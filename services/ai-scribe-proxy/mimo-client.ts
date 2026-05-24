import type { AiProxyConfig } from "./config.js";

export interface MimoChatMessage {
  role: "system" | "developer" | "user" | "assistant";
  content: string;
}

export interface MimoChatResult {
  content: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
  };
}

export interface MimoChatStreamDelta {
  type: "delta";
  delta: string;
}

interface MimoResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
}

interface MimoStreamResponse {
  choices?: Array<{
    delta?: {
      content?: unknown;
    };
  }>;
}

export async function requestMimoChatCompletion(
  config: AiProxyConfig,
  messages: MimoChatMessage[],
  fetcher: typeof fetch = fetch
): Promise<MimoChatResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetcher(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": config.apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.modelId,
        messages,
        stream: false,
        thinking: { type: "disabled" },
        temperature: 0.8,
        max_completion_tokens: config.maxCompletionTokens
      })
    });

    if (!response.ok) {
      throw new Error(`MiMo request failed with status ${response.status}.`);
    }

    return parseMimoResponse((await response.json()) as MimoResponse);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("MiMo request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function* requestMimoChatCompletionStream(
  config: AiProxyConfig,
  messages: MimoChatMessage[],
  fetcher: typeof fetch = fetch
): AsyncIterable<MimoChatStreamDelta> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetcher(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": config.apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.modelId,
        messages,
        stream: true,
        thinking: { type: "disabled" },
        temperature: 0.8,
        max_completion_tokens: config.maxCompletionTokens
      })
    });

    if (!response.ok) {
      throw new Error(`MiMo request failed with status ${response.status}.`);
    }

    if (response.body === null) {
      throw new Error("MiMo response did not include a usable stream.");
    }

    let streamCompleted = false;

    for await (const payload of parseSseData(response.body)) {
      if (payload === "[DONE]") {
        streamCompleted = true;
        break;
      }

      let parsed: MimoStreamResponse;

      try {
        parsed = JSON.parse(payload) as MimoStreamResponse;
      } catch {
        throw new Error("MiMo stream response could not be parsed.");
      }

      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === "string" && content.length > 0) {
        yield { type: "delta", delta: content };
      }
    }

    if (!streamCompleted) {
      throw new Error("MiMo stream ended before completion.");
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("MiMo request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseMimoResponse(payload: MimoResponse): MimoChatResult {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("MiMo response did not include usable message content.");
  }

  return {
    content: content.trim(),
    usage: {
      promptTokens: typeof payload.usage?.prompt_tokens === "number" ? payload.usage.prompt_tokens : null,
      completionTokens: typeof payload.usage?.completion_tokens === "number" ? payload.usage.completion_tokens : null
    }
  };
}

async function* parseSseData(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffered += decoder.decode(value, { stream: true });
      let newlineIndex = buffered.indexOf("\n");

      while (newlineIndex >= 0) {
        const rawLine = buffered.slice(0, newlineIndex);
        buffered = buffered.slice(newlineIndex + 1);
        const data = parseSseDataLine(rawLine);

        if (data !== undefined) {
          yield data;
        }

        newlineIndex = buffered.indexOf("\n");
      }
    }

    buffered += decoder.decode();

    if (buffered.length > 0) {
      const data = parseSseDataLine(buffered);

      if (data !== undefined) {
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseDataLine(rawLine: string): string | undefined {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

  if (line.length === 0 || line.startsWith(":") || !line.startsWith("data:")) {
    return undefined;
  }

  return line.slice("data:".length).trimStart();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

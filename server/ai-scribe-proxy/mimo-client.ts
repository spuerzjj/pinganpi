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
        temperature: 0.8,
        max_completion_tokens: 900
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
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

type MimoFetch = (url: string, init: RequestInit) => Promise<MimoFetchResponse>;

interface MimoFetchResponse {
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
  json: () => Promise<unknown>;
}

export async function requestMimoChatCompletion(
  config: AiProxyConfig,
  messages: MimoChatMessage[],
  fetcher: MimoFetch = resolveFetch()
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
  fetcher: MimoFetch = resolveFetch()
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

function resolveFetch(): MimoFetch {
  const fetcher = globalThis.fetch;

  if (typeof fetcher === "function") {
    return fetcher.bind(globalThis) as MimoFetch;
  }

  return requestWithNodeHttp;
}

function requestWithNodeHttp(urlValue: string, init: RequestInit): Promise<MimoFetchResponse> {
  const url = new URL(urlValue);
  const body = readBodyString(init.body);
  const headers = normalizeHeaders(init.headers);
  const request = url.protocol === "https:" ? requestHttps : requestHttp;

  if (body.length > 0 && !hasHeader(headers, "content-length")) {
    headers["content-length"] = String(Buffer.byteLength(body));
  }

  return new Promise((resolve, reject) => {
    const requestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: init.method ?? "GET",
      headers
    };
    const clientRequest = request(requestOptions, (response) => {
      const chunks: Buffer[] = [];

      response.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const status = response.statusCode ?? 0;

        resolve({
          ok: status >= 200 && status < 300,
          status,
          body: null,
          json: async () => JSON.parse(text)
        });
      });
    });

    clientRequest.on("error", reject);

    const signal = init.signal;

    if (signal !== undefined && signal !== null) {
      if (signal.aborted) {
        clientRequest.destroy(new DOMException("aborted", "AbortError"));
        return;
      }

      signal.addEventListener(
        "abort",
        () => {
          clientRequest.destroy(new DOMException("aborted", "AbortError"));
        },
        { once: true }
      );
    }

    if (body.length > 0) {
      clientRequest.write(body);
    }

    clientRequest.end();
  });
}

function normalizeHeaders(headers: RequestInit["headers"]): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers === undefined) {
    return result;
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
    return result;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalizedName = name.toLowerCase();

  return Object.keys(headers).some((key) => key.toLowerCase() === normalizedName);
}

function readBodyString(body: RequestInit["body"]): string {
  if (body === undefined || body === null) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body).toString("utf8");
  }

  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString("utf8");
  }

  throw new Error("Unsupported MiMo request body type.");
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
  return typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError";
}

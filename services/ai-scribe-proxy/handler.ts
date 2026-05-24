import type { AiProxyConfig } from "./config.js";
import {
  requestMimoChatCompletion,
  requestMimoChatCompletionStream,
  type MimoChatMessage,
  type MimoChatResult,
  type MimoChatStreamDelta
} from "./mimo-client.js";
import { buildScribeMessages, type AiScribeProxyRequest } from "./prompt.js";

const MAX_BODY_BYTES = 32768;

export type CompletionRequester = (
  config: AiProxyConfig,
  messages: MimoChatMessage[]
) => Promise<MimoChatResult>;

export type StreamingCompletionRequester = (
  config: AiProxyConfig,
  messages: MimoChatMessage[]
) => AsyncIterable<MimoChatStreamDelta>;

export interface AiProxyHandlerRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
  allowMissingOrigin?: boolean;
}

export interface AiProxyHandlerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface AiProxyStreamHandlerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: AsyncIterable<string> | string;
}

export async function handleAiProxyRequest(
  config: AiProxyConfig,
  request: AiProxyHandlerRequest,
  requestCompletion: CompletionRequester = requestMimoChatCompletion
): Promise<AiProxyHandlerResponse> {
  const pathname = normalizeAiProxyPathname(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
  const origin = readHeader(request.headers, "origin");

  if (pathname !== "/health" && !isAllowedOrigin(origin, request.allowMissingOrigin ?? true)) {
    return jsonResponse(
      403,
      {
        ok: false,
        reason: "origin_forbidden",
        message: "AI proxy only accepts local development origins."
      },
      origin
    );
  }

  if (request.method === "OPTIONS") {
    return emptyResponse(204, origin);
  }

  if (request.method === "GET" && pathname === "/health") {
    return jsonResponse(200, { ok: true }, origin);
  }

  if (request.method !== "POST" || pathname !== "/ai/scribe-draft") {
    return jsonResponse(404, { ok: false, reason: "not_found" }, origin);
  }

  try {
    const input = parseProxyRequest(readJsonBody(request.body ?? ""), config);
    const startedAt = Date.now();
    const result = await requestCompletion(config, buildScribeMessages(input));

    return jsonResponse(
      200,
      {
        ok: true,
        scribeDraft: result.content,
        readAloudText: result.content,
        signature: input.senderSignature,
        generationMeta: {
          engine: "ai-scribe-v1",
          provider: "xiaomi-mimo",
          model: config.modelId,
          promptVersion: "ai-scribe-prompt-v1",
          latencyMs: Date.now() - startedAt,
          usage: result.usage
        }
      },
      origin
    );
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonResponse(
        413,
        {
          ok: false,
          reason: "request_too_large",
          message: error.message
        },
        origin
      );
    }

    if (error instanceof ProxyRequestError) {
      return jsonResponse(
        400,
        {
          ok: false,
          reason: "invalid_request",
          message: error.message
        },
        origin
      );
    }

    return jsonResponse(
      502,
      {
        ok: false,
        reason: "provider_error",
        message: "AI provider request failed."
      },
      origin
    );
  }
}

export async function handleAiProxyStreamRequest(
  config: AiProxyConfig,
  request: AiProxyHandlerRequest,
  requestStreamingCompletion: StreamingCompletionRequester = requestMimoChatCompletionStream
): Promise<AiProxyStreamHandlerResponse> {
  const pathname = normalizeAiProxyPathname(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
  const origin = readHeader(request.headers, "origin");

  if (pathname !== "/health" && !isAllowedOrigin(origin, request.allowMissingOrigin ?? true)) {
    return jsonResponse(
      403,
      {
        ok: false,
        reason: "origin_forbidden",
        message: "AI proxy only accepts local development origins."
      },
      origin
    );
  }

  if (request.method !== "POST" || pathname !== "/ai/scribe-draft/stream") {
    return jsonResponse(404, { ok: false, reason: "not_found" }, origin);
  }

  let input: AiScribeProxyRequest;

  try {
    input = parseProxyRequest(readJsonBody(request.body ?? ""), config);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonResponse(
        413,
        {
          ok: false,
          reason: "request_too_large",
          message: error.message
        },
        origin
      );
    }

    if (error instanceof ProxyRequestError) {
      return jsonResponse(
        400,
        {
          ok: false,
          reason: "invalid_request",
          message: error.message
        },
        origin
      );
    }

    return jsonResponse(
      400,
      {
        ok: false,
        reason: "invalid_request",
        message: "Request body is invalid."
      },
      origin
    );
  }

  const startedAt = Date.now();
  const messages = buildScribeMessages(input);

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders(origin),
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    },
    body: streamScribeDraftEvents(config, input, messages, startedAt, requestStreamingCompletion)
  };
}

export function createProxyUnavailableResponse(
  headers: Record<string, string | string[] | undefined>,
  message = "AI proxy is not configured."
): AiProxyHandlerResponse {
  return jsonResponse(
    502,
    {
      ok: false,
      reason: "proxy_unavailable",
      message
    },
    readHeader(headers, "origin")
  );
}

export function shouldHandleAiProxyStreamRequest(method: string | undefined, url: string | undefined): boolean {
  const pathname = normalizeAiProxyPathname(new URL(url ?? "/", "http://127.0.0.1").pathname);

  return method === "POST" && pathname === "/ai/scribe-draft/stream";
}

export function normalizeAiProxyPathname(pathname: string): string {
  if (pathname === "/api") {
    return "/";
  }

  if (pathname.startsWith("/api/")) {
    return pathname.slice(4);
  }

  return pathname;
}

async function* streamScribeDraftEvents(
  config: AiProxyConfig,
  input: AiScribeProxyRequest,
  messages: MimoChatMessage[],
  startedAt: number,
  requestStreamingCompletion: StreamingCompletionRequester
): AsyncIterable<string> {
  let draft = "";

  try {
    for await (const event of requestStreamingCompletion(config, messages)) {
      draft += event.delta;
      yield sseEvent("delta", {
        delta: event.delta,
        text: draft
      });
    }

    if (draft.trim().length === 0) {
      yield sseEvent("error", {
        ok: false,
        reason: "invalid_response",
        message: "AI provider returned no usable draft text."
      });
      return;
    }

    yield sseEvent("done", {
      ok: true,
      scribeDraft: draft,
      readAloudText: draft,
      signature: input.senderSignature,
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        model: config.modelId,
        promptVersion: "ai-scribe-prompt-v1",
        latencyMs: Date.now() - startedAt,
        usage: { promptTokens: null, completionTokens: null }
      }
    });
  } catch {
    yield sseEvent("error", {
      ok: false,
      reason: "provider_error",
      message: "AI provider request failed."
    });
  }
}

function sseEvent(event: "delta" | "done" | "error", data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function readJsonBody(body: string): unknown {
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    throw new RequestTooLargeError(`Request body must be ${MAX_BODY_BYTES} bytes or fewer.`);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ProxyRequestError("Request body must be valid JSON.");
  }
}

function parseProxyRequest(value: unknown, config: AiProxyConfig): AiScribeProxyRequest {
  if (!isRecord(value)) {
    throw new ProxyRequestError("Request body must be an object.");
  }

  const oralText = readString(value, "oralText");

  if (oralText.length > config.maxOralTextChars) {
    throw new ProxyRequestError(`oralText must be ${config.maxOralTextChars} characters or fewer.`);
  }

  return {
    oralText,
    scribeName: readString(value, "scribeName"),
    scribeStyle: readString(value, "scribeStyle"),
    senderGreeting: readString(value, "senderGreeting"),
    senderSignature: readString(value, "senderSignature"),
    senderCity: readString(value, "senderCity"),
    recipientCity: readString(value, "recipientCity"),
    letterType: readLetterType(value.letterType)
  };
}

function readLetterType(value: unknown): "ordinary" | "registered" {
  if (value === "ordinary" || value === "registered") {
    return value;
  }

  throw new ProxyRequestError("letterType must be ordinary or registered.");
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProxyRequestError(`${key} must be a non-empty string.`);
  }

  return value.trim();
}

function jsonResponse(statusCode: number, body: unknown, origin?: string): AiProxyHandlerResponse {
  return {
    statusCode,
    headers: {
      ...corsHeaders(origin),
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function emptyResponse(statusCode: number, origin?: string): AiProxyHandlerResponse {
  return {
    statusCode,
    headers: corsHeaders(origin),
    body: ""
  };
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };

  if (origin === undefined) {
    return {
      ...headers,
      "access-control-allow-origin": "*"
    };
  }

  if (isAllowedOrigin(origin, true)) {
    return {
      ...headers,
      "access-control-allow-origin": origin
    };
  }

  return headers;
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isAllowedOrigin(origin: string | undefined, allowMissingOrigin: boolean): boolean {
  if (origin === undefined) {
    return allowMissingOrigin;
  }

  try {
    const url = new URL(origin);

    if ((url.protocol === "capacitor:" || url.protocol === "ionic:") && url.hostname === "localhost") {
      return true;
    }

    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class ProxyRequestError extends Error {}

class RequestTooLargeError extends Error {}

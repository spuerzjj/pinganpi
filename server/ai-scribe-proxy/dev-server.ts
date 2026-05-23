import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readAiProxyConfig, type AiProxyConfig } from "./config.js";
import { requestMimoChatCompletion, type MimoChatMessage, type MimoChatResult } from "./mimo-client.js";
import { buildScribeMessages, type AiScribeProxyRequest } from "./prompt.js";

export type CompletionRequester = (
  config: AiProxyConfig,
  messages: MimoChatMessage[]
) => Promise<MimoChatResult>;

export function createAiProxyServer(
  config: AiProxyConfig,
  requestCompletion: CompletionRequester = requestMimoChatCompletion
): Server {
  return createServer((request, response) => {
    void handleRequest(config, requestCompletion, request, response);
  });
}

if (isMainModule()) {
  const config = readAiProxyConfig(process.env);
  const server = createAiProxyServer(config);

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`Pinganpi AI proxy listening on http://127.0.0.1:${config.port}`);
  });
}

async function handleRequest(
  config: AiProxyConfig,
  requestCompletion: CompletionRequester,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

  if (request.method === "OPTIONS") {
    sendEmpty(response, 204);
    return;
  }

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || pathname !== "/ai/scribe-draft") {
    sendJson(response, 404, { ok: false, reason: "not_found" });
    return;
  }

  try {
    const input = parseProxyRequest(await readJsonBody(request));
    const startedAt = Date.now();
    const result = await requestCompletion(config, buildScribeMessages(input));

    sendJson(response, 200, {
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
    });
  } catch (error) {
    if (error instanceof ProxyRequestError) {
      sendJson(response, 400, {
        ok: false,
        reason: "invalid_request",
        message: error.message
      });
      return;
    }

    sendJson(response, 502, {
      ok: false,
      reason: "provider_error",
      message: error instanceof Error ? error.message : "AI provider request failed."
    });
  }
}

function parseProxyRequest(value: unknown): AiScribeProxyRequest {
  if (!isRecord(value)) {
    throw new ProxyRequestError("Request body must be an object.");
  }

  return {
    oralText: readString(value, "oralText"),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ProxyRequestError("Request body must be valid JSON.");
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, corsHeaders());
  response.end();
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function isMainModule(): boolean {
  const entry = process.argv[1];

  if (entry === undefined) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

class ProxyRequestError extends Error {}

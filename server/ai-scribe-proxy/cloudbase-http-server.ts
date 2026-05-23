import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readAiProxyConfig, type AiProxyConfig } from "./config.js";
import {
  createProxyUnavailableResponse,
  handleAiProxyRequest,
  normalizeAiProxyPathname,
  type CompletionRequester
} from "./handler.js";
import { requestMimoChatCompletion } from "./mimo-client.js";

export type ConfigReader = (method: string, url: string) => AiProxyConfig;

export function createCloudBaseHttpServer(
  readConfig: ConfigReader = readRuntimeConfig,
  requestCompletion: CompletionRequester = requestMimoChatCompletion
): Server {
  return createServer((request, response) => {
    void handleNodeRequest(readConfig, requestCompletion, request, response);
  });
}

async function handleNodeRequest(
  readConfig: ConfigReader,
  requestCompletion: CompletionRequester,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const method = request.method ?? "GET";
  const url = request.url ?? "/";
  const body = await readTextBody(request);

  let config: AiProxyConfig;

  try {
    config = readConfig(method, url);
  } catch {
    const unavailableResponse = createProxyUnavailableResponse(request.headers);
    response.writeHead(unavailableResponse.statusCode, unavailableResponse.headers);
    response.end(unavailableResponse.body);
    return;
  }

  const handlerResponse = await handleAiProxyRequest(
    config,
    {
      method,
      url,
      headers: request.headers,
      body,
      allowMissingOrigin: false
    },
    requestCompletion
  );

  response.writeHead(handlerResponse.statusCode, handlerResponse.headers);
  response.end(handlerResponse.body);
}

function readRuntimeConfig(method: string, url: string): AiProxyConfig {
  if (isConfigFreeRequest(method, url)) {
    return {
      baseUrl: "https://example.invalid",
      modelId: "health-check",
      apiKey: "health-check",
      port: 8787,
      requestTimeoutMs: 30000,
      maxOralTextChars: 800,
      maxCompletionTokens: 900
    };
  }

  return readAiProxyConfig(process.env);
}

function isConfigFreeRequest(method: string, url: string): boolean {
  const pathname = normalizeAiProxyPathname(new URL(url, "http://127.0.0.1").pathname);

  return (method === "GET" && pathname === "/health") || method === "OPTIONS";
}

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
  }

  return Buffer.concat(chunks).toString("utf8");
}

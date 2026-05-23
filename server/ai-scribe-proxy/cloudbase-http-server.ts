import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readAiProxyConfig, type AiProxyConfig } from "./config.js";
import {
  createProxyUnavailableResponse,
  handleAiProxyRequest,
  handleAiProxyStreamRequest,
  normalizeAiProxyPathname,
  shouldHandleAiProxyStreamRequest,
  type CompletionRequester,
  type StreamingCompletionRequester
} from "./handler.js";
import { requestMimoChatCompletion, requestMimoChatCompletionStream } from "./mimo-client.js";

export type ConfigReader = (method: string, url: string) => AiProxyConfig;

export function createCloudBaseHttpServer(
  readConfig: ConfigReader = readRuntimeConfig,
  requestCompletion: CompletionRequester = requestMimoChatCompletion,
  requestStreamingCompletion: StreamingCompletionRequester = requestMimoChatCompletionStream
): Server {
  return createServer((request, response) => {
    void handleNodeRequest(readConfig, requestCompletion, requestStreamingCompletion, request, response);
  });
}

async function handleNodeRequest(
  readConfig: ConfigReader,
  requestCompletion: CompletionRequester,
  requestStreamingCompletion: StreamingCompletionRequester,
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
    await writeHandlerResponse(
      response,
      unavailableResponse.statusCode,
      unavailableResponse.headers,
      unavailableResponse.body
    );
    return;
  }

  if (shouldHandleAiProxyStreamRequest(method, url)) {
    const handlerResponse = await handleAiProxyStreamRequest(
      config,
      {
        method,
        url,
        headers: request.headers,
        body,
        allowMissingOrigin: false
      },
      requestStreamingCompletion
    );

    await writeHandlerResponse(response, handlerResponse.statusCode, handlerResponse.headers, handlerResponse.body);
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

  await writeHandlerResponse(response, handlerResponse.statusCode, handlerResponse.headers, handlerResponse.body);
}

async function writeHandlerResponse(
  response: ServerResponse,
  statusCode: number,
  headers: Record<string, string>,
  body: AsyncIterable<string> | string
): Promise<void> {
  response.writeHead(statusCode, headers);

  if (typeof body === "string") {
    response.end(body);
    return;
  }

  for await (const chunk of body) {
    response.write(chunk);
  }

  response.end();
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

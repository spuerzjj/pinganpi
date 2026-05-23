import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readAiProxyConfig, type AiProxyConfig } from "./config.js";
import {
  handleAiProxyRequest,
  handleAiProxyStreamRequest,
  shouldHandleAiProxyStreamRequest,
  type CompletionRequester,
  type StreamingCompletionRequester
} from "./handler.js";
import { requestMimoChatCompletion, requestMimoChatCompletionStream } from "./mimo-client.js";

export type { CompletionRequester, StreamingCompletionRequester } from "./handler.js";

export function createAiProxyServer(
  config: AiProxyConfig,
  requestCompletion: CompletionRequester = requestMimoChatCompletion,
  requestStreamingCompletion: StreamingCompletionRequester = requestMimoChatCompletionStream
): Server {
  return createServer((request, response) => {
    void handleNodeRequest(config, requestCompletion, requestStreamingCompletion, request, response);
  });
}

if (isMainModule()) {
  const config = readAiProxyConfig(process.env);
  const server = createAiProxyServer(config);

  server.listen(config.port, "127.0.0.1", () => {
    console.log(`Pinganpi AI proxy listening on http://127.0.0.1:${config.port}`);
  });
}

async function handleNodeRequest(
  config: AiProxyConfig,
  requestCompletion: CompletionRequester,
  requestStreamingCompletion: StreamingCompletionRequester,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const method = request.method ?? "GET";
  const url = request.url ?? "/";
  const body = await readTextBody(request);
  if (shouldHandleAiProxyStreamRequest(method, url)) {
    const handlerResponse = await handleAiProxyStreamRequest(
      config,
      {
        method,
        url,
        headers: request.headers,
        body
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
      body
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

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isMainModule(): boolean {
  const entry = process.argv[1];

  if (entry === undefined) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

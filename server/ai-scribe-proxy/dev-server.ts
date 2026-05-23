import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readAiProxyConfig, type AiProxyConfig } from "./config.js";
import { handleAiProxyRequest, type CompletionRequester } from "./handler.js";
import { requestMimoChatCompletion } from "./mimo-client.js";

export type { CompletionRequester } from "./handler.js";

export function createAiProxyServer(
  config: AiProxyConfig,
  requestCompletion: CompletionRequester = requestMimoChatCompletion
): Server {
  return createServer((request, response) => {
    void handleNodeRequest(config, requestCompletion, request, response);
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
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const handlerResponse = await handleAiProxyRequest(
    config,
    {
      method: request.method ?? "GET",
      url: request.url ?? "/",
      headers: request.headers,
      body: await readTextBody(request)
    },
    requestCompletion
  );

  response.writeHead(handlerResponse.statusCode, handlerResponse.headers);
  response.end(handlerResponse.body);
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

import { readAiProxyConfig, type AiProxyConfig } from "./config.js";
import {
  createProxyUnavailableResponse,
  handleAiProxyRequest,
  normalizeAiProxyPathname,
  type AiProxyHandlerResponse,
  type CompletionRequester
} from "./handler.js";
import { requestMimoChatCompletion } from "./mimo-client.js";

export interface CloudBaseHttpEvent {
  httpMethod?: string;
  method?: string;
  path?: string;
  rawPath?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
    path?: string;
  };
}

export interface CloudBaseHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: false;
}

export async function main(event: CloudBaseHttpEvent): Promise<CloudBaseHttpResponse> {
  try {
    return handleCloudBaseHttpEvent(readRuntimeConfig(event), event, requestMimoChatCompletion);
  } catch {
    return toCloudBaseResponse(createProxyUnavailableResponse(event.headers ?? {}));
  }
}

export async function handleCloudBaseHttpEvent(
  config: AiProxyConfig,
  event: CloudBaseHttpEvent,
  requestCompletion: CompletionRequester = requestMimoChatCompletion
): Promise<CloudBaseHttpResponse> {
  const response = await handleAiProxyRequest(
    config,
    {
      method: readMethod(event),
      url: readPath(event),
      headers: event.headers ?? {},
      body: readBody(event),
      allowMissingOrigin: false
    },
    requestCompletion
  );

  return toCloudBaseResponse(response);
}

function toCloudBaseResponse(response: AiProxyHandlerResponse): CloudBaseHttpResponse {
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    isBase64Encoded: false
  };
}

function readMethod(event: CloudBaseHttpEvent): string {
  return event.httpMethod ?? event.method ?? event.requestContext?.http?.method ?? "GET";
}

function readPath(event: CloudBaseHttpEvent): string {
  return event.path ?? event.rawPath ?? event.requestContext?.http?.path ?? event.requestContext?.path ?? "/";
}

function readBody(event: CloudBaseHttpEvent): string {
  if (event.body === undefined) {
    return "";
  }

  if (event.isBase64Encoded === true) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }

  return event.body;
}

function readRuntimeConfig(event: CloudBaseHttpEvent): AiProxyConfig {
  if (isConfigFreeRequest(event)) {
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

function isConfigFreeRequest(event: CloudBaseHttpEvent): boolean {
  const method = readMethod(event);
  const path = normalizeAiProxyPathname(readPath(event));

  return (method === "GET" && path === "/health") || method === "OPTIONS";
}

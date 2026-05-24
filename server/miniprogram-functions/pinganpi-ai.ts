import { readAiProxyConfig, type AiProxyConfig, type EnvSource } from "../ai-scribe-proxy/config.js";
import { handleAiProxyRequest, type CompletionRequester } from "../ai-scribe-proxy/handler.js";
import { requestMimoChatCompletion } from "../ai-scribe-proxy/mimo-client.js";
import {
  isRecord,
  miniFail,
  miniOk,
  readMiniAction,
  type PinganpiMiniFunctionEvent,
  type PinganpiMiniFunctionResult
} from "./result.js";

export interface PinganpiAiEventOptions {
  config?: AiProxyConfig;
  env?: EnvSource;
  requestCompletion?: CompletionRequester;
}

export async function main(event: PinganpiMiniFunctionEvent): Promise<PinganpiMiniFunctionResult> {
  return handlePinganpiAiEvent(event);
}

export async function handlePinganpiAiEvent(
  event: PinganpiMiniFunctionEvent,
  options: PinganpiAiEventOptions = {}
): Promise<PinganpiMiniFunctionResult> {
  const action = readMiniAction(event);

  if (action === "health") {
    return miniOk(action, { ok: true });
  }

  if (action !== "scribeDraft") {
    return miniFail(action, "not_found", "Unknown miniprogram AI action.", 404);
  }

  const configResult = readConfig(options);

  if (!configResult.ok) {
    return miniFail(action, "proxy_unavailable", "AI proxy is not configured.", 502);
  }

  const response = await handleAiProxyRequest(
    configResult.config,
    {
      method: "POST",
      url: "/ai/scribe-draft",
      headers: {},
      body: JSON.stringify(event.payload ?? {}),
      allowMissingOrigin: true
    },
    options.requestCompletion ?? requestMimoChatCompletion
  );
  const body = parseJsonBody(response.body);

  if (response.statusCode === 200) {
    return miniOk(action, body);
  }

  return miniFail(
    action,
    readStringProperty(body, "reason") ?? "request_failed",
    readStringProperty(body, "message") ?? "AI proxy request failed.",
    response.statusCode
  );
}

function readConfig(options: PinganpiAiEventOptions): { ok: true; config: AiProxyConfig } | { ok: false } {
  if (options.config !== undefined) {
    return { ok: true, config: options.config };
  }

  try {
    return { ok: true, config: readAiProxyConfig(options.env ?? process.env) };
  } catch {
    return { ok: false };
  }
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return {};
  }
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];

  return typeof property === "string" && property.length > 0 ? property : undefined;
}

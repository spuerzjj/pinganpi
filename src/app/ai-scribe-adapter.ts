import type { Scribe } from "../domain/index.js";
import type { MemberProfile } from "./mock-data.js";
import type { LetterType, ScribeDraftResult } from "./scribe-template-engine.js";

export type AiScribeDraftErrorCode =
  | "network_unavailable"
  | "proxy_unavailable"
  | "provider_timeout"
  | "quota_exceeded"
  | "invalid_response"
  | "provider_error";

export class AiScribeDraftError extends Error {
  constructor(
    public readonly code: AiScribeDraftErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AiScribeDraftError";
  }
}

export interface AiScribeDraftInput {
  oralText: string;
  scribe: Scribe;
  sender: MemberProfile;
  recipient: MemberProfile;
  senderCity: string;
  recipientCity: string;
  letterType: LetterType;
  sceneTags: string[];
}

export interface AiScribeStreamHandlers {
  onDelta?: (delta: string, text: string) => void;
  signal?: AbortSignal;
}

export interface AiScribeAdapter {
  generateDraft(input: AiScribeDraftInput): Promise<ScribeDraftResult>;
  generateDraftStream?(input: AiScribeDraftInput, handlers?: AiScribeStreamHandlers): Promise<ScribeDraftResult>;
}

export interface CreateHttpAiScribeAdapterInput {
  proxyUrl: string;
  fetcher?: typeof fetch;
}

interface ProxySuccessResponse {
  ok: true;
  scribeDraft: unknown;
  readAloudText?: unknown;
  signature: unknown;
  generationMeta: {
    engine?: unknown;
    provider?: unknown;
    model?: unknown;
    promptVersion?: unknown;
    latencyMs?: unknown;
  };
}

interface ProxyFailureResponse {
  ok: false;
  reason?: unknown;
  message?: unknown;
}

interface StreamDeltaResponse {
  delta: unknown;
  text: unknown;
}

const scribeStyleText: Record<Scribe["style"], string> = {
  street: "街口代书",
  "old-scholar": "老先生",
  schoolmaster: "乡塾先生",
  clerk: "账房文书"
};

export function createHttpAiScribeAdapter(input: CreateHttpAiScribeAdapterInput): AiScribeAdapter {
  const proxyUrl = input.proxyUrl.replace(/\/+$/u, "");
  const fetcher = input.fetcher ?? fetch;

  return {
    async generateDraft(draftInput) {
      let response: Response;

      try {
        response = await fetcher(`${proxyUrl}/ai/scribe-draft`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(createProxyRequestBody(draftInput))
        });
      } catch {
        throw new AiScribeDraftError("network_unavailable", "AI 代理暂时不可用。");
      }

      const payload = await readProxyPayload(response);

      if (!response.ok) {
        throw proxyFailureToError(payload);
      }

      if (!isProxySuccessResponse(payload)) {
        throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法使用的起稿结果。");
      }

      return mapProxySuccessToDraftResult(draftInput, payload);
    },

    async generateDraftStream(draftInput, handlers) {
      let response: Response;
      const requestInit: RequestInit = {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(createProxyRequestBody(draftInput))
      };

      if (handlers?.signal !== undefined) {
        requestInit.signal = handlers.signal;
      }

      try {
        response = await fetcher(`${proxyUrl}/ai/scribe-draft/stream`, requestInit);
      } catch {
        throw new AiScribeDraftError("network_unavailable", "AI 代理暂时不可用。");
      }

      if (!response.ok) {
        const payload = await readProxyPayload(response);
        throw proxyFailureToError(payload);
      }

      if (response.body === null) {
        throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法解析的流式结果。");
      }

      const donePayload = await readSseDraftStream(response.body, handlers);

      if (!isProxySuccessResponse(donePayload)) {
        throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法使用的起稿结果。");
      }

      return mapProxySuccessToDraftResult(draftInput, donePayload);
    }
  };
}

function createProxyRequestBody(draftInput: AiScribeDraftInput) {
  return {
    oralText: draftInput.oralText,
    scribeName: draftInput.scribe.name,
    scribeStyle: scribeStyleText[draftInput.scribe.style],
    senderGreeting: draftInput.sender.letterGreeting,
    senderSignature: draftInput.sender.signatureName,
    senderCity: draftInput.senderCity,
    recipientCity: draftInput.recipientCity,
    letterType: draftInput.letterType
  };
}

function mapProxySuccessToDraftResult(
  draftInput: AiScribeDraftInput,
  payload: ProxySuccessResponse & {
    scribeDraft: string;
    signature: string;
    generationMeta: {
      engine: "ai-scribe-v1";
      provider: string;
      model: string;
      promptVersion: string;
      latencyMs: number;
    };
  }
): ScribeDraftResult {
  const scribeDraft = payload.scribeDraft.trim();
  const readAloudText = typeof payload.readAloudText === "string" && payload.readAloudText.trim().length > 0 ? payload.readAloudText.trim() : scribeDraft;

  return {
    oralText: draftInput.oralText.trim(),
    scribeDraft,
    readAloudText,
    signature: payload.signature.trim(),
    draftSource: "ai",
    generationMeta: {
      engine: "ai-scribe-v1",
      provider: payload.generationMeta.provider.trim(),
      model: payload.generationMeta.model.trim(),
      promptVersion: payload.generationMeta.promptVersion.trim(),
      scribeId: draftInput.scribe.id,
      sceneTags: draftInput.sceneTags,
      letterType: draftInput.letterType,
      senderCity: draftInput.senderCity,
      recipientCity: draftInput.recipientCity,
      latencyMs: payload.generationMeta.latencyMs
    }
  };
}

async function readSseDraftStream(body: ReadableStream<Uint8Array>, handlers: AiScribeStreamHandlers | undefined): Promise<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const result = processSseBuffer(buffer, handlers);

      buffer = result.remaining;

      if (result.donePayload !== undefined) {
        return result.donePayload;
      }
    }

    buffer += decoder.decode();

    if (buffer.trim().length > 0) {
      const result = processSseBuffer(`${buffer}\n\n`, handlers);

      if (result.donePayload !== undefined) {
        return result.donePayload;
      }
    }
  } catch (error) {
    if (error instanceof AiScribeDraftError) {
      throw error;
    }

    throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法解析的流式结果。");
  } finally {
    reader.releaseLock();
  }

  throw new AiScribeDraftError("invalid_response", "AI 代理起稿流在完成前中断。");
}

function processSseBuffer(buffer: string, handlers: AiScribeStreamHandlers | undefined): { remaining: string; donePayload?: unknown } {
  const normalized = buffer.replace(/\r\n/gu, "\n");
  const blocks = normalized.split("\n\n");
  const remaining = blocks.pop() ?? "";

  for (const block of blocks) {
    const event = parseSseBlock(block);

    if (event === null) {
      continue;
    }

    const payload = parseSsePayload(event.data);

    if (event.event === "delta") {
      if (!isStreamDeltaResponse(payload)) {
        throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法解析的流式结果。");
      }

      handlers?.onDelta?.(payload.delta, payload.text);
      continue;
    }

    if (event.event === "done") {
      return { remaining, donePayload: payload };
    }

    if (event.event === "error") {
      throw proxyFailureToError(payload);
    }
  }

  return { remaining };
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.trim().length === 0 || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (event.length === 0 && dataLines.length === 0) {
    return null;
  }

  if (event.length === 0 || dataLines.length === 0) {
    throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法解析的流式结果。");
  }

  return {
    event,
    data: dataLines.join("\n")
  };
}

function parseSsePayload(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法解析的流式结果。");
  }
}

function isStreamDeltaResponse(value: unknown): value is StreamDeltaResponse & { delta: string; text: string } {
  return (
    isRecord(value) &&
    typeof value.delta === "string" &&
    typeof value.text === "string"
  );
}

async function readProxyPayload(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AiScribeDraftError("invalid_response", "AI 代理返回了无法解析的结果。");
  }
}

function proxyFailureToError(payload: unknown): AiScribeDraftError {
  if (!isProxyFailureResponse(payload)) {
    return new AiScribeDraftError("proxy_unavailable", "AI 代理暂时不可用。");
  }

  const code = normalizeErrorCode(payload.reason);
  const message = typeof payload.message === "string" && payload.message.trim().length > 0 ? payload.message.trim() : "AI 代理暂时不可用。";

  return new AiScribeDraftError(code, message);
}

function normalizeErrorCode(reason: unknown): AiScribeDraftErrorCode {
  if (
    reason === "network_unavailable" ||
    reason === "proxy_unavailable" ||
    reason === "provider_timeout" ||
    reason === "quota_exceeded" ||
    reason === "invalid_response" ||
    reason === "provider_error"
  ) {
    return reason;
  }

  return "provider_error";
}

function isProxySuccessResponse(value: unknown): value is ProxySuccessResponse & {
  scribeDraft: string;
  signature: string;
  generationMeta: {
    engine: "ai-scribe-v1";
    provider: string;
    model: string;
    promptVersion: string;
    latencyMs: number;
  };
} {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.generationMeta)) {
    return false;
  }

  return (
    typeof value.scribeDraft === "string" &&
    value.scribeDraft.trim().length > 0 &&
    (value.readAloudText === undefined || typeof value.readAloudText === "string") &&
    typeof value.signature === "string" &&
    value.signature.trim().length > 0 &&
    value.generationMeta.engine === "ai-scribe-v1" &&
    typeof value.generationMeta.provider === "string" &&
    value.generationMeta.provider.trim().length > 0 &&
    typeof value.generationMeta.model === "string" &&
    value.generationMeta.model.trim().length > 0 &&
    typeof value.generationMeta.promptVersion === "string" &&
    value.generationMeta.promptVersion.trim().length > 0 &&
    typeof value.generationMeta.latencyMs === "number" &&
    Number.isFinite(value.generationMeta.latencyMs) &&
    value.generationMeta.latencyMs >= 0
  );
}

function isProxyFailureResponse(value: unknown): value is ProxyFailureResponse {
  return isRecord(value) && value.ok === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

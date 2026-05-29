import { callPinganpiAi, PinganpiCloudFunctionError } from "./cloud-functions.js";

export const AI_SCRIBE_DRAFT_FAILURE_TEXT = "先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。";

export type MiniProgramLetterType = "ordinary" | "registered";

export interface MiniProgramAiScribeDraftInput {
  oralText: string;
  scribeName: string;
  scribeStyle: string;
  senderGreeting: string;
  senderSignature: string;
  senderCity: string;
  recipientCity: string;
  letterType: MiniProgramLetterType;
}

export interface MiniProgramAiScribeDraftResult {
  draftText: string;
  readAloudText: string;
  signature: string;
  generationMeta?: Record<string, unknown>;
}

export interface MiniProgramAiScribeCloudService {
  generateDraft(input: MiniProgramAiScribeDraftInput): Promise<MiniProgramAiScribeDraftResult>;
}

export interface MiniProgramAiScribeCloudServiceOptions {
  callAi?: (action: string, payload?: unknown) => Promise<unknown>;
}

export class MiniProgramAiScribeDraftError extends Error {
  override name = "MiniProgramAiScribeDraftError";

  readonly reason: string;
  readonly publicMessage: string;
  readonly originalError?: unknown;

  constructor(options: { reason: string; message?: string; originalError?: unknown }) {
    super(options.message ?? AI_SCRIBE_DRAFT_FAILURE_TEXT);
    Object.setPrototypeOf(this, MiniProgramAiScribeDraftError.prototype);
    this.reason = options.reason;
    this.publicMessage = AI_SCRIBE_DRAFT_FAILURE_TEXT;

    if (options.originalError !== undefined) {
      this.originalError = options.originalError;
    }
  }
}

export function createMiniProgramAiScribeCloudService(
  options: MiniProgramAiScribeCloudServiceOptions = {},
): MiniProgramAiScribeCloudService {
  const callAi = options.callAi ?? callPinganpiAi;

  return {
    async generateDraft(input) {
      try {
        const response = await callAi("scribeDraft", createScribeDraftPayload(input));

        return parseScribeDraftResponse(response);
      } catch (error) {
        if (error instanceof MiniProgramAiScribeDraftError) {
          throw error;
        }

        if (error instanceof PinganpiCloudFunctionError) {
          throw new MiniProgramAiScribeDraftError({
            reason: error.reason,
            originalError: error,
          });
        }

        throw new MiniProgramAiScribeDraftError({
          reason: "cloud_call_failed",
          originalError: error,
        });
      }
    },
  };
}

export function generateAiScribeDraft(input: MiniProgramAiScribeDraftInput): Promise<MiniProgramAiScribeDraftResult> {
  return createMiniProgramAiScribeCloudService().generateDraft(input);
}

function createScribeDraftPayload(input: MiniProgramAiScribeDraftInput): MiniProgramAiScribeDraftInput {
  return {
    oralText: input.oralText.trim(),
    scribeName: input.scribeName.trim(),
    scribeStyle: input.scribeStyle.trim(),
    senderGreeting: input.senderGreeting.trim(),
    senderSignature: input.senderSignature.trim(),
    senderCity: input.senderCity.trim(),
    recipientCity: input.recipientCity.trim(),
    letterType: input.letterType,
  };
}

function parseScribeDraftResponse(value: unknown): MiniProgramAiScribeDraftResult {
  if (!isRecord(value) || value.ok !== true) {
    throw new MiniProgramAiScribeDraftError({ reason: "malformed_response" });
  }

  const draftText = readNonEmptyString(value.scribeDraft);

  if (draftText === undefined) {
    throw new MiniProgramAiScribeDraftError({ reason: "malformed_response" });
  }

  const readAloudText = readNonEmptyString(value.readAloudText) ?? draftText;
  const signature = readNonEmptyString(value.signature) ?? "";
  const generationMeta = isRecord(value.generationMeta) ? value.generationMeta : undefined;

  return {
    draftText,
    readAloudText,
    signature,
    ...(generationMeta === undefined ? {} : { generationMeta }),
  };
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();

  return text.length > 0 ? text : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

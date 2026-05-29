import { describe, expect, it } from "vitest";
import { PinganpiCloudFunctionError } from "./cloud-functions.js";
import {
  createMiniProgramAiScribeCloudService,
  MiniProgramAiScribeDraftError,
  type MiniProgramAiScribeDraftInput,
} from "./ai-scribe-cloud.js";

const baseInput: MiniProgramAiScribeDraftInput = {
  oralText: "近来天阴，问她可安。",
  scribeName: "许鹤年",
  scribeStyle: "旧塾文气",
  senderGreeting: "兰卿",
  senderSignature: "阿周",
  senderCity: "杭州",
  recipientCity: "西安",
  letterType: "ordinary",
};

describe("miniprogram AI scribe cloud service", () => {
  it("calls the AI cloud function and maps scribeDraft to draftText", async () => {
    const calls: Array<{ action: string; payload?: unknown }> = [];
    const service = createMiniProgramAiScribeCloudService({
      async callAi(action, payload) {
        calls.push({ action, payload });

        return {
          ok: true,
          scribeDraft: "兰卿：近来天阴，望你安好。",
          readAloudText: "兰卿：近来天阴，望你安好。",
          signature: "阿周",
          generationMeta: {
            engine: "ai-scribe-v1",
            provider: "xiaomi-mimo",
            promptVersion: "ai-scribe-prompt-v1",
          },
        };
      },
    });

    await expect(service.generateDraft(baseInput)).resolves.toEqual({
      draftText: "兰卿：近来天阴，望你安好。",
      readAloudText: "兰卿：近来天阴，望你安好。",
      signature: "阿周",
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        promptVersion: "ai-scribe-prompt-v1",
      },
    });
    expect(calls).toEqual([
      {
        action: "scribeDraft",
        payload: baseInput,
      },
    ]);
  });

  it("normalizes cloud function failures to a controlled draft error", async () => {
    const service = createMiniProgramAiScribeCloudService({
      async callAi() {
        throw new PinganpiCloudFunctionError({
          functionName: "pinganpi-ai",
          action: "scribeDraft",
          reason: "proxy_unavailable",
          message: "AI 代理暂不可用。",
          statusCode: 502,
        });
      },
    });

    await expect(service.generateDraft(baseInput)).rejects.toMatchObject({
      name: "MiniProgramAiScribeDraftError",
      reason: "proxy_unavailable",
      publicMessage: "先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。",
    });
  });

  it("rejects malformed AI responses before entering the revise step", async () => {
    const service = createMiniProgramAiScribeCloudService({
      async callAi() {
        return {
          ok: true,
          scribeDraft: "   ",
          generationMeta: {
            engine: "ai-scribe-v1",
          },
        };
      },
    });

    await expect(service.generateDraft(baseInput)).rejects.toBeInstanceOf(MiniProgramAiScribeDraftError);
    await expect(service.generateDraft(baseInput)).rejects.toMatchObject({
      reason: "malformed_response",
      publicMessage: "先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。",
    });
  });
});

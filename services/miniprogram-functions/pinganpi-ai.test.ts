import { describe, expect, it } from "vitest";
import type { AiProxyConfig } from "../ai-scribe-proxy/config.js";
import type { CompletionRequester } from "../ai-scribe-proxy/handler.js";
import { handlePinganpiAiEvent } from "./pinganpi-ai.js";

const config: AiProxyConfig = {
  baseUrl: "https://api.xiaomimimo.com/v1",
  modelId: "mimo-v2.5-pro",
  apiKey: "tp-test-key",
  port: 8787,
  requestTimeoutMs: 30000,
  maxOralTextChars: 800,
  maxCompletionTokens: 900
};

describe("pinganpi AI miniprogram function", () => {
  it("serves health without MiMo env", async () => {
    await expect(handlePinganpiAiEvent({ action: "health" }, { env: {} })).resolves.toEqual({
      ok: true,
      action: "health",
      data: { ok: true }
    });
  });

  it("generates a scribe draft through the existing AI handler", async () => {
    const response = await handlePinganpiAiEvent(
      {
        action: "scribeDraft",
        payload: {
          oralText: "请替我问她近来安好。",
          scribeName: "陈启明",
          scribeStyle: "语气温和，字句端正",
          senderGreeting: "兰卿",
          senderSignature: "阿平",
          senderCity: "广州",
          recipientCity: "上海",
          letterType: "ordinary"
        }
      },
      {
        config,
        requestCompletion: async (_config, messages) => {
          expect(messages[0]?.content).toContain("代笔先生");
          expect(messages[1]?.content).toContain("口述：请替我问她近来安好。");

          return {
            content: "兰卿：见字如晤。近来安好否。",
            usage: { promptTokens: 21, completionTokens: 13 }
          };
        }
      }
    );

    expect(response).toMatchObject({
      ok: true,
      action: "scribeDraft",
      data: {
        ok: true,
        scribeDraft: "兰卿：见字如晤。近来安好否。",
        readAloudText: "兰卿：见字如晤。近来安好否。",
        signature: "阿平",
        generationMeta: {
          engine: "ai-scribe-v1",
          provider: "xiaomi-mimo",
          model: "mimo-v2.5-pro",
          promptVersion: "ai-scribe-prompt-v1",
          usage: { promptTokens: 21, completionTokens: 13 }
        }
      }
    });
  });

  it("returns a controlled proxy_unavailable result when AI env is missing", async () => {
    const response = await handlePinganpiAiEvent(
      {
        action: "scribeDraft",
        payload: validDraftPayload()
      },
      { env: {} }
    );

    expect(response).toEqual({
      ok: false,
      action: "scribeDraft",
      reason: "proxy_unavailable",
      message: "AI proxy is not configured.",
      statusCode: 502
    });
  });

  it("returns not_found for unknown actions", async () => {
    const response = await handlePinganpiAiEvent(
      { action: "streamDraft", payload: validDraftPayload() },
      {
        config,
        requestCompletion: neverCalledRequester
      }
    );

    expect(response).toEqual({
      ok: false,
      action: "streamDraft",
      reason: "not_found",
      message: "Unknown miniprogram AI action.",
      statusCode: 404
    });
  });
});

function validDraftPayload(): Record<string, string> {
  return {
    oralText: "请替我问她近来安好。",
    scribeName: "陈启明",
    scribeStyle: "语气温和，字句端正",
    senderGreeting: "兰卿",
    senderSignature: "阿平",
    senderCity: "广州",
    recipientCity: "上海",
    letterType: "ordinary"
  };
}

const neverCalledRequester: CompletionRequester = async () => {
  throw new Error("Requester should not be called.");
};

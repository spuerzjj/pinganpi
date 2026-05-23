import { describe, expect, it } from "vitest";
import { handleAiProxyRequest, type CompletionRequester } from "./handler.js";
import type { AiProxyConfig } from "./config.js";

const config: AiProxyConfig = {
  baseUrl: "https://api.xiaomimimo.com/v1",
  modelId: "mimo-v2.5-pro",
  apiKey: "tp-test-key",
  port: 8787,
  requestTimeoutMs: 30000,
  maxOralTextChars: 800,
  maxCompletionTokens: 900
};

describe("AI proxy handler", () => {
  it("serves health checks without touching the provider", async () => {
    const response = await handleAiProxyRequest(config, {
      method: "GET",
      url: "/health",
      headers: {}
    }, neverCalledRequester);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it("generates a scribe draft through the injected requester", async () => {
    const response = await handleAiProxyRequest(
      config,
      {
        method: "POST",
        url: "/ai/scribe-draft",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        body: JSON.stringify({
          oralText: "请替我问她近来安好。",
          scribeName: "陈启明",
          scribeStyle: "语气温和，字句端正",
          senderGreeting: "兰卿",
          senderSignature: "阿平",
          senderCity: "广州",
          recipientCity: "上海",
          letterType: "ordinary"
        })
      },
      async (_config, messages) => {
        expect(messages[0]?.content).toContain("代笔先生");
        expect(messages[1]?.content).toContain("口述：请替我问她近来安好。");

        return {
          content: "兰卿：见字如晤。近来安好否。",
          usage: { promptTokens: 21, completionTokens: 13 }
        };
      }
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(JSON.parse(response.body)).toMatchObject({
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
    });
  });

  it("rejects non-local browser origins before calling the provider", async () => {
    let called = false;
    const response = await handleAiProxyRequest(
      config,
      {
        method: "POST",
        url: "/ai/scribe-draft",
        headers: { origin: "https://example.com", "content-type": "application/json" },
        body: validBody()
      },
      async () => {
        called = true;
        throw new Error("Requester should not be called.");
      }
    );

    expect(response.statusCode).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      reason: "origin_forbidden",
      message: "AI proxy only accepts local development origins."
    });
    expect(called).toBe(false);
  });

  it("rejects oversized request bodies before calling the provider", async () => {
    let called = false;
    const response = await handleAiProxyRequest(
      config,
      {
        method: "POST",
        url: "/ai/scribe-draft",
        headers: { origin: "http://127.0.0.1:5173", "content-type": "application/json" },
        body: JSON.stringify({ oralText: "一".repeat(33000) })
      },
      async () => {
        called = true;
        throw new Error("Requester should not be called.");
      }
    );

    expect(response.statusCode).toBe(413);
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      reason: "request_too_large",
      message: "Request body must be 32768 bytes or fewer."
    });
    expect(called).toBe(false);
  });

  it("rejects oral text over the configured guard before calling the provider", async () => {
    let called = false;
    const response = await handleAiProxyRequest(
      {
        ...config,
        maxOralTextChars: 20
      },
      {
        method: "POST",
        url: "/ai/scribe-draft",
        headers: { origin: "capacitor://localhost", "content-type": "application/json" },
        body: JSON.stringify({
          ...JSON.parse(validBody()),
          oralText: "一".repeat(21)
        })
      },
      async () => {
        called = true;
        throw new Error("Requester should not be called.");
      }
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      reason: "invalid_request",
      message: "oralText must be 20 characters or fewer."
    });
    expect(called).toBe(false);
  });
});

function validBody(): string {
  return JSON.stringify({
    oralText: "请替我问她近来安好。",
    scribeName: "陈启明",
    scribeStyle: "语气温和，字句端正",
    senderGreeting: "兰卿",
    senderSignature: "阿平",
    senderCity: "广州",
    recipientCity: "上海",
    letterType: "ordinary"
  });
}

const neverCalledRequester: CompletionRequester = async () => {
  throw new Error("Requester should not be called.");
};

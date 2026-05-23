import { describe, expect, it } from "vitest";
import { handleCloudBaseHttpEvent } from "./cloudbase-entry.js";
import type { AiProxyConfig } from "./config.js";
import type { CompletionRequester } from "./handler.js";

const config: AiProxyConfig = {
  baseUrl: "https://api.xiaomimimo.com/v1",
  modelId: "mimo-v2.5-pro",
  apiKey: "tp-test-key",
  port: 8787,
  requestTimeoutMs: 30000,
  maxOralTextChars: 800,
  maxCompletionTokens: 900
};

describe("CloudBase AI proxy entry", () => {
  it("adapts CloudBase HTTP health events to the shared handler", async () => {
    const response = await handleCloudBaseHttpEvent(
      config,
      {
        httpMethod: "GET",
        path: "/health",
        headers: {}
      },
      neverCalledRequester
    );

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBe(false);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it("adapts CloudBase HTTP draft events to the shared handler", async () => {
    const response = await handleCloudBaseHttpEvent(
      config,
      {
        httpMethod: "POST",
        path: "/ai/scribe-draft",
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
      generationMeta: {
        provider: "xiaomi-mimo",
        model: "mimo-v2.5-pro"
      }
    });
  });

  it("decodes base64 bodies from CloudBase HTTP events", async () => {
    let called = false;
    const response = await handleCloudBaseHttpEvent(
      config,
      {
        httpMethod: "POST",
        path: "/ai/scribe-draft",
        headers: { origin: "http://localhost:5173", "content-type": "application/json" },
        isBase64Encoded: true,
        body: Buffer.from(
          JSON.stringify({
            oralText: "请替我问她近来安好。",
            scribeName: "陈启明",
            scribeStyle: "语气温和，字句端正",
            senderGreeting: "兰卿",
            senderSignature: "阿平",
            senderCity: "广州",
            recipientCity: "上海",
            letterType: "ordinary"
          }),
          "utf8"
        ).toString("base64")
      },
      async () => {
        called = true;

        return {
          content: "兰卿：见字如晤。近来安好否。",
          usage: { promptTokens: 21, completionTokens: 13 }
        };
      }
    );

    expect(response.statusCode).toBe(200);
    expect(called).toBe(true);
  });
});

const neverCalledRequester: CompletionRequester = async () => {
  throw new Error("Requester should not be called.");
};

import { describe, expect, it } from "vitest";
import { handleCloudBaseHttpEvent } from "./cloudbase-entry.js";
import { main } from "./cloudbase-entry.js";
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
  it("serves health checks from the production entry without MiMo env", async () => {
    const previousApiKey = process.env.MIMO_API_KEY;
    const previousBaseUrl = process.env.MIMO_API_BASE_URL;
    const previousModelId = process.env.MIMO_MODEL_ID;
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_API_BASE_URL;
    delete process.env.MIMO_MODEL_ID;

    try {
      const response = await main({
        httpMethod: "GET",
        path: "/health",
        headers: {}
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
    } finally {
      process.env.MIMO_API_KEY = previousApiKey;
      process.env.MIMO_API_BASE_URL = previousBaseUrl;
      process.env.MIMO_MODEL_ID = previousModelId;
    }
  });

  it("serves prefixed health checks from the production entry without MiMo env", async () => {
    const previousApiKey = process.env.MIMO_API_KEY;
    const previousBaseUrl = process.env.MIMO_API_BASE_URL;
    const previousModelId = process.env.MIMO_MODEL_ID;
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_API_BASE_URL;
    delete process.env.MIMO_MODEL_ID;

    try {
      const response = await main({
        httpMethod: "GET",
        path: "/api/health",
        headers: {}
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
    } finally {
      process.env.MIMO_API_KEY = previousApiKey;
      process.env.MIMO_API_BASE_URL = previousBaseUrl;
      process.env.MIMO_MODEL_ID = previousModelId;
    }
  });

  it("returns a controlled error from the production entry without MiMo env", async () => {
    const previousApiKey = process.env.MIMO_API_KEY;
    const previousBaseUrl = process.env.MIMO_API_BASE_URL;
    const previousModelId = process.env.MIMO_MODEL_ID;
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_API_BASE_URL;
    delete process.env.MIMO_MODEL_ID;

    try {
      const response = await main({
        httpMethod: "POST",
        path: "/api/ai/scribe-draft",
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
      });

      expect(response.statusCode).toBe(502);
      expect(JSON.parse(response.body)).toEqual({
        ok: false,
        reason: "proxy_unavailable",
        message: "AI proxy is not configured."
      });
    } finally {
      process.env.MIMO_API_KEY = previousApiKey;
      process.env.MIMO_API_BASE_URL = previousBaseUrl;
      process.env.MIMO_MODEL_ID = previousModelId;
    }
  });

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

  it("adapts prefixed CloudBase HTTP draft events to the shared handler", async () => {
    const response = await handleCloudBaseHttpEvent(
      config,
      {
        httpMethod: "POST",
        path: "/api/ai/scribe-draft",
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
      scribeDraft: "兰卿：见字如晤。近来安好否。"
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

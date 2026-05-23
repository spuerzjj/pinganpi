import { afterEach, describe, expect, it } from "vitest";
import { createAiProxyServer } from "./dev-server.js";
import type { AiProxyConfig } from "./config.js";
import type { CompletionRequester } from "./dev-server.js";

const config: AiProxyConfig = {
  baseUrl: "https://api.xiaomimimo.com/v1",
  modelId: "mimo-v2.5",
  apiKey: "tp-test-key",
  port: 8787,
  requestTimeoutMs: 30000
};

const servers: Array<ReturnType<typeof createAiProxyServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error !== undefined) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe("AI proxy dev server", () => {
  it("serves health checks", async () => {
    const server = await listen(neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("generates a scribe draft through the injected requester", async () => {
    const server = await listen(async (_config, messages) => {
      expect(messages[0]?.content).toContain("代笔先生");
      expect(messages[1]?.content).toContain("口述：请替我问她近来安好。");

      return {
        content: "兰卿：见字如晤。近来安好否。",
        usage: { promptTokens: 21, completionTokens: 13 }
      };
    });

    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
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

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      scribeDraft: "兰卿：见字如晤。近来安好否。",
      readAloudText: "兰卿：见字如晤。近来安好否。",
      signature: "阿平",
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        model: "mimo-v2.5",
        promptVersion: "ai-scribe-prompt-v1",
        usage: { promptTokens: 21, completionTokens: 13 }
      }
    });
  });

  it("returns controlled validation errors", async () => {
    const server = await listen(neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
      body: JSON.stringify({ oralText: "缺少字段" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      reason: "invalid_request",
      message: "scribeName must be a non-empty string."
    });
  });

  it("allows local browser preflight requests", async () => {
    const server = await listen(neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "OPTIONS",
      headers: { origin: "http://localhost:5173" }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("rejects browser requests from non-local origins before calling the provider", async () => {
    let called = false;
    const server = await listen(async () => {
      called = true;
      throw new Error("Requester should not be called.");
    });
    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
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

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(await response.json()).toEqual({
      ok: false,
      reason: "origin_forbidden",
      message: "AI proxy only accepts local development origins."
    });
    expect(called).toBe(false);
  });

  it("limits request body size", async () => {
    const server = await listen(neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({ oralText: "一".repeat(33000) })
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      ok: false,
      reason: "request_too_large",
      message: "Request body must be 32768 bytes or fewer."
    });
  });

  it("does not return provider error details", async () => {
    const server = await listen(async () => {
      throw new Error("bad key: tp-secret");
    });
    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "capacitor://localhost" },
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

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      reason: "provider_error",
      message: "AI provider request failed."
    });
  });
});

async function listen(requester: CompletionRequester): Promise<ReturnType<typeof createAiProxyServer>> {
  const server = createAiProxyServer(config, requester);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  servers.push(server);
  return server;
}

function baseUrl(server: ReturnType<typeof createAiProxyServer>): string {
  const address = server.address();

  if (typeof address !== "object" || address === null) {
    throw new Error("Test server did not expose a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

const neverCalledRequester: CompletionRequester = async () => {
  throw new Error("Requester should not be called.");
};

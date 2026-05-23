import { afterEach, describe, expect, it } from "vitest";
import { createCloudBaseHttpServer } from "./cloudbase-http-server.js";
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

const servers: Array<ReturnType<typeof createCloudBaseHttpServer>> = [];

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

describe("CloudBase HTTP server entry", () => {
  it("serves health checks without MiMo env", async () => {
    const server = await listen(() => config, neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("serves health checks under the CloudBase /api route prefix", async () => {
    const server = await listen(() => config, neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("serves draft requests through the shared handler", async () => {
    const server = await listen(
      () => config,
      async (_config, messages) => {
        expect(messages[1]?.content).toContain("口述：请替我问她近来安好。");

        return {
          content: "兰卿：见字如晤。近来安好否。",
          usage: { promptTokens: 21, completionTokens: 13 }
        };
      }
    );
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
      scribeDraft: "兰卿：见字如晤。近来安好否。"
    });
  });

  it("serves draft requests under the CloudBase /api route prefix", async () => {
    const server = await listen(
      () => config,
      async (_config, messages) => {
        expect(messages[1]?.content).toContain("口述：请替我问她近来安好。");

        return {
          content: "兰卿：见字如晤。近来安好否。",
          usage: { promptTokens: 21, completionTokens: 13 }
        };
      }
    );
    const response = await fetch(`${baseUrl(server)}/api/ai/scribe-draft`, {
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
      scribeDraft: "兰卿：见字如晤。近来安好否。"
    });
  });

  it("rejects public draft requests without an Origin header", async () => {
    const server = await listen(() => config, neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/ai/scribe-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    expect(await response.json()).toEqual({
      ok: false,
      reason: "origin_forbidden",
      message: "AI proxy only accepts local development origins."
    });
  });

  it("returns a controlled error when runtime config is missing", async () => {
    const server = await listen(() => {
      throw new Error("Missing MIMO_API_KEY.");
    }, neverCalledRequester);
    const response = await fetch(`${baseUrl(server)}/api/ai/scribe-draft`, {
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

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      reason: "proxy_unavailable",
      message: "AI proxy is not configured."
    });
  });
});

async function listen(
  readConfig: Parameters<typeof createCloudBaseHttpServer>[0],
  requester: CompletionRequester
): Promise<ReturnType<typeof createCloudBaseHttpServer>> {
  const server = createCloudBaseHttpServer(readConfig, requester);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  servers.push(server);
  return server;
}

function baseUrl(server: ReturnType<typeof createCloudBaseHttpServer>): string {
  const address = server.address();

  if (typeof address !== "object" || address === null) {
    throw new Error("Test server did not expose a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

const neverCalledRequester: CompletionRequester = async () => {
  throw new Error("Requester should not be called.");
};

import { describe, expect, it, vi } from "vitest";
import { requestMimoChatCompletion } from "./mimo-client.js";
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

describe("MiMo client", () => {
  it("calls OpenAI-compatible chat completions with server key", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "兰卿：见字如晤。" } }],
          usage: { prompt_tokens: 10, completion_tokens: 8 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const result = await requestMimoChatCompletion(config, [{ role: "user", content: "写一封问安信。" }], fetcher);

    expect(result.content).toBe("兰卿：见字如晤。");
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 8 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(calls[0]?.init.headers).toMatchObject({
      "content-type": "application/json",
      "api-key": "tp-test-key"
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      model: "mimo-v2.5-pro",
      stream: false,
      thinking: { type: "disabled" },
      temperature: 0.8,
      max_completion_tokens: 900
    });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the configured completion token limit", async () => {
    let body: unknown;
    const fetcher: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body));

      return new Response(JSON.stringify({ choices: [{ message: { content: "平安。" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    await requestMimoChatCompletion(
      {
        ...config,
        maxCompletionTokens: 450
      },
      [{ role: "user", content: "写一封问安信。" }],
      fetcher
    );

    expect(body).toMatchObject({ max_completion_tokens: 450 });
  });

  it("normalizes provider errors without leaking response body", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "bad key: tp-secret" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      });

    await expect(
      requestMimoChatCompletion(config, [{ role: "user", content: "写一封问安信。" }], fetcher)
    ).rejects.toThrow("MiMo request failed with status 401.");
  });

  it("normalizes timeout errors", async () => {
    vi.useFakeTimers();
    try {
      const fetcher: typeof fetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });

      const assertion = expect(
        requestMimoChatCompletion(
          {
            ...config,
            requestTimeoutMs: 1000
          },
          [{ role: "user", content: "写一封问安信。" }],
          fetcher
        )
      ).rejects.toThrow("MiMo request timed out.");

      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

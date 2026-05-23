import { describe, expect, it } from "vitest";
import { readAiProxyConfig } from "./config.js";

describe("AI proxy config", () => {
  it("reads MiMo server env without exposing Vite keys", () => {
    const config = readAiProxyConfig({
      MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1/",
      MIMO_MODEL_ID: "mimo-v2.5",
      MIMO_API_KEY: "tp-test-key",
      PINGANPI_AI_PROXY_PORT: "8787"
    });

    expect(config).toEqual({
      baseUrl: "https://api.xiaomimimo.com/v1",
      modelId: "mimo-v2.5",
      apiKey: "tp-test-key",
      port: 8787,
      requestTimeoutMs: 30000,
      maxOralTextChars: 800,
      maxCompletionTokens: 900
    });
  });

  it("rejects VITE-prefixed MiMo keys", () => {
    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5",
        VITE_MIMO_API_KEY: "tp-leaked-key"
      })
    ).toThrow("Do not expose MiMo API keys through VITE_ variables.");
  });

  it("requires the server-side API key", () => {
    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5"
      })
    ).toThrow("Missing MIMO_API_KEY.");
  });

  it("rejects invalid ports and timeouts", () => {
    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5",
        MIMO_API_KEY: "tp-test-key",
        PINGANPI_AI_PROXY_PORT: "70000"
      })
    ).toThrow("PINGANPI_AI_PROXY_PORT must be an integer from 1 to 65535.");

    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5",
        MIMO_API_KEY: "tp-test-key",
        MIMO_REQUEST_TIMEOUT_MS: "0"
      })
    ).toThrow("MIMO_REQUEST_TIMEOUT_MS must be an integer from 1000 to 120000.");
  });

  it("reads local cost guard limits", () => {
    const config = readAiProxyConfig({
      MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
      MIMO_MODEL_ID: "mimo-v2.5",
      MIMO_API_KEY: "tp-test-key",
      PINGANPI_AI_MAX_ORAL_TEXT_CHARS: "500",
      MIMO_MAX_COMPLETION_TOKENS: "600"
    });

    expect(config.maxOralTextChars).toBe(500);
    expect(config.maxCompletionTokens).toBe(600);
  });

  it("rejects invalid local cost guard limits", () => {
    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5",
        MIMO_API_KEY: "tp-test-key",
        PINGANPI_AI_MAX_ORAL_TEXT_CHARS: "10"
      })
    ).toThrow("PINGANPI_AI_MAX_ORAL_TEXT_CHARS must be an integer from 20 to 2000.");

    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5",
        MIMO_API_KEY: "tp-test-key",
        MIMO_MAX_COMPLETION_TOKENS: "2000"
      })
    ).toThrow("MIMO_MAX_COMPLETION_TOKENS must be an integer from 100 to 1500.");
  });
});

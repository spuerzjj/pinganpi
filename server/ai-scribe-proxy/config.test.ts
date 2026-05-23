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
      requestTimeoutMs: 30000
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
});

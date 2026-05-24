import { describe, expect, it } from "vitest";
import {
  buildCloudBaseInvokeCommand,
  parseCloudBaseInvokeResult,
  runMiniProgramFunctionSmokeTest,
  sanitizeSmokeLog,
} from "./smoke-cloudbase-miniprogram-functions.js";

describe("cloudbase miniprogram function smoke helpers", () => {
  it("builds cloudbase fn invoke command args", () => {
    expect(buildCloudBaseInvokeCommand("pinganpi-ai", { action: "health" })).toEqual({
      command: "cloudbase",
      args: ["fn", "invoke", "pinganpi-ai", "-d", "{\"action\":\"health\"}", "--json"],
    });
  });

  it("parses CloudBase CLI JSON wrappers into mini function results", () => {
    const result = { ok: true, action: "health", data: { ok: true } };

    expect(parseCloudBaseInvokeResult(JSON.stringify({ Result: JSON.stringify(result) }))).toEqual(result);
    expect(parseCloudBaseInvokeResult(JSON.stringify({ Response: { Result: { RetMsg: JSON.stringify(result) } } }))).toEqual(
      result,
    );
    expect(parseCloudBaseInvokeResult(JSON.stringify({ data: { RetMsg: JSON.stringify(result) } }))).toEqual(result);
  });

  it("redacts sensitive values before logging", () => {
    const text = [
      "phone=13800138000",
      "invite=ABCD-1234",
      "invite=135790",
      "{\"code\":\"246810\",\"inviteCode\":\"975310\"}",
      "MIMO_API_KEY=sk-secretvalue",
      "sync token token-secret",
      "provider raw body: {\"error\":\"upstream\"}",
    ].join(" ");

    const redacted = sanitizeSmokeLog(text, {
      MIMO_API_KEY: "sk-secretvalue",
      PINGANPI_SYNC_SMOKE_MEMBER_TOKEN: "token-secret",
    });

    expect(redacted).not.toContain("13800138000");
    expect(redacted).not.toContain("ABCD-1234");
    expect(redacted).not.toContain("135790");
    expect(redacted).not.toContain("246810");
    expect(redacted).not.toContain("975310");
    expect(redacted).not.toContain("sk-secretvalue");
    expect(redacted).not.toContain("token-secret");
    expect(redacted).not.toContain("{\"error\":\"upstream\"}");
  });

  it("runs health checks for all mini program event functions", async () => {
    const calls: Array<{ name: string; event: unknown }> = [];

    const result = await runMiniProgramFunctionSmokeTest(
      { CLOUDBASE_ENV_ID: "pinganpi-dev" },
      async (name, event) => {
        calls.push({ name, event });

        return { ok: true, action: "health", data: { ok: true } };
      },
    );

    expect(result).toEqual({
      checked: ["pinganpi-ai", "pinganpi-account", "pinganpi-pair", "pinganpi-sync"],
      aiDraftChecked: false,
    });
    expect(calls).toEqual([
      { name: "pinganpi-ai", event: { action: "health" } },
      { name: "pinganpi-account", event: { action: "health" } },
      { name: "pinganpi-pair", event: { action: "health" } },
      { name: "pinganpi-sync", event: { action: "health" } },
    ]);
  });
});

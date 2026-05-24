import { afterEach, describe, expect, it } from "vitest";
import {
  callPinganpiAi,
  callPinganpiCloudFunction,
  callPinganpiSync,
  PinganpiCloudFunctionError,
  PINGANPI_AI_FUNCTION,
  PINGANPI_SYNC_FUNCTION,
} from "./cloud-functions.js";

interface TestWx {
  cloud?: {
    callFunction?(options: { name: string; data?: unknown }): Promise<{ result?: unknown }>;
  };
}

function setTestWx(wx: TestWx | undefined): void {
  (globalThis as unknown as { wx: TestWx | undefined }).wx = wx;
}

describe("miniprogram cloud function adapter", () => {
  afterEach(() => {
    setTestWx(undefined);
  });

  it("calls wx.cloud.callFunction with function name, action and payload", async () => {
    const calls: Array<{ name: string; data?: unknown }> = [];

    setTestWx({
      cloud: {
        async callFunction(options) {
          calls.push(options);

          return {
            result: {
              ok: true,
              action: "pull",
              data: { remoteRevision: 3 },
            },
          };
        },
      },
    });

    await expect(callPinganpiSync("pull", { householdId: "household-dev" })).resolves.toEqual({
      remoteRevision: 3,
    });
    expect(calls).toEqual([
      {
        name: PINGANPI_SYNC_FUNCTION,
        data: {
          action: "pull",
          payload: { householdId: "household-dev" },
        },
      },
    ]);
  });

  it("returns function data when the mini function result is ok", async () => {
    setTestWx({
      cloud: {
        async callFunction() {
          return {
            result: {
              ok: true,
              action: "scribeDraft",
              data: { draftText: "兰卿：一切平安。" },
            },
          };
        },
      },
    });

    await expect(callPinganpiAi("scribeDraft", { oralText: "一切平安。" })).resolves.toEqual({
      draftText: "兰卿：一切平安。",
    });
  });

  it("throws a controlled error when the mini function result is not ok", async () => {
    setTestWx({
      cloud: {
        async callFunction() {
          return {
            result: {
              ok: false,
              action: "scribeDraft",
              reason: "proxy_unavailable",
              message: "AI 代理暂不可用。",
              statusCode: 502,
            },
          };
        },
      },
    });

    await expect(callPinganpiCloudFunction(PINGANPI_AI_FUNCTION, "scribeDraft", {})).rejects.toMatchObject({
      name: "PinganpiCloudFunctionError",
      functionName: PINGANPI_AI_FUNCTION,
      action: "scribeDraft",
      reason: "proxy_unavailable",
      message: "AI 代理暂不可用。",
      statusCode: 502,
    });
  });

  it("throws cloud_unavailable when wx.cloud.callFunction is absent", async () => {
    setTestWx({ cloud: {} });

    await expect(callPinganpiCloudFunction("pinganpi-account", "health")).rejects.toBeInstanceOf(
      PinganpiCloudFunctionError,
    );
    await expect(callPinganpiCloudFunction("pinganpi-account", "health")).rejects.toMatchObject({
      reason: "cloud_unavailable",
      action: "health",
      functionName: "pinganpi-account",
    });
  });
});

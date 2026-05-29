import { describe, expect, it } from "vitest";
import { PinganpiCloudFunctionError } from "./cloud-functions.js";
import {
  checkMiniProgramSyncStatus,
  createInitialSyncStatus,
  createSyncingStatus,
} from "./sync-status.js";

const fixedNow = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

describe("miniprogram sync status", () => {
  it("creates an idle status before cloud check starts", () => {
    expect(createInitialSyncStatus({ envName: "dev", cloudbaseEnvId: "env-dev" })).toEqual({
      state: "idle",
      label: "云端未查验",
      detailText: "今日登记先按本地账簿显示。",
      envText: "dev · env-dev",
      checkedAtText: "尚未查验",
    });
  });

  it("creates a syncing status while checking cloud health", () => {
    expect(createSyncingStatus({ envName: "dev", cloudbaseEnvId: "env-dev" })).toMatchObject({
      state: "syncing",
      label: "云端查验中",
      detailText: "正在查看云端同步入口。",
      envText: "dev · env-dev",
    });
  });

  it("marks sync as checked when the sync cloud function is healthy", async () => {
    const calls: Array<{ action: string; payload?: unknown }> = [];

    await expect(
      checkMiniProgramSyncStatus({
        envName: "dev",
        cloudbaseEnvId: "env-dev",
        now: fixedNow,
        async callSync(action, payload) {
          calls.push({ action, payload });

          return { ok: true };
        },
      }),
    ).resolves.toMatchObject({
      state: "synced",
      label: "云端已查验",
      detailText: "今日登记可先读本地账簿，云端同步入口可用。",
      envText: "dev · env-dev",
      checkedAtText: "20:00",
    });
    expect(calls).toEqual([{ action: "health", payload: undefined }]);
  });

  it("uses an offline-required status when wx cloud is unavailable", async () => {
    await expect(
      checkMiniProgramSyncStatus({
        envName: "dev",
        cloudbaseEnvId: "env-dev",
        now: fixedNow,
        async callSync() {
          throw new PinganpiCloudFunctionError({
            functionName: "pinganpi-sync",
            action: "health",
            reason: "cloud_unavailable",
            message: "当前微信云开发调用能力不可用。",
          });
        },
      }),
    ).resolves.toMatchObject({
      state: "offlineRequired",
      label: "云端未连上",
      detailText: "今日登记仍可查看；投寄、拆阅前需要重新查验云端。",
      checkedAtText: "20:00",
    });
  });

  it("hides raw cloud error details from the page model", async () => {
    const status = await checkMiniProgramSyncStatus({
      envName: "dev",
      cloudbaseEnvId: "env-dev",
      now: fixedNow,
      async callSync() {
        throw new PinganpiCloudFunctionError({
          functionName: "pinganpi-sync",
          action: "health",
          reason: "provider_stack_trace_token_123",
          message: "token=secret stack trace",
          statusCode: 500,
        });
      },
    });

    expect(status.state).toBe("failed");
    expect(status.detailText).toBe("云端查验暂未成功，稍后再试。");
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(JSON.stringify(status)).not.toContain("provider_stack_trace_token_123");
  });
});

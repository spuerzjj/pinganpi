import { getMiniProgramRuntimeConfig, type MiniProgramEnvironmentName } from "../config/env.js";
import { callPinganpiSync, PinganpiCloudFunctionError } from "./cloud-functions.js";

export type MiniProgramSyncState = "idle" | "syncing" | "synced" | "failed" | "offlineRequired";

export interface MiniProgramSyncEnvironment {
  envName: MiniProgramEnvironmentName;
  cloudbaseEnvId: string;
}

export interface MiniProgramSyncStatus {
  state: MiniProgramSyncState;
  label: string;
  detailText: string;
  envText: string;
  checkedAtText: string;
}

export interface MiniProgramSyncStatusOptions extends Partial<MiniProgramSyncEnvironment> {
  now?: Date;
  callSync?: (action: string, payload?: unknown) => Promise<unknown>;
}

export function createInitialSyncStatus(options: Partial<MiniProgramSyncEnvironment> = {}): MiniProgramSyncStatus {
  return {
    state: "idle",
    label: "云端未查验",
    detailText: "今日登记先按本地账簿显示。",
    envText: formatEnvText(resolveEnvironment(options)),
    checkedAtText: "尚未查验",
  };
}

export function createSyncingStatus(options: Partial<MiniProgramSyncEnvironment> = {}): MiniProgramSyncStatus {
  return {
    state: "syncing",
    label: "云端查验中",
    detailText: "正在查看云端同步入口。",
    envText: formatEnvText(resolveEnvironment(options)),
    checkedAtText: "查验中",
  };
}

export async function checkMiniProgramSyncStatus(
  options: MiniProgramSyncStatusOptions = {},
): Promise<MiniProgramSyncStatus> {
  const env = resolveEnvironment(options);
  const now = options.now ?? new Date();
  const callSync = options.callSync ?? callPinganpiSync;

  try {
    const response = await callSync("health");

    if (!isRecord(response) || response.ok !== true) {
      return createFailedStatus(env, now);
    }

    return {
      state: "synced",
      label: "云端已查验",
      detailText: "今日登记可先读本地账簿，云端同步入口可用。",
      envText: formatEnvText(env),
      checkedAtText: formatCheckedAt(now),
    };
  } catch (error) {
    if (error instanceof PinganpiCloudFunctionError && error.reason === "cloud_unavailable") {
      return {
        state: "offlineRequired",
        label: "云端未连上",
        detailText: "今日登记仍可查看；投寄、拆阅前需要重新查验云端。",
        envText: formatEnvText(env),
        checkedAtText: formatCheckedAt(now),
      };
    }

    return createFailedStatus(env, now);
  }
}

function createFailedStatus(env: MiniProgramSyncEnvironment, now: Date): MiniProgramSyncStatus {
  return {
    state: "failed",
    label: "云端查验未成",
    detailText: "云端查验暂未成功，稍后再试。",
    envText: formatEnvText(env),
    checkedAtText: formatCheckedAt(now),
  };
}

function resolveEnvironment(options: Partial<MiniProgramSyncEnvironment>): MiniProgramSyncEnvironment {
  if (options.envName !== undefined && options.cloudbaseEnvId !== undefined) {
    return {
      envName: options.envName,
      cloudbaseEnvId: options.cloudbaseEnvId,
    };
  }

  return getMiniProgramRuntimeConfig();
}

function formatEnvText(env: MiniProgramSyncEnvironment): string {
  return `${env.envName} · ${env.cloudbaseEnvId}`;
}

function formatCheckedAt(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

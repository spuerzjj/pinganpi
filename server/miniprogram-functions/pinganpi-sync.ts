import cloudbase from "@cloudbase/node-sdk";
import { createCloudBaseSyncSnapshotStore } from "../sync-proxy/cloudbase-store.js";
import {
  handleSyncProxyRequest,
  type SyncProxyAuthConfig,
  type SyncSnapshotStore
} from "../sync-proxy/handler.js";
import { readSyncProxyAuthConfig } from "../sync-proxy/runtime-auth.js";
import {
  isRecord,
  miniFail,
  miniOk,
  readMiniAction,
  type PinganpiMiniFunctionEvent,
  type PinganpiMiniFunctionResult
} from "./result.js";

export async function main(event: PinganpiMiniFunctionEvent): Promise<PinganpiMiniFunctionResult> {
  return handlePinganpiSyncEvent(createRuntimeStore(), event, readSyncProxyAuthConfig(process.env));
}

export async function handlePinganpiSyncEvent(
  store: SyncSnapshotStore,
  event: PinganpiMiniFunctionEvent,
  authConfig?: SyncProxyAuthConfig
): Promise<PinganpiMiniFunctionResult> {
  const action = readMiniAction(event);
  const route = readSyncRoute(action);

  if (route === null) {
    return miniFail(action, "not_found", "Unknown miniprogram sync action.", 404);
  }

  const response = await handleSyncProxyRequest(
    store,
    {
      method: route.method,
      url: route.url,
      headers: {},
      body: route.method === "GET" ? "" : JSON.stringify(event.payload ?? {})
    },
    authConfig
  );
  const body = parseJsonBody(response.body);

  if (response.statusCode === 200) {
    return miniOk(action, body);
  }

  return miniFail(
    action,
    readStringProperty(body, "error") ?? "sync_unavailable",
    "Sync proxy request failed.",
    response.statusCode
  );
}

function createRuntimeStore(): SyncSnapshotStore {
  const app = cloudbase.init(
    process.env.CLOUDBASE_ENV_ID === undefined || process.env.CLOUDBASE_ENV_ID.trim().length === 0
      ? {}
      : { env: process.env.CLOUDBASE_ENV_ID.trim() }
  );
  const db = app.database();
  const collectionName = process.env.PINGANPI_SYNC_SNAPSHOT_COLLECTION?.trim();

  return createCloudBaseSyncSnapshotStore(db, {
    ...(collectionName === undefined || collectionName.length === 0 ? {} : { collectionName })
  });
}

function readSyncRoute(action: string): { method: "GET" | "POST"; url: string } | null {
  if (action === "health") {
    return { method: "GET", url: "/sync/health" };
  }

  if (action === "pull") {
    return { method: "POST", url: "/sync/pull" };
  }

  if (action === "push") {
    return { method: "POST", url: "/sync/push" };
  }

  return null;
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return {};
  }
}

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];

  return typeof property === "string" && property.length > 0 ? property : undefined;
}

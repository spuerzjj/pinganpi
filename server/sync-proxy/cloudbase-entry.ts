import cloudbase from "@cloudbase/node-sdk";
import { createCloudBaseSyncSnapshotStore } from "./cloudbase-store.js";
import {
  handleSyncProxyRequest,
  type SyncProxyAuthConfig,
  type SyncProxyResponse,
  type SyncSnapshotStore
} from "./handler.js";
import { readSyncProxyAuthConfig } from "./runtime-auth.js";

export { readSyncProxyAuthConfig } from "./runtime-auth.js";

export interface CloudBaseSyncHttpEvent {
  httpMethod?: string;
  method?: string;
  path?: string;
  rawPath?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
    path?: string;
  };
}

export interface CloudBaseSyncHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: false;
}

export async function main(event: CloudBaseSyncHttpEvent): Promise<CloudBaseSyncHttpResponse> {
  return handleCloudBaseSyncHttpEvent(createRuntimeStore(), event, readSyncProxyAuthConfig(process.env));
}

export async function handleCloudBaseSyncHttpEvent(
  store: SyncSnapshotStore,
  event: CloudBaseSyncHttpEvent,
  authConfig?: SyncProxyAuthConfig
): Promise<CloudBaseSyncHttpResponse> {
  const response = await handleSyncProxyRequest(
    store,
    {
      method: readMethod(event),
      url: readPath(event),
      headers: event.headers ?? {},
      body: readBody(event)
    },
    authConfig
  );

  return toCloudBaseResponse(response);
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

function toCloudBaseResponse(response: SyncProxyResponse): CloudBaseSyncHttpResponse {
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    isBase64Encoded: false
  };
}

function readMethod(event: CloudBaseSyncHttpEvent): string {
  return event.httpMethod ?? event.method ?? event.requestContext?.http?.method ?? "GET";
}

function readPath(event: CloudBaseSyncHttpEvent): string {
  return event.path ?? event.rawPath ?? event.requestContext?.http?.path ?? event.requestContext?.path ?? "/";
}

function readBody(event: CloudBaseSyncHttpEvent): string {
  if (event.body === undefined) {
    return "";
  }

  if (event.isBase64Encoded === true) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }

  return event.body;
}

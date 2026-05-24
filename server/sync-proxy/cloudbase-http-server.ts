import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import cloudbase from "@cloudbase/node-sdk";
import { createCloudBaseSyncSnapshotStore } from "./cloudbase-store.js";
import { handleSyncProxyRequest, type SyncProxyAuthConfig, type SyncSnapshotStore } from "./handler.js";
import { readSyncProxyAuthConfig } from "./runtime-auth.js";

export function createCloudBaseSyncHttpServer(
  store: SyncSnapshotStore = createRuntimeStore(),
  authConfig: SyncProxyAuthConfig = readSyncProxyAuthConfig(process.env)
): Server {
  return createServer((request, response) => {
    void handleNodeRequest(store, authConfig, request, response);
  });
}

async function handleNodeRequest(
  store: SyncSnapshotStore,
  authConfig: SyncProxyAuthConfig,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const handlerResponse = await handleSyncProxyRequest(store, {
    method: request.method ?? "GET",
    url: request.url ?? "/",
    headers: request.headers,
    body: await readTextBody(request)
  }, authConfig);

  response.writeHead(handlerResponse.statusCode, handlerResponse.headers);
  response.end(handlerResponse.body);
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

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
  }

  return Buffer.concat(chunks).toString("utf8");
}

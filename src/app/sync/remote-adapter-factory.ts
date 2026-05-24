import type { KeyValueStorage } from "../app-state-storage.js";
import type { SyncAdapter } from "./remote-model.js";
import { createHttpRemoteSyncAdapter } from "./http-remote-adapter.js";
import { createLocalStorageRemoteSyncAdapter } from "./local-remote-adapter.js";

export interface RemoteSyncAdapterFactoryInput {
  storage: KeyValueStorage;
  syncProxyUrl: string | null;
  syncMemberToken?: string | null;
  fetch?: typeof fetch;
}

export function createRemoteSyncAdapter(input: RemoteSyncAdapterFactoryInput): SyncAdapter {
  const syncProxyUrl = input.syncProxyUrl?.trim();

  if (syncProxyUrl !== undefined && syncProxyUrl.length > 0) {
    return createHttpRemoteSyncAdapter({
      baseUrl: syncProxyUrl,
      ...(input.syncMemberToken === undefined ? {} : { memberToken: input.syncMemberToken }),
      ...(input.fetch === undefined ? {} : { fetch: input.fetch })
    });
  }

  return createLocalStorageRemoteSyncAdapter(input.storage);
}

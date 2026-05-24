import type { KeyValueStorage } from "../app-state-storage.js";
import {
  createAppStateStorageKey,
  createDeviceNamespace,
  createSyncStateStorageKey,
  resolveBrowserSyncConfig,
  type BrowserSyncConfig,
  type BrowserSyncLocation,
  type ResolveBrowserSyncConfigOptions
} from "../sync/browser-sync-config.js";
import { createRemoteSnapshotStorageKey } from "../sync/local-remote-adapter.js";
import type { PinganpiBinding } from "./account-model.js";

export function resolveAccountAwareBrowserSyncConfig(
  location: BrowserSyncLocation,
  storage: KeyValueStorage,
  binding: PinganpiBinding | null,
  options: ResolveBrowserSyncConfigOptions = {}
): BrowserSyncConfig {
  const browserConfig = resolveBrowserSyncConfig(location, storage, options);

  if (binding === null) {
    return browserConfig;
  }

  const householdId = binding.household.householdId;
  const memberId = binding.member.memberId;
  const deviceId = browserConfig.deviceId;
  const deviceNamespace = createDeviceNamespace({ householdId, memberId, deviceId });

  return {
    householdId,
    memberId,
    deviceId,
    appStateStorageKey: createAppStateStorageKey(deviceNamespace),
    syncStateStorageKey: createSyncStateStorageKey(deviceNamespace),
    remoteSnapshotStorageKey: createRemoteSnapshotStorageKey(householdId)
  };
}

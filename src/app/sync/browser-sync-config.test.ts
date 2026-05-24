import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "../app-state.js";
import { createAppStateStore, createMemoryKeyValueStorage } from "../app-state-storage.js";
import { createLocalSyncStateStore } from "./sync-state-storage.js";
import {
  DEFAULT_BROWSER_SYNC_HOUSEHOLD_ID,
  DEFAULT_BROWSER_SYNC_MEMBER_ID,
  resolveBrowserSyncConfig
} from "./browser-sync-config.js";
import { createRemoteSnapshotStorageKey } from "./local-remote-adapter.js";

describe("browser sync config", () => {
  it("uses URL parameters to override household, device, and member", () => {
    const storage = createMemoryKeyValueStorage();
    const config = resolveBrowserSyncConfig("https://example.test/?household=household-dev&device=device-b&member=member-lan", storage, {
      deviceIdGenerator: () => "device-generated"
    });

    expect(config).toEqual({
      householdId: "household-dev",
      deviceId: "device-b",
      memberId: "member-lan",
      appStateStorageKey: "pinganpi.app-state.v1.household-dev.member-lan.device-b",
      syncStateStorageKey: "pinganpi.sync-state.v1.household-dev.member-lan.device-b",
      remoteSnapshotStorageKey: "pinganpi.remote-snapshot.v1.household-dev"
    });
  });

  it("generates and persists a device id when the URL does not provide one", () => {
    const storage = createMemoryKeyValueStorage();
    let generatedCount = 0;

    const first = resolveBrowserSyncConfig("https://example.test/", storage, {
      deviceIdGenerator: () => `device-generated-${++generatedCount}`
    });
    const second = resolveBrowserSyncConfig("https://example.test/", storage, {
      deviceIdGenerator: () => `device-generated-${++generatedCount}`
    });

    expect(first.deviceId).toBe("device-generated-1");
    expect(second.deviceId).toBe("device-generated-1");
    expect(generatedCount).toBe(1);
    expect(first.householdId).toBe(DEFAULT_BROWSER_SYNC_HOUSEHOLD_ID);
    expect(first.memberId).toBe(DEFAULT_BROWSER_SYNC_MEMBER_ID);
  });

  it("keeps an unknown URL member isolated instead of pretending to be the default member", () => {
    const storage = createMemoryKeyValueStorage();
    const config = resolveBrowserSyncConfig("https://example.test/?household=household-main&device=device-a&member=member-unknown", storage);

    expect(config.memberId).toBe("member-unknown");
    expect(config.appStateStorageKey).toBe("pinganpi.app-state.v1.household-main.member-unknown.device-a");
  });

  it("keeps two device namespaces from overwriting local AppState or SyncState while sharing household remote key", () => {
    const storage = createMemoryKeyValueStorage();
    const configA = resolveBrowserSyncConfig("https://example.test/?household=household-main&device=device-a&member=member-zhou", storage);
    const configB = resolveBrowserSyncConfig("https://example.test/?household=household-main&device=device-b&member=member-lan", storage);
    const appStoreA = createAppStateStore(storage, configA.appStateStorageKey);
    const appStoreB = createAppStateStore(storage, configB.appStateStorageKey);
    const syncStoreA = createLocalSyncStateStore(storage, {
      householdId: configA.householdId,
      deviceId: configA.deviceId,
      memberId: configA.memberId
    }, configA.syncStateStorageKey);
    const syncStoreB = createLocalSyncStateStore(storage, {
      householdId: configB.householdId,
      deviceId: configB.deviceId,
      memberId: configB.memberId
    }, configB.syncStateStorageKey);

    const stateA = createDefaultAppState();
    stateA.wallet.balanceFen = 101;
    const stateB = createDefaultAppState();
    stateB.wallet.balanceFen = 202;
    appStoreA.save(stateA);
    appStoreB.save(stateB);
    syncStoreA.save({ ...syncStoreA.load(), lastRemoteRevision: 1 });
    syncStoreB.save({ ...syncStoreB.load(), lastRemoteRevision: 2 });

    expect(configA.appStateStorageKey).toBe("pinganpi.app-state.v1.household-main.member-zhou.device-a");
    expect(configB.syncStateStorageKey).toBe("pinganpi.sync-state.v1.household-main.member-lan.device-b");
    expect(configA.remoteSnapshotStorageKey).toBe(createRemoteSnapshotStorageKey("household-main"));
    expect(configA.remoteSnapshotStorageKey).toBe(configB.remoteSnapshotStorageKey);
    expect(appStoreA.load().wallet.balanceFen).toBe(101);
    expect(appStoreB.load().wallet.balanceFen).toBe(202);
    expect(syncStoreA.load().lastRemoteRevision).toBe(1);
    expect(syncStoreB.load().lastRemoteRevision).toBe(2);
  });

  it("separates local state when the same device id is used for different household or member", () => {
    const storage = createMemoryKeyValueStorage();
    const configA = resolveBrowserSyncConfig("https://example.test/?household=household-a&device=device-shared&member=member-zhou", storage);
    const configB = resolveBrowserSyncConfig("https://example.test/?household=household-b&device=device-shared&member=member-zhou", storage);
    const configC = resolveBrowserSyncConfig("https://example.test/?household=household-a&device=device-shared&member=member-lan", storage);

    expect(configA.appStateStorageKey).not.toBe(configB.appStateStorageKey);
    expect(configA.syncStateStorageKey).not.toBe(configC.syncStateStorageKey);
    expect(configA.remoteSnapshotStorageKey).not.toBe(configB.remoteSnapshotStorageKey);
    expect(configA.remoteSnapshotStorageKey).toBe(configC.remoteSnapshotStorageKey);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppState } from "../app-state.js";
import { createBrowserAppStateStore, createMemoryKeyValueStorage } from "../app-state-storage.js";
import {
  createDefaultLocalSyncState,
  LOCAL_SYNC_STATE_SCHEMA_VERSION,
  parseLocalSyncState,
  serializeLocalSyncState,
  type LocalSyncState
} from "./sync-state.js";
import { createLocalSyncStateStore } from "./sync-state-storage.js";

const fallbackInput = {
  householdId: "household-main",
  memberId: "member-zhou",
  deviceId: "device-default"
};

describe("local sync state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates default configured sync state", () => {
    const state = createDefaultLocalSyncState(fallbackInput);

    expect(state).toEqual({
      schemaVersion: LOCAL_SYNC_STATE_SCHEMA_VERSION,
      householdId: "household-main",
      deviceId: "device-default",
      memberId: "member-zhou",
      lastRemoteRevision: null,
      lastSyncedAtIso: null,
      status: "idle",
      lastError: null
    });
  });

  it("uses an injected device id before generating one", () => {
    const state = createDefaultLocalSyncState({
      householdId: "household-main",
      memberId: "member-lan",
      deviceId: "device-fixed",
      deviceIdGenerator: () => "device-generated"
    });

    expect(state.deviceId).toBe("device-fixed");
    expect(state.memberId).toBe("member-lan");
  });

  it("uses an injected generator when device id is missing", () => {
    const state = createDefaultLocalSyncState({
      householdId: "household-main",
      memberId: "member-zhou",
      deviceIdGenerator: () => "device-generated"
    });

    expect(state.deviceId).toBe("device-generated");
  });

  it("uses crypto.randomUUID before getRandomValues for generated device ids", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "device-random-uuid",
      getRandomValues: vi.fn()
    });

    const state = createDefaultLocalSyncState({
      householdId: "household-main",
      memberId: "member-zhou"
    });

    expect(state.deviceId).toBe("device-random-uuid");
    expect(globalThis.crypto.getRandomValues).not.toHaveBeenCalled();
  });

  it("uses crypto.getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(bytes: Uint8Array) {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      }
    });

    const state = createDefaultLocalSyncState({
      householdId: "household-main",
      memberId: "member-zhou"
    });

    expect(state.deviceId).toBe("device-000102030405060708090a0b0c0d0e0f");
  });

  it("fails loudly when no secure random source is available for generated device ids", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() =>
      createDefaultLocalSyncState({
        householdId: "household-main",
        memberId: "member-zhou"
      })
    ).toThrow("Cannot generate local sync device id without a secure random source");
  });

  it("parses serialized sync state", () => {
    const state: LocalSyncState = {
      schemaVersion: LOCAL_SYNC_STATE_SCHEMA_VERSION,
      householdId: "household-main",
      deviceId: "device-a",
      memberId: "member-zhou",
      lastRemoteRevision: 7,
      lastSyncedAtIso: "2026-05-24T02:00:00.000Z",
      status: "synced",
      lastError: "短错误"
    };

    expect(parseLocalSyncState(serializeLocalSyncState(state), fallbackInput)).toEqual(state);
  });

  it("falls back to defaults for bad JSON", () => {
    expect(parseLocalSyncState("{bad json", fallbackInput)).toEqual(createDefaultLocalSyncState(fallbackInput));
  });

  it("falls back to defaults for schema mismatch", () => {
    expect(parseLocalSyncState(JSON.stringify({ ...createDefaultLocalSyncState(fallbackInput), schemaVersion: 2 }), fallbackInput)).toEqual(
      createDefaultLocalSyncState(fallbackInput)
    );
  });

  it("falls back to defaults for invalid status", () => {
    expect(
      parseLocalSyncState(JSON.stringify({ ...createDefaultLocalSyncState(fallbackInput), status: "online" }), fallbackInput)
    ).toEqual(createDefaultLocalSyncState(fallbackInput));
  });

  it("falls back to defaults for invalid remote revision", () => {
    expect(
      parseLocalSyncState(JSON.stringify({ ...createDefaultLocalSyncState(fallbackInput), lastRemoteRevision: -1 }), fallbackInput)
    ).toEqual(createDefaultLocalSyncState(fallbackInput));
  });

  it("falls back to defaults for unsafe remote revisions", () => {
    expect(
      parseLocalSyncState(
        JSON.stringify({ ...createDefaultLocalSyncState(fallbackInput), lastRemoteRevision: Number.MAX_SAFE_INTEGER + 1 }),
        fallbackInput
      )
    ).toEqual(createDefaultLocalSyncState(fallbackInput));
  });

  it("falls back to defaults for invalid synced date", () => {
    expect(
      parseLocalSyncState(
        JSON.stringify({ ...createDefaultLocalSyncState(fallbackInput), lastSyncedAtIso: "不是日期" }),
        fallbackInput
      )
    ).toEqual(createDefaultLocalSyncState(fallbackInput));
  });

  it("loads, saves, and resets sync state in storage", () => {
    const storage = createMemoryKeyValueStorage();
    const store = createLocalSyncStateStore(storage, fallbackInput);

    expect(store.load()).toEqual(createDefaultLocalSyncState(fallbackInput));

    const saved: LocalSyncState = {
      ...createDefaultLocalSyncState(fallbackInput),
      deviceId: "device-saved",
      lastRemoteRevision: 3,
      lastSyncedAtIso: "2026-05-24T02:00:00.000Z",
      status: "synced"
    };
    store.save(saved);

    expect(store.load()).toEqual(saved);
    expect(store.reset({ householdId: "household-main", memberId: "member-lan", deviceId: "device-reset" })).toEqual({
      ...createDefaultLocalSyncState(fallbackInput),
      memberId: "member-lan",
      deviceId: "device-reset"
    });
    expect(store.load().deviceId).toBe("device-reset");
  });

  it("persists generated default sync state on first load so device id stays stable", () => {
    const storage = createMemoryKeyValueStorage();
    let nextDeviceNumber = 0;
    const store = createLocalSyncStateStore(storage, {
      householdId: "household-main",
      memberId: "member-zhou",
      deviceIdGenerator: () => `device-generated-${++nextDeviceNumber}`
    });

    expect(store.load().deviceId).toBe("device-generated-1");
    expect(store.load().deviceId).toBe("device-generated-1");
  });

  it("persists fallback sync state when stored data is invalid", () => {
    const storage = createMemoryKeyValueStorage();
    let nextDeviceNumber = 0;
    const store = createLocalSyncStateStore(storage, {
      householdId: "household-main",
      memberId: "member-zhou",
      deviceIdGenerator: () => `device-recovered-${++nextDeviceNumber}`
    });
    storage.setItem("pinganpi.sync-state.v1", "{bad json");

    expect(store.load().deviceId).toBe("device-recovered-1");
    expect(store.load().deviceId).toBe("device-recovered-1");
  });

  it("keeps custom browser AppState storage keys isolated", () => {
    const storage = createMemoryKeyValueStorage();
    vi.stubGlobal("window", { localStorage: storage });
    const storeA = createBrowserAppStateStore("pinganpi.app-state.v1.device-a");
    const storeB = createBrowserAppStateStore("pinganpi.app-state.v1.device-b");

    const stateA = createDefaultAppState();
    stateA.wallet.balanceFen = 101;
    const stateB = createDefaultAppState();
    stateB.wallet.balanceFen = 202;

    storeA.save(stateA);
    storeB.save(stateB);

    expect(storeA.load().wallet.balanceFen).toBe(101);
    expect(storeB.load().wallet.balanceFen).toBe(202);
  });
});

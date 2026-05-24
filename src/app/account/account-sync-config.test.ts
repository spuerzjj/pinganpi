import { describe, expect, it } from "vitest";
import { createMemoryKeyValueStorage } from "../app-state-storage.js";
import { DEFAULT_BROWSER_SYNC_HOUSEHOLD_ID, DEFAULT_BROWSER_SYNC_MEMBER_ID } from "../sync/browser-sync-config.js";
import type { PinganpiBinding } from "./account-model.js";
import { resolveAccountAwareBrowserSyncConfig } from "./account-sync-config.js";

describe("account sync config", () => {
  it("uses household and member from active account binding", () => {
    const storage = createMemoryKeyValueStorage();
    const config = resolveAccountAwareBrowserSyncConfig(
      "https://example.test/?household=debug-household&member=debug-member&device=device-a",
      storage,
      createBinding()
    );

    expect(config).toEqual({
      householdId: "household-account-a",
      memberId: "member-account-a",
      deviceId: "device-a",
      appStateStorageKey: "pinganpi.app-state.v1.household-account-a.member-account-a.device-a",
      syncStateStorageKey: "pinganpi.sync-state.v1.household-account-a.member-account-a.device-a",
      remoteSnapshotStorageKey: "pinganpi.remote-snapshot.v1.household-account-a"
    });
  });

  it("keeps the phase 16 browser debug config when no account binding exists", () => {
    const storage = createMemoryKeyValueStorage();
    const config = resolveAccountAwareBrowserSyncConfig("https://example.test/?device=device-a", storage, null);

    expect(config.householdId).toBe(DEFAULT_BROWSER_SYNC_HOUSEHOLD_ID);
    expect(config.memberId).toBe(DEFAULT_BROWSER_SYNC_MEMBER_ID);
    expect(config.deviceId).toBe("device-a");
  });
});

function createBinding(): PinganpiBinding {
  return {
    household: {
      householdId: "household-account-a",
      status: "active",
      createdByAccountId: "account-a",
      createdAtIso: "2026-05-24T08:00:00.000Z",
      updatedAtIso: "2026-05-24T08:00:00.000Z"
    },
    member: {
      memberId: "member-account-a",
      householdId: "household-account-a",
      accountId: "account-a",
      role: "first",
      joinedAtIso: "2026-05-24T08:00:00.000Z",
      status: "active"
    },
    activeMemberCount: 1
  };
}

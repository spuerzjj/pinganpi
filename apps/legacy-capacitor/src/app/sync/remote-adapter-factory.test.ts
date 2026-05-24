import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "../app-state.js";
import { createMemoryKeyValueStorage } from "../app-state-storage.js";
import { createRemoteSnapshotFromAppState } from "./remote-snapshot.js";
import { createRemoteSnapshotStorageKey } from "./local-remote-adapter.js";
import { createRemoteSyncAdapter } from "./remote-adapter-factory.js";

const householdId = "household-main";
const deviceId = "device-a";
const memberId = "member-zhou";

describe("remote sync adapter factory", () => {
  it("uses the local storage remote adapter when no sync proxy URL is configured", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createRemoteSyncAdapter({
      storage,
      syncProxyUrl: null
    });

    await adapter.push({
      householdId,
      deviceId,
      memberId,
      baseRemoteRevision: null,
      snapshot: createSnapshot(0)
    });

    expect(storage.getItem(createRemoteSnapshotStorageKey(householdId))).not.toBeNull();
  });

  it("uses the HTTP remote adapter when a sync proxy URL is configured", async () => {
    const calls: string[] = [];
    const headers: unknown[] = [];
    const adapter = createRemoteSyncAdapter({
      storage: createMemoryKeyValueStorage(),
      syncProxyUrl: "https://sync.example.com/api",
      syncMemberToken: "member-token",
      fetch: async (input, init) => {
        calls.push(String(input));
        headers.push(init?.headers);

        return new Response(
          JSON.stringify({
            snapshot: createSnapshot(4)
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    });

    const snapshot = await adapter.pull({
      householdId,
      deviceId,
      memberId,
      sinceRemoteRevision: 3
    });

    expect(snapshot.remoteRevision).toBe(4);
    expect(calls).toEqual(["https://sync.example.com/api/sync/pull"]);
    expect(headers).toEqual([
      {
        "Content-Type": "application/json",
        "X-Pinganpi-Sync-Token": "member-token"
      }
    ]);
  });
});

function createSnapshot(remoteRevision: number) {
  return createRemoteSnapshotFromAppState(createDefaultAppState(), {
    householdId,
    deviceId,
    exportedAtIso: "2026-05-24T07:00:00.000Z",
    remoteRevision
  });
}

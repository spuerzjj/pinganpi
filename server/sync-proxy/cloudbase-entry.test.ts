import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "../../src/app/app-state.js";
import type { RemoteSnapshot } from "../../src/app/sync/remote-model.js";
import { createRemoteSnapshotFromAppState } from "../../src/app/sync/remote-snapshot.js";
import type { SyncSnapshotStore } from "./handler.js";
import { handleCloudBaseSyncHttpEvent, readSyncProxyAuthConfig, type CloudBaseSyncHttpEvent } from "./cloudbase-entry.js";

const householdId = "household-main";
const deviceId = "device-a";
const memberId = "member-zhou";

describe("cloudbase sync entry", () => {
  it("adapts CloudBase HTTP events to the sync handler", async () => {
    const response = await handleCloudBaseSyncHttpEvent(createMemoryStore(), {
      httpMethod: "GET",
      path: "/api/health"
    });

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ ok: true }),
      isBase64Encoded: false
    });
  });

  it("decodes base64 encoded request bodies", async () => {
    const store = createMemoryStore();
    const body = JSON.stringify({
      householdId,
      deviceId,
      memberId,
      baseRemoteRevision: null,
      snapshot: createSnapshot(0)
    });
    const event: CloudBaseSyncHttpEvent = {
      httpMethod: "POST",
      path: "/api/sync/push",
      body: Buffer.from(body, "utf8").toString("base64"),
      isBase64Encoded: true
    };

    const response = await handleCloudBaseSyncHttpEvent(store, event);

    expect(response.statusCode).toBe(200);
    expect(store.snapshot?.remoteRevision).toBe(1);
  });

  it("reads member tokens from runtime env", () => {
    expect(
      readSyncProxyAuthConfig({
        PINGANPI_SYNC_MEMBER_TOKENS: JSON.stringify({
          [householdId]: {
            [memberId]: "token-zhou"
          }
        })
      })
    ).toEqual({
      required: true,
      memberTokens: {
        [householdId]: {
          [memberId]: "token-zhou"
        }
      }
    });
  });

  it("reads member tokens from base64 runtime env", () => {
    const rawTokens = JSON.stringify({
      [householdId]: {
        [memberId]: "token-zhou"
      }
    });

    expect(
      readSyncProxyAuthConfig({
        PINGANPI_SYNC_MEMBER_TOKENS_B64: Buffer.from(rawTokens, "utf8").toString("base64")
      })
    ).toEqual({
      required: true,
      memberTokens: {
        [householdId]: {
          [memberId]: "token-zhou"
        }
      }
    });
  });

  it("fails closed when runtime member tokens are not configured", () => {
    expect(readSyncProxyAuthConfig({})).toEqual({
      required: true,
      memberTokens: {}
    });
  });
});

interface MemoryStore extends SyncSnapshotStore {
  snapshot: RemoteSnapshot | null;
}

function createMemoryStore(): MemoryStore {
  return {
    snapshot: null,
    async loadSnapshot() {
      return this.snapshot;
    },
    async saveSnapshot(input) {
      this.snapshot = input.snapshot;
    }
  };
}

function createSnapshot(remoteRevision: number): RemoteSnapshot {
  return createRemoteSnapshotFromAppState(createDefaultAppState(), {
    householdId,
    deviceId,
    exportedAtIso: "2026-05-24T06:30:00.000Z",
    remoteRevision
  });
}

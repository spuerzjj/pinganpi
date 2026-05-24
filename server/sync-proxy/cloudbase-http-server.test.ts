import { afterEach, describe, expect, it } from "vitest";
import type { RemoteSnapshot } from "../../src/app/sync/remote-model.js";
import { createEmptyRemoteSnapshot } from "../../src/app/sync/remote-snapshot.js";
import { createCloudBaseSyncHttpServer } from "./cloudbase-http-server.js";
import type { SyncSnapshotStore } from "./handler.js";

const householdId = "household-main";
const deviceId = "device-a";
const memberId = "member-zhou";
const servers: Array<ReturnType<typeof createCloudBaseSyncHttpServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error !== undefined) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe("CloudBase sync HTTP server", () => {
  it("serves health checks without member auth", async () => {
    const server = await listen(createMemoryStore());
    const response = await fetch(`${baseUrl(server)}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects sync requests without a configured member token", async () => {
    const server = await listen(createMemoryStore());
    const response = await fetch(`${baseUrl(server)}/api/sync/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        householdId,
        deviceId,
        memberId,
        sinceRemoteRevision: null
      })
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});

interface MemoryStore extends SyncSnapshotStore {
  snapshot: RemoteSnapshot | null;
}

function createMemoryStore(): MemoryStore {
  return {
    snapshot: createEmptyRemoteSnapshot({
      householdId,
      deviceId,
      exportedAtIso: "2026-05-24T08:00:00.000Z",
      remoteRevision: 0
    }),
    async loadSnapshot() {
      return this.snapshot;
    },
    async saveSnapshot(input) {
      this.snapshot = input.snapshot;
    }
  };
}

async function listen(store: SyncSnapshotStore): Promise<ReturnType<typeof createCloudBaseSyncHttpServer>> {
  const server = createCloudBaseSyncHttpServer(store, { required: true, memberTokens: {} });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  servers.push(server);
  return server;
}

function baseUrl(server: ReturnType<typeof createCloudBaseSyncHttpServer>): string {
  const address = server.address();

  if (typeof address !== "object" || address === null) {
    throw new Error("Test server did not expose a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

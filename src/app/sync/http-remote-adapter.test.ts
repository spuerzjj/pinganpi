import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "../app-state.js";
import type { RemoteSnapshot, SyncPushInput } from "./remote-model.js";
import { createRemoteSnapshotFromAppState } from "./remote-snapshot.js";
import { createHttpRemoteSyncAdapter } from "./http-remote-adapter.js";

const householdId = "household-main";
const deviceId = "device-a";
const memberId = "member-zhou";

describe("http remote sync adapter", () => {
  it("pull sends household device member and sinceRemoteRevision", async () => {
    const snapshot = createSnapshot(4);
    const fetchCalls: FetchCall[] = [];
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api/",
      fetch: createFetchMock(fetchCalls, [
        jsonResponse({
          snapshot
        })
      ])
    });

    const result = await adapter.pull({
      householdId,
      deviceId,
      memberId,
      sinceRemoteRevision: 3
    });

    expect(result.remoteRevision).toBe(4);
    expect(fetchCalls).toEqual([
      {
        url: "https://sync.example.com/api/sync/pull",
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            householdId,
            deviceId,
            memberId,
            sinceRemoteRevision: 3
          })
        }
      }
    ]);
  });

  it("push sends baseRemoteRevision and snapshot", async () => {
    const input = createPushInput(5);
    const fetchCalls: FetchCall[] = [];
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      fetch: createFetchMock(fetchCalls, [jsonResponse(createPushResult(input, 6))])
    });

    const result = await adapter.push(input);

    expect(result.acceptedRemoteRevision).toBe(6);
    expect(fetchCalls[0]).toMatchObject({
      url: "https://sync.example.com/api/sync/push",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      }
    });
  });

  it("sends a member token when configured", async () => {
    const fetchCalls: FetchCall[] = [];
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      memberToken: "member-token",
      fetch: createFetchMock(fetchCalls, [
        jsonResponse({
          snapshot: createSnapshot(4)
        })
      ])
    });

    await adapter.pull({
      householdId,
      deviceId,
      memberId,
      sinceRemoteRevision: 3
    });

    expect(fetchCalls[0]?.init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Pinganpi-Sync-Token": "member-token"
    });
  });

  it("maps stale remote revision responses to stale errors", async () => {
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      fetch: createFetchMock([], [
        jsonResponse(
          {
            error: "stale_remote_revision"
          },
          409
        )
      ])
    });

    await expect(adapter.push(createPushInput(2))).rejects.toMatchObject({
      code: "stale_remote_revision"
    });
  });

  it("does not expose raw server error body in thrown errors", async () => {
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      fetch: createFetchMock([], [new Response("cloud exploded with secret-token", { status: 500 })])
    });

    await expect(
      adapter.pull({
        householdId,
        deviceId,
        memberId,
        sinceRemoteRevision: null
      })
    ).rejects.toThrow("同步未完成，请稍后重试");
    await expect(
      adapter.pull({
        householdId,
        deviceId,
        memberId,
        sinceRemoteRevision: null
      })
    ).rejects.not.toThrow("secret-token");
  });

  it("rejects malformed successful pull responses", async () => {
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      fetch: createFetchMock([], [
        jsonResponse({
          snapshot: {
            remoteRevision: Number.NaN
          }
        })
      ])
    });

    await expect(
      adapter.pull({
        householdId,
        deviceId,
        memberId,
        sinceRemoteRevision: null
      })
    ).rejects.toThrow("同步未完成，请稍后重试");
  });

  it("rejects malformed remote entities in successful pull responses", async () => {
    const snapshot = createSnapshot(4);
    snapshot.letters = [
      {
        id: 123
      } as never
    ];
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      fetch: createFetchMock([], [
        jsonResponse({
          snapshot
        })
      ])
    });

    await expect(
      adapter.pull({
        householdId,
        deviceId,
        memberId,
        sinceRemoteRevision: null
      })
    ).rejects.toThrow("同步未完成，请稍后重试");
  });

  it("rejects malformed successful push responses", async () => {
    const input = createPushInput(5);
    const adapter = createHttpRemoteSyncAdapter({
      baseUrl: "https://sync.example.com/api",
      fetch: createFetchMock([], [
        jsonResponse({
          ...createPushResult(input, 6),
          snapshot: createSnapshot(5)
        })
      ])
    });

    await expect(adapter.push(input)).rejects.toThrow("同步未完成，请稍后重试");
  });
});

interface FetchCall {
  url: string;
  init: RequestInit;
}

function createFetchMock(calls: FetchCall[], responses: Response[]): typeof fetch {
  let index = 0;

  return async (input, init) => {
    const response = responses[index];
    index += 1;

    calls.push({
      url: String(input),
      init: init ?? {}
    });

    if (response === undefined) {
      throw new Error("Unexpected fetch call");
    }

    return response;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createSnapshot(remoteRevision: number): RemoteSnapshot {
  return createRemoteSnapshotFromAppState(createDefaultAppState(), {
    householdId,
    deviceId,
    exportedAtIso: "2026-05-24T04:00:00.000Z",
    remoteRevision
  });
}

function createPushInput(baseRemoteRevision: number): SyncPushInput {
  return {
    householdId,
    deviceId,
    memberId,
    baseRemoteRevision,
    snapshot: createSnapshot(baseRemoteRevision)
  };
}

function createPushResult(input: SyncPushInput, acceptedRemoteRevision: number) {
  return {
    householdId: input.householdId,
    deviceId: input.deviceId,
    acceptedRemoteRevision,
    cursor: {
      householdId: input.householdId,
      deviceId: input.deviceId,
      memberId: input.memberId,
      remoteRevision: acceptedRemoteRevision,
      lastPulledAtIso: null,
      lastPushedAtIso: "2026-05-24T04:05:00.000Z",
      updatedAtIso: "2026-05-24T04:05:00.000Z"
    },
    snapshot: createSnapshot(acceptedRemoteRevision)
  };
}

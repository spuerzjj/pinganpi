import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type DraftPaper, type PersistedLetter } from "../../apps/legacy-capacitor/src/app/app-state.js";
import type { RemoteSnapshot } from "../../apps/legacy-capacitor/src/app/sync/remote-model.js";
import { createRemoteSnapshotFromAppState } from "../../apps/legacy-capacitor/src/app/sync/remote-snapshot.js";
import {
  handleSyncProxyRequest,
  StaleRemoteRevisionError,
  type SyncProxyAuthConfig,
  type SyncProxyRequest,
  type SyncSnapshotStore
} from "./handler.js";

const householdId = "household-main";
const deviceA = "device-a";
const deviceB = "device-b";
const memberZhou = "member-zhou";
const memberLan = "member-lan";

describe("sync proxy handler", () => {
  it("returns health without touching the store", async () => {
    const store = createMemoryStore();

    const response = await handleSyncProxyRequest(store, {
      method: "GET",
      url: "/api/health",
      body: ""
    });

    expect(response).toMatchObject({
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ ok: true })
    });
    expect(store.saveCalls).toEqual([]);
  });

  it("returns health under the routed /api/sync prefix", async () => {
    const store = createMemoryStore();

    const response = await handleSyncProxyRequest(store, {
      method: "GET",
      url: "/api/sync/health",
      body: ""
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ ok: true }));
  });

  it("returns health under the standalone /sync route", async () => {
    const store = createMemoryStore();

    const response = await handleSyncProxyRequest(store, {
      method: "GET",
      url: "/sync/health",
      body: ""
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ ok: true }));
  });

  it("pulls an empty household snapshot at revision zero", async () => {
    const store = createMemoryStore();

    const response = await handleSyncProxyRequest(store, createPullRequest(null));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ snapshot: RemoteSnapshot }>(response.body);
    expect(body.snapshot).toMatchObject({
      remoteRevision: 0,
      letters: [],
      draftPapers: []
    });
    expect(body.snapshot.syncCursors.find((cursor) => cursor.deviceId === deviceA)).toMatchObject({
      householdId,
      memberId: memberZhou,
      remoteRevision: 0
    });
  });

  it("pushes the first household snapshot and increments revision", async () => {
    const store = createMemoryStore();
    const snapshot = createSnapshot(createStateWithLetter("arrived"), deviceA, 0);

    const response = await handleSyncProxyRequest(
      store,
      createPushRequest({
        deviceId: deviceA,
        memberId: memberZhou,
        baseRemoteRevision: null,
        snapshot
      })
    );

    expect(response.statusCode).toBe(200);
    const body = parseBody<{
      acceptedRemoteRevision: number;
      snapshot: RemoteSnapshot;
    }>(response.body);
    expect(body.acceptedRemoteRevision).toBe(1);
    expect(body.snapshot.remoteRevision).toBe(1);
    expect(store.snapshot?.remoteRevision).toBe(1);
  });

  it("rejects stale pushes without mutating the stored snapshot", async () => {
    const existing = createSnapshot(createStateWithLetter("arrived"), deviceA, 2);
    const store = createMemoryStore(existing);
    const incoming = createSnapshot(createStateWithLetter("opened"), deviceB, 1);

    const response = await handleSyncProxyRequest(
      store,
      createPushRequest({
        deviceId: deviceB,
        memberId: memberLan,
        baseRemoteRevision: 1,
        snapshot: incoming
      })
    );

    expect(response.statusCode).toBe(409);
    expect(parseBody(response.body)).toEqual({
      error: "stale_remote_revision"
    });
    expect(store.snapshot).toEqual(existing);
  });

  it("redacts unarrived incoming letters and filters private drafts in client snapshots", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handleSyncProxyRequest(store, createPullRequest(2, memberLan));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ snapshot: RemoteSnapshot }>(response.body);
    const incomingLetter = body.snapshot.letters.find((letter) => letter.id === "letter-to-lan");
    expect(incomingLetter).toMatchObject({
      id: "letter-to-lan",
      state: "in_transit"
    });
    expect(incomingLetter?.body).toBeUndefined();
    expect(incomingLetter?.excerpt).toBeUndefined();
    expect(incomingLetter?.oralText).toBeUndefined();
    expect(incomingLetter?.scribeDraft).toBeUndefined();
    expect(incomingLetter?.generationMeta).toBeUndefined();
    expect(body.snapshot.draftPapers.map((draft) => draft.authorMemberId)).toEqual([memberLan]);
    expect(body.snapshot.draftPapers.find((draft) => draft.id === "draft-private-zhou")).toBeUndefined();
    expect(body.snapshot.photoAttachments).toEqual([]);
  });

  it("keeps sender-visible unarrived letter content", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handleSyncProxyRequest(store, createPullRequest(2, memberZhou));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ snapshot: RemoteSnapshot }>(response.body);
    const outgoingLetter = body.snapshot.letters.find((letter) => letter.id === "letter-to-lan");
    expect(outgoingLetter).toMatchObject({
      body: "兰卿：近日雨止，院中石榴开了。",
      excerpt: "近日雨止，院中石榴开了。",
      oralText: "告诉她我平安。"
    });
  });

  it("does not expose raw store errors", async () => {
    const store = createMemoryStore();
    store.failLoad = new Error("database exploded with secret-token");

    const response = await handleSyncProxyRequest(store, createPullRequest(null));

    expect(response.statusCode).toBe(500);
    expect(response.body).toBe(JSON.stringify({ error: "sync_unavailable" }));
    expect(response.body).not.toContain("secret-token");
  });

  it("rejects member impersonation when auth is required", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handleSyncProxyRequest(
      store,
      createPullRequest(2, memberZhou, {
        "x-pinganpi-sync-token": "token-lan"
      }),
      createAuthConfig()
    );

    expect(response.statusCode).toBe(401);
    expect(parseBody(response.body)).toEqual({
      error: "unauthorized"
    });
  });

  it("allows member-scoped pull when auth token matches the requested member", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handleSyncProxyRequest(
      store,
      createPullRequest(2, memberLan, {
        authorization: "Bearer token-lan"
      }),
      createAuthConfig()
    );

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ snapshot: RemoteSnapshot }>(response.body);
    expect(body.snapshot.draftPapers.map((draft) => draft.authorMemberId)).toEqual([memberLan]);
  });

  it("uses account membership auth instead of trusting client household or member ids", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handleSyncProxyRequest(
      store,
      createPullRequest(2, "member-tampered", {
        "x-pinganpi-auth-uid": "auth-lan"
      }, "household-tampered"),
      createAccountAuthConfig()
    );

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ snapshot: RemoteSnapshot }>(response.body);
    expect(body.snapshot.draftPapers.map((draft) => draft.authorMemberId)).toEqual([memberLan]);
    expect(body.snapshot.syncCursors.find((cursor) => cursor.deviceId === deviceA)).toMatchObject({
      householdId,
      memberId: memberLan
    });
  });

  it("rejects account membership auth when no trusted uid is present", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handleSyncProxyRequest(store, createPullRequest(2, memberLan), createAccountAuthConfig());

    expect(response.statusCode).toBe(401);
    expect(parseBody(response.body)).toEqual({
      error: "unauthorized"
    });
  });
});

interface MemoryStore extends SyncSnapshotStore {
  snapshot: RemoteSnapshot | null;
  saveCalls: Array<{ expectedRemoteRevision: number | null; snapshot: RemoteSnapshot }>;
  failLoad?: Error;
}

function createMemoryStore(snapshot: RemoteSnapshot | null = null): MemoryStore {
  return {
    snapshot,
    saveCalls: [],
    async loadSnapshot() {
      if (this.failLoad !== undefined) {
        throw this.failLoad;
      }

      return this.snapshot;
    },
    async saveSnapshot(input) {
      if (this.snapshot !== null && input.expectedRemoteRevision !== this.snapshot.remoteRevision) {
        throw new StaleRemoteRevisionError(this.snapshot.remoteRevision, input.expectedRemoteRevision);
      }

      this.saveCalls.push({
        expectedRemoteRevision: input.expectedRemoteRevision,
        snapshot: input.snapshot
      });
      this.snapshot = input.snapshot;
    }
  };
}

function createPullRequest(
  sinceRemoteRevision: number | null,
  memberId = memberZhou,
  headers: Record<string, string | undefined> = {},
  requestedHouseholdId = householdId
): SyncProxyRequest {
  return {
    method: "POST",
    url: "/api/sync/pull",
    headers,
    body: JSON.stringify({
      householdId: requestedHouseholdId,
      deviceId: deviceA,
      memberId,
      sinceRemoteRevision
    })
  };
}

function createPushRequest(input: {
  deviceId: string;
  memberId: string;
  baseRemoteRevision: number | null;
  snapshot: RemoteSnapshot;
}): SyncProxyRequest {
  return {
    method: "POST",
    url: "/api/sync/push",
    body: JSON.stringify({
      householdId,
      ...input
    })
  };
}

function createSnapshot(state: AppState, deviceId: string, remoteRevision: number): RemoteSnapshot {
  const snapshot = createRemoteSnapshotFromAppState(state, {
    householdId,
    deviceId,
    exportedAtIso: "2026-05-24T05:00:00.000Z",
    remoteRevision
  });

  if (state.letters.some((letter) => letter.hasPhoto)) {
    snapshot.photoAttachments = [
      {
        remoteId: "photo-secret",
        localId: "photo-secret",
        householdId,
        remoteRevision,
        createdAtIso: "2026-05-24T05:00:00.000Z",
        updatedAtIso: "2026-05-24T05:00:00.000Z",
        createdByDeviceId: deviceId,
        updatedByDeviceId: deviceId,
        id: "photo-secret",
        letterId: "letter-to-lan",
        ownerMemberId: memberZhou,
        accessState: "pending_arrival",
        fileName: "secret.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        checksumSha256: "abc",
        storageKey: "private/storage/key",
        thumbnailUrl: "https://example.com/thumb",
        downloadUrl: "https://example.com/download"
      }
    ];
  }

  return snapshot;
}

function createStateWithLetter(state: PersistedLetter["state"]): AppState {
  const appState = createDefaultAppState();
  appState.letters = [createLetter("letter-to-lan", state)];

  return appState;
}

function createStateWithPrivateData(): AppState {
  const appState = createStateWithLetter("in_transit");
  appState.draftPapers = [
    createDraft("draft-private-zhou", memberZhou, "周明远的私信草稿"),
    createDraft("draft-private-lan", memberLan, "兰卿的私信草稿")
  ];
  appState.letters[0] = {
    ...appState.letters[0]!,
    oralText: "告诉她我平安。",
    scribeDraft: "兰卿吾爱，余在杭城平安。",
    finalText: "兰卿吾爱，余在杭城平安。",
    generationMeta: {
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      model: "mimo-test",
      promptVersion: "pinganpi-scribe-v1",
      scribeId: "scribe-wang",
      sceneTags: ["平安"],
      letterType: "ordinary",
      senderCity: "杭州",
      recipientCity: "西安",
      latencyMs: 120
    }
  };

  return appState;
}

function createLetter(id: string, state: PersistedLetter["state"]): PersistedLetter {
  return {
    id,
    senderId: memberZhou,
    recipientId: memberLan,
    subject: "杭州来信",
    state,
    sentAtIso: "2026-05-24T04:30:00.000Z",
    distanceKm: 1200,
    registered: false,
    hasPhoto: true,
    important: false,
    excerpt: "近日雨止，院中石榴开了。",
    body: "兰卿：近日雨止，院中石榴开了。"
  };
}

function createDraft(id: string, authorMemberId: string, finalText: string): DraftPaper {
  return {
    id,
    authorMemberId,
    recipientMemberId: authorMemberId === memberZhou ? memberLan : memberZhou,
    createdAtIso: "2026-05-24T04:10:00.000Z",
    updatedAtIso: "2026-05-24T04:20:00.000Z",
    oralText: finalText,
    scribeId: null,
    scribeDraft: finalText,
    finalText,
    status: "draft"
  };
}

function parseBody<T = unknown>(body: string): T {
  return JSON.parse(body) as T;
}

function createAuthConfig(): SyncProxyAuthConfig {
  return {
    required: true,
    memberTokens: {
      [householdId]: {
        [memberZhou]: "token-zhou",
        [memberLan]: "token-lan"
      }
    }
  };
}

function createAccountAuthConfig(): SyncProxyAuthConfig {
  return {
    required: true,
    memberTokens: {},
    accountBindings: {
      "auth-lan": {
        accountId: "account-lan",
        householdId,
        memberId: memberLan
      }
    }
  };
}

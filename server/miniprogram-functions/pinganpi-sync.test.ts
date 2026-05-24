import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type DraftPaper, type PersistedLetter } from "../../src/app/app-state.js";
import type { RemoteSnapshot } from "../../src/app/sync/remote-model.js";
import { createRemoteSnapshotFromAppState } from "../../src/app/sync/remote-snapshot.js";
import { StaleRemoteRevisionError, type SyncSnapshotStore } from "../sync-proxy/handler.js";
import { handlePinganpiSyncEvent } from "./pinganpi-sync.js";

const householdId = "household-main";
const deviceA = "device-a";
const memberZhou = "member-zhou";
const memberLan = "member-lan";

describe("pinganpi sync miniprogram function", () => {
  it("serves health without touching the store", async () => {
    const store = createMemoryStore();

    await expect(handlePinganpiSyncEvent(store, { action: "health" })).resolves.toEqual({
      ok: true,
      action: "health",
      data: { ok: true }
    });
    expect(store.saveCalls).toEqual([]);
  });

  it("pulls through the existing sync handler and returns a redacted snapshot", async () => {
    const store = createMemoryStore(createSnapshot(createStateWithPrivateData(), deviceA, 3));

    const response = await handlePinganpiSyncEvent(store, {
      action: "pull",
      payload: {
        householdId,
        deviceId: deviceA,
        memberId: memberLan,
        sinceRemoteRevision: 2
      }
    });

    expect(response.ok).toBe(true);
    expect(response.action).toBe("pull");
    if (!response.ok) {
      throw new Error("Expected pull to succeed.");
    }

    const snapshot = readRemoteSnapshot(response.data, "snapshot");
    const incomingLetter = snapshot.letters.find((letter) => letter.id === "letter-to-lan");
    expect(incomingLetter).toMatchObject({
      id: "letter-to-lan",
      state: "in_transit"
    });
    expect(incomingLetter?.body).toBeUndefined();
    expect(incomingLetter?.excerpt).toBeUndefined();
    expect(incomingLetter?.oralText).toBeUndefined();
    expect(incomingLetter?.scribeDraft).toBeUndefined();
    expect(incomingLetter?.generationMeta).toBeUndefined();
    expect(snapshot.draftPapers.map((draft) => draft.authorMemberId)).toEqual([memberLan]);
    expect(snapshot.photoAttachments).toEqual([]);
  });

  it("pushes through the existing sync handler and returns the accepted revision", async () => {
    const store = createMemoryStore();
    const snapshot = createSnapshot(createStateWithLetter("arrived"), deviceA, 0);

    const response = await handlePinganpiSyncEvent(store, {
      action: "push",
      payload: {
        householdId,
        deviceId: deviceA,
        memberId: memberZhou,
        baseRemoteRevision: null,
        snapshot
      }
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error("Expected push to succeed.");
    }

    expect(readAcceptedRemoteRevision(response.data)).toBe(1);
    expect(store.snapshot?.remoteRevision).toBe(1);
  });

  it("uses the dev event payload namespace even when no HTTP auth headers exist", async () => {
    const store = createMemoryStore();
    const snapshot = createSnapshot(createStateWithLetter("arrived"), deviceA, 0);

    const response = await handlePinganpiSyncEvent(store, {
      action: "push",
      payload: {
        householdId,
        deviceId: deviceA,
        memberId: memberZhou,
        baseRemoteRevision: null,
        snapshot
      }
    });

    expect(response.ok).toBe(true);
    expect(store.snapshot?.household?.householdId ?? store.snapshot?.members[0]?.householdId).toBe(householdId);
  });

  it("returns not_found for unknown actions", async () => {
    const response = await handlePinganpiSyncEvent(createMemoryStore(), { action: "deleteEverything" });

    expect(response).toEqual({
      ok: false,
      action: "deleteEverything",
      reason: "not_found",
      message: "Unknown miniprogram sync action.",
      statusCode: 404
    });
  });
});

interface MemoryStore extends SyncSnapshotStore {
  snapshot: RemoteSnapshot | null;
  saveCalls: Array<{ expectedRemoteRevision: number | null; snapshot: RemoteSnapshot }>;
}

function readRemoteSnapshot(value: unknown, key: string): RemoteSnapshot {
  if (!isRecord(value) || !isRemoteSnapshot(value[key])) {
    throw new Error(`Expected ${key} to be a remote snapshot.`);
  }

  return value[key];
}

function readAcceptedRemoteRevision(value: unknown): number {
  if (!isRecord(value) || typeof value.acceptedRemoteRevision !== "number") {
    throw new Error("Expected acceptedRemoteRevision.");
  }

  return value.acceptedRemoteRevision;
}

function isRemoteSnapshot(value: unknown): value is RemoteSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.letters) &&
    Array.isArray(value.draftPapers) &&
    Array.isArray(value.photoAttachments) &&
    typeof value.remoteRevision === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createMemoryStore(snapshot: RemoteSnapshot | null = null): MemoryStore {
  return {
    snapshot,
    saveCalls: [],
    async loadSnapshot() {
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

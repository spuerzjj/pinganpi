import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type DraftPaper, type PersistedLetter } from "../app-state.js";
import type { RemoteSnapshot, SyncAdapter, SyncPushInput, SyncPushResult } from "./remote-model.js";
import { createRemoteSnapshotFromAppState } from "./remote-snapshot.js";
import { createDefaultLocalSyncState, type LocalSyncState } from "./sync-state.js";
import {
  prepareOnlineMutation,
  pullRemoteChanges,
  pushLocalChanges,
  syncNow,
  SYNC_ERROR_MESSAGES
} from "./sync-runtime.js";

const householdId = "household-main";
const deviceA = "device-a";
const deviceB = "device-b";
const memberId = "member-zhou";
const now = new Date("2026-05-24T03:00:00.000Z");
const nowIso = now.toISOString();

describe("sync runtime", () => {
  it("pulls remote changes, merges them into local state, and marks sync as successful", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({ lastRemoteRevision: 1 });
    const remoteSnapshot = createSnapshotWithLetter(4);
    const adapter = createRecordingAdapter({ pullSnapshot: remoteSnapshot });

    const result = await pullRemoteChanges({ state, syncState, adapter, now });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("pull should succeed");
    }
    expect(adapter.pulls).toEqual([
      {
        householdId,
        deviceId: deviceA,
        memberId,
        sinceRemoteRevision: 1
      }
    ]);
    expect(result.state.letters.find((letter) => letter.id === `${deviceB}@@letter-from-device-b`)).toMatchObject({
      body: "周郎：西安风定，窗前灯影很静。"
    });
    expect(result.syncState).toMatchObject({
      lastRemoteRevision: 4,
      lastSyncedAtIso: nowIso,
      status: "synced",
      lastError: null
    });
    expect(result.snapshot).toBe(remoteSnapshot);
  });

  it("pushes local changes as a remote snapshot and records the accepted revision", async () => {
    const state = createDefaultAppState();
    state.draftPapers = [createDraft("draft-local", "本地待同步草稿")];
    const syncState = createSyncState({ lastRemoteRevision: 5 });
    const adapter = createRecordingAdapter({ acceptedRevision: 6 });

    const result = await pushLocalChanges({ state, syncState, adapter, now });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("push should succeed");
    }
    expect(adapter.pushes).toHaveLength(1);
    expect(adapter.pushes[0]).toMatchObject({
      householdId,
      deviceId: deviceA,
      baseRemoteRevision: 5
    });
    expect(adapter.pushes[0]?.snapshot).toMatchObject({
      exportedAtIso: nowIso,
      remoteRevision: 5
    });
    expect(adapter.pushes[0]?.snapshot.draftPapers.find((draft) => draft.id === "draft-local")).toMatchObject({
      finalText: "本地待同步草稿"
    });
    expect(result.syncState).toMatchObject({
      lastRemoteRevision: 6,
      lastSyncedAtIso: nowIso,
      status: "synced",
      lastError: null
    });
  });

  it("syncNow pulls first and then pushes the merged local state by default", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({ lastRemoteRevision: null });
    const remoteSnapshot = createSnapshotWithLetter(2);
    const adapter = createRecordingAdapter({ pullSnapshot: remoteSnapshot, acceptedRevision: 3 });

    const result = await syncNow({ state, syncState, adapter, now });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("syncNow should succeed");
    }
    expect(adapter.calls).toEqual(["pull", "push"]);
    expect(adapter.pushes[0]?.baseRemoteRevision).toBe(2);
    expect(adapter.pushes[0]?.snapshot.letters.find((letter) => letter.id === `${deviceB}@@letter-from-device-b`)).toMatchObject({
      body: "周郎：西安风定，窗前灯影很静。"
    });
    expect(result.state.letters.find((letter) => letter.id === `${deviceB}@@letter-from-device-b`)).toBeDefined();
    expect(result.syncState.lastRemoteRevision).toBe(3);
  });

  it("prepareOnlineMutation only pulls and returns the latest local state for guarded operations", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({ lastRemoteRevision: 1 });
    const remoteSnapshot = createSnapshotWithLetter(7);
    const adapter = createRecordingAdapter({ pullSnapshot: remoteSnapshot });

    const result = await prepareOnlineMutation({ state, syncState, adapter, now });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("prepareOnlineMutation should succeed");
    }
    expect(adapter.calls).toEqual(["pull"]);
    expect(result.state.letters.find((letter) => letter.id === `${deviceB}@@letter-from-device-b`)).toBeDefined();
    expect(result.syncState.lastRemoteRevision).toBe(7);
  });

  it("uses the latest local revision as the next push base after a successful pull", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({ lastRemoteRevision: 3 });
    const adapter = createRecordingAdapter({ pullSnapshot: createSnapshotWithLetter(8), acceptedRevision: 9 });

    const result = await syncNow({ state, syncState, adapter, now });

    expect(result.ok).toBe(true);
    expect(adapter.pushes[0]?.baseRemoteRevision).toBe(8);
    if (result.ok) {
      expect(result.syncState.lastRemoteRevision).toBe(9);
    }
  });

  it("returns a short failed sync state when the adapter fails without exposing the raw error", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({ lastRemoteRevision: 2 });
    const adapter = createRecordingAdapter({ pullError: new Error("provider exploded with secret detail") });

    const result = await prepareOnlineMutation({ state, syncState, adapter, now });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("prepareOnlineMutation should fail");
    }
    expect(result.reason).toBe("pull_failed");
    expect(result.state).toEqual(state);
    expect(result.syncState).toMatchObject({
      lastRemoteRevision: 2,
      lastSyncedAtIso: null,
      status: "failed",
      lastError: SYNC_ERROR_MESSAGES.pullFailed
    });
    expect(result.syncState.lastError).not.toContain("provider exploded");
    expect(result.syncState.lastError).not.toContain("secret");
  });

  it("keeps local drafts intact when push fails", async () => {
    const state = createDefaultAppState();
    state.draftPapers = [createDraft("draft-survives-failure", "推送失败后仍留在本地")];
    const syncState = createSyncState({ lastRemoteRevision: 4 });
    const adapter = createRecordingAdapter({ pushError: new Error("raw cloud failure") });

    const result = await pushLocalChanges({ state, syncState, adapter, now });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("push should fail");
    }
    expect(result.reason).toBe("push_failed");
    expect(result.state.draftPapers).toEqual(state.draftPapers);
    expect(result.syncState).toMatchObject({
      lastRemoteRevision: 4,
      status: "failed",
      lastError: SYNC_ERROR_MESSAGES.pushFailed
    });
  });

  it("reports stale push conflicts without exposing raw adapter details", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({ lastRemoteRevision: 4 });
    const adapter = createRecordingAdapter({
      pushError: {
        code: "stale_remote_revision",
        detail: "remote wallet moved with private detail"
      }
    });

    const result = await pushLocalChanges({ state, syncState, adapter, now });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("push should fail with conflict");
    }
    expect(result.reason).toBe("conflict");
    expect(result.syncState).toMatchObject({
      lastRemoteRevision: 4,
      status: "failed",
      lastError: SYNC_ERROR_MESSAGES.conflict
    });
    expect(result.syncState.lastError).not.toContain("private detail");
  });

  it("redacts the returned push snapshot for the current member", async () => {
    const state = createDefaultAppState();
    const syncState = createSyncState({
      memberId: "member-lan",
      deviceId: deviceB,
      lastRemoteRevision: 4
    });
    const fullSnapshot = createRemoteSnapshotFromAppState(
      {
        ...createDefaultAppState(),
        letters: [createLetterToLan("letter-not-yet-arrived", "in_transit")]
      },
      {
        householdId,
        deviceId: deviceA,
        exportedAtIso: "2026-05-24T02:30:00.000Z",
        remoteRevision: 5
      }
    );
    const adapter = createRecordingAdapter({ pushSnapshot: fullSnapshot, acceptedRevision: 5 });

    const result = await pushLocalChanges({ state, syncState, adapter, now });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("push should succeed");
    }
    const returnedLetter = result.snapshot?.letters.find((letter) => letter.id === "letter-not-yet-arrived");
    expect(returnedLetter).toMatchObject({
      id: "letter-not-yet-arrived",
      state: "in_transit"
    });
    expect(returnedLetter?.body).toBeUndefined();
    expect(returnedLetter?.excerpt).toBeUndefined();
  });
});

function createSyncState(overrides: Partial<LocalSyncState> = {}): LocalSyncState {
  return {
    ...createDefaultLocalSyncState({
      householdId,
      memberId,
      deviceId: deviceA
    }),
    ...overrides
  };
}

function createSnapshotWithLetter(remoteRevision: number): RemoteSnapshot {
  const state = createDefaultAppState();
  state.currentMemberId = "member-lan";
  state.recipientMemberId = "member-zhou";
  state.letters = [createLetter("letter-from-device-b")];
  state.postalRecords = [];

  return createRemoteSnapshotFromAppState(state, {
    householdId,
    deviceId: deviceB,
    exportedAtIso: "2026-05-24T02:30:00.000Z",
    remoteRevision
  });
}

function createDraft(id: string, finalText: string): DraftPaper {
  return {
    id,
    authorMemberId: memberId,
    recipientMemberId: "member-lan",
    createdAtIso: "2026-05-24T02:00:00.000Z",
    updatedAtIso: "2026-05-24T02:05:00.000Z",
    oralText: finalText,
    scribeId: null,
    scribeDraft: finalText,
    finalText,
    status: "draft"
  };
}

function createLetter(id: string, state: PersistedLetter["state"] = "arrived"): PersistedLetter {
  return {
    id,
    senderId: "member-lan",
    recipientId: memberId,
    subject: "西安来信",
    state,
    sentAtIso: "2026-05-24T01:30:00.000Z",
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: false,
    excerpt: "西安风定，窗前灯影很静。",
    body: "周郎：西安风定，窗前灯影很静。"
  };
}

function createLetterToLan(id: string, state: PersistedLetter["state"]): PersistedLetter {
  return {
    ...createLetter(id, state),
    senderId: "member-zhou",
    recipientId: "member-lan",
    subject: "杭州来信",
    excerpt: "近日雨止，院中石榴开了。",
    body: "兰卿：近日雨止，院中石榴开了。"
  };
}

function createRecordingAdapter(options: {
  pullSnapshot?: RemoteSnapshot;
  pushSnapshot?: RemoteSnapshot;
  acceptedRevision?: number;
  pullError?: unknown;
  pushError?: unknown;
}): SyncAdapter & {
  calls: string[];
  pulls: Parameters<SyncAdapter["pull"]>[0][];
  pushes: SyncPushInput[];
} {
  const calls: string[] = [];
  const pulls: Parameters<SyncAdapter["pull"]>[0][] = [];
  const pushes: SyncPushInput[] = [];

  return {
    calls,
    pulls,
    pushes,
    async pull(input) {
      calls.push("pull");
      pulls.push(input);

      if (options.pullError !== undefined) {
        throw options.pullError;
      }

      return options.pullSnapshot ?? createEmptySnapshot(input.householdId, input.deviceId, 0);
    },
    async push(input) {
      calls.push("push");
      pushes.push(input);

      if (options.pushError !== undefined) {
        throw options.pushError;
      }

      const acceptedRemoteRevision = options.acceptedRevision ?? (input.baseRemoteRevision ?? 0) + 1;

      return createPushResult(input, acceptedRemoteRevision, options.pushSnapshot);
    }
  };
}

function createEmptySnapshot(householdIdValue: string, deviceIdValue: string, remoteRevision: number): RemoteSnapshot {
  return createRemoteSnapshotFromAppState(createDefaultAppState(), {
    householdId: householdIdValue,
    deviceId: deviceIdValue,
    exportedAtIso: "2026-05-24T02:30:00.000Z",
    remoteRevision
  });
}

function createPushResult(input: SyncPushInput, acceptedRemoteRevision: number, snapshot: RemoteSnapshot = input.snapshot): SyncPushResult {
  return {
    householdId: input.householdId,
    deviceId: input.deviceId,
    acceptedRemoteRevision,
    cursor: {
      householdId: input.householdId,
      deviceId: input.deviceId,
      memberId,
      remoteRevision: acceptedRemoteRevision,
      lastPulledAtIso: null,
      lastPushedAtIso: nowIso,
      updatedAtIso: nowIso
    },
    snapshot: {
      ...snapshot,
      remoteRevision: acceptedRemoteRevision,
      exportedAtIso: nowIso
    }
  };
}

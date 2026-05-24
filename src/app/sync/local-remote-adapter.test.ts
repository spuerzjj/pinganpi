import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type PersistedLetter, type PostalRecord } from "../app-state.js";
import { createMemoryKeyValueStorage } from "../app-state-storage.js";
import { createRemoteSnapshotFromAppState } from "./remote-snapshot.js";
import { createLocalStorageRemoteSyncAdapter, createRemoteSnapshotStorageKey } from "./local-remote-adapter.js";

const householdId = "household-main";
const deviceA = "device-a";
const deviceB = "device-b";

describe("local storage remote sync adapter", () => {
  it("stores one household remote snapshot that multiple devices can share", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapterA = createLocalStorageRemoteSyncAdapter(storage);
    const adapterB = createLocalStorageRemoteSyncAdapter(storage);
    const stateA = createStateWithArrivedLetter();

    await adapterA.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    const pulledByB = await adapterB.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });

    expect(storage.getItem(createRemoteSnapshotStorageKey(householdId))).not.toBeNull();
    expect(pulledByB.remoteRevision).toBe(1);
    expect(pulledByB.letters.find((letter) => letter.id === "letter-device-a-new")).toMatchObject({
      id: "letter-device-a-new",
      state: "arrived",
      body: "兰卿：近日雨止，院中石榴开了。"
    });
  });

  it("redacts an incoming letter body for the recipient before arrival", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalStorageRemoteSyncAdapter(storage);
    const stateA = createDefaultAppState();
    stateA.letters = [createLetter("letter-not-arrived", "in_transit")];

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    const pulledByRecipient = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });
    const pulledBySender = await adapter.pull({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      sinceRemoteRevision: null
    });
    const pulledByUnknownMember = await adapter.pull({
      householdId,
      deviceId: "device-unknown",
      memberId: "member-unknown",
      sinceRemoteRevision: null
    });

    const redactedLetter = requireRemoteLetter(pulledByRecipient, "letter-not-arrived");
    expect(redactedLetter).toMatchObject({
      id: "letter-not-arrived",
      state: "in_transit"
    });
    expect(redactedLetter.body).toBeUndefined();
    expect(redactedLetter.excerpt).toBeUndefined();
    expect(requireRemoteLetter(pulledBySender, "letter-not-arrived")).toMatchObject({
      body: "兰卿：近日雨止，院中石榴开了。",
      excerpt: "近日雨止，院中石榴开了。"
    });
    expect(requireRemoteLetter(pulledByUnknownMember, "letter-not-arrived").body).toBeUndefined();
  });

  it("redacts unarrived letters for unknown members instead of treating them as senders", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalStorageRemoteSyncAdapter(storage);
    const stateA = createDefaultAppState();
    stateA.letters = [createLetter("letter-for-unknown-member-check", "in_transit")];

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    const pulledByUnknownMember = await adapter.pull({
      householdId,
      deviceId: "device-unknown",
      memberId: "member-unknown",
      sinceRemoteRevision: null
    });
    const unknownMemberLetter = requireRemoteLetter(pulledByUnknownMember, "letter-for-unknown-member-check");

    expect(unknownMemberLetter.body).toBeUndefined();
    expect(unknownMemberLetter.excerpt).toBeUndefined();
    expect(unknownMemberLetter.generationMeta).toBeUndefined();
  });

  it("returns deep copies so callers cannot pollute stored remote snapshots", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalStorageRemoteSyncAdapter(storage);
    const stateA = createStateWithArrivedLetter();

    const pushed = await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });
    const pushedLetter = requireRemoteLetter(pushed.snapshot, "letter-device-a-new");
    pushedLetter.subject = "被 push 返回值污染";

    const pulled = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });
    const pulledLetter = requireRemoteLetter(pulled, "letter-device-a-new");
    pulledLetter.subject = "被 pull 返回值污染";
    pulled.letters.push({
      ...pulledLetter,
      id: "letter-contaminated"
    });

    const pulledAgain = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });

    expect(pulledAgain.letters.find((letter) => letter.id === "letter-contaminated")).toBeUndefined();
    expect(requireRemoteLetter(pulledAgain, "letter-device-a-new").subject).toBe("新寄西安一封");
  });

  it("rejects stale pushes when the base remote revision is no longer current", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalStorageRemoteSyncAdapter(storage);
    const stateA = createStateWithArrivedLetter();
    const stateB = createDefaultAppState();
    stateB.letters.push(createLetter("letter-device-b-new", "arrived"));

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    await expect(
      adapter.push({
        householdId,
        deviceId: deviceB,
        memberId: "member-lan",
        baseRemoteRevision: 0,
        snapshot: createSnapshot(stateB, deviceB, "2026-05-24T02:05:00.000Z", 0)
      })
    ).rejects.toMatchObject({
      code: "stale_remote_revision"
    });
  });

  it("falls back to an empty remote snapshot when stored data is polluted", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalStorageRemoteSyncAdapter(storage);
    storage.setItem(
      createRemoteSnapshotStorageKey(householdId),
      JSON.stringify({
        household: { id: "other-household", householdId: "other-household" },
        remoteRevision: Number.NaN
      })
    );

    const pulled = await adapter.pull({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      sinceRemoteRevision: null
    });

    expect(pulled.remoteRevision).toBe(0);
    expect(pulled.letters).toEqual([]);
    expect(pulled.syncCursors.find((cursor) => cursor.deviceId === deviceA)).toMatchObject({
      householdId,
      remoteRevision: 0
    });
  });
});

function createStateWithArrivedLetter(): AppState {
  const state = createDefaultAppState();
  state.letters.push(createLetter("letter-device-a-new", "arrived"));
  state.postalRecords.push(createPostalRecord("postal-device-a-new-arrived", "letter-device-a-new", "清波门投递。"));

  return state;
}

function createSnapshot(state: AppState, deviceId: string, exportedAtIso: string, remoteRevision: number) {
  return createRemoteSnapshotFromAppState(state, {
    householdId,
    deviceId,
    exportedAtIso,
    remoteRevision
  });
}

function createLetter(id: string, state: PersistedLetter["state"]): PersistedLetter {
  return {
    id,
    senderId: "member-zhou",
    recipientId: "member-lan",
    subject: "新寄西安一封",
    state,
    sentAtIso: "2026-05-24T01:30:00.000Z",
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: false,
    excerpt: "近日雨止，院中石榴开了。",
    body: "兰卿：近日雨止，院中石榴开了。"
  };
}

function createPostalRecord(id: string, letterId: string, text: string): PostalRecord {
  return {
    id,
    letterId,
    atIso: "2026-05-24T01:35:00.000Z",
    text
  };
}

function requireRemoteLetter(snapshot: ReturnType<typeof createSnapshot>, letterId: string) {
  const letter = snapshot.letters.find((candidate) => candidate.id === letterId);

  if (letter === undefined) {
    throw new Error(`Missing remote letter: ${letterId}`);
  }

  return letter;
}

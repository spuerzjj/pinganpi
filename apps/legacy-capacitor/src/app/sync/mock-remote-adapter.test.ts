import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type DraftPaper, type PersistedLetter, type PostalRecord } from "../app-state.js";
import { createMockRemoteSyncAdapter } from "./mock-remote-adapter.js";
import { createRemoteSnapshotFromAppState, mergeRemoteSnapshotIntoAppState } from "./remote-snapshot.js";

const householdId = "household-main";
const deviceA = "device-a";
const deviceB = "device-b";

describe("mock remote sync adapter", () => {
  it("lets device B pull new letters and postal records after device A pushes", async () => {
    const adapter = createMockRemoteSyncAdapter();
    const stateA = createStateWithNewLetter();

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    const pulledByB = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });

    expect(pulledByB.remoteRevision).toBe(1);
    expect(pulledByB.letters.find((letter) => letter.id === "letter-device-a-new")).toMatchObject({
      id: "letter-device-a-new",
      state: "arrived",
      body: "兰卿：近日雨止，院中石榴开了。"
    });
    expect(pulledByB.postalRecords.find((record) => record.id === "postal-device-a-new-arrived")).toMatchObject({
      id: "postal-device-a-new-arrived",
      letterId: "letter-device-a-new"
    });
    expect(pulledByB.syncCursors.find((cursor) => cursor.deviceId === deviceB)).toMatchObject({
      householdId,
      deviceId: deviceB,
      remoteRevision: 1,
      lastPulledAtIso: expect.any(String),
      lastPushedAtIso: null,
      updatedAtIso: expect.any(String)
    });
  });

  it("redacts incoming letter body for the recipient before arrival", async () => {
    const adapter = createMockRemoteSyncAdapter();
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
  });

  it("merges opened state and deduplicates postal records across devices", async () => {
    const adapter = createMockRemoteSyncAdapter();
    const stateA = createStateWithNewLetter();

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    const pulledByB = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });
    const stateB = mergeRemoteSnapshotIntoAppState(createDefaultAppState(), pulledByB, {
      householdId,
      deviceId: deviceB,
      currentMemberId: "member-lan",
      mergedAtIso: "2026-05-24T02:05:00.000Z",
      remoteRevision: pulledByB.remoteRevision
    });
    requireLetter(stateB, `${deviceA}@@letter-device-a-new`).state = "opened";
    stateB.postalRecords.push(createPostalRecord("postal-device-a-new-opened", `${deviceA}@@letter-device-a-new`, "拆阅登记"));

    const pushByB = await adapter.push({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      baseRemoteRevision: pulledByB.remoteRevision,
      snapshot: createSnapshot(stateB, deviceB, "2026-05-24T02:10:00.000Z", pulledByB.remoteRevision)
    });

    const pulledByA = await adapter.pull({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      sinceRemoteRevision: 1
    });
    const mergedA = mergeRemoteSnapshotIntoAppState(stateA, pulledByA, {
      householdId,
      deviceId: deviceA,
      currentMemberId: "member-zhou",
      mergedAtIso: "2026-05-24T02:15:00.000Z",
      remoteRevision: pulledByA.remoteRevision
    });

    expect(requireLetter(mergedA, "letter-device-a-new").state).toBe("opened");
    expect(mergedA.postalRecords.filter((record) => record.id === "postal-device-a-new-arrived")).toHaveLength(1);
    expect(mergedA.postalRecords.filter((record) => record.text === "拆阅登记" && record.letterId === "letter-device-a-new")).toHaveLength(1);
    expect(pulledByA.syncCursors.map((cursor) => cursor.deviceId).sort()).toEqual([deviceA, deviceB]);
    expect(pulledByA.syncCursors.find((cursor) => cursor.deviceId === deviceA)).toMatchObject({
      lastPulledAtIso: expect.any(String),
      lastPushedAtIso: expect.any(String)
    });
    expect(pushByB.cursor).toMatchObject({
      deviceId: deviceB,
      remoteRevision: 2,
      lastPulledAtIso: expect.any(String),
      lastPushedAtIso: expect.any(String)
    });
  });

  it("keeps another member's private drafts in remote while local merge filters them by current member", async () => {
    const adapter = createMockRemoteSyncAdapter();
    const stateA = createDefaultAppState();
    const stateB = createDefaultAppState();
    stateB.currentMemberId = "member-lan";
    stateB.recipientMemberId = "member-zhou";
    stateB.draftPapers = [createDraftPaper("draft-lan-private", "member-lan", "member-zhou", "静兰未投寄草稿")];

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });
    await adapter.push({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      baseRemoteRevision: 1,
      snapshot: createSnapshot(stateB, deviceB, "2026-05-24T02:05:00.000Z", 1)
    });

    const pulled = await adapter.pull({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      sinceRemoteRevision: 1
    });
    const mergedForA = mergeRemoteSnapshotIntoAppState(stateA, pulled, {
      householdId,
      deviceId: deviceA,
      currentMemberId: "member-zhou",
      mergedAtIso: "2026-05-24T02:10:00.000Z",
      remoteRevision: pulled.remoteRevision
    });
    const mergedForB = mergeRemoteSnapshotIntoAppState({ ...stateB, draftPapers: [] }, pulled, {
      householdId,
      deviceId: deviceB,
      currentMemberId: "member-lan",
      mergedAtIso: "2026-05-24T02:10:00.000Z",
      remoteRevision: pulled.remoteRevision
    });

    expect(pulled.draftPapers.find((draft) => draft.id === "draft-lan-private")).toBeDefined();
    expect(mergedForA.draftPapers.find((draft) => draft.id === "draft-lan-private")).toBeUndefined();
    expect(mergedForB.draftPapers.find((draft) => draft.id === "draft-lan-private")).toMatchObject({
      finalText: "静兰未投寄草稿"
    });
  });

  it("returns deep copies so external mutation cannot pollute remote state", async () => {
    const adapter = createMockRemoteSyncAdapter();
    const stateA = createStateWithNewLetter();

    await adapter.push({
      householdId,
      deviceId: deviceA,
      memberId: "member-zhou",
      baseRemoteRevision: null,
      snapshot: createSnapshot(stateA, deviceA, "2026-05-24T02:00:00.000Z", 0)
    });

    const pulled = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });
    const pulledLetter = requireRemoteLetter(pulled, "letter-device-a-new");
    const pulledPostalRecord = requireRemotePostalRecord(pulled, "postal-device-a-new-arrived");
    pulledLetter.subject = "被外部篡改";
    pulled.letters.push({
      ...pulledLetter,
      id: "letter-contaminated"
    });
    pulled.postalRecords.push({
      ...pulledPostalRecord,
      id: "postal-contaminated",
      letterId: "letter-contaminated",
      text: "污染记录"
    });

    const pulledAgain = await adapter.pull({
      householdId,
      deviceId: deviceB,
      memberId: "member-lan",
      sinceRemoteRevision: null
    });

    expect(pulledAgain.letters.find((letter) => letter.id === "letter-contaminated")).toBeUndefined();
    expect(pulledAgain.postalRecords.find((record) => record.id === "postal-contaminated")).toBeUndefined();
    expect(requireRemoteLetter(pulledAgain, "letter-device-a-new").subject).not.toBe("被外部篡改");
  });
});

function createStateWithNewLetter(): AppState {
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

function createDraftPaper(id: string, authorMemberId: string, recipientMemberId: string, finalText: string): DraftPaper {
  return {
    id,
    authorMemberId,
    recipientMemberId,
    createdAtIso: "2026-05-24T01:00:00.000Z",
    updatedAtIso: "2026-05-24T01:05:00.000Z",
    oralText: finalText,
    scribeId: null,
    scribeDraft: finalText,
    finalText,
    status: "draft"
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

function requireLetter(state: AppState, letterId: string): PersistedLetter {
  const letter = state.letters.find((candidate) => candidate.id === letterId);

  if (letter === undefined) {
    throw new Error(`Missing letter: ${letterId}`);
  }

  return letter;
}

function requireRemoteLetter(snapshot: ReturnType<typeof createSnapshot>, letterId: string) {
  const letter = snapshot.letters.find((candidate) => candidate.id === letterId);

  if (letter === undefined) {
    throw new Error(`Missing remote letter: ${letterId}`);
  }

  return letter;
}

function requireRemotePostalRecord(snapshot: ReturnType<typeof createSnapshot>, recordId: string) {
  const record = snapshot.postalRecords.find((candidate) => candidate.id === recordId);

  if (record === undefined) {
    throw new Error(`Missing remote postal record: ${recordId}`);
  }

  return record;
}

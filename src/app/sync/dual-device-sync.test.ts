import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type DraftPaper } from "../app-state.js";
import { createMemoryKeyValueStorage } from "../app-state-storage.js";
import { openLetter } from "../mailbox-service.js";
import { postLetter } from "../write-letter-service.js";
import { createLocalStorageRemoteSyncAdapter } from "./local-remote-adapter.js";
import { prepareOnlineMutation, pushLocalChanges, syncNow } from "./sync-runtime.js";
import { createDefaultLocalSyncState, type LocalSyncState } from "./sync-state.js";

const householdId = "household-main";
const deviceA = "device-a";
const deviceB = "device-b";
const memberZhou = "member-zhou";
const memberLan = "member-lan";

describe("dual device sync lifecycle", () => {
  it("syncs a posted letter, preserves arrival privacy, and propagates opened state without duplicate records", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalStorageRemoteSyncAdapter(storage);
    const postedAt = new Date("2026-05-24T02:00:00.000Z");
    const arrivedAt = new Date("2026-06-02T02:00:00.000Z");
    let stateA = createStateForMember(memberZhou);
    let stateB = createStateForMember(memberLan);
    let syncA = createSyncState(deviceA, memberZhou);
    let syncB = createSyncState(deviceB, memberLan);

    const postResult = postLetter(
      stateA,
      {
        oralText: "近日雨止，院中石榴开了。",
        scribeId: null,
        scribeDraft: "兰卿：近日雨止，院中石榴开了。",
        readAloudText: "兰卿：近日雨止，院中石榴开了。",
        finalText: "兰卿：近日雨止，院中石榴开了。",
        registered: false
      },
      postedAt
    );

    expect(postResult.ok).toBe(true);
    if (!postResult.ok) {
      throw new Error("post should succeed");
    }
    stateA = postResult.state;

    const pushA = await pushLocalChanges({ state: stateA, syncState: syncA, adapter, now: postedAt });
    expect(pushA.ok).toBe(true);
    if (!pushA.ok) {
      throw new Error("device A push should succeed");
    }
    syncA = pushA.syncState;

    const pullBeforeArrival = await prepareOnlineMutation({ state: stateB, syncState: syncB, adapter, now: postedAt });
    expect(pullBeforeArrival.ok).toBe(true);
    if (!pullBeforeArrival.ok) {
      throw new Error("device B pull should succeed");
    }
    stateB = pullBeforeArrival.state;
    syncB = pullBeforeArrival.syncState;
    const remoteLetterId = `${deviceA}@@${postResult.letterId}`;
    const pulledLetterBeforeArrival = requireLetter(stateB, remoteLetterId);

    expect(pulledLetterBeforeArrival.state).toBe("in_transit");
    expect(pulledLetterBeforeArrival.body).toBe("");
    expect(pulledLetterBeforeArrival.excerpt).toBe("");

    stateB.draftPapers.push(createPrivateDraft("draft-lan-private"));
    const openResult = openLetter(stateB, remoteLetterId, arrivedAt);
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      throw new Error("open should succeed after arrival");
    }
    stateB = openResult.state;

    const pushB = await pushLocalChanges({ state: stateB, syncState: syncB, adapter, now: arrivedAt });
    expect(pushB.ok).toBe(true);
    if (!pushB.ok) {
      throw new Error("device B push should succeed");
    }
    stateB = pushB.state;
    syncB = pushB.syncState;
    expect(requireLetter(stateB, remoteLetterId)).toMatchObject({
      state: "opened",
      body: "兰卿：近日雨止，院中石榴开了。"
    });

    const pullAfterOpened = await syncNow({ state: stateA, syncState: syncA, adapter, now: arrivedAt });
    expect(pullAfterOpened.ok).toBe(true);
    if (!pullAfterOpened.ok) {
      throw new Error("device A sync should succeed");
    }
    stateA = pullAfterOpened.state;
    syncA = pullAfterOpened.syncState;

    expect(requireLetter(stateA, postResult.letterId)).toMatchObject({
      state: "opened",
      body: "兰卿：近日雨止，院中石榴开了。"
    });
    expect(hasDuplicateIds(stateA.ledgerEntries)).toBe(false);
    expect(hasDuplicateIds(stateA.postalRecords)).toBe(false);
    expect(stateA.draftPapers.find((draft) => draft.id.includes("draft-lan-private"))).toBeUndefined();

    const secondPullA = await syncNow({ state: stateA, syncState: syncA, adapter, now: arrivedAt });
    expect(secondPullA.ok).toBe(true);
    if (!secondPullA.ok) {
      throw new Error("second device A sync should succeed");
    }
    expect(hasDuplicateIds(secondPullA.state.ledgerEntries)).toBe(false);
    expect(hasDuplicateIds(secondPullA.state.postalRecords)).toBe(false);
    expect(syncB.lastRemoteRevision).toBeGreaterThanOrEqual(2);
  });
});

function createSyncState(deviceId: string, memberId: string): LocalSyncState {
  return createDefaultLocalSyncState({
    householdId,
    deviceId,
    memberId
  });
}

function createStateForMember(memberId: string): AppState {
  const state = createDefaultAppState();
  const currentMember = state.members.find((member) => member.id === memberId);
  const recipientMember = state.members.find((member) => member.id !== memberId);

  if (currentMember === undefined || recipientMember === undefined) {
    throw new Error(`Missing member setup for ${memberId}`);
  }

  state.currentMemberId = currentMember.id;
  state.recipientMemberId = recipientMember.id;
  state.wallet.ownerMemberId = currentMember.id;
  state.writingRoute = {
    fromCity: currentMember.city,
    toCity: recipientMember.city,
    distanceKm: state.writingRoute.distanceKm
  };
  state.letters = [];
  state.postalRecords = [];
  state.ledgerEntries = [];
  state.draftPapers = [];
  state.draftTombstones = [];

  return state;
}

function createPrivateDraft(id: string): DraftPaper {
  return {
    id,
    authorMemberId: memberLan,
    recipientMemberId: memberZhou,
    createdAtIso: "2026-05-24T03:00:00.000Z",
    updatedAtIso: "2026-05-24T03:00:00.000Z",
    oralText: "这是一张没有投寄的私有草稿。",
    scribeId: null,
    scribeDraft: "明远：这是一张没有投寄的私有草稿。",
    finalText: "明远：这是一张没有投寄的私有草稿。",
    status: "draft"
  };
}

function requireLetter(state: AppState, letterId: string) {
  const letter = state.letters.find((candidate) => candidate.id === letterId);

  if (letter === undefined) {
    throw new Error(`Missing letter: ${letterId}`);
  }

  return letter;
}

function hasDuplicateIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size !== items.length;
}

import { describe, expect, it } from "vitest";
import { createDefaultAppState, type AppState, type DraftPaper, type LedgerEntry, type PersistedLetter, type PostalRecord } from "../app-state.js";
import {
  createRemoteSnapshotFromAppState,
  mergeRemoteSnapshotIntoAppState,
  type RemoteSnapshotWithContext
} from "./remote-snapshot.js";

const householdId = "household-main";
const deviceA = "device-a";
const deviceB = "device-b";
const exportedAtIso = "2026-05-24T02:00:00.000Z";

describe("remote snapshot mapping", () => {
  it("exports AppState into split remote entities", () => {
    const state = createDefaultAppState();
    state.ledgerEntries.push(createLedgerEntry("ledger-local-postage", -8));
    state.draftPapers.push(createDraftPaper("draft-local", "device-a", "2026-05-23T04:00:00.000Z"));

    const snapshot = createRemoteSnapshotFromAppState(state, {
      householdId,
      deviceId: deviceA,
      exportedAtIso,
      remoteRevision: 3
    });

    expect(snapshot.household).toMatchObject({
      id: householdId,
      memberIds: ["member-zhou", "member-lan"],
      householdId,
      remoteRevision: 3
    });
    expect(snapshot.members.map((member) => member.id)).toEqual(["member-zhou", "member-lan"]);
    expect(snapshot.wallets).toHaveLength(1);
    expect(snapshot.wallets[0]).toMatchObject({
      ownerMemberId: "member-zhou",
      balanceFen: state.wallet.balanceFen,
      updatedByDeviceId: deviceA
    });
    expect(snapshot.ledgerEntries[0]).toMatchObject({
      id: "ledger-local-postage",
      ownerMemberId: "member-zhou",
      amountFen: -8
    });
    expect(snapshot.draftPapers[0]).toMatchObject({
      id: "draft-local",
      authorMemberId: "member-zhou",
      updatedByDeviceId: deviceA
    });
    expect(snapshot.letters).toHaveLength(state.letters.length);
    expect(snapshot.postalRecords.length).toBe(state.postalRecords.length);
  });

  it("preserves allowed AI metadata without adding prompt, raw provider response, or keys", () => {
    const state = createDefaultAppState();
    state.draftPapers.push({
      ...createDraftPaper("draft-ai", deviceA, "2026-05-23T04:00:00.000Z"),
      draftSource: "ai",
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        model: "mimo-v2.5-pro",
        promptVersion: "ai-scribe-prompt-v1",
        scribeId: "scribe-xu",
        sceneTags: ["问安"],
        letterType: "ordinary",
        senderCity: "杭州",
        recipientCity: "西安",
        latencyMs: 900,
        failureReason: "timeout"
      },
      promptText: "不该同步的完整提示词",
      rawResponse: "不该同步的 provider 原始响应",
      providerKey: "MIMO_API_KEY"
    } as DraftPaper);

    const snapshot = createRemoteSnapshotFromAppState(state, {
      householdId,
      deviceId: deviceA,
      exportedAtIso,
      remoteRevision: 1
    });

    const remoteDraft = snapshot.draftPapers.find((draft) => draft.id === "draft-ai");
    expect(remoteDraft?.generationMeta).toEqual({
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      model: "mimo-v2.5-pro",
      promptVersion: "ai-scribe-prompt-v1",
      scribeId: "scribe-xu",
      sceneTags: ["问安"],
      letterType: "ordinary",
      senderCity: "杭州",
      recipientCity: "西安",
      latencyMs: 900,
      failureReason: "timeout"
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("MIMO_API_KEY");
    expect(serialized).not.toContain("promptText");
    expect(serialized).not.toContain("rawResponse");
    expect(serialized).not.toContain("choices");
  });
});

describe("remote snapshot merge", () => {
  it("deduplicates append-only ledger and postal records with stable ordering", () => {
    const state = createDefaultAppState();
    state.ledgerEntries = [createLedgerEntry("ledger-2", -8, "2026-05-24T02:00:00.000Z")];
    state.postalRecords = [createPostalRecord("postal-2", "letter-to-lan-0521", "2026-05-24T02:00:00.000Z")];
    const remote = createSnapshot(state);
    remote.ledgerEntries = [
      withRemoteStamp({ ...createLedgerEntry("ledger-1", 1200, "2026-05-23T02:00:00.000Z"), ownerMemberId: "member-zhou" }),
      withRemoteStamp({ ...createLedgerEntry("ledger-2", -8, "2026-05-24T02:00:00.000Z"), ownerMemberId: "member-zhou" })
    ];
    remote.postalRecords = [
      withRemoteStamp(createPostalRecord("postal-1", "letter-to-lan-0521", "2026-05-23T02:00:00.000Z")),
      withRemoteStamp(createPostalRecord("postal-2", "letter-to-lan-0521", "2026-05-24T02:00:00.000Z"))
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(merged.ledgerEntries.map((entry) => entry.id)).toEqual(["device-b@@ledger-1", "device-b@@ledger-2", "ledger-2"]);
    expect(merged.postalRecords.map((record) => record.id)).toEqual(["device-b@@postal-1", "device-b@@postal-2", "postal-2"]);
  });

  it("keeps same local ids from different devices as distinct remote entities", () => {
    const state = createDefaultAppState();
    state.letters = [createLetter("letter-collide", "member-zhou", "member-lan", "本机正文")];
    const remote = createSnapshot(state);
    remote.letters = [
      withRemoteStamp({
        ...createLetter("letter-collide", "member-lan", "member-zhou", "远端正文"),
        photoAttachmentIds: []
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(merged.letters.map((letter) => letter.id).sort()).toEqual(["device-b@@letter-collide", "letter-collide"]);
    expect(merged.letters.find((letter) => letter.id === "letter-collide")?.body).toBe("本机正文");
    expect(merged.letters.find((letter) => letter.id === "device-b@@letter-collide")?.body).toBe("远端正文");
  });

  it("only advances letter state and never lets an older state overwrite a newer state", () => {
    const state = createDefaultAppState();
    const localLetter = requireLetter(state, "letter-from-lan-0520");
    localLetter.state = "opened";
    const remote = createSnapshot(state);
    remote.letters = [
      withRemoteStamp({
        ...localLetter,
        state: "arrived",
        photoAttachmentIds: []
      }, {
        createdByDeviceId: deviceA
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(requireLetter(merged, "letter-from-lan-0520").state).toBe("opened");
  });

  it("advances local letter state when remote has a newer state", () => {
    const state = createDefaultAppState();
    const localLetter = requireLetter(state, "letter-from-lan-0520");
    localLetter.state = "arrived";
    const remote = createSnapshot(state);
    remote.letters = [
      withRemoteStamp({
        ...localLetter,
        state: "opened",
        photoAttachmentIds: []
      }, {
        createdByDeviceId: deviceA
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(requireLetter(merged, "letter-from-lan-0520").state).toBe("opened");
  });

  it("resolves draft conflicts by updatedAtIso and updatedByDeviceId", () => {
    const state = createDefaultAppState();
    state.draftPapers = [createDraftPaper("draft-shared", deviceA, "2026-05-23T04:00:00.000Z", "本机较旧")];
    const remote = createSnapshot(state);
    remote.draftPapers = [
      withRemoteStamp(createDraftPaper("draft-shared", deviceB, "2026-05-23T05:00:00.000Z", "远端较新"), {
        createdByDeviceId: deviceA,
        updatedByDeviceId: deviceB,
        updatedAtIso: "2026-05-23T05:00:00.000Z"
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(merged.draftPapers).toHaveLength(1);
    expect(merged.draftPapers[0]).toMatchObject({
      id: "draft-shared",
      finalText: "远端较新"
    });
  });

  it("uses updatedByDeviceId as a stable tie breaker for draft conflicts", () => {
    const state = createDefaultAppState();
    state.draftPapers = [createDraftPaper("draft-shared", "device-a", "2026-05-23T04:00:00.000Z", "A 设备")];
    const remote = createSnapshot(state);
    remote.draftPapers = [
      withRemoteStamp(createDraftPaper("draft-shared", "device-z", "2026-05-23T04:00:00.000Z", "Z 设备"), {
        createdByDeviceId: "device-a",
        updatedByDeviceId: "device-z",
        updatedAtIso: "2026-05-23T04:00:00.000Z"
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(merged.draftPapers[0]?.finalText).toBe("Z 设备");
  });

  it("does not import another member's private drafts", () => {
    const state = createDefaultAppState();
    state.draftPapers = [];
    const remote = createSnapshot(state);
    remote.draftPapers = [
      withRemoteStamp({
        ...createDraftPaper("draft-other", deviceB, "2026-05-23T04:00:00.000Z", "对方草稿"),
        authorMemberId: "member-lan",
        recipientMemberId: "member-zhou"
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(merged.draftPapers).toEqual([]);
  });

  it("applies a newer draft tombstone so deleted drafts do not revive", () => {
    const state = createDefaultAppState();
    state.draftPapers = [createDraftPaper("draft-deleted", deviceA, "2026-05-23T04:00:00.000Z", "待删除草稿")];
    const remote = createSnapshot(state);
    remote.draftPapers = [
      withRemoteStamp(createDraftPaper("draft-deleted", deviceB, "2026-05-23T04:00:00.000Z", "已删草稿"), {
        createdByDeviceId: deviceA,
        deletedAtIso: "2026-05-23T06:00:00.000Z",
        updatedByDeviceId: deviceB,
        updatedAtIso: "2026-05-23T06:00:00.000Z"
      })
    ];

    const merged = mergeRemoteSnapshotIntoAppState(state, remote, mergeOptions());

    expect(merged.draftPapers).toEqual([]);
  });

  it("exports local draft tombstones so deletions can be pushed", () => {
    const state = createDefaultAppState();
    state.draftTombstones = [
      {
        id: "draft-deleted",
        authorMemberId: "member-zhou",
        recipientMemberId: "member-lan",
        deletedAtIso: "2026-05-23T06:00:00.000Z"
      }
    ];

    const snapshot = createRemoteSnapshotFromAppState(state, {
      householdId,
      deviceId: deviceA,
      exportedAtIso,
      remoteRevision: 4
    });

    expect(snapshot.draftPapers.find((draft) => draft.id === "draft-deleted")).toMatchObject({
      id: "draft-deleted",
      remoteId: "device-a@@draft-deleted",
      deletedAtIso: "2026-05-23T06:00:00.000Z"
    });
  });
});

function createSnapshot(state: AppState): RemoteSnapshotWithContext {
  return createRemoteSnapshotFromAppState(state, {
    householdId,
    deviceId: deviceB,
    exportedAtIso,
    remoteRevision: 2
  });
}

function mergeOptions() {
  return {
    householdId,
    deviceId: deviceA,
    currentMemberId: "member-zhou",
    mergedAtIso: exportedAtIso,
    remoteRevision: 2
  };
}

function createLedgerEntry(id: string, amountFen: number, atIso = "2026-05-23T04:00:00.000Z"): LedgerEntry {
  return {
    id,
    atIso,
    kind: amountFen >= 0 ? "income" : "postage",
    amountFen,
    note: amountFen >= 0 ? "月余款" : "平信邮票"
  };
}

function createPostalRecord(id: string, letterId: string, atIso: string): PostalRecord {
  return {
    id,
    letterId,
    atIso,
    text: "邮政记录"
  };
}

function createDraftPaper(
  id: string,
  _deviceId: string,
  updatedAtIso: string,
  finalText = "草稿正文"
): DraftPaper {
  return {
    id,
    authorMemberId: "member-zhou",
    recipientMemberId: "member-lan",
    createdAtIso: "2026-05-23T03:00:00.000Z",
    updatedAtIso,
    oralText: finalText,
    scribeId: null,
    scribeDraft: finalText,
    finalText,
    status: "draft"
  };
}

function createLetter(id: string, senderId: string, recipientId: string, body: string): PersistedLetter {
  return {
    id,
    senderId,
    recipientId,
    subject: "同号信件",
    state: "arrived",
    sentAtIso: "2026-05-23T04:00:00.000Z",
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: false,
    excerpt: body.slice(0, 8),
    body
  };
}

function requireLetter(state: AppState, letterId: string): PersistedLetter {
  const letter = state.letters.find((candidate) => candidate.id === letterId);

  if (letter === undefined) {
    throw new Error(`Missing letter: ${letterId}`);
  }

  return letter;
}

function withRemoteStamp<T extends { id: string; createdAtIso?: string; updatedAtIso?: string }>(
  entity: T,
  overrides: Partial<{
    createdAtIso: string;
    updatedAtIso: string;
    createdByDeviceId: string;
    updatedByDeviceId: string;
    deletedAtIso: string;
  }> = {}
): T & {
  remoteId: string;
  localId: string;
  householdId: string;
  remoteRevision: number;
  createdAtIso: string;
  updatedAtIso: string;
  createdByDeviceId: string;
  updatedByDeviceId: string;
  deletedAtIso?: string;
  letterRemoteId: string;
  localLetterId: string;
} {
  const createdByDeviceId = overrides.createdByDeviceId ?? deviceB;
  const remoteId = `${createdByDeviceId}@@${entity.id}`;
  const letterId = "letterId" in entity && typeof entity.letterId === "string" ? entity.letterId : "";

  return {
    ...entity,
    remoteId,
    localId: entity.id,
    householdId,
    remoteRevision: 2,
    createdAtIso: overrides.createdAtIso ?? entity.createdAtIso ?? "2026-05-23T03:00:00.000Z",
    updatedAtIso: overrides.updatedAtIso ?? entity.updatedAtIso ?? "2026-05-23T04:00:00.000Z",
    createdByDeviceId,
    updatedByDeviceId: overrides.updatedByDeviceId ?? deviceB,
    letterRemoteId: letterId === "" ? "" : `${createdByDeviceId}@@${letterId}`,
    localLetterId: letterId,
    ...(overrides.deletedAtIso === undefined ? {} : { deletedAtIso: overrides.deletedAtIso })
  };
}

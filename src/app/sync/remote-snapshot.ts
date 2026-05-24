import {
  cloneAppState,
  type AppState,
  type DraftPaper,
  type DraftPaperTombstone,
  type LedgerEntry,
  type PersistedLetter,
  type PostalRecord
} from "../app-state.js";
import type { MemberProfile } from "../mock-data.js";
import type {
  RemoteDraftPaper,
  RemoteHousehold,
  RemoteLedgerEntry,
  RemoteLetter,
  RemoteMember,
  RemotePhotoAttachment,
  RemotePostalRecord,
  RemoteSnapshot,
  RemoteSnapshotExportOptions,
  RemoteSnapshotMergeOptions,
  RemoteWallet
} from "./remote-model.js";

export type RemoteSnapshotWithContext = RemoteSnapshot;

export interface RemoteSnapshotMergeRemoteOptions {
  householdId: string;
  deviceId: string;
  mergedAtIso: string;
  remoteRevision: number;
}

const letterStateRank: Record<PersistedLetter["state"], number> = {
  draft: 0,
  scribed: 1,
  revised: 2,
  sealed: 3,
  posted: 4,
  accepted: 5,
  in_transit: 6,
  delayed: 7,
  misrouted: 8,
  lost: 9,
  found: 10,
  returned: 11,
  arrived: 12,
  opened: 13,
  archived: 14
};

const remoteIdSeparator = "@@";
const contentVisibleStates = new Set<PersistedLetter["state"]>(["arrived", "opened", "archived"]);

export function createRemoteSnapshotFromAppState(state: AppState, options: RemoteSnapshotExportOptions): RemoteSnapshotWithContext {
  const household = createRemoteHousehold(state, options);

  return {
    household,
    members: state.members.map((member) => createRemoteMember(member, options)),
    wallets: [createRemoteWallet(state, options)],
    ledgerEntries: state.ledgerEntries.map((entry) => createRemoteLedgerEntry(entry, state.wallet.ownerMemberId, options)),
    draftPapers: [
      ...state.draftPapers
        .filter(
          (draft) =>
            options.includePrivateDraftsForMemberId === undefined ||
            draft.authorMemberId === options.includePrivateDraftsForMemberId
        )
        .map((draft) => createRemoteDraftPaper(draft, options)),
      ...(state.draftTombstones ?? [])
        .filter(
          (tombstone) =>
            options.includePrivateDraftsForMemberId === undefined ||
            tombstone.authorMemberId === options.includePrivateDraftsForMemberId
        )
        .map((tombstone) => createRemoteDraftTombstone(tombstone, options))
    ],
    letters: state.letters.map((letter) => createRemoteLetter(letter, options)),
    postalRecords: state.postalRecords.map((record) => createRemotePostalRecord(record, options)),
    photoAttachments: [],
    syncCursors: [
      {
        householdId: options.householdId,
        deviceId: options.deviceId,
        memberId: state.currentMemberId,
        remoteRevision: options.remoteRevision,
        lastPulledAtIso: null,
        lastPushedAtIso: options.exportedAtIso,
        updatedAtIso: options.exportedAtIso
      }
    ],
    exportedAtIso: options.exportedAtIso,
    remoteRevision: options.remoteRevision
  };
}

export function mergeRemoteSnapshotIntoAppState(
  state: AppState,
  snapshot: RemoteSnapshot,
  options: RemoteSnapshotMergeOptions
): AppState {
  const nextState = cloneAppState(state);

  nextState.members = mergeMembers(nextState.members, snapshot.members);
  nextState.wallet = mergeWallet(nextState.wallet, snapshot.wallets, options.currentMemberId);
  nextState.ledgerEntries = mergeAppendOnlyById(nextState.ledgerEntries, snapshot.ledgerEntries, (entry) =>
    stripRemoteLedgerEntry(entry, options)
  );
  nextState.postalRecords = mergeAppendOnlyById(nextState.postalRecords, snapshot.postalRecords, (record) =>
    stripRemotePostalRecord(record, options)
  );
  nextState.letters = mergeLetters(nextState.letters, snapshot.letters, options);
  nextState.draftPapers = mergeDraftPapers(nextState.draftPapers, snapshot.draftPapers, options);

  return nextState;
}

export function redactRemoteSnapshotForMember(snapshot: RemoteSnapshot, memberId: string): RemoteSnapshot {
  return {
    ...snapshot,
    letters: snapshot.letters.map((letter) => redactRemoteLetterForMember(letter, memberId))
  };
}

export function mergeRemoteSnapshots(
  baseSnapshot: RemoteSnapshot,
  incomingSnapshot: RemoteSnapshot,
  options: RemoteSnapshotMergeRemoteOptions
): RemoteSnapshot {
  return {
    household: mergeRemoteHousehold(baseSnapshot.household, incomingSnapshot.household, options),
    members: mergeRemoteEntities(baseSnapshot.members, incomingSnapshot.members, getRemoteEntityTimestamp, deleteRemoteEntity),
    wallets: mergeRemoteWallets(baseSnapshot.wallets, incomingSnapshot.wallets),
    ledgerEntries: mergeRemoteAppendOnlyById(baseSnapshot.ledgerEntries, incomingSnapshot.ledgerEntries),
    draftPapers: mergeRemoteDraftPapers(baseSnapshot.draftPapers, incomingSnapshot.draftPapers),
    letters: mergeRemoteLetters(baseSnapshot.letters, incomingSnapshot.letters),
    postalRecords: mergeRemoteAppendOnlyById(baseSnapshot.postalRecords, incomingSnapshot.postalRecords),
    photoAttachments: mergeRemoteEntities(
      baseSnapshot.photoAttachments,
      incomingSnapshot.photoAttachments,
      getRemoteEntityTimestamp,
      keepRemoteEntity
    ),
    syncCursors: mergeRemoteCursors(baseSnapshot.syncCursors, incomingSnapshot.syncCursors),
    exportedAtIso: options.mergedAtIso,
    remoteRevision: options.remoteRevision
  };
}

function createRemoteHousehold(state: AppState, options: RemoteSnapshotExportOptions): RemoteHousehold {
  const memberIds = [state.currentMemberId, state.recipientMemberId] as [string, string];

  return {
    ...createStamp(options, options.householdId, options.exportedAtIso, options.exportedAtIso, { globalId: true }),
    id: options.householdId,
    memberIds
  };
}

function createRemoteMember(member: MemberProfile, options: RemoteSnapshotExportOptions): RemoteMember {
  return {
    ...createStamp(options, member.id, options.exportedAtIso, options.exportedAtIso, { globalId: true }),
    id: member.id,
    dailyName: member.dailyName,
    envelopeName: member.envelopeName,
    letterGreeting: member.letterGreeting,
    signatureName: member.signatureName,
    city: member.city,
    district: member.district,
    postOffice: member.postOffice,
    preferredScribeId: member.preferredScribeId
  };
}

function createRemoteWallet(state: AppState, options: RemoteSnapshotExportOptions): RemoteWallet {
  return {
    ...createStamp(options, `wallet-${state.wallet.ownerMemberId}`, state.wallet.lastSettledAtIso, options.exportedAtIso, {
      globalId: true
    }),
    ownerMemberId: state.wallet.ownerMemberId,
    balanceFen: state.wallet.balanceFen,
    monthlyIncomeFen: state.wallet.monthlyIncomeFen,
    dailyLivingCostFen: state.wallet.dailyLivingCostFen,
    lastSettledAtIso: state.wallet.lastSettledAtIso
  };
}

function createRemoteLedgerEntry(
  entry: LedgerEntry,
  ownerMemberId: string,
  options: RemoteSnapshotExportOptions
): RemoteLedgerEntry {
  return {
    ...createStamp(options, entry.id, entry.atIso, entry.atIso),
    id: entry.id,
    atIso: entry.atIso,
    kind: entry.kind,
    amountFen: entry.amountFen,
    note: entry.note,
    ownerMemberId
  };
}

function createRemoteDraftPaper(draft: DraftPaper, options: RemoteSnapshotExportOptions): RemoteDraftPaper {
  return {
    ...createStamp(options, draft.id, draft.createdAtIso, draft.updatedAtIso),
    id: draft.id,
    authorMemberId: draft.authorMemberId,
    recipientMemberId: draft.recipientMemberId,
    oralText: draft.oralText,
    scribeId: draft.scribeId,
    scribeDraft: draft.scribeDraft,
    finalText: draft.finalText,
    ...(draft.readAloudText === undefined ? {} : { readAloudText: draft.readAloudText }),
    ...(draft.draftSource === undefined ? {} : { draftSource: draft.draftSource }),
    ...(draft.generationMeta === undefined ? {} : { generationMeta: draft.generationMeta }),
    status: draft.status
  };
}

function createRemoteDraftTombstone(tombstone: DraftPaperTombstone, options: RemoteSnapshotExportOptions): RemoteDraftPaper {
  return {
    ...createStamp(options, tombstone.id, tombstone.deletedAtIso, tombstone.deletedAtIso),
    id: tombstone.id,
    authorMemberId: tombstone.authorMemberId,
    recipientMemberId: tombstone.recipientMemberId,
    scribeId: null,
    status: "draft",
    deletedAtIso: tombstone.deletedAtIso
  };
}

function createRemoteLetter(letter: PersistedLetter, options: RemoteSnapshotExportOptions): RemoteLetter {
  return {
    ...createStamp(options, letter.id, letter.sentAtIso, letter.sentAtIso),
    id: letter.id,
    senderId: letter.senderId,
    recipientId: letter.recipientId,
    subject: letter.subject,
    state: letter.state,
    sentAtIso: letter.sentAtIso,
    distanceKm: letter.distanceKm,
    registered: letter.registered,
    hasPhoto: letter.hasPhoto,
    important: letter.important,
    excerpt: letter.excerpt,
    body: letter.body,
    ...(letter.oralText === undefined ? {} : { oralText: letter.oralText }),
    ...(letter.scribeId === undefined ? {} : { scribeId: letter.scribeId }),
    ...(letter.scribeDraft === undefined ? {} : { scribeDraft: letter.scribeDraft }),
    ...(letter.finalText === undefined ? {} : { finalText: letter.finalText }),
    ...(letter.readAloudText === undefined ? {} : { readAloudText: letter.readAloudText }),
    ...(letter.draftSource === undefined ? {} : { draftSource: letter.draftSource }),
    ...(letter.generationMeta === undefined ? {} : { generationMeta: letter.generationMeta }),
    photoAttachmentIds: []
  };
}

function createRemotePostalRecord(record: PostalRecord, options: RemoteSnapshotExportOptions): RemotePostalRecord {
  const letterIdentity = createRemoteIdentity(record.letterId, options.deviceId);

  return {
    ...createStamp(options, record.id, record.atIso, record.atIso),
    id: record.id,
    letterId: record.letterId,
    letterRemoteId: letterIdentity.remoteId,
    localLetterId: letterIdentity.localId,
    atIso: record.atIso,
    text: record.text
  };
}

function createStamp(
  options: RemoteSnapshotExportOptions,
  localId: string,
  createdAtIso: string,
  updatedAtIso: string,
  config: { globalId?: boolean } = {}
) {
  const identity = config.globalId
    ? { remoteId: localId, localId, createdByDeviceId: options.deviceId }
    : createRemoteIdentity(localId, options.deviceId);

  return {
    remoteId: identity.remoteId,
    localId: identity.localId,
    householdId: options.householdId,
    remoteRevision: options.remoteRevision,
    createdAtIso,
    updatedAtIso,
    createdByDeviceId: identity.createdByDeviceId,
    updatedByDeviceId: options.deviceId
  };
}

function createRemoteIdentity(localId: string, deviceId: string): {
  remoteId: string;
  localId: string;
  createdByDeviceId: string;
} {
  const parsed = parseRemoteId(localId);

  if (parsed !== null) {
    return {
      remoteId: localId,
      localId: parsed.localId,
      createdByDeviceId: parsed.createdByDeviceId
    };
  }

  return {
    remoteId: `${deviceId}${remoteIdSeparator}${localId}`,
    localId,
    createdByDeviceId: deviceId
  };
}

function parseRemoteId(value: string): { createdByDeviceId: string; localId: string } | null {
  const separatorIndex = value.indexOf(remoteIdSeparator);

  if (separatorIndex <= 0 || separatorIndex + remoteIdSeparator.length >= value.length) {
    return null;
  }

  return {
    createdByDeviceId: value.slice(0, separatorIndex),
    localId: value.slice(separatorIndex + remoteIdSeparator.length)
  };
}

function getRemoteIdentityKey<TItem extends { id: string }>(item: TItem): string {
  if ("remoteId" in (item as object) && typeof (item as { remoteId?: unknown }).remoteId === "string") {
    return (item as unknown as { remoteId: string }).remoteId;
  }

  if ("createdByDeviceId" in (item as object) && typeof (item as { createdByDeviceId?: unknown }).createdByDeviceId === "string") {
    return `${(item as unknown as { createdByDeviceId: string }).createdByDeviceId}${remoteIdSeparator}${item.id}`;
  }

  return item.id;
}

function getAppEntityId<TItem extends { id: string; localId?: string; remoteId?: string; createdByDeviceId?: string }>(
  remote: TItem,
  localDeviceId: string
): string {
  const localId = remote.localId ?? remote.id;

  return remote.createdByDeviceId === localDeviceId ? localId : (remote.remoteId ?? localId);
}

function mergeRemoteHousehold(
  baseHousehold: RemoteHousehold | null,
  incomingHousehold: RemoteHousehold | null,
  options: RemoteSnapshotMergeRemoteOptions
): RemoteHousehold | null {
  const source = incomingHousehold ?? baseHousehold;

  if (source === null) {
    return null;
  }

  return {
    ...source,
    householdId: options.householdId,
    remoteRevision: options.remoteRevision,
    updatedAtIso: options.mergedAtIso,
    updatedByDeviceId: options.deviceId
  };
}

function mergeRemoteWallets(baseWallets: RemoteWallet[], incomingWallets: RemoteWallet[]): RemoteWallet[] {
  const byOwnerId = new Map<string, RemoteWallet>();

  for (const wallet of [...baseWallets, ...incomingWallets]) {
    if (wallet.deletedAtIso !== undefined) {
      byOwnerId.delete(wallet.ownerMemberId);
      continue;
    }

    const existing = byOwnerId.get(wallet.ownerMemberId);

    if (
      existing === undefined ||
      compareIsoThenText(wallet.lastSettledAtIso, existing.lastSettledAtIso, wallet.updatedByDeviceId, existing.updatedByDeviceId) >= 0
    ) {
      byOwnerId.set(wallet.ownerMemberId, wallet);
    }
  }

  return Array.from(byOwnerId.values()).sort((left, right) => left.ownerMemberId.localeCompare(right.ownerMemberId));
}

function mergeRemoteAppendOnlyById<TItem extends { id: string; atIso: string }>(
  baseItems: TItem[],
  incomingItems: TItem[]
): TItem[] {
  const byId = new Map<string, TItem>();

  for (const item of [...baseItems, ...incomingItems]) {
    const key = getRemoteIdentityKey(item);

    if (!byId.has(key)) {
      byId.set(key, item);
    }
  }

  return Array.from(byId.values()).sort((left, right) => compareIsoThenText(left.atIso, right.atIso, left.id, right.id));
}

function mergeRemoteDraftPapers(baseDrafts: RemoteDraftPaper[], incomingDrafts: RemoteDraftPaper[]): RemoteDraftPaper[] {
  const byId = new Map<string, RemoteDraftPaper>();

  for (const draft of [...baseDrafts, ...incomingDrafts]) {
    const key = getRemoteIdentityKey(draft);
    const existing = byId.get(key);

    if (existing === undefined || compareRemoteDraftVersion(draft, existing) >= 0) {
      byId.set(key, draft);
    }
  }

  return Array.from(byId.values()).sort((left, right) =>
    compareIsoThenText(getRemoteDraftTimestamp(right), getRemoteDraftTimestamp(left), right.id, left.id)
  );
}

function mergeRemoteLetters(baseLetters: RemoteLetter[], incomingLetters: RemoteLetter[]): RemoteLetter[] {
  const byId = new Map<string, RemoteLetter>();

  for (const letter of [...baseLetters, ...incomingLetters]) {
    if (letter.deletedAtIso !== undefined) {
      continue;
    }

    const key = getRemoteIdentityKey(letter);
    const existing = byId.get(key);

    if (existing === undefined) {
      byId.set(key, letter);
      continue;
    }

    byId.set(key, {
      ...mergeRemoteLetterFields(existing, letter),
      state: chooseLaterLetterState(existing.state, letter.state)
    });
  }

  return Array.from(byId.values()).sort((left, right) => compareIsoThenText(left.sentAtIso, right.sentAtIso, left.id, right.id));
}

function mergeRemoteEntities<TItem extends { id: string }>(
  baseItems: TItem[],
  incomingItems: TItem[],
  getTimestamp: (item: TItem) => string,
  onDeleted: (item: TItem, byId: Map<string, TItem>) => void
): TItem[] {
  const byId = new Map<string, TItem>();

  for (const item of [...baseItems, ...incomingItems]) {
    const key = getRemoteIdentityKey(item);

    if (hasDeletedAtIso(item)) {
      onDeleted(item, byId);
      continue;
    }

    const existing = byId.get(key);

    if (
      existing === undefined ||
      compareIsoThenText(getTimestamp(item), getTimestamp(existing), getUpdatedByDeviceId(item), getUpdatedByDeviceId(existing)) >= 0
    ) {
      byId.set(key, item);
    }
  }

  return Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function mergeRemoteCursors(
  baseCursors: RemoteSnapshot["syncCursors"],
  incomingCursors: RemoteSnapshot["syncCursors"]
): RemoteSnapshot["syncCursors"] {
  const byDeviceId = new Map<string, RemoteSnapshot["syncCursors"][number]>();

  for (const cursor of [...baseCursors, ...incomingCursors]) {
    const existing = byDeviceId.get(cursor.deviceId);

    if (
      existing === undefined ||
      compareIsoThenText(cursor.updatedAtIso, existing.updatedAtIso, cursor.deviceId, existing.deviceId) >= 0
    ) {
      byDeviceId.set(cursor.deviceId, cursor);
    }
  }

  return Array.from(byDeviceId.values()).sort((left, right) => left.deviceId.localeCompare(right.deviceId));
}

function mergeRemoteLetterFields(existing: RemoteLetter, incoming: RemoteLetter): RemoteLetter {
  return {
    ...existing,
    ...pickOptional("excerpt", existing.excerpt ?? incoming.excerpt),
    ...pickOptional("body", existing.body ?? incoming.body),
    ...pickOptional("oralText", existing.oralText ?? incoming.oralText),
    ...pickOptional("scribeId", existing.scribeId ?? incoming.scribeId),
    ...pickOptional("scribeDraft", existing.scribeDraft ?? incoming.scribeDraft),
    ...pickOptional("finalText", existing.finalText ?? incoming.finalText),
    ...pickOptional("readAloudText", existing.readAloudText ?? incoming.readAloudText),
    ...pickOptional("draftSource", existing.draftSource ?? incoming.draftSource),
    ...pickOptional("generationMeta", existing.generationMeta ?? incoming.generationMeta),
    photoAttachmentIds: Array.from(new Set([...existing.photoAttachmentIds, ...incoming.photoAttachmentIds])).sort()
  };
}

function compareRemoteDraftVersion(left: RemoteDraftPaper, right: RemoteDraftPaper): number {
  return compareIsoThenText(getRemoteDraftTimestamp(left), getRemoteDraftTimestamp(right), left.updatedByDeviceId, right.updatedByDeviceId);
}

function getRemoteDraftTimestamp(draft: RemoteDraftPaper): string {
  return draft.deletedAtIso ?? draft.updatedAtIso;
}

function getRemoteEntityTimestamp<TItem extends { updatedAtIso?: string; createdAtIso?: string }>(item: TItem): string {
  return item.updatedAtIso ?? item.createdAtIso ?? "1970-01-01T00:00:00.000Z";
}

function getUpdatedByDeviceId<TItem>(item: TItem): string {
  if ("updatedByDeviceId" in (item as object) && typeof (item as { updatedByDeviceId?: unknown }).updatedByDeviceId === "string") {
    return (item as { updatedByDeviceId: string }).updatedByDeviceId;
  }

  return "";
}

function hasDeletedAtIso<TItem>(item: TItem): boolean {
  return "deletedAtIso" in (item as object) && typeof (item as { deletedAtIso?: unknown }).deletedAtIso === "string";
}

function deleteRemoteEntity<TItem extends { id: string }>(item: TItem, byId: Map<string, TItem>): void {
  byId.delete(getRemoteIdentityKey(item));
}

function keepRemoteEntity<TItem extends { id: string }>(item: TItem, byId: Map<string, TItem>): void {
  byId.set(getRemoteIdentityKey(item), item);
}

function mergeMembers(localMembers: MemberProfile[], remoteMembers: RemoteMember[]): MemberProfile[] {
  const byId = new Map(localMembers.map((member) => [member.id, member]));

  for (const remoteMember of remoteMembers) {
    if (remoteMember.deletedAtIso !== undefined) {
      continue;
    }

    byId.set(remoteMember.id, stripRemoteMember(remoteMember));
  }

  return Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function mergeWallet(
  localWallet: AppState["wallet"],
  remoteWallets: RemoteWallet[],
  currentMemberId: string
): AppState["wallet"] {
  const remoteWallet = remoteWallets
    .filter((wallet) => wallet.deletedAtIso === undefined && wallet.ownerMemberId === currentMemberId)
    .sort((left, right) => compareIsoThenText(right.lastSettledAtIso, left.lastSettledAtIso, right.updatedByDeviceId, left.updatedByDeviceId))[0];

  if (remoteWallet === undefined) {
    return localWallet;
  }

  if (compareIsoThenText(remoteWallet.lastSettledAtIso, localWallet.lastSettledAtIso, remoteWallet.updatedByDeviceId, "") < 0) {
    return localWallet;
  }

  return {
    ownerMemberId: remoteWallet.ownerMemberId,
    balanceFen: remoteWallet.balanceFen,
    monthlyIncomeFen: remoteWallet.monthlyIncomeFen,
    dailyLivingCostFen: remoteWallet.dailyLivingCostFen,
    lastSettledAtIso: remoteWallet.lastSettledAtIso
  };
}

function mergeAppendOnlyById<TLocal extends { id: string; atIso: string }, TRemote extends TLocal>(
  localItems: TLocal[],
  remoteItems: TRemote[],
  stripRemote: (remote: TRemote) => TLocal
): TLocal[] {
  const byId = new Map<string, TLocal>();

  for (const item of [...localItems, ...remoteItems.map(stripRemote)]) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values()).sort((left, right) => compareIsoThenText(left.atIso, right.atIso, left.id, right.id));
}

function mergeLetters(
  localLetters: PersistedLetter[],
  remoteLetters: RemoteLetter[],
  options: RemoteSnapshotMergeOptions
): PersistedLetter[] {
  const byId = new Map(localLetters.map((letter) => [letter.id, letter]));

  for (const remoteLetter of remoteLetters) {
    if (remoteLetter.deletedAtIso !== undefined) {
      continue;
    }

    const incoming = stripRemoteLetter(remoteLetter, options);
    const existing = byId.get(incoming.id);

    if (existing === undefined) {
      byId.set(incoming.id, incoming);
      continue;
    }

    byId.set(incoming.id, {
      ...mergeOptionalLetterFields(existing, incoming),
      state: chooseLaterLetterState(existing.state, incoming.state)
    });
  }

  return Array.from(byId.values()).sort((left, right) => compareIsoThenText(left.sentAtIso, right.sentAtIso, left.id, right.id));
}

function mergeDraftPapers(
  localDrafts: DraftPaper[],
  remoteDrafts: RemoteDraftPaper[],
  options: RemoteSnapshotMergeOptions
): DraftPaper[] {
  const byId = new Map(localDrafts.map((draft) => [draft.id, draft]));

  for (const remoteDraft of remoteDrafts) {
    if (remoteDraft.authorMemberId !== options.currentMemberId) {
      continue;
    }

    const appDraftId = getAppEntityId(remoteDraft, options.deviceId);
    const existing = byId.get(appDraftId);

    if (remoteDraft.deletedAtIso !== undefined) {
      if (
        existing === undefined ||
        compareIsoThenText(remoteDraft.deletedAtIso, existing.updatedAtIso, remoteDraft.updatedByDeviceId, options.deviceId) >= 0
      ) {
        byId.delete(appDraftId);
      }
      continue;
    }

    if (existing === undefined || shouldRemoteDraftWin(existing, remoteDraft, options.deviceId)) {
      byId.set(appDraftId, stripRemoteDraftPaper(remoteDraft, options));
    }
  }

  return Array.from(byId.values()).sort((left, right) => compareIsoThenText(right.updatedAtIso, left.updatedAtIso, right.id, left.id));
}

function shouldRemoteDraftWin(localDraft: DraftPaper, remoteDraft: RemoteDraftPaper, localDeviceId: string): boolean {
  return compareIsoThenText(remoteDraft.updatedAtIso, localDraft.updatedAtIso, remoteDraft.updatedByDeviceId, localDeviceId) >= 0;
}

function chooseLaterLetterState(
  localState: PersistedLetter["state"],
  remoteState: PersistedLetter["state"]
): PersistedLetter["state"] {
  return letterStateRank[remoteState] > letterStateRank[localState] ? remoteState : localState;
}

function mergeOptionalLetterFields(existing: PersistedLetter, incoming: PersistedLetter): PersistedLetter {
  return {
    ...existing,
    excerpt: existing.excerpt || incoming.excerpt,
    body: existing.body || incoming.body,
    ...pickOptional("oralText", existing.oralText ?? incoming.oralText),
    ...pickOptional("scribeId", existing.scribeId ?? incoming.scribeId),
    ...pickOptional("scribeDraft", existing.scribeDraft ?? incoming.scribeDraft),
    ...pickOptional("finalText", existing.finalText ?? incoming.finalText),
    ...pickOptional("readAloudText", existing.readAloudText ?? incoming.readAloudText),
    ...pickOptional("draftSource", existing.draftSource ?? incoming.draftSource),
    ...pickOptional("generationMeta", existing.generationMeta ?? incoming.generationMeta)
  };
}

function pickOptional<Key extends keyof PersistedLetter>(
  key: Key,
  value: PersistedLetter[Key] | undefined
): Partial<Pick<PersistedLetter, Key>> {
  return value === undefined ? {} : { [key]: value } as Partial<Pick<PersistedLetter, Key>>;
}

function compareIsoThenText(leftIso: string, rightIso: string, leftText: string, rightText: string): number {
  const timeDiff = Date.parse(leftIso) - Date.parse(rightIso);

  return timeDiff === 0 ? leftText.localeCompare(rightText) : timeDiff;
}

function stripRemoteMember(remote: RemoteMember): MemberProfile {
  return {
    id: remote.id,
    dailyName: remote.dailyName,
    envelopeName: remote.envelopeName,
    letterGreeting: remote.letterGreeting,
    signatureName: remote.signatureName,
    city: remote.city,
    district: remote.district,
    postOffice: remote.postOffice,
    preferredScribeId: remote.preferredScribeId
  };
}

function stripRemoteLedgerEntry(remote: RemoteLedgerEntry, options: RemoteSnapshotMergeOptions): LedgerEntry {
  return {
    id: getAppEntityId(remote, options.deviceId),
    atIso: remote.atIso,
    kind: remote.kind,
    amountFen: remote.amountFen,
    note: remote.note
  };
}

function stripRemotePostalRecord(remote: RemotePostalRecord, options: RemoteSnapshotMergeOptions): PostalRecord {
  const letterIdentity = parseRemoteId(remote.letterRemoteId);

  return {
    id: getAppEntityId(remote, options.deviceId),
    letterId: letterIdentity?.createdByDeviceId === options.deviceId ? remote.localLetterId : remote.letterRemoteId,
    atIso: remote.atIso,
    text: remote.text
  };
}

function stripRemoteDraftPaper(remote: RemoteDraftPaper, options: RemoteSnapshotMergeOptions): DraftPaper {
  return {
    id: getAppEntityId(remote, options.deviceId),
    authorMemberId: remote.authorMemberId,
    recipientMemberId: remote.recipientMemberId,
    createdAtIso: remote.createdAtIso,
    updatedAtIso: remote.updatedAtIso,
    oralText: remote.oralText ?? "",
    scribeId: remote.scribeId,
    scribeDraft: remote.scribeDraft ?? "",
    finalText: remote.finalText ?? "",
    ...(remote.readAloudText === undefined ? {} : { readAloudText: remote.readAloudText }),
    ...(remote.draftSource === undefined ? {} : { draftSource: remote.draftSource }),
    ...(remote.generationMeta === undefined ? {} : { generationMeta: remote.generationMeta }),
    status: remote.status
  };
}

function stripRemoteLetter(remote: RemoteLetter, options: RemoteSnapshotMergeOptions): PersistedLetter {
  return {
    id: getAppEntityId(remote, options.deviceId),
    senderId: remote.senderId,
    recipientId: remote.recipientId,
    subject: remote.subject,
    state: remote.state,
    sentAtIso: remote.sentAtIso,
    distanceKm: remote.distanceKm,
    registered: remote.registered,
    hasPhoto: remote.hasPhoto,
    important: remote.important,
    excerpt: remote.excerpt ?? "",
    body: remote.body ?? "",
    ...(remote.oralText === undefined ? {} : { oralText: remote.oralText }),
    ...(remote.scribeId === undefined ? {} : { scribeId: remote.scribeId }),
    ...(remote.scribeDraft === undefined ? {} : { scribeDraft: remote.scribeDraft }),
    ...(remote.finalText === undefined ? {} : { finalText: remote.finalText }),
    ...(remote.readAloudText === undefined ? {} : { readAloudText: remote.readAloudText }),
    ...(remote.draftSource === undefined ? {} : { draftSource: remote.draftSource }),
    ...(remote.generationMeta === undefined ? {} : { generationMeta: remote.generationMeta })
  };
}

function redactRemoteLetterForMember(letter: RemoteLetter, memberId: string): RemoteLetter {
  if (letter.senderId === memberId || letter.recipientId !== memberId || contentVisibleStates.has(letter.state)) {
    return letter;
  }

  return {
    remoteId: letter.remoteId,
    localId: letter.localId,
    householdId: letter.householdId,
    remoteRevision: letter.remoteRevision,
    createdAtIso: letter.createdAtIso,
    updatedAtIso: letter.updatedAtIso,
    createdByDeviceId: letter.createdByDeviceId,
    updatedByDeviceId: letter.updatedByDeviceId,
    ...(letter.deletedAtIso === undefined ? {} : { deletedAtIso: letter.deletedAtIso }),
    id: letter.id,
    senderId: letter.senderId,
    recipientId: letter.recipientId,
    subject: letter.subject,
    state: letter.state,
    sentAtIso: letter.sentAtIso,
    distanceKm: letter.distanceKm,
    registered: letter.registered,
    hasPhoto: letter.hasPhoto,
    important: letter.important,
    photoAttachmentIds: []
  };
}

export function createEmptyRemoteSnapshot(options: RemoteSnapshotExportOptions): RemoteSnapshot {
  return {
    household: null,
    members: [],
    wallets: [],
    ledgerEntries: [],
    draftPapers: [],
    letters: [],
    postalRecords: [],
    photoAttachments: [] satisfies RemotePhotoAttachment[],
    syncCursors: [],
    exportedAtIso: options.exportedAtIso,
    remoteRevision: options.remoteRevision
  };
}

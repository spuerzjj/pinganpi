import type { DraftPaper, LedgerEntry, LedgerEntryKind, PersistedLetter, PostalRecord, WalletState } from "../app-state.js";
import type { MemberProfile } from "../mock-data.js";
import type { DraftSource, ScribeGenerationMeta } from "../scribe-template-engine.js";
import type { Fen, LetterState } from "../../domain/index.js";

interface RemoteEntityStamp {
  remoteId: string;
  localId: string;
  householdId: string;
  remoteRevision: number;
  createdAtIso: string;
  updatedAtIso: string;
  createdByDeviceId: string;
  updatedByDeviceId: string;
  deletedAtIso?: string;
}

export interface RemoteHousehold extends RemoteEntityStamp {
  id: string;
  memberIds: [string, string];
}

export interface RemoteMember extends RemoteEntityStamp, MemberProfile {}

export interface RemoteWallet extends RemoteEntityStamp, WalletState {
  ownerMemberId: string;
  balanceFen: Fen;
}

export interface RemoteLedgerEntry extends RemoteEntityStamp, LedgerEntry {
  ownerMemberId: string;
  kind: LedgerEntryKind;
  amountFen: number;
}

export interface RemoteDraftPaper extends RemoteEntityStamp {
  id: string;
  authorMemberId: string;
  recipientMemberId: string;
  oralText?: string;
  scribeId: string | null;
  scribeDraft?: string;
  finalText?: string;
  readAloudText?: string;
  draftSource?: DraftSource;
  generationMeta?: ScribeGenerationMeta;
  status: DraftPaper["status"];
}

export interface RemoteLetter extends RemoteEntityStamp {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  state: LetterState;
  sentAtIso: string;
  distanceKm: number;
  registered: boolean;
  hasPhoto: boolean;
  important: boolean;
  excerpt?: string;
  body?: string;
  oralText?: string;
  scribeId?: string | null;
  scribeDraft?: string;
  finalText?: string;
  readAloudText?: string;
  draftSource?: DraftSource;
  generationMeta?: ScribeGenerationMeta;
  photoAttachmentIds: string[];
}

export interface RemotePostalRecord extends RemoteEntityStamp, PostalRecord {
  letterId: string;
  letterRemoteId: string;
  localLetterId: string;
}

export interface RemoteSyncCursor {
  householdId: string;
  deviceId: string;
  memberId?: string;
  remoteRevision: number;
  lastPulledAtIso: string | null;
  lastPushedAtIso: string | null;
  updatedAtIso: string;
}

type RemotePhotoAttachmentAccessState = "pending_arrival" | "available" | "removed";

export interface RemotePhotoAttachment extends RemoteEntityStamp {
  id: string;
  letterId: string;
  ownerMemberId: string;
  accessState: RemotePhotoAttachmentAccessState;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
  storageKey: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
}

export interface RemoteSnapshot {
  household: RemoteHousehold | null;
  members: RemoteMember[];
  wallets: RemoteWallet[];
  ledgerEntries: RemoteLedgerEntry[];
  draftPapers: RemoteDraftPaper[];
  letters: RemoteLetter[];
  postalRecords: RemotePostalRecord[];
  photoAttachments: RemotePhotoAttachment[];
  syncCursors: RemoteSyncCursor[];
  exportedAtIso: string;
  remoteRevision: number;
}

export interface SyncPullInput {
  householdId: string;
  deviceId: string;
  memberId: string;
  sinceRemoteRevision: number | null;
}

export interface SyncPushInput {
  householdId: string;
  deviceId: string;
  baseRemoteRevision: number | null;
  snapshot: RemoteSnapshot;
}

export interface SyncPushResult {
  householdId: string;
  deviceId: string;
  acceptedRemoteRevision: number;
  cursor: RemoteSyncCursor;
  snapshot: RemoteSnapshot;
}

export interface SyncAdapter {
  pull(input: SyncPullInput): Promise<RemoteSnapshot>;
  push(input: SyncPushInput): Promise<SyncPushResult>;
}

export interface RemoteSnapshotExportOptions {
  householdId: string;
  deviceId: string;
  exportedAtIso: string;
  remoteRevision: number;
  includePrivateDraftsForMemberId?: string;
}

export interface RemoteSnapshotMergeOptions {
  householdId: string;
  deviceId: string;
  currentMemberId: string;
  mergedAtIso: string;
  remoteRevision: number;
}

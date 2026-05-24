import type { RemoteSnapshot } from "../../apps/legacy-capacitor/src/app/sync/remote-model.js";
import { StaleRemoteRevisionError, type SyncSnapshotStore } from "./handler.js";

export const DEFAULT_SYNC_SNAPSHOT_COLLECTION = "pinganpi_sync_snapshots";

export interface CloudBaseSyncSnapshotStoreOptions {
  collectionName?: string;
}

interface CloudBaseDatabase {
  collection(name: string): CloudBaseCollection;
  runTransaction?<T>(callback: (transaction: CloudBaseTransaction) => Promise<T>): Promise<T>;
}

interface CloudBaseCollection {
  doc(id: string): CloudBaseDocumentReference;
}

interface CloudBaseDocumentReference {
  get(): Promise<{ data?: unknown }>;
  set(data: SyncSnapshotDocument): Promise<unknown>;
}

interface CloudBaseTransaction {
  collection(name: string): CloudBaseCollection;
}

interface SyncSnapshotDocument {
  schemaVersion: 1;
  householdId: string;
  snapshot: RemoteSnapshot;
  updatedAtIso: string;
}

export function createCloudBaseSyncSnapshotStore(
  db: CloudBaseDatabase,
  options: CloudBaseSyncSnapshotStoreOptions = {}
): SyncSnapshotStore {
  const collectionName = options.collectionName ?? DEFAULT_SYNC_SNAPSHOT_COLLECTION;

  return {
    async loadSnapshot(householdId) {
      const document = await loadDocument(db.collection(collectionName).doc(householdId), householdId);

      return document?.snapshot ?? null;
    },
    async saveSnapshot(input) {
      const document = createSnapshotDocument(input.householdId, input.snapshot, input.updatedAtIso);

      if (typeof db.runTransaction === "function") {
        await db.runTransaction(async (transaction) => {
          const documentReference = transaction.collection(collectionName).doc(input.householdId);
          const currentDocument = await loadDocumentWithGetter(
            () => documentReference.get(),
            input.householdId
          );
          assertExpectedRevision(currentDocument, input.expectedRemoteRevision);
          await documentReference.set(document);
        });
        return;
      }

      await saveDocumentWithRevisionCheck(
        db.collection(collectionName).doc(input.householdId),
        input.householdId,
        input.expectedRemoteRevision,
        document
      );
    }
  };
}

async function saveDocumentWithRevisionCheck(
  documentReference: CloudBaseDocumentReference,
  householdId: string,
  expectedRemoteRevision: number | null,
  document: SyncSnapshotDocument
): Promise<void> {
  const currentDocument = await loadDocument(documentReference, householdId);
  assertExpectedRevision(currentDocument, expectedRemoteRevision);
  await documentReference.set(document);
}

async function loadDocument(
  documentReference: CloudBaseDocumentReference,
  householdId: string
): Promise<SyncSnapshotDocument | null> {
  return loadDocumentWithGetter(() => documentReference.get(), householdId);
}

async function loadDocumentWithGetter(
  getter: () => Promise<{ data?: unknown }>,
  householdId: string
): Promise<SyncSnapshotDocument | null> {
  const result = await getter();
  const data = normalizeDocumentData(result.data);

  if (!isSyncSnapshotDocument(data, householdId)) {
    return null;
  }

  return deepClone(data);
}

function assertExpectedRevision(
  currentDocument: SyncSnapshotDocument | null,
  expectedRemoteRevision: number | null
): void {
  const currentRevision = currentDocument?.snapshot.remoteRevision ?? null;

  if (currentRevision !== expectedRemoteRevision) {
    throw new StaleRemoteRevisionError(currentRevision ?? 0, expectedRemoteRevision);
  }
}

function createSnapshotDocument(
  householdId: string,
  snapshot: RemoteSnapshot,
  updatedAtIso: string
): SyncSnapshotDocument {
  return {
    schemaVersion: 1,
    householdId,
    snapshot: deepClone(snapshot),
    updatedAtIso
  };
}

function normalizeDocumentData(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data ?? null;
}

function isSyncSnapshotDocument(value: unknown, householdId: string): value is SyncSnapshotDocument {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    value.householdId === householdId &&
    isRemoteSnapshot(value.snapshot)
  );
}

function isRemoteSnapshot(value: unknown): value is RemoteSnapshot {
  return (
    isRecord(value) &&
    (value.household === null || isRecord(value.household)) &&
    Array.isArray(value.members) &&
    Array.isArray(value.wallets) &&
    Array.isArray(value.ledgerEntries) &&
    Array.isArray(value.draftPapers) &&
    Array.isArray(value.letters) &&
    Array.isArray(value.postalRecords) &&
    Array.isArray(value.photoAttachments) &&
    Array.isArray(value.syncCursors) &&
    typeof value.exportedAtIso === "string" &&
    typeof value.remoteRevision === "number" &&
    Number.isSafeInteger(value.remoteRevision) &&
    value.remoteRevision >= 0
  );
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

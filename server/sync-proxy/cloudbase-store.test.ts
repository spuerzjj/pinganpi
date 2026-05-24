import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "../../src/app/app-state.js";
import type { RemoteSnapshot } from "../../src/app/sync/remote-model.js";
import { createRemoteSnapshotFromAppState } from "../../src/app/sync/remote-snapshot.js";
import { StaleRemoteRevisionError } from "./handler.js";
import { createCloudBaseSyncSnapshotStore, DEFAULT_SYNC_SNAPSHOT_COLLECTION } from "./cloudbase-store.js";

const householdId = "household-main";
const deviceId = "device-a";

describe("cloudbase sync snapshot store", () => {
  it("returns null when the snapshot document does not exist", async () => {
    const db = createFakeDb();
    const store = createCloudBaseSyncSnapshotStore(db);

    await expect(store.loadSnapshot(householdId)).resolves.toBeNull();
  });

  it("saves a schema versioned household snapshot document", async () => {
    const db = createFakeDb();
    const store = createCloudBaseSyncSnapshotStore(db);
    const snapshot = createSnapshot(1);

    await store.saveSnapshot({
      householdId,
      expectedRemoteRevision: null,
      snapshot,
      updatedAtIso: "2026-05-24T06:00:00.000Z"
    });

    expect(db.readDocument(DEFAULT_SYNC_SNAPSHOT_COLLECTION, householdId)).toEqual({
      schemaVersion: 1,
      householdId,
      snapshot,
      updatedAtIso: "2026-05-24T06:00:00.000Z"
    });
    await expect(store.loadSnapshot(householdId)).resolves.toEqual(snapshot);
  });

  it("rejects stale expected revisions without mutating the stored snapshot", async () => {
    const db = createFakeDb();
    const store = createCloudBaseSyncSnapshotStore(db);
    const existing = createSnapshot(2);
    db.writeDocument(DEFAULT_SYNC_SNAPSHOT_COLLECTION, householdId, {
      schemaVersion: 1,
      householdId,
      snapshot: existing,
      updatedAtIso: "2026-05-24T05:00:00.000Z"
    });

    await expect(
      store.saveSnapshot({
        householdId,
        expectedRemoteRevision: 1,
        snapshot: createSnapshot(3),
        updatedAtIso: "2026-05-24T06:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(StaleRemoteRevisionError);
    expect(db.readDocument(DEFAULT_SYNC_SNAPSHOT_COLLECTION, householdId)?.snapshot).toEqual(existing);
  });

  it("uses a transaction when the database exposes runTransaction", async () => {
    const db = createFakeDb();
    const store = createCloudBaseSyncSnapshotStore(db);

    await store.saveSnapshot({
      householdId,
      expectedRemoteRevision: null,
      snapshot: createSnapshot(1),
      updatedAtIso: "2026-05-24T06:00:00.000Z"
    });

    expect(db.transactionRuns).toBe(1);
  });
});

interface SnapshotDocument {
  schemaVersion: number;
  householdId: string;
  snapshot: RemoteSnapshot;
  updatedAtIso: string;
}

interface FakeDb {
  transactionRuns: number;
  collection(name: string): FakeCollection;
  runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>): Promise<T>;
  readDocument(collectionName: string, id: string): SnapshotDocument | undefined;
  writeDocument(collectionName: string, id: string, document: SnapshotDocument): void;
}

interface FakeCollection {
  doc(id: string): FakeDoc;
}

interface FakeDoc {
  collectionName: string;
  id: string;
  get(): Promise<{ data: SnapshotDocument | null }>;
  set(data: SnapshotDocument): Promise<{ updated: number }>;
}

interface FakeTransaction {
  collection(name: string): FakeCollection;
}

function createFakeDb(): FakeDb {
  const documentsByCollection = new Map<string, Map<string, SnapshotDocument>>();

  const db: FakeDb = {
    transactionRuns: 0,
    collection(name) {
      return createCollection(documentsByCollection, name);
    },
    async runTransaction(callback) {
      db.transactionRuns += 1;
      return callback({
        collection(name) {
          return createCollection(documentsByCollection, name);
        }
      });
    },
    readDocument(collectionName, id) {
      return documentsByCollection.get(collectionName)?.get(id);
    },
    writeDocument(collectionName, id, document) {
      getCollectionDocuments(documentsByCollection, collectionName).set(id, document);
    }
  };

  return db;
}

function createCollection(documentsByCollection: Map<string, Map<string, SnapshotDocument>>, name: string): FakeCollection {
  return {
    doc(id) {
      return {
        collectionName: name,
        id,
        async get() {
          return {
            data: documentsByCollection.get(name)?.get(id) ?? null
          };
        },
        async set(data) {
          getCollectionDocuments(documentsByCollection, name).set(id, data);
          return { updated: 1 };
        }
      };
    }
  };
}

function getCollectionDocuments(
  documentsByCollection: Map<string, Map<string, SnapshotDocument>>,
  name: string
): Map<string, SnapshotDocument> {
  const existing = documentsByCollection.get(name);

  if (existing !== undefined) {
    return existing;
  }

  const next = new Map<string, SnapshotDocument>();
  documentsByCollection.set(name, next);

  return next;
}

function createSnapshot(remoteRevision: number): RemoteSnapshot {
  return createRemoteSnapshotFromAppState(createDefaultAppState(), {
    householdId,
    deviceId,
    exportedAtIso: "2026-05-24T06:00:00.000Z",
    remoteRevision
  });
}

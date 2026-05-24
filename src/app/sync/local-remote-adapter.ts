import type { KeyValueStorage } from "../app-state-storage.js";
import type { RemoteSnapshot, RemoteSyncCursor, SyncAdapter, SyncPullInput, SyncPushInput } from "./remote-model.js";
import { createEmptyRemoteSnapshot, mergeRemoteSnapshots, redactRemoteSnapshotForMember } from "./remote-snapshot.js";

export const LOCAL_REMOTE_SNAPSHOT_STORAGE_KEY_PREFIX = "pinganpi.remote-snapshot.v1.";

interface StoredRemoteState {
  snapshot: RemoteSnapshot;
}

export class StaleRemoteRevisionError extends Error {
  readonly code = "stale_remote_revision";

  constructor(expectedRevision: number, receivedRevision: number | null) {
    super(`Stale remote revision: expected ${expectedRevision}, received ${receivedRevision ?? "null"}`);
  }
}

export function createRemoteSnapshotStorageKey(householdId: string): string {
  return `${LOCAL_REMOTE_SNAPSHOT_STORAGE_KEY_PREFIX}${householdId}`;
}

export function createLocalStorageRemoteSyncAdapter(storage: KeyValueStorage): SyncAdapter {
  return {
    async pull(input) {
      const nowIso = new Date().toISOString();
      const stored = loadStoredRemoteState(storage, input.householdId);
      const snapshot =
        stored?.snapshot ??
        createEmptyRemoteSnapshot({
          householdId: input.householdId,
          deviceId: input.deviceId,
          exportedAtIso: nowIso,
          remoteRevision: 0
        });
      const previousCursor = findCursor(snapshot, input.deviceId);
      const pulledCursor = createPulledCursor(input, snapshot.remoteRevision, nowIso, previousCursor);
      const nextSnapshot = upsertCursor(deepClone(snapshot), pulledCursor);

      if (stored !== undefined) {
        saveStoredRemoteState(
          storage,
          input.householdId,
          upsertCursor(stored.snapshot, createPulledCursor(input, stored.snapshot.remoteRevision, nowIso, previousCursor))
        );
      }

      return deepClone(redactRemoteSnapshotForMember(nextSnapshot, input.memberId));
    },

    async push(input) {
      const nowIso = new Date().toISOString();
      const stored = loadStoredRemoteState(storage, input.householdId);
      const baseSnapshot =
        stored?.snapshot ??
        createEmptyRemoteSnapshot({
          householdId: input.householdId,
          deviceId: input.deviceId,
          exportedAtIso: nowIso,
          remoteRevision: 0
        });

      if (input.baseRemoteRevision !== null && input.baseRemoteRevision !== baseSnapshot.remoteRevision) {
        throw new StaleRemoteRevisionError(baseSnapshot.remoteRevision, input.baseRemoteRevision);
      }

      const nextRevision = baseSnapshot.remoteRevision + 1;
      const mergedSnapshot = mergeRemoteSnapshots(baseSnapshot, input.snapshot, {
        householdId: input.householdId,
        deviceId: input.deviceId,
        mergedAtIso: nowIso,
        remoteRevision: nextRevision
      });
      const cursor = createPushedCursor(input, nextRevision, nowIso, findCursor(baseSnapshot, input.deviceId));
      const snapshotWithCursor = upsertCursor(
        {
          ...mergedSnapshot,
          syncCursors: mergeCursors(baseSnapshot.syncCursors, input.snapshot.syncCursors, mergedSnapshot.syncCursors)
        },
        cursor
      );

      saveStoredRemoteState(storage, input.householdId, snapshotWithCursor);

      return {
        householdId: input.householdId,
        deviceId: input.deviceId,
        acceptedRemoteRevision: nextRevision,
        cursor: deepClone(cursor),
        snapshot: deepClone(redactRemoteSnapshotForMember(snapshotWithCursor, input.memberId))
      };
    }
  };
}

function loadStoredRemoteState(storage: KeyValueStorage, householdId: string): StoredRemoteState | undefined {
  const raw = storage.getItem(createRemoteSnapshotStorageKey(householdId));

  if (raw === null) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isRemoteSnapshotForHousehold(parsed, householdId)) {
      return undefined;
    }

    return { snapshot: parsed };
  } catch {
    return undefined;
  }
}

function saveStoredRemoteState(storage: KeyValueStorage, householdId: string, snapshot: RemoteSnapshot): void {
  storage.setItem(createRemoteSnapshotStorageKey(householdId), JSON.stringify(deepClone(snapshot)));
}

function createPulledCursor(
  input: SyncPullInput,
  remoteRevision: number,
  nowIso: string,
  previousCursor?: RemoteSyncCursor
): RemoteSyncCursor {
  return {
    householdId: input.householdId,
    deviceId: input.deviceId,
    memberId: input.memberId,
    remoteRevision,
    lastPulledAtIso: nowIso,
    lastPushedAtIso: previousCursor?.lastPushedAtIso ?? null,
    updatedAtIso: nowIso
  };
}

function createPushedCursor(
  input: SyncPushInput,
  remoteRevision: number,
  nowIso: string,
  previousCursor?: RemoteSyncCursor
): RemoteSyncCursor {
  return {
    householdId: input.householdId,
    deviceId: input.deviceId,
    memberId: input.memberId,
    remoteRevision,
    lastPulledAtIso: previousCursor?.lastPulledAtIso ?? null,
    lastPushedAtIso: nowIso,
    updatedAtIso: nowIso
  };
}

function findCursor(snapshot: RemoteSnapshot, deviceId: string): RemoteSyncCursor | undefined {
  return snapshot.syncCursors.find((cursor) => cursor.deviceId === deviceId);
}

function mergeCursors(...cursorGroups: RemoteSyncCursor[][]): RemoteSyncCursor[] {
  const byDeviceId = new Map<string, RemoteSyncCursor>();

  for (const cursor of cursorGroups.flat()) {
    const existing = byDeviceId.get(cursor.deviceId);

    byDeviceId.set(cursor.deviceId, existing === undefined ? cursor : mergeCursor(existing, cursor));
  }

  return Array.from(byDeviceId.values()).sort((left, right) => left.deviceId.localeCompare(right.deviceId));
}

function mergeCursor(left: RemoteSyncCursor, right: RemoteSyncCursor): RemoteSyncCursor {
  const updatedAtIso = chooseLaterIso(left.updatedAtIso, right.updatedAtIso);
  const memberId = right.memberId ?? left.memberId;

  return {
    householdId: right.householdId,
    deviceId: right.deviceId,
    ...(memberId === undefined ? {} : { memberId }),
    remoteRevision: Math.max(left.remoteRevision, right.remoteRevision),
    lastPulledAtIso: chooseLaterNullableIso(left.lastPulledAtIso, right.lastPulledAtIso),
    lastPushedAtIso: chooseLaterNullableIso(left.lastPushedAtIso, right.lastPushedAtIso),
    updatedAtIso
  };
}

function upsertCursor(snapshot: RemoteSnapshot, cursor: RemoteSyncCursor): RemoteSnapshot {
  return {
    ...snapshot,
    syncCursors: [...snapshot.syncCursors.filter((candidate) => candidate.deviceId !== cursor.deviceId), cursor],
    exportedAtIso: cursor.updatedAtIso,
    remoteRevision: cursor.remoteRevision
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function chooseLaterNullableIso(left: string | null, right: string | null): string | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return chooseLaterIso(left, right);
}

function chooseLaterIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function isRemoteSnapshotForHousehold(value: unknown, householdId: string): value is RemoteSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.household === null ||
      (isRecord(value.household) &&
        value.household.id === householdId &&
        value.household.householdId === householdId)) &&
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

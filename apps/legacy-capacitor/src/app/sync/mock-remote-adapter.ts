import type { SyncAdapter, RemoteSnapshot, RemoteSyncCursor, SyncPullInput, SyncPushInput } from "./remote-model.js";
import { createEmptyRemoteSnapshot, mergeRemoteSnapshots, redactRemoteSnapshotForMember } from "./remote-snapshot.js";

interface StoredRemoteState {
  snapshot: RemoteSnapshot;
}

export function createMockRemoteSyncAdapter(): SyncAdapter {
  const snapshotsByHouseholdId = new Map<string, StoredRemoteState>();

  return {
    async pull(input) {
      const nowIso = new Date().toISOString();
      const stored = snapshotsByHouseholdId.get(input.householdId);
      const snapshot =
        stored?.snapshot ??
        createEmptyRemoteSnapshot({
          householdId: input.householdId,
          deviceId: input.deviceId,
          exportedAtIso: nowIso,
          remoteRevision: 0
        });
      const previousCursor = findCursor(snapshot, input.deviceId);
      const nextSnapshot = upsertCursor(deepClone(snapshot), createPulledCursor(input, snapshot.remoteRevision, nowIso, previousCursor));

      if (stored !== undefined) {
        stored.snapshot = upsertCursor(
          stored.snapshot,
          createPulledCursor(input, stored.snapshot.remoteRevision, nowIso, previousCursor)
        );
      }

      return redactRemoteSnapshotForMember(nextSnapshot, input.memberId);
    },

    async push(input) {
      const nowIso = new Date().toISOString();
      const stored = snapshotsByHouseholdId.get(input.householdId);
      const baseSnapshot =
        stored?.snapshot ??
        createEmptyRemoteSnapshot({
          householdId: input.householdId,
          deviceId: input.deviceId,
          exportedAtIso: nowIso,
          remoteRevision: 0
        });
      const nextRevision = baseSnapshot.remoteRevision + 1;
      const mergedSnapshot = mergeSnapshots(baseSnapshot, input.snapshot, {
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

      snapshotsByHouseholdId.set(input.householdId, {
        snapshot: deepClone(snapshotWithCursor)
      });

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

function mergeSnapshots(
  baseSnapshot: RemoteSnapshot,
  incomingSnapshot: RemoteSnapshot,
  options: {
    householdId: string;
    deviceId: string;
    mergedAtIso: string;
    remoteRevision: number;
  }
): RemoteSnapshot {
  return mergeRemoteSnapshots(baseSnapshot, incomingSnapshot, {
    householdId: options.householdId,
    deviceId: options.deviceId,
    mergedAtIso: options.mergedAtIso,
    remoteRevision: options.remoteRevision
  });
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

  return {
    householdId: right.householdId,
    deviceId: right.deviceId,
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

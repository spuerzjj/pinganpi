import type { AppState } from "../app-state.js";
import type { RemoteSnapshot, SyncAdapter } from "./remote-model.js";
import { createRemoteSnapshotFromAppState, mergeRemoteSnapshotIntoAppState, redactRemoteSnapshotForMember } from "./remote-snapshot.js";
import type { LocalSyncState } from "./sync-state.js";

export const SYNC_ERROR_MESSAGES = {
  pullFailed: "同步未完成，请稍后重试",
  pushFailed: "同步未送达，请稍后重试",
  conflict: "账本已有新变化，请先收取后再试"
} as const;

export type SyncFailureReason = "pull_failed" | "push_failed" | "conflict";

export interface SyncRuntimeInput {
  state: AppState;
  syncState: LocalSyncState;
  adapter: SyncAdapter;
  now?: Date;
}

export interface SyncNowInput extends SyncRuntimeInput {
  pushLocalChanges?: boolean;
}

export type SyncRuntimeResult =
  | {
      ok: true;
      state: AppState;
      syncState: LocalSyncState;
      snapshot?: RemoteSnapshot;
    }
  | {
      ok: false;
      state: AppState;
      syncState: LocalSyncState;
      reason: SyncFailureReason;
    };

export async function pullRemoteChanges(input: SyncRuntimeInput): Promise<SyncRuntimeResult> {
  const syncedAtIso = getSyncTimeIso(input.now);
  const { syncState } = input;

  try {
    const snapshot = await input.adapter.pull({
      householdId: syncState.householdId,
      deviceId: syncState.deviceId,
      memberId: syncState.memberId,
      sinceRemoteRevision: syncState.lastRemoteRevision
    });
    const state = mergeRemoteSnapshotIntoAppState(input.state, snapshot, {
      householdId: syncState.householdId,
      deviceId: syncState.deviceId,
      currentMemberId: syncState.memberId,
      mergedAtIso: syncedAtIso,
      remoteRevision: snapshot.remoteRevision
    });

    return {
      ok: true,
      state,
      syncState: markSynced(syncState, snapshot.remoteRevision, syncedAtIso),
      snapshot
    };
  } catch {
    return {
      ok: false,
      state: input.state,
      syncState: markFailed(syncState, SYNC_ERROR_MESSAGES.pullFailed),
      reason: "pull_failed"
    };
  }
}

export async function pushLocalChanges(input: SyncRuntimeInput): Promise<SyncRuntimeResult> {
  const syncedAtIso = getSyncTimeIso(input.now);
  const { syncState } = input;

  try {
    const snapshot = createRemoteSnapshotFromAppState(input.state, {
      householdId: syncState.householdId,
      deviceId: syncState.deviceId,
      exportedAtIso: syncedAtIso,
      remoteRevision: syncState.lastRemoteRevision ?? 0,
      includePrivateDraftsForMemberId: syncState.memberId
    });
    const result = await input.adapter.push({
      householdId: syncState.householdId,
      deviceId: syncState.deviceId,
      memberId: syncState.memberId,
      baseRemoteRevision: syncState.lastRemoteRevision,
      snapshot
    });
    const visibleSnapshot = redactRemoteSnapshotForMember(result.snapshot, syncState.memberId);
    const state = mergeRemoteSnapshotIntoAppState(input.state, visibleSnapshot, {
      householdId: syncState.householdId,
      deviceId: syncState.deviceId,
      currentMemberId: syncState.memberId,
      mergedAtIso: syncedAtIso,
      remoteRevision: result.acceptedRemoteRevision
    });

    return {
      ok: true,
      state,
      syncState: markSynced(syncState, result.acceptedRemoteRevision, syncedAtIso),
      snapshot: visibleSnapshot
    };
  } catch (error) {
    if (isStaleRemoteRevisionError(error)) {
      return {
        ok: false,
        state: input.state,
        syncState: markFailed(syncState, SYNC_ERROR_MESSAGES.conflict),
        reason: "conflict"
      };
    }

    return {
      ok: false,
      state: input.state,
      syncState: markFailed(syncState, SYNC_ERROR_MESSAGES.pushFailed),
      reason: "push_failed"
    };
  }
}

export async function syncNow(input: SyncNowInput): Promise<SyncRuntimeResult> {
  const now = input.now ?? new Date();
  const pulled = await pullRemoteChanges({ ...input, now });

  if (!pulled.ok) {
    return pulled;
  }

  if (input.pushLocalChanges === false) {
    return pulled;
  }

  return pushLocalChanges({
    state: pulled.state,
    syncState: pulled.syncState,
    adapter: input.adapter,
    now
  });
}

export function prepareOnlineMutation(input: SyncRuntimeInput): Promise<SyncRuntimeResult> {
  return pullRemoteChanges(input);
}

function markSynced(syncState: LocalSyncState, remoteRevision: number, syncedAtIso: string): LocalSyncState {
  return {
    ...syncState,
    lastRemoteRevision: remoteRevision,
    lastSyncedAtIso: syncedAtIso,
    status: "synced",
    lastError: null
  };
}

function markFailed(syncState: LocalSyncState, lastError: string): LocalSyncState {
  return {
    ...syncState,
    status: "failed",
    lastError
  };
}

function getSyncTimeIso(now: Date | undefined): string {
  return (now ?? new Date()).toISOString();
}

function isStaleRemoteRevisionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "stale_remote_revision"
  );
}

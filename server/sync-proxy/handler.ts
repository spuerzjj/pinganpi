import type {
  RemoteSnapshot,
  RemoteSyncCursor,
  SyncPullInput,
  SyncPushInput
} from "../../src/app/sync/remote-model.js";
import { createEmptyRemoteSnapshot, mergeRemoteSnapshots, redactRemoteSnapshotForMember } from "../../src/app/sync/remote-snapshot.js";

export interface SyncProxyRequest {
  method: string;
  url: string;
  headers?: Record<string, string | string[] | undefined>;
  body: string;
}

export interface SyncProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface SyncSnapshotStore {
  loadSnapshot(householdId: string): Promise<RemoteSnapshot | null>;
  saveSnapshot(input: {
    householdId: string;
    expectedRemoteRevision: number | null;
    snapshot: RemoteSnapshot;
    updatedAtIso: string;
  }): Promise<void>;
}

export interface SyncProxyAuthConfig {
  required: boolean;
  memberTokens: Record<string, Record<string, string>>;
}

export class StaleRemoteRevisionError extends Error {
  readonly code = "stale_remote_revision";

  constructor(expectedRevision: number, receivedRevision: number | null) {
    super(`Stale remote revision: expected ${expectedRevision}, received ${receivedRevision ?? "null"}`);
  }
}

export async function handleSyncProxyRequest(
  store: SyncSnapshotStore,
  request: SyncProxyRequest,
  authConfig?: SyncProxyAuthConfig
): Promise<SyncProxyResponse> {
  const pathname = normalizeSyncPathname(new URL(request.url, "http://127.0.0.1").pathname);

  try {
    if (request.method === "GET" && pathname === "/health") {
      return jsonResponse(200, { ok: true });
    }

    if (request.method === "POST" && pathname === "/sync/pull") {
      const input = parsePullInput(request.body);
      assertAuthorized(authConfig, request, input);
      return await handlePull(store, input);
    }

    if (request.method === "POST" && pathname === "/sync/push") {
      const input = parsePushInput(request.body);
      assertAuthorized(authConfig, request, input);
      return await handlePush(store, input);
    }

    return jsonResponse(404, { error: "not_found" });
  } catch (error) {
    if (isBadRequestError(error)) {
      return jsonResponse(400, { error: "bad_request" });
    }

    if (isStaleRemoteRevisionError(error)) {
      return jsonResponse(409, { error: "stale_remote_revision" });
    }

    if (isUnauthorizedError(error)) {
      return jsonResponse(401, { error: "unauthorized" });
    }

    return jsonResponse(500, { error: "sync_unavailable" });
  }
}

async function handlePull(store: SyncSnapshotStore, input: SyncPullInput): Promise<SyncProxyResponse> {
  const nowIso = new Date().toISOString();
  const storedSnapshot = await store.loadSnapshot(input.householdId);
  const snapshot =
    storedSnapshot ??
    createEmptyRemoteSnapshot({
      householdId: input.householdId,
      deviceId: input.deviceId,
      exportedAtIso: nowIso,
      remoteRevision: 0
    });
  const nextSnapshot = upsertCursor(
    deepClone(snapshot),
    createPulledCursor(input, snapshot.remoteRevision, nowIso, findCursor(snapshot, input.deviceId))
  );

  return jsonResponse(200, {
    snapshot: createClientVisibleSnapshot(nextSnapshot, input.memberId)
  });
}

async function handlePush(store: SyncSnapshotStore, input: SyncPushInput): Promise<SyncProxyResponse> {
  const nowIso = new Date().toISOString();
  const storedSnapshot = await store.loadSnapshot(input.householdId);
  const baseSnapshot =
    storedSnapshot ??
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

  await store.saveSnapshot({
    householdId: input.householdId,
    expectedRemoteRevision: storedSnapshot?.remoteRevision ?? null,
    snapshot: snapshotWithCursor,
    updatedAtIso: nowIso
  });

  return jsonResponse(200, {
    householdId: input.householdId,
    deviceId: input.deviceId,
    acceptedRemoteRevision: nextRevision,
    cursor,
    snapshot: createClientVisibleSnapshot(snapshotWithCursor, input.memberId)
  });
}

function createClientVisibleSnapshot(snapshot: RemoteSnapshot, memberId: string): RemoteSnapshot {
  const redactedSnapshot = redactRemoteSnapshotForMember(snapshot, memberId);

  return {
    ...redactedSnapshot,
    draftPapers: redactedSnapshot.draftPapers.filter((draft) => draft.authorMemberId === memberId),
    photoAttachments: []
  };
}

function assertAuthorized(
  authConfig: SyncProxyAuthConfig | undefined,
  request: SyncProxyRequest,
  input: Pick<SyncPullInput, "householdId" | "memberId">
): void {
  if (authConfig === undefined || !authConfig.required) {
    return;
  }

  const expectedToken = authConfig.memberTokens[input.householdId]?.[input.memberId];
  const receivedToken = readRequestToken(request.headers ?? {});

  if (expectedToken === undefined || receivedToken === null || !safeEqualString(receivedToken, expectedToken)) {
    throw new UnauthorizedError();
  }
}

function readRequestToken(headers: Record<string, string | string[] | undefined>): string | null {
  const explicitToken = normalizeHeaderValue(headers["x-pinganpi-sync-token"] ?? headers["X-Pinganpi-Sync-Token"]);

  if (explicitToken !== null) {
    return explicitToken;
  }

  const authorization = normalizeHeaderValue(headers.authorization ?? headers.Authorization);
  const bearerPrefix = "Bearer ";

  if (authorization !== null && authorization.startsWith(bearerPrefix)) {
    const token = authorization.slice(bearerPrefix.length).trim();

    return token.length === 0 ? null : token;
  }

  return null;
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function safeEqualString(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function parsePullInput(body: string): SyncPullInput {
  const parsed = parseJsonRecord(body);

  if (
    typeof parsed.householdId !== "string" ||
    typeof parsed.deviceId !== "string" ||
    typeof parsed.memberId !== "string" ||
    !(parsed.sinceRemoteRevision === null || isSafeRevision(parsed.sinceRemoteRevision))
  ) {
    throw new BadRequestError();
  }

  return {
    householdId: parsed.householdId,
    deviceId: parsed.deviceId,
    memberId: parsed.memberId,
    sinceRemoteRevision: parsed.sinceRemoteRevision
  };
}

function parsePushInput(body: string): SyncPushInput {
  const parsed = parseJsonRecord(body);

  if (
    typeof parsed.householdId !== "string" ||
    typeof parsed.deviceId !== "string" ||
    typeof parsed.memberId !== "string" ||
    !(parsed.baseRemoteRevision === null || isSafeRevision(parsed.baseRemoteRevision)) ||
    !isRemoteSnapshot(parsed.snapshot)
  ) {
    throw new BadRequestError();
  }

  return {
    householdId: parsed.householdId,
    deviceId: parsed.deviceId,
    memberId: parsed.memberId,
    baseRemoteRevision: parsed.baseRemoteRevision,
    snapshot: parsed.snapshot
  };
}

function parseJsonRecord(body: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body) as unknown;

    if (!isRecord(parsed)) {
      throw new BadRequestError();
    }

    return parsed;
  } catch (error) {
    if (isBadRequestError(error)) {
      throw error;
    }

    throw new BadRequestError();
  }
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

function jsonResponse(statusCode: number, body: unknown): SyncProxyResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function normalizeSyncPathname(pathname: string): string {
  return pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
    isSafeRevision(value.remoteRevision)
  );
}

function isSafeRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class BadRequestError extends Error {}
class UnauthorizedError extends Error {}

function isBadRequestError(error: unknown): error is BadRequestError {
  return error instanceof BadRequestError;
}

function isStaleRemoteRevisionError(error: unknown): error is StaleRemoteRevisionError {
  return (
    error instanceof StaleRemoteRevisionError ||
    (isRecord(error) && error.code === "stale_remote_revision")
  );
}

function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

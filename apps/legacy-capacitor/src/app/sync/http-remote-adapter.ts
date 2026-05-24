import type { RemoteSnapshot, SyncAdapter, SyncPullInput, SyncPushInput, SyncPushResult } from "./remote-model.js";

const SYNC_FAILED_MESSAGE = "同步未完成，请稍后重试";

export interface HttpRemoteSyncAdapterOptions {
  baseUrl: string;
  memberToken?: string | null;
  fetch?: typeof fetch;
}

export class HttpRemoteSyncError extends Error {
  readonly code?: string;

  constructor(message = SYNC_FAILED_MESSAGE, code?: string) {
    super(message);
    this.name = "HttpRemoteSyncError";

    if (code !== undefined) {
      this.code = code;
    }
  }
}

export function createHttpRemoteSyncAdapter(options: HttpRemoteSyncAdapterOptions): SyncAdapter {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const memberToken = normalizeOptionalToken(options.memberToken);
  const fetcher = options.fetch ?? globalThis.fetch;

  if (typeof fetcher !== "function") {
    throw new Error("Cannot create HTTP sync adapter without fetch");
  }

  return {
    async pull(input) {
      const body = await postJson(fetcher, `${baseUrl}/sync/pull`, input, memberToken);

      if (!isPullResponse(body)) {
        throw new HttpRemoteSyncError();
      }

      return body.snapshot;
    },
    async push(input) {
      const body = await postJson(fetcher, `${baseUrl}/sync/push`, input, memberToken);

      if (!isPushResponse(body, input)) {
        throw new HttpRemoteSyncError();
      }

      return body;
    }
  };
}

async function postJson(
  fetcher: typeof fetch,
  url: string,
  input: SyncPullInput | SyncPushInput,
  memberToken: string | null
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetcher(url, {
      method: "POST",
      headers: createJsonHeaders(memberToken),
      body: JSON.stringify(input)
    });
  } catch {
    throw new HttpRemoteSyncError();
  }

  if (response.status === 409 && (await readErrorCode(response)) === "stale_remote_revision") {
    throw new HttpRemoteSyncError(SYNC_FAILED_MESSAGE, "stale_remote_revision");
  }

  if (!response.ok) {
    throw new HttpRemoteSyncError();
  }

  try {
    return await response.json();
  } catch {
    throw new HttpRemoteSyncError();
  }
}

function createJsonHeaders(memberToken: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(memberToken === null ? {} : { "X-Pinganpi-Sync-Token": memberToken })
  };
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as unknown;

    return isRecord(body) && body.error === "stale_remote_revision" ? "stale_remote_revision" : null;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();

  if (trimmed.length === 0) {
    throw new Error("Missing HTTP sync base URL");
  }

  return trimmed.replace(/\/+$/, "");
}

function normalizeOptionalToken(token: string | null | undefined): string | null {
  const trimmed = token?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function isPullResponse(value: unknown): value is { snapshot: RemoteSnapshot } {
  return isRecord(value) && isRemoteSnapshot(value.snapshot);
}

function isPushResponse(value: unknown, input: SyncPushInput): value is SyncPushResult {
  if (!isRecord(value)) {
    return false;
  }

  const acceptedRemoteRevision = value.acceptedRemoteRevision;

  if (
    value.householdId !== input.householdId ||
    value.deviceId !== input.deviceId ||
    !isSafeRevision(acceptedRemoteRevision) ||
    acceptedRemoteRevision < (input.baseRemoteRevision ?? -1) + 1 ||
    !isRemoteSnapshot(value.snapshot) ||
    value.snapshot.remoteRevision !== acceptedRemoteRevision ||
    !isRecord(value.cursor) ||
    value.cursor.householdId !== input.householdId ||
    value.cursor.deviceId !== input.deviceId ||
    value.cursor.remoteRevision !== acceptedRemoteRevision
  ) {
    return false;
  }

  return true;
}

function isRemoteSnapshot(value: unknown): value is RemoteSnapshot {
  return (
    isRecord(value) &&
    (value.household === null || isRemoteHousehold(value.household)) &&
    Array.isArray(value.members) &&
    value.members.every(isRemoteMember) &&
    Array.isArray(value.wallets) &&
    value.wallets.every(isRemoteWallet) &&
    Array.isArray(value.ledgerEntries) &&
    value.ledgerEntries.every(isRemoteLedgerEntry) &&
    Array.isArray(value.draftPapers) &&
    value.draftPapers.every(isRemoteDraftPaper) &&
    Array.isArray(value.letters) &&
    value.letters.every(isRemoteLetter) &&
    Array.isArray(value.postalRecords) &&
    value.postalRecords.every(isRemotePostalRecord) &&
    Array.isArray(value.photoAttachments) &&
    value.photoAttachments.every(isRemotePhotoAttachment) &&
    Array.isArray(value.syncCursors) &&
    value.syncCursors.every(isRemoteSyncCursor) &&
    typeof value.exportedAtIso === "string" &&
    isSafeRevision(value.remoteRevision)
  );
}

function isRemoteHousehold(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.memberIds) &&
    value.memberIds.length === 2 &&
    value.memberIds.every((memberId) => typeof memberId === "string")
  );
}

function isRemoteMember(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    typeof value.dailyName === "string" &&
    typeof value.envelopeName === "string" &&
    typeof value.letterGreeting === "string" &&
    typeof value.signatureName === "string" &&
    typeof value.city === "string" &&
    typeof value.district === "string" &&
    typeof value.postOffice === "string" &&
    typeof value.preferredScribeId === "string"
  );
}

function isRemoteWallet(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.ownerMemberId === "string" &&
    typeof value.balanceFen === "number" &&
    typeof value.monthlyIncomeFen === "number" &&
    typeof value.dailyLivingCostFen === "number" &&
    typeof value.lastSettledAtIso === "string"
  );
}

function isRemoteLedgerEntry(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    typeof value.ownerMemberId === "string" &&
    typeof value.atIso === "string" &&
    typeof value.kind === "string" &&
    typeof value.amountFen === "number" &&
    typeof value.note === "string"
  );
}

function isRemoteDraftPaper(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    typeof value.authorMemberId === "string" &&
    typeof value.recipientMemberId === "string" &&
    (value.scribeId === null || typeof value.scribeId === "string") &&
    typeof value.status === "string"
  );
}

function isRemoteLetter(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    typeof value.senderId === "string" &&
    typeof value.recipientId === "string" &&
    typeof value.subject === "string" &&
    isLetterState(value.state) &&
    typeof value.sentAtIso === "string" &&
    typeof value.distanceKm === "number" &&
    typeof value.registered === "boolean" &&
    typeof value.hasPhoto === "boolean" &&
    typeof value.important === "boolean" &&
    Array.isArray(value.photoAttachmentIds) &&
    value.photoAttachmentIds.every((id) => typeof id === "string")
  );
}

function isRemotePostalRecord(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    typeof value.letterId === "string" &&
    typeof value.letterRemoteId === "string" &&
    typeof value.localLetterId === "string" &&
    typeof value.atIso === "string" &&
    typeof value.text === "string"
  );
}

function isRemotePhotoAttachment(value: unknown): boolean {
  return (
    hasRemoteStamp(value) &&
    typeof value.id === "string" &&
    typeof value.letterId === "string" &&
    typeof value.ownerMemberId === "string" &&
    typeof value.accessState === "string"
  );
}

function isRemoteSyncCursor(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.householdId === "string" &&
    typeof value.deviceId === "string" &&
    (value.memberId === undefined || typeof value.memberId === "string") &&
    isSafeRevision(value.remoteRevision) &&
    (value.lastPulledAtIso === null || typeof value.lastPulledAtIso === "string") &&
    (value.lastPushedAtIso === null || typeof value.lastPushedAtIso === "string") &&
    typeof value.updatedAtIso === "string"
  );
}

function hasRemoteStamp(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.remoteId === "string" &&
    typeof value.localId === "string" &&
    typeof value.householdId === "string" &&
    isSafeRevision(value.remoteRevision) &&
    typeof value.createdAtIso === "string" &&
    typeof value.updatedAtIso === "string" &&
    typeof value.createdByDeviceId === "string" &&
    typeof value.updatedByDeviceId === "string" &&
    (value.deletedAtIso === undefined || typeof value.deletedAtIso === "string")
  );
}

function isLetterState(value: unknown): boolean {
  return (
    value === "draft" ||
    value === "scribed" ||
    value === "revised" ||
    value === "sealed" ||
    value === "posted" ||
    value === "accepted" ||
    value === "in_transit" ||
    value === "delayed" ||
    value === "misrouted" ||
    value === "lost" ||
    value === "found" ||
    value === "returned" ||
    value === "arrived" ||
    value === "opened" ||
    value === "archived"
  );
}

function isSafeRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

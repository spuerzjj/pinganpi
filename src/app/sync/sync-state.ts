export const LOCAL_SYNC_STATE_SCHEMA_VERSION = 1;

export const LOCAL_SYNC_STATUSES = ["not_configured", "idle", "syncing", "synced", "failed", "offline"] as const;

export type LocalSyncStatus = (typeof LOCAL_SYNC_STATUSES)[number];

export interface CreateDefaultLocalSyncStateInput {
  householdId: string;
  memberId: string;
  deviceId?: string;
  deviceIdGenerator?: () => string;
}

export interface LocalSyncState {
  schemaVersion: typeof LOCAL_SYNC_STATE_SCHEMA_VERSION;
  householdId: string;
  deviceId: string;
  memberId: string;
  lastRemoteRevision: number | null;
  lastSyncedAtIso: string | null;
  status: LocalSyncStatus;
  lastError: string | null;
}

export function createDefaultLocalSyncState(input: CreateDefaultLocalSyncStateInput): LocalSyncState {
  return {
    schemaVersion: LOCAL_SYNC_STATE_SCHEMA_VERSION,
    householdId: input.householdId,
    deviceId: input.deviceId ?? input.deviceIdGenerator?.() ?? createDefaultDeviceId(),
    memberId: input.memberId,
    lastRemoteRevision: null,
    lastSyncedAtIso: null,
    status: "idle",
    lastError: null
  };
}

export function parseLocalSyncState(raw: string, fallbackInput: CreateDefaultLocalSyncStateInput): LocalSyncState {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (isLocalSyncState(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to default state.
  }

  return createDefaultLocalSyncState(fallbackInput);
}

export function serializeLocalSyncState(state: LocalSyncState): string {
  return JSON.stringify(state);
}

function createDefaultDeviceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);

    return `device-${bytesToHex(bytes)}`;
  }

  throw new Error("Cannot generate local sync device id without a secure random source");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isLocalSyncState(value: unknown): value is LocalSyncState {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    value.schemaVersion === LOCAL_SYNC_STATE_SCHEMA_VERSION &&
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.deviceId) &&
    isNonEmptyString(value.memberId) &&
    isValidRemoteRevision(value.lastRemoteRevision) &&
    isValidIsoDateOrNull(value.lastSyncedAtIso) &&
    isLocalSyncStatus(value.status) &&
    (value.lastError === null || typeof value.lastError === "string")
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidRemoteRevision(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function isValidIsoDateOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && isIsoDateString(value));
}

function isLocalSyncStatus(value: unknown): value is LocalSyncStatus {
  return typeof value === "string" && LOCAL_SYNC_STATUSES.includes(value as LocalSyncStatus);
}

function isIsoDateString(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

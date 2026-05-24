import { fileURLToPath } from "node:url";

export interface SyncProxySmokeConfig {
  baseUrl: string;
  householdId: string;
  memberId: string;
  memberToken: string;
  deviceId: string;
}

export interface SyncProxySmokeResult {
  initialRemoteRevision: number;
  acceptedRemoteRevision: number;
  finalRemoteRevision: number;
}

interface RemoteSnapshotLike {
  household: null;
  members: [];
  wallets: [];
  ledgerEntries: [];
  draftPapers: [];
  letters: [];
  postalRecords: [];
  photoAttachments: [];
  syncCursors: [];
  exportedAtIso: string;
  remoteRevision: number;
}

export function buildSyncProxySmokeConfig(env: Record<string, string | undefined>): SyncProxySmokeConfig {
  const baseUrl = readRequiredEnv(env, "PINGANPI_SYNC_PROXY_URL", "VITE_PINGANPI_SYNC_PROXY_URL").replace(/\/+$/, "");
  const householdId = readRequiredEnv(env, "PINGANPI_SYNC_SMOKE_HOUSEHOLD_ID");
  const memberId = readRequiredEnv(env, "PINGANPI_SYNC_SMOKE_MEMBER_ID");
  const memberToken = readOptionalEnv(env, "PINGANPI_SYNC_SMOKE_MEMBER_TOKEN") ?? readMemberTokenFromMap(env, householdId, memberId);

  if (memberToken === null) {
    throw new Error("Missing PINGANPI_SYNC_SMOKE_MEMBER_TOKEN or matching PINGANPI_SYNC_MEMBER_TOKENS entry.");
  }

  return {
    baseUrl,
    householdId,
    memberId,
    memberToken,
    deviceId: readOptionalEnv(env, "PINGANPI_SYNC_SMOKE_DEVICE_ID") ?? "stage16-smoke-device"
  };
}

export function joinSyncProxyUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export async function runSyncProxySmokeTest(
  config: SyncProxySmokeConfig,
  fetchFn: typeof fetch = fetch
): Promise<SyncProxySmokeResult> {
  await assertHealth(config, fetchFn);
  await assertFailClosed(config, fetchFn);
  const initialSnapshot = await pullSnapshot(config, fetchFn, config.memberToken);
  const acceptedRemoteRevision = await pushSnapshot(config, fetchFn, initialSnapshot.remoteRevision);
  const finalSnapshot = await pullSnapshot(config, fetchFn, config.memberToken);

  if (finalSnapshot.remoteRevision < acceptedRemoteRevision) {
    throw new Error("sync-proxy smoke failed: final pull did not observe accepted revision.");
  }

  return {
    initialRemoteRevision: initialSnapshot.remoteRevision,
    acceptedRemoteRevision,
    finalRemoteRevision: finalSnapshot.remoteRevision
  };
}

async function assertHealth(config: SyncProxySmokeConfig, fetchFn: typeof fetch): Promise<void> {
  const response = await fetchFn(joinSyncProxyUrl(config.baseUrl, "/sync/health"));

  if (!response.ok) {
    throw new Error(`sync-proxy health failed with HTTP ${response.status}.`);
  }

  const body = await readJson(response);

  if (!isRecord(body) || body.ok !== true) {
    throw new Error("sync-proxy health returned malformed body.");
  }
}

async function assertFailClosed(config: SyncProxySmokeConfig, fetchFn: typeof fetch): Promise<void> {
  const response = await fetchFn(joinSyncProxyUrl(config.baseUrl, "/sync/pull"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(createPullBody(config))
  });

  if (response.status !== 401) {
    throw new Error(`sync-proxy fail-closed check expected HTTP 401, got ${response.status}.`);
  }
}

async function pullSnapshot(
  config: SyncProxySmokeConfig,
  fetchFn: typeof fetch,
  memberToken: string
): Promise<RemoteSnapshotLike> {
  const response = await fetchFn(joinSyncProxyUrl(config.baseUrl, "/sync/pull"), {
    method: "POST",
    headers: createAuthHeaders(memberToken),
    body: JSON.stringify(createPullBody(config))
  });

  if (!response.ok) {
    throw new Error(`sync-proxy pull failed with HTTP ${response.status}.`);
  }

  const body = await readJson(response);
  const snapshot = isRecord(body) ? body.snapshot : undefined;

  if (!isSmokeSnapshot(snapshot)) {
    throw new Error("sync-proxy pull returned malformed snapshot.");
  }

  return snapshot;
}

async function pushSnapshot(
  config: SyncProxySmokeConfig,
  fetchFn: typeof fetch,
  baseRemoteRevision: number
): Promise<number> {
  const response = await fetchFn(joinSyncProxyUrl(config.baseUrl, "/sync/push"), {
    method: "POST",
    headers: createAuthHeaders(config.memberToken),
    body: JSON.stringify({
      householdId: config.householdId,
      deviceId: config.deviceId,
      memberId: config.memberId,
      baseRemoteRevision,
      snapshot: createSmokeSnapshot(baseRemoteRevision)
    })
  });

  if (!response.ok) {
    throw new Error(`sync-proxy push failed with HTTP ${response.status}.`);
  }

  const body = await readJson(response);
  const acceptedRemoteRevision = isRecord(body) ? body.acceptedRemoteRevision : undefined;

  if (typeof acceptedRemoteRevision !== "number" || !Number.isSafeInteger(acceptedRemoteRevision)) {
    throw new Error("sync-proxy push returned malformed accepted revision.");
  }

  return acceptedRemoteRevision;
}

function createAuthHeaders(memberToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Pinganpi-Sync-Token": memberToken
  };
}

function createPullBody(config: SyncProxySmokeConfig): Record<string, unknown> {
  return {
    householdId: config.householdId,
    deviceId: config.deviceId,
    memberId: config.memberId,
    sinceRemoteRevision: null
  };
}

function createSmokeSnapshot(remoteRevision: number): RemoteSnapshotLike {
  return {
    household: null,
    members: [],
    wallets: [],
    ledgerEntries: [],
    draftPapers: [],
    letters: [],
    postalRecords: [],
    photoAttachments: [],
    syncCursors: [],
    exportedAtIso: new Date().toISOString(),
    remoteRevision
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("sync-proxy returned malformed JSON.");
  }
}

function readMemberTokenFromMap(
  env: Record<string, string | undefined>,
  householdId: string,
  memberId: string
): string | null {
  const raw = env.PINGANPI_SYNC_MEMBER_TOKENS?.trim();

  if (raw === undefined || raw.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const householdTokens = isRecord(parsed) ? parsed[householdId] : undefined;
    const token = isRecord(householdTokens) ? householdTokens[memberId] : undefined;

    return typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
  } catch {
    return null;
  }
}

function readRequiredEnv(env: Record<string, string | undefined>, ...keys: string[]): string {
  for (const key of keys) {
    const value = env[key]?.trim();

    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  throw new Error(`Missing ${keys.join(" or ")}.`);
}

function readOptionalEnv(env: Record<string, string | undefined>, key: string): string | null {
  const value = env[key]?.trim();

  return value === undefined || value.length === 0 ? null : value;
}

function isSmokeSnapshot(value: unknown): value is RemoteSnapshotLike {
  return (
    isRecord(value) &&
    (value.household === null) &&
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
    Number.isSafeInteger(value.remoteRevision)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  const config = buildSyncProxySmokeConfig(process.env);
  const result = await runSyncProxySmokeTest(config);

  console.log(
    [
      "CloudBase sync-proxy smoke passed.",
      `household=${config.householdId}`,
      `member=${config.memberId}`,
      `initialRevision=${result.initialRemoteRevision}`,
      `acceptedRevision=${result.acceptedRemoteRevision}`,
      `finalRevision=${result.finalRemoteRevision}`
    ].join(" ")
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

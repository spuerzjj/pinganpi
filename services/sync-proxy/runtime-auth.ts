import type { SyncProxyAccountBinding, SyncProxyAuthConfig } from "./handler.js";

export function readSyncProxyAuthConfig(env: Record<string, string | undefined>): SyncProxyAuthConfig {
  const raw = readMemberTokensJson(env);
  const accountBindings = readAccountBindings(env);
  const trustedAuthUidHeader = readNonEmptyEnv(env.PINGANPI_SYNC_TRUSTED_AUTH_UID_HEADER);

  if (raw === undefined || raw.length === 0) {
    return {
      required: true,
      memberTokens: {},
      ...(accountBindings === undefined ? {} : { accountBindings }),
      ...(trustedAuthUidHeader === undefined ? {} : { trustedAuthUidHeader })
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    return {
      required: true,
      memberTokens: parseMemberTokenMap(parsed),
      ...(accountBindings === undefined ? {} : { accountBindings }),
      ...(trustedAuthUidHeader === undefined ? {} : { trustedAuthUidHeader })
    };
  } catch {
    return {
      required: true,
      memberTokens: {},
      ...(accountBindings === undefined ? {} : { accountBindings }),
      ...(trustedAuthUidHeader === undefined ? {} : { trustedAuthUidHeader })
    };
  }
}

function readMemberTokensJson(env: Record<string, string | undefined>): string | undefined {
  const raw = readNonEmptyEnv(env.PINGANPI_SYNC_MEMBER_TOKENS);

  if (raw !== undefined && raw.length > 0) {
    return raw;
  }

  const rawBase64 = readNonEmptyEnv(env.PINGANPI_SYNC_MEMBER_TOKENS_B64);

  if (rawBase64 === undefined || rawBase64.length === 0) {
    return undefined;
  }

  try {
    return Buffer.from(rawBase64, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function readAccountBindings(env: Record<string, string | undefined>): Record<string, SyncProxyAccountBinding> | undefined {
  const raw = readJsonOrBase64Env(env.PINGANPI_SYNC_ACCOUNT_BINDINGS, env.PINGANPI_SYNC_ACCOUNT_BINDINGS_B64);

  if (raw === undefined) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const bindings = parseAccountBindingMap(parsed);

    return Object.keys(bindings).length === 0 ? undefined : bindings;
  } catch {
    return undefined;
  }
}

function readJsonOrBase64Env(rawValue: string | undefined, rawBase64Value: string | undefined): string | undefined {
  const raw = readNonEmptyEnv(rawValue);

  if (raw !== undefined) {
    return raw;
  }

  const rawBase64 = readNonEmptyEnv(rawBase64Value);

  if (rawBase64 === undefined) {
    return undefined;
  }

  try {
    return Buffer.from(rawBase64, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function parseMemberTokenMap(value: unknown): Record<string, Record<string, string>> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, Record<string, string>> = {};

  for (const [householdId, members] of Object.entries(value)) {
    if (!isRecord(members)) {
      continue;
    }

    const memberTokens: Record<string, string> = {};

    for (const [memberId, token] of Object.entries(members)) {
      if (typeof token === "string" && token.trim().length > 0) {
        memberTokens[memberId] = token.trim();
      }
    }

    if (Object.keys(memberTokens).length > 0) {
      result[householdId] = memberTokens;
    }
  }

  return result;
}

function parseAccountBindingMap(value: unknown): Record<string, SyncProxyAccountBinding> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, SyncProxyAccountBinding> = {};

  for (const [authUid, binding] of Object.entries(value)) {
    if (!isRecord(binding)) {
      continue;
    }

    if (
      typeof binding.accountId === "string" &&
      binding.accountId.trim().length > 0 &&
      typeof binding.householdId === "string" &&
      binding.householdId.trim().length > 0 &&
      typeof binding.memberId === "string" &&
      binding.memberId.trim().length > 0
    ) {
      result[authUid] = {
        accountId: binding.accountId.trim(),
        householdId: binding.householdId.trim(),
        memberId: binding.memberId.trim()
      };
    }
  }

  return result;
}

function readNonEmptyEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

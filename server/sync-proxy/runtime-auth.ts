import type { SyncProxyAuthConfig } from "./handler.js";

export function readSyncProxyAuthConfig(env: Record<string, string | undefined>): SyncProxyAuthConfig {
  const raw = readMemberTokensJson(env);

  if (raw === undefined || raw.length === 0) {
    return {
      required: true,
      memberTokens: {}
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    return {
      required: true,
      memberTokens: parseMemberTokenMap(parsed)
    };
  } catch {
    return {
      required: true,
      memberTokens: {}
    };
  }
}

function readMemberTokensJson(env: Record<string, string | undefined>): string | undefined {
  const raw = env.PINGANPI_SYNC_MEMBER_TOKENS?.trim();

  if (raw !== undefined && raw.length > 0) {
    return raw;
  }

  const rawBase64 = env.PINGANPI_SYNC_MEMBER_TOKENS_B64?.trim();

  if (rawBase64 === undefined || rawBase64.length === 0) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

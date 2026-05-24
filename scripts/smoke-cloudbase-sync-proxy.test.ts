import { describe, expect, it } from "vitest";
import {
  buildSyncProxySmokeConfig,
  joinSyncProxyUrl,
  runSyncProxySmokeTest
} from "./smoke-cloudbase-sync-proxy.js";

describe("cloudbase sync-proxy smoke helpers", () => {
  it("builds smoke config from explicit env", () => {
    const config = buildSyncProxySmokeConfig({
      PINGANPI_SYNC_PROXY_URL: "https://example.com/api/",
      PINGANPI_SYNC_SMOKE_HOUSEHOLD_ID: "household-smoke",
      PINGANPI_SYNC_SMOKE_MEMBER_ID: "member-zhou",
      PINGANPI_SYNC_SMOKE_MEMBER_TOKEN: "secret-token"
    });

    expect(config).toEqual({
      baseUrl: "https://example.com/api",
      householdId: "household-smoke",
      memberId: "member-zhou",
      memberToken: "secret-token",
      deviceId: "stage16-smoke-device"
    });
  });

  it("reads smoke member token from the member token map when no explicit token is set", () => {
    const config = buildSyncProxySmokeConfig({
      VITE_PINGANPI_SYNC_PROXY_URL: "https://example.com/api",
      PINGANPI_SYNC_SMOKE_HOUSEHOLD_ID: "household-main",
      PINGANPI_SYNC_SMOKE_MEMBER_ID: "member-lan",
      PINGANPI_SYNC_MEMBER_TOKENS: '{"household-main":{"member-lan":"token-lan"}}'
    });

    expect(config.memberToken).toBe("token-lan");
  });

  it("joins endpoint paths without duplicating slashes", () => {
    expect(joinSyncProxyUrl("https://example.com/api/", "/sync/pull")).toBe("https://example.com/api/sync/pull");
  });

  it("runs health, fail-closed pull, authorized pull, push and final pull", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch = createFetchMock(calls, [
      jsonResponse({ ok: true }),
      jsonResponse({ error: "unauthorized" }, 401),
      jsonResponse({ snapshot: createEmptySnapshot(0) }),
      jsonResponse({
        householdId: "household-smoke",
        deviceId: "stage16-smoke-device",
        acceptedRemoteRevision: 1,
        cursor: {
          householdId: "household-smoke",
          deviceId: "stage16-smoke-device",
          memberId: "member-zhou",
          remoteRevision: 1,
          lastPulledAtIso: null,
          lastPushedAtIso: "2026-05-24T06:00:00.000Z",
          updatedAtIso: "2026-05-24T06:00:00.000Z"
        },
        snapshot: createEmptySnapshot(1)
      }),
      jsonResponse({ snapshot: createEmptySnapshot(1) })
    ]);

    const result = await runSyncProxySmokeTest(
      {
        baseUrl: "https://example.com/api",
        householdId: "household-smoke",
        memberId: "member-zhou",
        memberToken: "secret-token",
        deviceId: "stage16-smoke-device"
      },
      fetch
    );

    expect(result).toEqual({
      initialRemoteRevision: 0,
      acceptedRemoteRevision: 1,
      finalRemoteRevision: 1
    });
    expect(calls.map((call) => call.url)).toEqual([
      "https://example.com/api/sync/health",
      "https://example.com/api/sync/pull",
      "https://example.com/api/sync/pull",
      "https://example.com/api/sync/push",
      "https://example.com/api/sync/pull"
    ]);
    expect(calls[1]?.init?.headers).toEqual({
      "Content-Type": "application/json"
    });
    expect(calls[2]?.init?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Pinganpi-Sync-Token": "secret-token"
    });
  });
});

function createFetchMock(calls: Array<{ url: string; init?: RequestInit }>, responses: Response[]): typeof fetch {
  let index = 0;

  return async (input, init) => {
    const response = responses[index];
    index += 1;
    calls.push({ url: String(input), init });

    if (response === undefined) {
      throw new Error("Unexpected fetch call.");
    }

    return response;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createEmptySnapshot(remoteRevision: number) {
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
    exportedAtIso: "2026-05-24T06:00:00.000Z",
    remoteRevision
  };
}

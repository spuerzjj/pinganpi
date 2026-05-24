import { describe, expect, it } from "vitest";
import { createInMemoryAccountPairStore, type AccountPairStore } from "../account-pair/account-pair-service.js";
import { handlePinganpiAccountEvent, type AccountPairRepository } from "./pinganpi-account.js";

interface EnsureAccountResultData {
  account: {
    accountId: string;
  };
}

describe("pinganpi account miniprogram function", () => {
  it("returns health without touching the repository", async () => {
    const repository = createMemoryRepository();

    await expect(handlePinganpiAccountEvent(repository, { action: "health" })).resolves.toEqual({
      ok: true,
      action: "health",
      data: { ok: true }
    });
    expect(repository.loadCount).toBe(0);
    expect(repository.saveCount).toBe(0);
  });

  it("creates an account from dev auth uid and full phone number", async () => {
    const repository = createMemoryRepository();

    const result = await handlePinganpiAccountEvent(repository, {
      action: "ensureAccount",
      payload: {
        authUid: "wx-openid-a",
        phoneNumber: "13800138000"
      }
    }, createDeterministicOptions());

    expect(result).toEqual({
      ok: true,
      action: "ensureAccount",
      data: {
        account: {
          accountId: "account-id-a",
          authUid: "wx-openid-a",
          phoneNumber: "13800138000",
          status: "active",
          createdAtIso: "2026-05-24T08:00:00.000Z",
          lastLoginAtIso: "2026-05-24T08:00:00.000Z"
        }
      }
    });
    expect(repository.saveCount).toBe(1);
  });

  it("keeps the same account id and updates last login time on repeated ensure", async () => {
    const repository = createMemoryRepository();
    const options = createDeterministicOptions([
      new Date("2026-05-24T08:00:00.000Z"),
      new Date("2026-05-25T09:30:00.000Z")
    ]);

    await handlePinganpiAccountEvent(repository, {
      action: "ensureAccount",
      payload: { authUid: "wx-openid-a", phoneNumber: "13800138000" }
    }, options);
    const result = await handlePinganpiAccountEvent(repository, {
      action: "ensureAccount",
      payload: { authUid: "wx-openid-a", phoneNumber: "13900139000" }
    }, options);

    expect(result).toMatchObject({
      ok: true,
      action: "ensureAccount",
      data: {
        account: {
          accountId: "account-id-a",
          phoneNumber: "13900139000",
          createdAtIso: "2026-05-24T08:00:00.000Z",
          lastLoginAtIso: "2026-05-25T09:30:00.000Z"
        }
      }
    });
    expect(repository.saveCount).toBe(2);
  });

  it("returns null active binding before a relation exists", async () => {
    const repository = createMemoryRepository();
    const options = createDeterministicOptions();
    const ensured = await handlePinganpiAccountEvent(repository, {
      action: "ensureAccount",
      payload: { authUid: "wx-openid-a", phoneNumber: "13800138000" }
    }, options);

    const accountId = ensured.ok ? (ensured.data as EnsureAccountResultData).account.accountId : "";
    await expect(
      handlePinganpiAccountEvent(repository, {
        action: "getActiveBinding",
        payload: { accountId }
      }, options)
    ).resolves.toEqual({
      ok: true,
      action: "getActiveBinding",
      data: { binding: null }
    });
  });

  it("returns bad request for invalid payloads", async () => {
    const repository = createMemoryRepository();

    await expect(
      handlePinganpiAccountEvent(repository, {
        action: "ensureAccount",
        payload: { authUid: "wx-openid-a" }
      })
    ).resolves.toEqual({
      ok: false,
      action: "ensureAccount",
      reason: "bad_request",
      message: "Invalid account function payload.",
      statusCode: 400
    });
  });
});

function createMemoryRepository(initialStore: AccountPairStore = createInMemoryAccountPairStore()): AccountPairRepository & {
  loadCount: number;
  saveCount: number;
} {
  let store = initialStore;

  return {
    loadCount: 0,
    saveCount: 0,
    async loadStore() {
      this.loadCount += 1;
      return store;
    },
    async saveStore(nextStore) {
      this.saveCount += 1;
      store = nextStore;
    }
  };
}

function createDeterministicOptions(dates: Date[] = [new Date("2026-05-24T08:00:00.000Z")]) {
  let dateIndex = 0;
  let idIndex = 0;
  const ids = ["id-a", "id-b", "id-c", "id-d"];
  const fallbackDate = dates.at(-1) ?? new Date("2026-05-24T08:00:00.000Z");

  return {
    now: () => {
      const date = dates[Math.min(dateIndex, dates.length - 1)] ?? fallbackDate;
      dateIndex += 1;

      return date;
    },
    idGenerator: () => ids[idIndex++] ?? `id-${idIndex}`
  };
}

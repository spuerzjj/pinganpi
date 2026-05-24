import { describe, expect, it } from "vitest";
import { createInMemoryAccountPairStore, type AccountPairStore } from "../account-pair/account-pair-service.js";
import { handlePinganpiAccountEvent, type AccountPairRepository } from "./pinganpi-account.js";

interface AccountResultData {
  account: {
    accountId: string;
    authUid: string;
    phoneNumber: string;
  } | null;
  binding?: unknown;
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

  it("logs in with trusted WeChat identity and server-resolved phone number", async () => {
    const repository = createMemoryRepository();

    const result = await handlePinganpiAccountEvent(
      repository,
      {
        action: "loginByWechatPhone",
        payload: {
          phoneCode: "phone-code-a",
          authUid: "client-forged",
          phoneNumber: "13900139000"
        }
      },
      {
        ...createDeterministicOptions(),
        trustedIdentity: createIdentity("openid-a"),
        phoneNumberResolver: {
          async resolve(phoneCode) {
            expect(phoneCode).toBe("phone-code-a");
            return "13800138000";
          }
        }
      }
    );

    expect(result).toEqual({
      ok: true,
      action: "loginByWechatPhone",
      data: {
        account: {
          accountId: "account-id-a",
          authUid: "wx-openid:wx-app-a:openid-a",
          phoneNumber: "13800138000",
          status: "active",
          createdAtIso: "2026-05-24T08:00:00.000Z",
          lastLoginAtIso: "2026-05-24T08:00:00.000Z"
        },
        binding: null
      }
    });
    expect(repository.saveCount).toBe(1);
  });

  it("keeps the same account id on repeated trusted login", async () => {
    const repository = createMemoryRepository();
    const options = {
      ...createDeterministicOptions([
        new Date("2026-05-24T08:00:00.000Z"),
        new Date("2026-05-25T09:30:00.000Z")
      ]),
      phoneNumberResolver: {
        async resolve() {
          return "13800138000";
        }
      }
    };

    await handlePinganpiAccountEvent(
      repository,
      {
        action: "loginByWechatPhone",
        payload: { phoneCode: "phone-code-a" }
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );
    const result = await handlePinganpiAccountEvent(
      repository,
      {
        action: "loginByWechatPhone",
        payload: { phoneCode: "phone-code-b" }
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );

    expect(result).toMatchObject({
      ok: true,
      action: "loginByWechatPhone",
      data: {
        account: {
          accountId: "account-id-a",
          createdAtIso: "2026-05-24T08:00:00.000Z",
          lastLoginAtIso: "2026-05-25T09:30:00.000Z"
        }
      }
    });
    expect(repository.saveCount).toBe(2);
  });

  it("reads current account and active binding from trusted identity, not payload account id", async () => {
    const repository = createMemoryRepository(createStoreWithBoundAccount());
    const options = createDeterministicOptions();

    await expect(
      handlePinganpiAccountEvent(
        repository,
        {
          action: "getActiveBinding",
          payload: { accountId: "account-b" }
        },
        { ...options, trustedIdentity: createIdentity("openid-a") }
      )
    ).resolves.toMatchObject({
      ok: true,
      action: "getActiveBinding",
      data: {
        account: {
          accountId: "account-a"
        },
        binding: {
          member: {
            accountId: "account-a"
          }
        }
      }
    });
  });

  it("returns null current account before trusted identity has logged in", async () => {
    const repository = createMemoryRepository();

    await expect(
      handlePinganpiAccountEvent(repository, {
        action: "getCurrentAccount"
      }, { trustedIdentity: createIdentity("openid-a") })
    ).resolves.toEqual({
      ok: true,
      action: "getCurrentAccount",
      data: { account: null, binding: null }
    });
  });

  it("rejects login when trusted identity is missing", async () => {
    const repository = createMemoryRepository();

    await expect(
      handlePinganpiAccountEvent(repository, {
        action: "loginByWechatPhone",
        payload: { phoneCode: "phone-code-a", authUid: "client-forged", phoneNumber: "13800138000" }
      })
    ).resolves.toEqual({
      ok: false,
      action: "loginByWechatPhone",
      reason: "unauthorized",
      message: "Mini program trusted identity is unavailable.",
      statusCode: 401
    });
  });

  it("keeps development phone login behind an explicit guard", async () => {
    const repository = createMemoryRepository();

    await expect(
      handlePinganpiAccountEvent(repository, {
        action: "loginByDevPhone",
        payload: { phoneNumber: "13800138000" }
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "dev_login_disabled",
      statusCode: 403
    });
  });

  it("validates development phone number on the server even when the guard is enabled", async () => {
    const repository = createMemoryRepository();

    await expect(
      handlePinganpiAccountEvent(
        repository,
        {
          action: "loginByDevPhone",
          payload: { phoneNumber: "not-a-phone" }
        },
        {
          ...createDeterministicOptions(),
          trustedIdentity: createIdentity("openid-a"),
          allowDevPhoneLogin: true
        }
      )
    ).resolves.toMatchObject({
      ok: false,
      reason: "invalid_phone_number",
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

function createStoreWithBoundAccount(): AccountPairStore {
  return {
    accounts: [
      {
        accountId: "account-a",
        authUid: "wx-openid:wx-app-a:openid-a",
        phoneNumber: "13800138000",
        status: "active",
        createdAtIso: "2026-05-24T08:00:00.000Z",
        lastLoginAtIso: "2026-05-24T08:00:00.000Z"
      },
      {
        accountId: "account-b",
        authUid: "wx-openid:wx-app-a:openid-b",
        phoneNumber: "13900139000",
        status: "active",
        createdAtIso: "2026-05-24T08:00:00.000Z",
        lastLoginAtIso: "2026-05-24T08:00:00.000Z"
      }
    ],
    households: [
      {
        householdId: "household-a",
        status: "active",
        createdByAccountId: "account-a",
        createdAtIso: "2026-05-24T08:00:00.000Z",
        updatedAtIso: "2026-05-24T08:00:00.000Z"
      }
    ],
    members: [
      {
        memberId: "member-a",
        householdId: "household-a",
        accountId: "account-a",
        role: "first",
        joinedAtIso: "2026-05-24T08:00:00.000Z",
        status: "active"
      }
    ],
    invites: []
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

function createIdentity(openId: string) {
  return {
    authUid: `wx-openid:wx-app-a:${openId}`,
    appId: "wx-app-a",
    openId
  };
}

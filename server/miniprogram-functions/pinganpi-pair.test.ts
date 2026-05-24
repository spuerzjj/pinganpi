import { describe, expect, it } from "vitest";
import { createInMemoryAccountPairStore, type AccountPairStore } from "../account-pair/account-pair-service.js";
import { handlePinganpiPairEvent, type AccountPairRepository } from "./pinganpi-pair.js";

interface CreateInviteResultData {
  code: string;
  invite: {
    expiresAtIso: string;
  };
}

describe("pinganpi pair miniprogram function", () => {
  it("creates a household for the trusted current account", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    const result = await handlePinganpiPairEvent(
      repository,
      {
        action: "createHousehold",
        payload: { accountId: "account-b" }
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );

    expect(result).toMatchObject({
      ok: true,
      action: "createHousehold",
      data: {
        account: {
          accountId: "account-a"
        },
        binding: {
          household: {
            householdId: "household-household-id",
            createdByAccountId: "account-a"
          },
          member: {
            memberId: "member-member-id",
            accountId: "account-a",
            role: "first"
          },
          activeMemberCount: 1
        }
      }
    });
    expect(repository.saveCount).toBe(1);
  });

  it("creates a one-time invite without exposing codeHash", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    await handlePinganpiPairEvent(
      repository,
      {
        action: "createHousehold"
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );
    const result = await handlePinganpiPairEvent(
      repository,
      {
        action: "createInvite"
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as CreateInviteResultData;

      expect(data.code).toBe("135790");
      expect(data.invite).not.toHaveProperty("codeHash");
      expect(data.invite).not.toHaveProperty("code");
      expect(data.invite.expiresAtIso).toBe("2026-05-25T08:00:00.000Z");
    }
    expect(repository.saveCount).toBe(2);
  });

  it("joins the trusted second account by invite and ignores forged payload account id", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    await handlePinganpiPairEvent(
      repository,
      {
        action: "createHousehold"
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );
    const invite = await handlePinganpiPairEvent(
      repository,
      {
        action: "createInvite"
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );
    const result = await handlePinganpiPairEvent(
      repository,
      {
        action: "joinByInvite",
        payload: {
          accountId: "account-a",
          householdId: "household-forged",
          memberId: "member-forged",
          code: invite.ok ? (invite.data as CreateInviteResultData).code : ""
        }
      },
      { ...options, trustedIdentity: createIdentity("openid-b") }
    );

    expect(result).toMatchObject({
      ok: true,
      action: "joinByInvite",
      data: {
        account: {
          accountId: "account-b"
        },
        binding: {
          household: {
            householdId: "household-household-id"
          },
          member: {
            accountId: "account-b",
            role: "second"
          },
          activeMemberCount: 2
        }
      }
    });
    expect(repository.saveCount).toBe(3);
  });

  it("returns controlled errors for unauthenticated or unregistered identities", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());

    await expect(
      handlePinganpiPairEvent(repository, {
        action: "createHousehold"
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "unauthorized",
      statusCode: 401
    });
    await expect(
      handlePinganpiPairEvent(repository, {
        action: "createHousehold"
      }, { trustedIdentity: createIdentity("openid-missing") })
    ).resolves.toMatchObject({
      ok: false,
      reason: "account_not_found",
      statusCode: 401
    });
  });

  it("returns controlled errors for duplicate household and own invite", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    await handlePinganpiPairEvent(
      repository,
      {
        action: "createHousehold"
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );
    const invite = await handlePinganpiPairEvent(
      repository,
      {
        action: "createInvite"
      },
      { ...options, trustedIdentity: createIdentity("openid-a") }
    );

    await expect(
      handlePinganpiPairEvent(
        repository,
        {
          action: "createHousehold"
        },
        { ...options, trustedIdentity: createIdentity("openid-a") }
      )
    ).resolves.toMatchObject({
      ok: false,
      action: "createHousehold",
      reason: "account_already_bound",
      statusCode: 409
    });
    await expect(
      handlePinganpiPairEvent(
        repository,
        {
          action: "joinByInvite",
          payload: { code: invite.ok ? (invite.data as CreateInviteResultData).code : "" }
        },
        { ...options, trustedIdentity: createIdentity("openid-a") }
      )
    ).resolves.toMatchObject({
      ok: false,
      action: "joinByInvite",
      reason: "cannot_join_own_invite",
      statusCode: 409
    });
  });
});

function createMemoryRepository(initialStore: AccountPairStore): AccountPairRepository & {
  saveCount: number;
} {
  let store = initialStore;

  return {
    saveCount: 0,
    async loadStore() {
      return store;
    },
    async saveStore(nextStore) {
      this.saveCount += 1;
      store = nextStore;
    }
  };
}

function createStoreWithAccounts(): AccountPairStore {
  return {
    ...createInMemoryAccountPairStore(),
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
    ]
  };
}

function createDeterministicOptions() {
  const ids = ["household-id", "member-id", "invite-id", "second-member-id"];
  let idIndex = 0;

  return {
    now: () => new Date("2026-05-24T08:00:00.000Z"),
    codeGenerator: () => "135790",
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

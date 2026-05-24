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
  it("creates a household with the first member binding", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    const result = await handlePinganpiPairEvent(repository, {
      action: "createHousehold",
      payload: { accountId: "account-a" }
    }, options);

    expect(result).toMatchObject({
      ok: true,
      action: "createHousehold",
      data: {
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

  it("creates a one-time invite without exposing codeHash as the code", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    await handlePinganpiPairEvent(repository, {
      action: "createHousehold",
      payload: { accountId: "account-a" }
    }, options);
    const result = await handlePinganpiPairEvent(repository, {
      action: "createInvite",
      payload: { accountId: "account-a" }
    }, options);

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

  it("lets the second account join by invite", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    await handlePinganpiPairEvent(repository, {
      action: "createHousehold",
      payload: { accountId: "account-a" }
    }, options);
    const invite = await handlePinganpiPairEvent(repository, {
      action: "createInvite",
      payload: { accountId: "account-a" }
    }, options);
    const result = await handlePinganpiPairEvent(repository, {
      action: "joinByInvite",
      payload: { accountId: "account-b", code: invite.ok ? (invite.data as CreateInviteResultData).code : "" }
    }, options);

    expect(result).toMatchObject({
      ok: true,
      action: "joinByInvite",
      data: {
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

  it("returns controlled errors for duplicate household and own invite", async () => {
    const repository = createMemoryRepository(createStoreWithAccounts());
    const options = createDeterministicOptions();

    await handlePinganpiPairEvent(repository, {
      action: "createHousehold",
      payload: { accountId: "account-a" }
    }, options);
    const invite = await handlePinganpiPairEvent(repository, {
      action: "createInvite",
      payload: { accountId: "account-a" }
    }, options);

    await expect(
      handlePinganpiPairEvent(repository, {
        action: "createHousehold",
        payload: { accountId: "account-a" }
      }, options)
    ).resolves.toMatchObject({
      ok: false,
      action: "createHousehold",
      reason: "account_already_bound",
      statusCode: 409
    });
    await expect(
      handlePinganpiPairEvent(repository, {
        action: "joinByInvite",
        payload: { accountId: "account-a", code: invite.ok ? (invite.data as CreateInviteResultData).code : "" }
      }, options)
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
        authUid: "uid-a",
        phoneNumber: "13800138000",
        status: "active",
        createdAtIso: "2026-05-24T08:00:00.000Z",
        lastLoginAtIso: "2026-05-24T08:00:00.000Z"
      },
      {
        accountId: "account-b",
        authUid: "uid-b",
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

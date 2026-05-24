import { describe, expect, it } from "vitest";
import { createMemoryKeyValueStorage } from "../app-state-storage.js";
import { PairBindingError } from "./account-model.js";
import { createLocalPairBindingAdapter } from "./local-pair-binding-adapter.js";

describe("local pair binding adapter", () => {
  it("creates a household and assigns the first member to the creator", async () => {
    const adapter = createLocalPairBindingAdapter(createMemoryKeyValueStorage(), {
      now: () => new Date("2026-05-24T08:00:00.000Z"),
      codeGenerator: () => "123456"
    });

    const binding = await adapter.createHousehold("account-a");
    const invite = await adapter.createInvite("account-a");

    expect(binding.household).toMatchObject({
      householdId: "household-account-a",
      status: "active",
      createdByAccountId: "account-a"
    });
    expect(binding.member).toEqual({
      memberId: "member-account-a",
      householdId: "household-account-a",
      accountId: "account-a",
      role: "first",
      joinedAtIso: "2026-05-24T08:00:00.000Z",
      status: "active"
    });
    expect(invite.code).toBe("123456");
    expect(invite.invite.expiresAtIso).toBe("2026-05-25T08:00:00.000Z");
  });

  it("lets the second account join immediately with a one-time 24 hour invite code", async () => {
    const adapter = createLocalPairBindingAdapter(createMemoryKeyValueStorage(), {
      now: () => new Date("2026-05-24T08:00:00.000Z"),
      codeGenerator: () => "654321"
    });
    await adapter.createHousehold("account-a");
    await adapter.createInvite("account-a");

    const joined = await adapter.joinByInvite("account-b", "654321");

    expect(joined.member).toEqual({
      memberId: "member-account-b",
      householdId: "household-account-a",
      accountId: "account-b",
      role: "second",
      joinedAtIso: "2026-05-24T08:00:00.000Z",
      status: "active"
    });
    expect(joined.activeMemberCount).toBe(2);
    await expect(adapter.joinByInvite("account-c", "654321")).rejects.toThrow("invite_used");
  });

  it("does not allow one account to create or join a second active household", async () => {
    const adapter = createLocalPairBindingAdapter(createMemoryKeyValueStorage(), {
      codeGenerator: () => "111111"
    });

    await adapter.createHousehold("account-a");
    await expect(adapter.createHousehold("account-a")).rejects.toThrow("account_already_bound");
    await adapter.createInvite("account-a");

    await adapter.joinByInvite("account-b", "111111");
    await expect(adapter.createHousehold("account-b")).rejects.toThrow("account_already_bound");
  });

  it("rejects expired invites and own invites", async () => {
    let now = new Date("2026-05-24T08:00:00.000Z");
    const adapter = createLocalPairBindingAdapter(createMemoryKeyValueStorage(), {
      now: () => now,
      codeGenerator: () => "222222"
    });
    await adapter.createHousehold("account-a");
    await adapter.createInvite("account-a");

    await expect(adapter.joinByInvite("account-a", "222222")).rejects.toThrow("cannot_join_own_invite");

    now = new Date("2026-05-25T08:00:00.001Z");
    await expect(adapter.joinByInvite("account-b", "222222")).rejects.toThrow("invite_expired");
  });

  it("rejects full households and missing invites", async () => {
    let nextCode = "333333";
    const adapter = createLocalPairBindingAdapter(createMemoryKeyValueStorage(), {
      codeGenerator: () => nextCode
    });
    await adapter.createHousehold("account-a");
    await adapter.createInvite("account-a");
    await adapter.joinByInvite("account-b", "333333");

    nextCode = "444444";
    await adapter.createInvite("account-a");

    await expect(adapter.joinByInvite("account-c", "444444")).rejects.toThrow("household_full");
    await expect(adapter.joinByInvite("account-c", "999999")).rejects.toBeInstanceOf(PairBindingError);
  });
});

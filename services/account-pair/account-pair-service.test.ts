import { describe, expect, it } from "vitest";
import { PairBindingError } from "../../apps/legacy-capacitor/src/app/account/account-model.js";
import { createAccountPairService, createInMemoryAccountPairStore } from "./account-pair-service.js";

describe("account pair service", () => {
  it("ensures a stable Pinganpi account for the same trusted auth uid", async () => {
    let now = new Date("2026-05-24T08:00:00.000Z");
    const service = createAccountPairService(createInMemoryAccountPairStore(), {
      now: () => now
    });

    const first = await service.ensureAccount({
      authUid: "cloudbase-uid-a",
      phoneNumber: "13800138000"
    });
    now = new Date("2026-05-25T09:30:00.000Z");
    const second = await service.ensureAccount({
      authUid: "cloudbase-uid-a",
      phoneNumber: "13800138000"
    });

    expect(second.accountId).toBe(first.accountId);
    expect(second.createdAtIso).toBe("2026-05-24T08:00:00.000Z");
    expect(second.lastLoginAtIso).toBe("2026-05-25T09:30:00.000Z");
  });

  it("creates an account with an empty phone number for openid login and preserves it on later phone login", async () => {
    const service = createAccountPairService(createInMemoryAccountPairStore(), {
      now: () => new Date("2026-05-24T08:00:00.000Z")
    });

    const created = await service.ensureAccount({ authUid: "wx-openid:app:openid-a" });
    expect(created.phoneNumber).toBe("");

    // A subsequent openid login must not wipe a phone set in between.
    await service.ensureAccount({ authUid: "wx-openid:app:openid-a", phoneNumber: "13800138000" });
    const afterOpenidAgain = await service.ensureAccount({ authUid: "wx-openid:app:openid-a" });
    expect(afterOpenidAgain.phoneNumber).toBe("13800138000");
  });

  it("creates a pair, issues a 24 hour one-time invite, and lets the second account join", async () => {
    const service = createAccountPairService(createInMemoryAccountPairStore(), {
      now: () => new Date("2026-05-24T08:00:00.000Z"),
      codeGenerator: () => "135790"
    });
    const accountA = await service.ensureAccount({ authUid: "uid-a", phoneNumber: "13800138000" });
    const accountB = await service.ensureAccount({ authUid: "uid-b", phoneNumber: "13900139000" });

    const created = await service.createHousehold(accountA.accountId);
    const invite = await service.createInvite(accountA.accountId);
    const joined = await service.joinByInvite(accountB.accountId, invite.code);

    expect(created.member.role).toBe("first");
    expect(invite.code).toBe("135790");
    expect(invite.invite.expiresAtIso).toBe("2026-05-25T08:00:00.000Z");
    expect(joined.household.householdId).toBe(created.household.householdId);
    expect(joined.member.role).toBe("second");
    expect(joined.activeMemberCount).toBe(2);
    await expect(service.joinByInvite("account-c", invite.code)).rejects.toThrow("invite_used");
  });

  it("rejects duplicate active households, expired invites, self invites, and full households", async () => {
    let now = new Date("2026-05-24T08:00:00.000Z");
    let nextCode = "246800";
    const service = createAccountPairService(createInMemoryAccountPairStore(), {
      now: () => now,
      codeGenerator: () => nextCode
    });
    const accountA = await service.ensureAccount({ authUid: "uid-a", phoneNumber: "13800138000" });
    const accountB = await service.ensureAccount({ authUid: "uid-b", phoneNumber: "13900139000" });
    const accountC = await service.ensureAccount({ authUid: "uid-c", phoneNumber: "13700137000" });

    await service.createHousehold(accountA.accountId);
    const firstInvite = await service.createInvite(accountA.accountId);

    await expect(service.createHousehold(accountA.accountId)).rejects.toThrow("account_already_bound");
    await expect(service.joinByInvite(accountA.accountId, firstInvite.code)).rejects.toThrow("cannot_join_own_invite");

    now = new Date("2026-05-25T08:00:00.001Z");
    await expect(service.joinByInvite(accountB.accountId, firstInvite.code)).rejects.toThrow("invite_expired");

    now = new Date("2026-05-25T08:10:00.000Z");
    nextCode = "864200";
    const secondInvite = await service.createInvite(accountA.accountId);
    await service.joinByInvite(accountB.accountId, secondInvite.code);
    nextCode = "975310";
    const thirdInvite = await service.createInvite(accountA.accountId);

    await expect(service.createHousehold(accountB.accountId)).rejects.toThrow("account_already_bound");
    await expect(service.joinByInvite(accountC.accountId, thirdInvite.code)).rejects.toThrow("household_full");
    await expect(service.joinByInvite(accountC.accountId, "000000")).rejects.toBeInstanceOf(PairBindingError);
  });
});

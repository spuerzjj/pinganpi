import { describe, expect, it } from "vitest";
import { createMiniProgramAccountCloudService } from "./account-cloud.js";

describe("miniprogram account cloud service", () => {
  it("logs in through the account cloud function with the trusted WeChat openid", async () => {
    const calls: Array<{ action: string; payload?: unknown }> = [];
    const service = createMiniProgramAccountCloudService({
      async callAccount(action, payload) {
        calls.push({ action, payload });

        return {
          account: { accountId: "account-a" },
          binding: null
        };
      },
      async callPair() {
        throw new Error("not used");
      }
    });

    await expect(service.loginWithWechat()).resolves.toEqual({
      account: { accountId: "account-a" },
      binding: null
    });
    expect(calls).toEqual([
      {
        action: "loginByWechat",
        payload: undefined
      }
    ]);
  });

  it("loads current account and active binding without client account id", async () => {
    const calls: Array<{ action: string; payload?: unknown }> = [];
    const service = createMiniProgramAccountCloudService({
      async callAccount(action, payload) {
        calls.push({ action, payload });

        return {
          account: { accountId: "account-a" },
          binding: null
        };
      },
      async callPair() {
        throw new Error("not used");
      }
    });

    await service.loadCurrentAccount();
    await service.loadActiveBinding();

    expect(calls).toEqual([
      { action: "getCurrentAccount", payload: undefined },
      { action: "getActiveBinding", payload: undefined }
    ]);
  });

  it("performs pair operations without sending account id from the client", async () => {
    const pairCalls: Array<{ action: string; payload?: unknown }> = [];
    const service = createMiniProgramAccountCloudService({
      async callAccount() {
        throw new Error("not used");
      },
      async callPair(action, payload) {
        pairCalls.push({ action, payload });

        return {
          account: { accountId: "account-a" },
          binding: { household: { householdId: "household-a" } },
          invite: { inviteId: "invite-a" },
          code: "135790"
        };
      }
    });

    await service.createHousehold();
    await service.createInvite();
    await service.joinByInvite("135790");

    expect(pairCalls).toEqual([
      { action: "createHousehold", payload: undefined },
      { action: "createInvite", payload: undefined },
      { action: "joinByInvite", payload: { code: "135790" } }
    ]);
  });
});

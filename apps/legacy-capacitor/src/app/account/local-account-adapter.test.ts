import { describe, expect, it } from "vitest";
import { createMemoryKeyValueStorage } from "../app-state-storage.js";
import { createLocalAccountAdapter } from "./local-account-adapter.js";

describe("local account adapter", () => {
  it("restores the same Pinganpi account after phone login", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalAccountAdapter(storage, {
      now: () => new Date("2026-05-24T08:00:00.000Z")
    });

    const requested = await adapter.requestSmsCode(" 13800138000 ");
    const firstLogin = await adapter.loginWithSmsCode("13800138000", requested.devCode);
    const restored = await adapter.restoreSession();

    expect(firstLogin.account).toEqual({
      accountId: "account-13800138000",
      authUid: "local-auth-13800138000",
      phoneNumber: "13800138000",
      status: "active",
      createdAtIso: "2026-05-24T08:00:00.000Z",
      lastLoginAtIso: "2026-05-24T08:00:00.000Z"
    });
    expect(restored?.account.accountId).toBe(firstLogin.account.accountId);
    expect(restored?.account.phoneNumber).toBe("13800138000");
  });

  it("updates last login time without changing account identity", async () => {
    const storage = createMemoryKeyValueStorage();
    let now = new Date("2026-05-24T08:00:00.000Z");
    const adapter = createLocalAccountAdapter(storage, {
      now: () => now
    });

    const requested = await adapter.requestSmsCode("13800138000");
    const firstLogin = await adapter.loginWithSmsCode("13800138000", requested.devCode);
    now = new Date("2026-05-25T09:30:00.000Z");
    const secondLogin = await adapter.loginWithSmsCode("13800138000", requested.devCode);

    expect(secondLogin.account.accountId).toBe(firstLogin.account.accountId);
    expect(secondLogin.account.createdAtIso).toBe("2026-05-24T08:00:00.000Z");
    expect(secondLogin.account.lastLoginAtIso).toBe("2026-05-25T09:30:00.000Z");
  });

  it("clears restored session after logout", async () => {
    const storage = createMemoryKeyValueStorage();
    const adapter = createLocalAccountAdapter(storage);
    const requested = await adapter.requestSmsCode("13800138000");

    await adapter.loginWithSmsCode("13800138000", requested.devCode);
    await adapter.logout();

    await expect(adapter.restoreSession()).resolves.toBeNull();
  });

  it("rejects invalid phone numbers and verification codes", async () => {
    const adapter = createLocalAccountAdapter(createMemoryKeyValueStorage());
    const requested = await adapter.requestSmsCode("13800138000");

    await expect(adapter.requestSmsCode("123")).rejects.toThrow("invalid_phone_number");
    await expect(adapter.loginWithSmsCode("13800138000", "000000")).rejects.toThrow("invalid_sms_code");
    await expect(adapter.loginWithSmsCode("13900139000", requested.devCode)).rejects.toThrow("sms_code_not_requested");
  });
});

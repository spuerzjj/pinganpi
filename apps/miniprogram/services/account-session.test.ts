import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredAccountSession,
  restoreStoredAccountSession,
  saveStoredAccountSession,
  type MiniProgramAccountSession
} from "./account-session.js";

interface TestWxStorage {
  store: Record<string, unknown>;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}

describe("miniprogram account session storage", () => {
  afterEach(() => {
    (globalThis as unknown as { wx: TestWxStorage | undefined }).wx = undefined;
  });

  it("stores only account and binding summary needed by the miniprogram", () => {
    const wx = createStorage();
    (globalThis as unknown as { wx: TestWxStorage }).wx = wx;
    const session = createSession();

    saveStoredAccountSession(session);

    const raw = JSON.stringify(wx.store);
    expect(raw).toContain("13800138000");
    expect(raw).not.toContain("verificationCode");
    expect(raw).not.toContain("CloudBase token");
    expect(raw).not.toContain("codeHash");
    expect(restoreStoredAccountSession()).toEqual(session);
  });

  it("clears stored account session", () => {
    const wx = createStorage();
    (globalThis as unknown as { wx: TestWxStorage }).wx = wx;

    saveStoredAccountSession(createSession());
    clearStoredAccountSession();

    expect(restoreStoredAccountSession()).toBeNull();
  });
});

function createStorage(): TestWxStorage {
  return {
    store: {},
    getStorageSync(key) {
      return this.store[key];
    },
    setStorageSync(key, value) {
      this.store[key] = value;
    },
    removeStorageSync(key) {
      delete this.store[key];
    }
  };
}

function createSession(): MiniProgramAccountSession {
  return {
    account: {
      accountId: "account-a",
      authUid: "wx-openid:wx-app-a:openid-a",
      phoneNumber: "13800138000",
      status: "active",
      createdAtIso: "2026-05-24T08:00:00.000Z",
      lastLoginAtIso: "2026-05-24T08:00:00.000Z"
    },
    binding: {
      household: {
        householdId: "household-a",
        status: "active",
        createdByAccountId: "account-a",
        createdAtIso: "2026-05-24T08:00:00.000Z",
        updatedAtIso: "2026-05-24T08:00:00.000Z"
      },
      member: {
        memberId: "member-a",
        householdId: "household-a",
        accountId: "account-a",
        role: "first",
        joinedAtIso: "2026-05-24T08:00:00.000Z",
        status: "active"
      },
      activeMemberCount: 1
    },
    authenticatedAtIso: "2026-05-24T08:00:00.000Z"
  };
}

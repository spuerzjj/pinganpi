export type MiniProgramAccountStatus = "active" | "disabled";
export type MiniProgramHouseholdStatus = "active" | "disabled";
export type MiniProgramMemberRole = "first" | "second";

export interface MiniProgramAccount {
  accountId: string;
  authUid: string;
  phoneNumber: string;
  status: MiniProgramAccountStatus;
  createdAtIso: string;
  lastLoginAtIso: string;
}

export interface MiniProgramHousehold {
  householdId: string;
  status: MiniProgramHouseholdStatus;
  createdByAccountId: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface MiniProgramMember {
  memberId: string;
  householdId: string;
  accountId: string;
  role: MiniProgramMemberRole;
  joinedAtIso: string;
  status: "active";
}

export interface MiniProgramBinding {
  household: MiniProgramHousehold;
  member: MiniProgramMember;
  activeMemberCount: number;
}

export interface MiniProgramInvite {
  inviteId: string;
  householdId: string;
  createdByAccountId: string;
  expiresAtIso: string;
  usedAtIso: string | null;
  usedByAccountId: string | null;
  status: "active" | "used" | "expired" | "revoked";
}

export interface MiniProgramAccountSession {
  account: MiniProgramAccount;
  binding: MiniProgramBinding | null;
  authenticatedAtIso: string;
}

const storageKey = "pinganpi:miniprogram:account-session:v1";

export function saveStoredAccountSession(session: MiniProgramAccountSession): void {
  readWxStorage().setStorageSync(storageKey, session);
}

export function restoreStoredAccountSession(): MiniProgramAccountSession | null {
  const value = readWxStorage().getStorageSync(storageKey);

  return isMiniProgramAccountSession(value) ? value : null;
}

export function clearStoredAccountSession(): void {
  readWxStorage().removeStorageSync(storageKey);
}

function readWxStorage(): Pick<WechatMiniprogram.Wx, "getStorageSync" | "setStorageSync" | "removeStorageSync"> {
  const wx = (globalThis as { wx?: WechatMiniprogram.Wx }).wx;

  if (
    wx === undefined ||
    typeof wx.getStorageSync !== "function" ||
    typeof wx.setStorageSync !== "function" ||
    typeof wx.removeStorageSync !== "function"
  ) {
    throw new Error("wechat storage is unavailable");
  }

  return wx;
}

function isMiniProgramAccountSession(value: unknown): value is MiniProgramAccountSession {
  if (!isRecord(value) || !isRecord(value.account) || typeof value.authenticatedAtIso !== "string") {
    return false;
  }

  return (
    typeof value.account.accountId === "string" &&
    typeof value.account.authUid === "string" &&
    typeof value.account.phoneNumber === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

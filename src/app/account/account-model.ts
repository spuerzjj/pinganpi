export type PinganpiAccountStatus = "active" | "disabled";
export type PinganpiHouseholdStatus = "active" | "disabled";
export type PinganpiMemberRole = "first" | "second";
export type PinganpiInviteStatus = "active" | "used" | "expired" | "revoked";

export interface PinganpiAccount {
  accountId: string;
  authUid: string;
  phoneNumber: string;
  status: PinganpiAccountStatus;
  createdAtIso: string;
  lastLoginAtIso: string;
}

export interface PinganpiSession {
  account: PinganpiAccount;
  authenticatedAtIso: string;
}

export interface PinganpiHousehold {
  householdId: string;
  status: PinganpiHouseholdStatus;
  createdByAccountId: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface PinganpiMember {
  memberId: string;
  householdId: string;
  accountId: string;
  role: PinganpiMemberRole;
  joinedAtIso: string;
  status: "active";
}

export interface PinganpiInvite {
  inviteId: string;
  householdId: string;
  createdByAccountId: string;
  codeHash: string;
  expiresAtIso: string;
  usedAtIso: string | null;
  usedByAccountId: string | null;
  status: PinganpiInviteStatus;
}

export interface PinganpiBinding {
  household: PinganpiHousehold;
  member: PinganpiMember;
  activeMemberCount: number;
}

export interface PairInviteIssue {
  invite: PinganpiInvite;
  code: string;
}

export class AccountAuthError extends Error {
  constructor(readonly code: "invalid_phone_number" | "sms_code_not_requested" | "invalid_sms_code" | "invalid_session") {
    super(code);
  }
}

export class PairBindingError extends Error {
  constructor(
    readonly code:
      | "account_already_bound"
      | "account_not_bound"
      | "invite_not_found"
      | "invite_expired"
      | "invite_used"
      | "household_full"
      | "cannot_join_own_invite"
  ) {
    super(code);
  }
}

export interface AccountAuthAdapter {
  restoreSession(): Promise<PinganpiSession | null>;
  requestSmsCode(phoneNumber: string): Promise<{ phoneNumber: string; devCode: string }>;
  loginWithSmsCode(phoneNumber: string, code: string): Promise<PinganpiSession>;
  logout(): Promise<void>;
}

export interface PairBindingAdapter {
  getActiveBinding(accountId: string): Promise<PinganpiBinding | null>;
  createHousehold(accountId: string): Promise<PinganpiBinding>;
  createInvite(accountId: string): Promise<PairInviteIssue>;
  joinByInvite(accountId: string, code: string): Promise<PinganpiBinding>;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\s+/g, "").trim();
}

export function isValidMainlandPhoneNumber(phoneNumber: string): boolean {
  return /^1[3-9]\d{9}$/.test(phoneNumber);
}

import { createHash, randomUUID } from "node:crypto";
import {
  PairBindingError,
  type PairInviteIssue,
  type PinganpiAccount,
  type PinganpiBinding,
  type PinganpiHousehold,
  type PinganpiInvite,
  type PinganpiMember
} from "../../apps/legacy-capacitor/src/app/account/account-model.js";

const inviteTtlMs = 24 * 60 * 60 * 1000;

export interface AccountPairStore {
  accounts: PinganpiAccount[];
  households: PinganpiHousehold[];
  members: PinganpiMember[];
  invites: PinganpiInvite[];
}

export interface EnsureAccountInput {
  authUid: string;
  phoneNumber: string;
}

export interface AccountPairService {
  ensureAccount(input: EnsureAccountInput): Promise<PinganpiAccount>;
  getActiveBinding(accountId: string): Promise<PinganpiBinding | null>;
  createHousehold(accountId: string): Promise<PinganpiBinding>;
  createInvite(accountId: string): Promise<PairInviteIssue>;
  joinByInvite(accountId: string, code: string): Promise<PinganpiBinding>;
}

export interface AccountPairServiceOptions {
  now?: () => Date;
  codeGenerator?: () => string;
  idGenerator?: () => string;
}

export function createInMemoryAccountPairStore(): AccountPairStore {
  return {
    accounts: [],
    households: [],
    members: [],
    invites: []
  };
}

export function createAccountPairService(
  store: AccountPairStore,
  options: AccountPairServiceOptions = {}
): AccountPairService {
  const now = options.now ?? (() => new Date());
  const codeGenerator = options.codeGenerator ?? createInviteCode;
  const idGenerator = options.idGenerator ?? (() => randomUUID());

  return {
    async ensureAccount(input) {
      const existing = store.accounts.find((account) => account.authUid === input.authUid);
      const nowIso = now().toISOString();

      if (existing !== undefined) {
        existing.phoneNumber = input.phoneNumber;
        existing.lastLoginAtIso = nowIso;
        return existing;
      }

      const account: PinganpiAccount = {
        accountId: `account-${idGenerator()}`,
        authUid: input.authUid,
        phoneNumber: input.phoneNumber,
        status: "active",
        createdAtIso: nowIso,
        lastLoginAtIso: nowIso
      };

      store.accounts.push(account);
      return account;
    },

    async getActiveBinding(accountId) {
      return findActiveBinding(store, accountId);
    },

    async createHousehold(accountId) {
      if (findActiveBinding(store, accountId) !== null) {
        throw new PairBindingError("account_already_bound");
      }

      const nowIso = now().toISOString();
      const household: PinganpiHousehold = {
        householdId: `household-${idGenerator()}`,
        status: "active",
        createdByAccountId: accountId,
        createdAtIso: nowIso,
        updatedAtIso: nowIso
      };
      const member: PinganpiMember = {
        memberId: `member-${idGenerator()}`,
        householdId: household.householdId,
        accountId,
        role: "first",
        joinedAtIso: nowIso,
        status: "active"
      };

      store.households.push(household);
      store.members.push(member);

      return createBinding(store, household, member);
    },

    async createInvite(accountId) {
      const binding = findActiveBinding(store, accountId);

      if (binding === null) {
        throw new PairBindingError("account_not_bound");
      }

      const nowDate = now();
      const code = codeGenerator();
      const invite: PinganpiInvite = {
        inviteId: `invite-${idGenerator()}`,
        householdId: binding.household.householdId,
        createdByAccountId: accountId,
        codeHash: hashInviteCode(code),
        expiresAtIso: new Date(nowDate.getTime() + inviteTtlMs).toISOString(),
        usedAtIso: null,
        usedByAccountId: null,
        status: "active"
      };

      store.invites.push(invite);

      return {
        invite,
        code
      };
    },

    async joinByInvite(accountId, code) {
      const invite = store.invites.find((candidate) => candidate.codeHash === hashInviteCode(code.trim()));

      if (invite === undefined) {
        throw new PairBindingError("invite_not_found");
      }

      if (invite.createdByAccountId === accountId) {
        throw new PairBindingError("cannot_join_own_invite");
      }

      if (findActiveBinding(store, accountId) !== null) {
        throw new PairBindingError("account_already_bound");
      }

      if (invite.status === "used" || invite.usedAtIso !== null) {
        throw new PairBindingError("invite_used");
      }

      if (invite.status !== "active" || Date.parse(invite.expiresAtIso) < now().getTime()) {
        invite.status = "expired";
        throw new PairBindingError("invite_expired");
      }

      const household = store.households.find(
        (candidate) => candidate.householdId === invite.householdId && candidate.status === "active"
      );

      if (household === undefined) {
        throw new PairBindingError("invite_not_found");
      }

      if (countActiveMembers(store, household.householdId) >= 2) {
        throw new PairBindingError("household_full");
      }

      const nowIso = now().toISOString();
      const member: PinganpiMember = {
        memberId: `member-${idGenerator()}`,
        householdId: household.householdId,
        accountId,
        role: "second",
        joinedAtIso: nowIso,
        status: "active"
      };

      household.updatedAtIso = nowIso;
      invite.status = "used";
      invite.usedAtIso = nowIso;
      invite.usedByAccountId = accountId;
      store.members.push(member);

      return createBinding(store, household, member);
    }
  };
}

function findActiveBinding(store: AccountPairStore, accountId: string): PinganpiBinding | null {
  const member = store.members.find((candidate) => candidate.accountId === accountId && candidate.status === "active");

  if (member === undefined) {
    return null;
  }

  const household = store.households.find(
    (candidate) => candidate.householdId === member.householdId && candidate.status === "active"
  );

  return household === undefined ? null : createBinding(store, household, member);
}

function createBinding(store: AccountPairStore, household: PinganpiHousehold, member: PinganpiMember): PinganpiBinding {
  return {
    household,
    member,
    activeMemberCount: countActiveMembers(store, household.householdId)
  };
}

function countActiveMembers(store: AccountPairStore, householdId: string): number {
  return store.members.filter((member) => member.householdId === householdId && member.status === "active").length;
}

function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function createInviteCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

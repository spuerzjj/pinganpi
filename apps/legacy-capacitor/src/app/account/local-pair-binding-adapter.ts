import type { KeyValueStorage } from "../app-state-storage.js";
import {
  PairBindingError,
  type PairBindingAdapter,
  type PairInviteIssue,
  type PinganpiBinding,
  type PinganpiHousehold,
  type PinganpiInvite,
  type PinganpiMember
} from "./account-model.js";

const LOCAL_PAIR_STORE_KEY = "pinganpi.pair-bindings.v1";
const inviteTtlMs = 24 * 60 * 60 * 1000;

interface LocalPairStore {
  households: PinganpiHousehold[];
  members: PinganpiMember[];
  invites: PinganpiInvite[];
}

export interface LocalPairBindingAdapterOptions {
  now?: () => Date;
  codeGenerator?: () => string;
}

export function createLocalPairBindingAdapter(
  storage: KeyValueStorage,
  options: LocalPairBindingAdapterOptions = {}
): PairBindingAdapter {
  const now = options.now ?? (() => new Date());
  const codeGenerator = options.codeGenerator ?? createInviteCode;

  return {
    async getActiveBinding(accountId) {
      return readLocalActiveBinding(storage, accountId);
    },

    async createHousehold(accountId) {
      const store = readStore(storage);

      if (findActiveBinding(store, accountId) !== null) {
        throw new PairBindingError("account_already_bound");
      }

      const nowIso = now().toISOString();
      const household: PinganpiHousehold = {
        householdId: `household-${accountId}`,
        status: "active",
        createdByAccountId: accountId,
        createdAtIso: nowIso,
        updatedAtIso: nowIso
      };
      const member: PinganpiMember = {
        memberId: `member-${accountId}`,
        householdId: household.householdId,
        accountId,
        role: "first",
        joinedAtIso: nowIso,
        status: "active"
      };

      store.households.push(household);
      store.members.push(member);
      writeStore(storage, store);

      return createBinding(store, household, member);
    },

    async createInvite(accountId) {
      const store = readStore(storage);
      const binding = findActiveBinding(store, accountId);

      if (binding === null) {
        throw new PairBindingError("account_not_bound");
      }

      const nowDate = now();
      const code = codeGenerator();
      const invite: PinganpiInvite = {
        inviteId: `invite-${binding.household.householdId}-${nowDate.getTime()}-${code}`,
        householdId: binding.household.householdId,
        createdByAccountId: accountId,
        codeHash: hashInviteCode(code),
        expiresAtIso: new Date(nowDate.getTime() + inviteTtlMs).toISOString(),
        usedAtIso: null,
        usedByAccountId: null,
        status: "active"
      };

      store.invites.push(invite);
      writeStore(storage, store);

      return {
        invite,
        code
      };
    },

    async joinByInvite(accountId, code) {
      const store = readStore(storage);
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
        writeStore(storage, store);
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
        memberId: `member-${accountId}`,
        householdId: household.householdId,
        accountId,
        role: "second",
        joinedAtIso: nowIso,
        status: "active"
      };

      invite.status = "used";
      invite.usedAtIso = nowIso;
      invite.usedByAccountId = accountId;
      household.updatedAtIso = nowIso;
      store.members.push(member);
      writeStore(storage, store);

      return createBinding(store, household, member);
    }
  };
}

export function readLocalActiveBinding(storage: KeyValueStorage, accountId: string): PinganpiBinding | null {
  return findActiveBinding(readStore(storage), accountId);
}

function findActiveBinding(store: LocalPairStore, accountId: string): PinganpiBinding | null {
  const member = store.members.find((candidate) => candidate.accountId === accountId && candidate.status === "active");

  if (member === undefined) {
    return null;
  }

  const household = store.households.find(
    (candidate) => candidate.householdId === member.householdId && candidate.status === "active"
  );

  return household === undefined ? null : createBinding(store, household, member);
}

function createBinding(store: LocalPairStore, household: PinganpiHousehold, member: PinganpiMember): PinganpiBinding {
  return {
    household,
    member,
    activeMemberCount: countActiveMembers(store, household.householdId)
  };
}

function countActiveMembers(store: LocalPairStore, householdId: string): number {
  return store.members.filter((member) => member.householdId === householdId && member.status === "active").length;
}

function readStore(storage: KeyValueStorage): LocalPairStore {
  const raw = storage.getItem(LOCAL_PAIR_STORE_KEY);

  if (raw === null) {
    return createEmptyStore();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalPairStore>;

    return {
      households: Array.isArray(parsed.households) ? parsed.households : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : []
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(storage: KeyValueStorage, store: LocalPairStore): void {
  storage.setItem(LOCAL_PAIR_STORE_KEY, JSON.stringify(store));
}

function createEmptyStore(): LocalPairStore {
  return {
    households: [],
    members: [],
    invites: []
  };
}

function hashInviteCode(code: string): string {
  return `local-code:${code}`;
}

function createInviteCode(): string {
  const value = Math.floor(100000 + Math.random() * 900000);

  return String(value);
}

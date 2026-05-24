import type { KeyValueStorage } from "../app-state-storage.js";
import {
  AccountAuthError,
  isValidMainlandPhoneNumber,
  normalizePhoneNumber,
  type AccountAuthAdapter,
  type PinganpiAccount,
  type PinganpiSession
} from "./account-model.js";

const LOCAL_ACCOUNTS_KEY = "pinganpi.accounts.v1";
const LOCAL_SESSION_KEY = "pinganpi.account-session.v1";
const LOCAL_SMS_CODES_KEY = "pinganpi.account-sms-codes.v1";
const DEV_SMS_CODE = "196060";

export interface LocalAccountAdapterOptions {
  now?: () => Date;
}

export function createLocalAccountAdapter(
  storage: KeyValueStorage,
  options: LocalAccountAdapterOptions = {}
): AccountAuthAdapter {
  const now = options.now ?? (() => new Date());

  return {
    async restoreSession() {
      return readLocalAccountSession(storage);
    },

    async requestSmsCode(phoneNumber) {
      const normalizedPhoneNumber = assertValidPhoneNumber(phoneNumber);
      const codes = readCodeStore(storage);
      codes[normalizedPhoneNumber] = DEV_SMS_CODE;
      writeJson(storage, LOCAL_SMS_CODES_KEY, codes);

      return {
        phoneNumber: normalizedPhoneNumber,
        devCode: DEV_SMS_CODE
      };
    },

    async loginWithSmsCode(phoneNumber, code) {
      const normalizedPhoneNumber = assertValidPhoneNumber(phoneNumber);
      const codes = readCodeStore(storage);
      const expectedCode = codes[normalizedPhoneNumber];

      if (expectedCode === undefined) {
        throw new AccountAuthError("sms_code_not_requested");
      }

      if (code.trim() !== expectedCode) {
        throw new AccountAuthError("invalid_sms_code");
      }

      const accounts = readAccountStore(storage);
      const existing = accounts[normalizedPhoneNumber];
      const nowIso = now().toISOString();
      const account: PinganpiAccount = existing ?? createLocalAccount(normalizedPhoneNumber, nowIso);
      const nextAccount = {
        ...account,
        lastLoginAtIso: nowIso
      };
      const session: PinganpiSession = {
        account: nextAccount,
        authenticatedAtIso: nowIso
      };

      accounts[normalizedPhoneNumber] = nextAccount;
      writeJson(storage, LOCAL_ACCOUNTS_KEY, accounts);
      writeJson(storage, LOCAL_SESSION_KEY, session);

      return session;
    },

    async logout() {
      storage.removeItem(LOCAL_SESSION_KEY);
    }
  };
}

export function readLocalAccountSession(storage: KeyValueStorage): PinganpiSession | null {
  const session = readJson<PinganpiSession>(storage, LOCAL_SESSION_KEY);

  if (session === null || !isSession(session)) {
    return null;
  }

  return session;
}

function createLocalAccount(phoneNumber: string, nowIso: string): PinganpiAccount {
  return {
    accountId: `account-${phoneNumber}`,
    authUid: `local-auth-${phoneNumber}`,
    phoneNumber,
    status: "active",
    createdAtIso: nowIso,
    lastLoginAtIso: nowIso
  };
}

function assertValidPhoneNumber(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);

  if (!isValidMainlandPhoneNumber(normalized)) {
    throw new AccountAuthError("invalid_phone_number");
  }

  return normalized;
}

function readAccountStore(storage: KeyValueStorage): Record<string, PinganpiAccount> {
  const parsed = readJson<Record<string, PinganpiAccount>>(storage, LOCAL_ACCOUNTS_KEY);

  return parsed === null || typeof parsed !== "object" ? {} : parsed;
}

function readCodeStore(storage: KeyValueStorage): Record<string, string> {
  const parsed = readJson<Record<string, string>>(storage, LOCAL_SMS_CODES_KEY);

  return parsed === null || typeof parsed !== "object" ? {} : parsed;
}

function readJson<T>(storage: KeyValueStorage, key: string): T | null {
  const raw = storage.getItem(key);

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(storage: KeyValueStorage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

function isSession(value: unknown): value is PinganpiSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "account" in value &&
    typeof (value as PinganpiSession).account.accountId === "string" &&
    typeof (value as PinganpiSession).account.phoneNumber === "string"
  );
}

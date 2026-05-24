import cloudbase from "@cloudbase/node-sdk";
import { isValidMainlandPhoneNumber, type PinganpiAccount } from "../../src/app/account/account-model.js";
import { createAccountPairService, type AccountPairServiceOptions } from "../account-pair/account-pair-service.js";
import {
  createCloudBaseAccountPairStore,
  type AccountPairRepository
} from "../account-pair/cloudbase-store.js";
import {
  MiniProgramAuthError,
  createWechatPhoneNumberResolver,
  readNonEmptyString,
  readTrustedMiniProgramIdentity,
  type TrustedMiniProgramIdentity,
  type WechatPhoneNumberResolver
} from "./miniprogram-auth.js";
import {
  isRecord,
  miniFail,
  miniOk,
  readMiniAction,
  type PinganpiMiniFunctionEvent,
  type PinganpiMiniFunctionResult
} from "./result.js";

export type { AccountPairRepository } from "../account-pair/cloudbase-store.js";

export interface MiniProgramAccountFunctionOptions extends AccountPairServiceOptions {
  trustedIdentity?: TrustedMiniProgramIdentity;
  phoneNumberResolver?: WechatPhoneNumberResolver;
  allowDevPhoneLogin?: boolean;
}

export async function main(
  event: PinganpiMiniFunctionEvent = {},
  context?: unknown
): Promise<PinganpiMiniFunctionResult> {
  return handlePinganpiAccountEvent(createRuntimeRepository(), event, {}, context);
}

export async function handlePinganpiAccountEvent(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent = {},
  options: MiniProgramAccountFunctionOptions = {},
  context?: unknown
): Promise<PinganpiMiniFunctionResult> {
  const action = readMiniAction(event);

  if (action === "health") {
    return miniOk(action, { ok: true });
  }

  if (action === "loginByWechatPhone") {
    const phoneCode = readPhoneCodePayload(event.payload);

    if (phoneCode === null) {
      return miniFail(action, "bad_request", "Invalid account function payload.", 400);
    }

    return runAccountMutation(repository, event, action, options, context, async (store, service, identity) => {
      const resolver = options.phoneNumberResolver ?? createWechatPhoneNumberResolver();
      const phoneNumber = await resolver.resolve(phoneCode, identity);
      const account = await service.ensureAccount({ authUid: identity.authUid, phoneNumber });
      const binding = await service.getActiveBinding(account.accountId);

      return { account, binding };
    });
  }

  if (action === "loginByDevPhone") {
    if (!isDevPhoneLoginEnabled(options)) {
      return miniFail(action, "dev_login_disabled", "Development phone login is disabled.", 403);
    }

    const phoneNumber = readPhoneNumberPayload(event.payload);

    if (phoneNumber === null) {
      return miniFail(action, "bad_request", "Invalid account function payload.", 400);
    }

    if (!isValidMainlandPhoneNumber(phoneNumber)) {
      return miniFail(action, "invalid_phone_number", "Invalid phone number.", 400);
    }

    return runAccountMutation(repository, event, action, options, context, async (store, service, identity) => {
      const account = await service.ensureAccount({ authUid: identity.authUid, phoneNumber });
      const binding = await service.getActiveBinding(account.accountId);

      return { account, binding };
    });
  }

  if (action === "getCurrentAccount" || action === "getActiveBinding") {
    const identity = readIdentity(event, options, context);

    if (identity === null) {
      return miniFail(action, "unauthorized", "Mini program trusted identity is unavailable.", 401);
    }

    const store = await repository.loadStore();
    const service = createAccountPairService(store, options);
    const account = findAccountByAuthUid(store.accounts, identity.authUid);
    const binding = account === null ? null : await service.getActiveBinding(account.accountId);

    return miniOk(action, { account, binding });
  }

  return miniFail(action, "not_found", "Unknown account function action.", 404);
}

async function runAccountMutation<TData>(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent,
  action: string,
  options: MiniProgramAccountFunctionOptions,
  context: unknown,
  mutate: (
    store: Awaited<ReturnType<AccountPairRepository["loadStore"]>>,
    service: ReturnType<typeof createAccountPairService>,
    identity: TrustedMiniProgramIdentity
  ) => Promise<TData>
): Promise<PinganpiMiniFunctionResult<TData>> {
  const identity = readIdentity(event, options, context);

  if (identity === null) {
    return miniFail(action, "unauthorized", "Mini program trusted identity is unavailable.", 401);
  }

  const store = await repository.loadStore();
  const service = createAccountPairService(store, options);

  try {
    const data = await mutate(store, service, identity);
    await repository.saveStore(store);

    return miniOk(action, data);
  } catch (error) {
    if (error instanceof MiniProgramAuthError && error.code === "phone_number_unavailable") {
      return miniFail(action, "phone_number_unavailable", "Wechat phone number is unavailable.", 502);
    }

    throw error;
  }
}

function createRuntimeRepository(): AccountPairRepository {
  const app = cloudbase.init(
    process.env.CLOUDBASE_ENV_ID === undefined || process.env.CLOUDBASE_ENV_ID.trim().length === 0
      ? {}
      : { env: process.env.CLOUDBASE_ENV_ID.trim() }
  );

  return createCloudBaseAccountPairStore(app.database());
}

function readIdentity(
  event: PinganpiMiniFunctionEvent,
  options: MiniProgramAccountFunctionOptions,
  context?: unknown
): TrustedMiniProgramIdentity | null {
  return options.trustedIdentity ?? readTrustedMiniProgramIdentity(event, context);
}

function findAccountByAuthUid(accounts: PinganpiAccount[], authUid: string): PinganpiAccount | null {
  return accounts.find((account) => account.authUid === authUid && account.status === "active") ?? null;
}

function isDevPhoneLoginEnabled(options: MiniProgramAccountFunctionOptions): boolean {
  return (
    options.allowDevPhoneLogin === true ||
    process.env.PINGANPI_MINIPROGRAM_ALLOW_DEV_PHONE_LOGIN?.trim().toLowerCase() === "true"
  );
}

function readPhoneCodePayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readNonEmptyString(payload.phoneCode);
}

function readPhoneNumberPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readNonEmptyString(payload.phoneNumber);
}

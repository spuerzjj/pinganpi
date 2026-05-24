import cloudbase from "@cloudbase/node-sdk";
import {
  PairBindingError,
  type PinganpiAccount,
  type PinganpiInvite
} from "../../apps/legacy-capacitor/src/app/account/account-model.js";
import { createAccountPairService, type AccountPairServiceOptions } from "../account-pair/account-pair-service.js";
import {
  createCloudBaseAccountPairStore,
  type AccountPairRepository
} from "../account-pair/cloudbase-store.js";
import {
  readNonEmptyString,
  readTrustedMiniProgramIdentity,
  type TrustedMiniProgramIdentity
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

export interface MiniProgramPairFunctionOptions extends AccountPairServiceOptions {
  trustedIdentity?: TrustedMiniProgramIdentity;
}

export async function main(
  event: PinganpiMiniFunctionEvent = {},
  context?: unknown
): Promise<PinganpiMiniFunctionResult> {
  return handlePinganpiPairEvent(createRuntimeRepository(), event, {}, context);
}

export async function handlePinganpiPairEvent(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent = {},
  options: MiniProgramPairFunctionOptions = {},
  context?: unknown
): Promise<PinganpiMiniFunctionResult> {
  const action = readMiniAction(event);

  if (action === "health") {
    return miniOk(action, { ok: true });
  }

  if (action === "getActiveBinding") {
    return runCurrentAccountRead(repository, event, action, options, context, async (service, account) => ({
      account,
      binding: await service.getActiveBinding(account.accountId)
    }));
  }

  if (action === "createHousehold") {
    return runPairMutation(repository, event, action, options, context, async (service, account) => ({
      account,
      binding: await service.createHousehold(account.accountId)
    }));
  }

  if (action === "createInvite") {
    return runPairMutation(repository, event, action, options, context, async (service, account) => {
      const issue = await service.createInvite(account.accountId);

      return {
        account,
        invite: toClientInvite(issue.invite),
        code: issue.code
      };
    });
  }

  if (action === "joinByInvite") {
    const code = readInviteCodePayload(event.payload);

    if (code === null) {
      return miniFail(action, "bad_request", "Invalid pair function payload.", 400);
    }

    return runPairMutation(repository, event, action, options, context, async (service, account) => ({
      account,
      binding: await service.joinByInvite(account.accountId, code)
    }));
  }

  return miniFail(action, "not_found", "Unknown pair function action.", 404);
}

function toClientInvite(invite: PinganpiInvite): Omit<PinganpiInvite, "codeHash"> {
  const { codeHash: _codeHash, ...clientInvite } = invite;

  return clientInvite;
}

async function runCurrentAccountRead<TData>(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent,
  action: string,
  options: MiniProgramPairFunctionOptions,
  context: unknown,
  read: (service: ReturnType<typeof createAccountPairService>, account: PinganpiAccount) => Promise<TData>
): Promise<PinganpiMiniFunctionResult<TData>> {
  const resolved = await resolveCurrentAccount(repository, event, action, options, context);

  if ("failure" in resolved) {
    return resolved.failure;
  }

  return miniOk(action, await read(resolved.service, resolved.account));
}

async function runPairMutation<TData>(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent,
  action: string,
  options: MiniProgramPairFunctionOptions,
  context: unknown,
  mutate: (service: ReturnType<typeof createAccountPairService>, account: PinganpiAccount) => Promise<TData>
): Promise<PinganpiMiniFunctionResult<TData>> {
  const resolved = await resolveCurrentAccount(repository, event, action, options, context);

  if ("failure" in resolved) {
    return resolved.failure;
  }

  try {
    const data = await mutate(resolved.service, resolved.account);
    await repository.saveStore(resolved.store);

    return miniOk(action, data);
  } catch (error) {
    if (error instanceof PairBindingError) {
      if (error.code === "invite_expired") {
        await repository.saveStore(resolved.store);
      }

      return pairBindingFail(action, error);
    }

    throw error;
  }
}

async function resolveCurrentAccount(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent,
  action: string,
  options: MiniProgramPairFunctionOptions,
  context?: unknown
): Promise<
  | {
      store: Awaited<ReturnType<AccountPairRepository["loadStore"]>>;
      service: ReturnType<typeof createAccountPairService>;
      account: PinganpiAccount;
    }
  | { failure: PinganpiMiniFunctionResult<never> }
> {
  const identity = options.trustedIdentity ?? readTrustedMiniProgramIdentity(event, context);

  if (identity === null) {
    return { failure: miniFail(action, "unauthorized", "Mini program trusted identity is unavailable.", 401) };
  }

  const store = await repository.loadStore();
  const service = createAccountPairService(store, options);
  const account = store.accounts.find(
    (candidate) => candidate.authUid === identity.authUid && candidate.status === "active"
  );

  if (account === undefined) {
    return { failure: miniFail(action, "account_not_found", "Current account is not registered.", 401) };
  }

  return { store, service, account };
}

function createRuntimeRepository(): AccountPairRepository {
  const app = cloudbase.init(
    process.env.CLOUDBASE_ENV_ID === undefined || process.env.CLOUDBASE_ENV_ID.trim().length === 0
      ? {}
      : { env: process.env.CLOUDBASE_ENV_ID.trim() }
  );

  return createCloudBaseAccountPairStore(app.database());
}

function readInviteCodePayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readNonEmptyString(payload.code);
}

function pairBindingFail(action: string, error: PairBindingError): PinganpiMiniFunctionResult<never> {
  return miniFail(action, error.code, "Pair binding request failed.", 409);
}

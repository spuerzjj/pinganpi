import cloudbase from "@cloudbase/node-sdk";
import { PairBindingError, type PinganpiInvite } from "../../src/app/account/account-model.js";
import { createAccountPairService, type AccountPairServiceOptions } from "../account-pair/account-pair-service.js";
import {
  createCloudBaseAccountPairStore,
  type AccountPairRepository
} from "../account-pair/cloudbase-store.js";
import {
  isRecord,
  miniFail,
  miniOk,
  readMiniAction,
  type PinganpiMiniFunctionEvent,
  type PinganpiMiniFunctionResult
} from "./result.js";

export type { AccountPairRepository } from "../account-pair/cloudbase-store.js";

export async function main(event: PinganpiMiniFunctionEvent = {}): Promise<PinganpiMiniFunctionResult> {
  return handlePinganpiPairEvent(createRuntimeRepository(), event);
}

export async function handlePinganpiPairEvent(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent = {},
  options: AccountPairServiceOptions = {}
): Promise<PinganpiMiniFunctionResult> {
  const action = readMiniAction(event);

  if (action === "health") {
    return miniOk(action, { ok: true });
  }

  if (action === "getActiveBinding") {
    const accountId = readAccountIdPayload(event.payload);

    if (accountId === null) {
      return miniFail(action, "bad_request", "Invalid pair function payload.", 400);
    }

    const store = await repository.loadStore();
    const service = createAccountPairService(store, options);
    const binding = await service.getActiveBinding(accountId);

    return miniOk(action, { binding });
  }

  if (action === "createHousehold") {
    return runPairMutation(repository, action, event.payload, options, async (service, accountId) => ({
      binding: await service.createHousehold(accountId)
    }));
  }

  if (action === "createInvite") {
    return runPairMutation(repository, action, event.payload, options, async (service, accountId) => {
      const issue = await service.createInvite(accountId);

      return {
        invite: toClientInvite(issue.invite),
        code: issue.code
      };
    });
  }

  if (action === "joinByInvite") {
    const input = readJoinByInvitePayload(event.payload);

    if (input === null) {
      return miniFail(action, "bad_request", "Invalid pair function payload.", 400);
    }

    const store = await repository.loadStore();
    const service = createAccountPairService(store, options);

    try {
      const binding = await service.joinByInvite(input.accountId, input.code);
      await repository.saveStore(store);

      return miniOk(action, { binding });
    } catch (error) {
      if (error instanceof PairBindingError) {
        if (error.code === "invite_expired") {
          await repository.saveStore(store);
        }

        return pairBindingFail(action, error);
      }

      throw error;
    }
  }

  return miniFail(action, "not_found", "Unknown pair function action.", 404);
}

function toClientInvite(invite: PinganpiInvite): Omit<PinganpiInvite, "codeHash"> {
  const { codeHash: _codeHash, ...clientInvite } = invite;

  return clientInvite;
}

async function runPairMutation<TData>(
  repository: AccountPairRepository,
  action: string,
  payload: unknown,
  options: AccountPairServiceOptions,
  mutate: (service: ReturnType<typeof createAccountPairService>, accountId: string) => Promise<TData>
): Promise<PinganpiMiniFunctionResult<TData>> {
  const accountId = readAccountIdPayload(payload);

  if (accountId === null) {
    return miniFail(action, "bad_request", "Invalid pair function payload.", 400);
  }

  const store = await repository.loadStore();
  const service = createAccountPairService(store, options);

  try {
    const data = await mutate(service, accountId);
    await repository.saveStore(store);

    return miniOk(action, data);
  } catch (error) {
    if (error instanceof PairBindingError) {
      return pairBindingFail(action, error);
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

function readAccountIdPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readNonEmptyString(payload.accountId);
}

function readJoinByInvitePayload(payload: unknown): { accountId: string; code: string } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const accountId = readNonEmptyString(payload.accountId);
  const code = readNonEmptyString(payload.code);

  return accountId === null || code === null ? null : { accountId, code };
}

function pairBindingFail(action: string, error: PairBindingError): PinganpiMiniFunctionResult<never> {
  return miniFail(action, error.code, "Pair binding request failed.", 409);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

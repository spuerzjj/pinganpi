import cloudbase from "@cloudbase/node-sdk";
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
  return handlePinganpiAccountEvent(createRuntimeRepository(), event);
}

export async function handlePinganpiAccountEvent(
  repository: AccountPairRepository,
  event: PinganpiMiniFunctionEvent = {},
  options: AccountPairServiceOptions = {}
): Promise<PinganpiMiniFunctionResult> {
  const action = readMiniAction(event);

  if (action === "health") {
    return miniOk(action, { ok: true });
  }

  if (action === "ensureAccount") {
    const input = readEnsureAccountPayload(event.payload);

    if (input === null) {
      return miniFail(action, "bad_request", "Invalid account function payload.", 400);
    }

    const store = await repository.loadStore();
    const service = createAccountPairService(store, options);
    const account = await service.ensureAccount(input);
    await repository.saveStore(store);

    return miniOk(action, { account });
  }

  if (action === "getActiveBinding") {
    const accountId = readAccountIdPayload(event.payload);

    if (accountId === null) {
      return miniFail(action, "bad_request", "Invalid account function payload.", 400);
    }

    const store = await repository.loadStore();
    const service = createAccountPairService(store, options);
    const binding = await service.getActiveBinding(accountId);

    return miniOk(action, { binding });
  }

  return miniFail(action, "not_found", "Unknown account function action.", 404);
}

function createRuntimeRepository(): AccountPairRepository {
  const app = cloudbase.init(
    process.env.CLOUDBASE_ENV_ID === undefined || process.env.CLOUDBASE_ENV_ID.trim().length === 0
      ? {}
      : { env: process.env.CLOUDBASE_ENV_ID.trim() }
  );

  return createCloudBaseAccountPairStore(app.database());
}

function readEnsureAccountPayload(payload: unknown): { authUid: string; phoneNumber: string } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const authUid = readNonEmptyString(payload.authUid);
  const phoneNumber = readNonEmptyString(payload.phoneNumber);

  return authUid === null || phoneNumber === null ? null : { authUid, phoneNumber };
}

function readAccountIdPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  return readNonEmptyString(payload.accountId);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

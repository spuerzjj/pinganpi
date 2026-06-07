import { callPinganpiAccount, callPinganpiPair } from "./cloud-functions.js";
import type {
  MiniProgramAccount,
  MiniProgramBinding,
  MiniProgramInvite,
  MiniProgramAccountSession
} from "./account-session.js";

export interface MiniProgramAccountBindingData {
  account: MiniProgramAccount | null;
  binding: MiniProgramBinding | null;
}

export interface MiniProgramInviteData {
  account: MiniProgramAccount;
  invite: MiniProgramInvite;
  code: string;
}

export interface MiniProgramPairMutationData {
  account: MiniProgramAccount;
  binding: MiniProgramBinding;
}

export interface MiniProgramAccountCloudService {
  loginWithWechat(): Promise<MiniProgramAccountBindingData>;
  loginWithDevPhone(phoneNumber: string): Promise<MiniProgramAccountBindingData>;
  loadCurrentAccount(): Promise<MiniProgramAccountBindingData>;
  loadActiveBinding(): Promise<MiniProgramAccountBindingData>;
  createHousehold(): Promise<MiniProgramPairMutationData>;
  createInvite(): Promise<MiniProgramInviteData>;
  joinByInvite(code: string): Promise<MiniProgramPairMutationData>;
}

export interface MiniProgramAccountCloudServiceOptions {
  callAccount?: (action: string, payload?: unknown) => Promise<unknown>;
  callPair?: (action: string, payload?: unknown) => Promise<unknown>;
}

export function createMiniProgramAccountCloudService(
  options: MiniProgramAccountCloudServiceOptions = {}
): MiniProgramAccountCloudService {
  const callAccount = options.callAccount ?? callPinganpiAccount;
  const callPair = options.callPair ?? callPinganpiPair;

  return {
    async loginWithWechat() {
      return (await callAccount("loginByWechat")) as MiniProgramAccountBindingData;
    },
    async loginWithDevPhone(phoneNumber) {
      return (await callAccount("loginByDevPhone", { phoneNumber })) as MiniProgramAccountBindingData;
    },
    async loadCurrentAccount() {
      return (await callAccount("getCurrentAccount")) as MiniProgramAccountBindingData;
    },
    async loadActiveBinding() {
      return (await callAccount("getActiveBinding")) as MiniProgramAccountBindingData;
    },
    async createHousehold() {
      return (await callPair("createHousehold")) as MiniProgramPairMutationData;
    },
    async createInvite() {
      return (await callPair("createInvite")) as MiniProgramInviteData;
    },
    async joinByInvite(code) {
      return (await callPair("joinByInvite", { code })) as MiniProgramPairMutationData;
    }
  };
}

export function createSessionFromCloudData(data: MiniProgramAccountBindingData): MiniProgramAccountSession | null {
  if (data.account === null) {
    return null;
  }

  return {
    account: data.account,
    binding: data.binding,
    authenticatedAtIso: new Date().toISOString()
  };
}

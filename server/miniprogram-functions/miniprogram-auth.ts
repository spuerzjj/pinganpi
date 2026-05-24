import cloudbase from "@cloudbase/node-sdk";
import { isRecord, type PinganpiMiniFunctionEvent } from "./result.js";

export type MiniProgramAuthErrorCode = "trusted_identity_unavailable" | "phone_number_unavailable";

export class MiniProgramAuthError extends Error {
  constructor(readonly code: MiniProgramAuthErrorCode) {
    super(code);
  }
}

export interface TrustedMiniProgramIdentity {
  authUid: string;
  openId: string;
  appId?: string;
  unionId?: string;
}

export interface WechatPhoneNumberResolver {
  resolve(phoneCode: string, identity: TrustedMiniProgramIdentity): Promise<string>;
}

interface CloudBaseContext {
  WX_APPID?: string;
  WX_OPENID?: string;
  WX_UNIONID?: string;
}

interface WechatOpenApiCaller {
  callWxOpenApi(options: { apiName: string; requestData: unknown }): Promise<unknown>;
}

export function readTrustedMiniProgramIdentity(
  _event: PinganpiMiniFunctionEvent = {},
  context?: unknown
): TrustedMiniProgramIdentity | null {
  const contextInfo = readCloudBaseContext(context);
  const openId = readNonEmptyString(contextInfo.WX_OPENID);

  if (openId === null) {
    return null;
  }

  const appId = readNonEmptyString(contextInfo.WX_APPID);
  const unionId = readNonEmptyString(contextInfo.WX_UNIONID);

  return {
    authUid: unionId === null ? `wx-openid:${appId ?? "unknown"}:${openId}` : `wx-union:${unionId}`,
    openId,
    ...(appId === null ? {} : { appId }),
    ...(unionId === null ? {} : { unionId })
  };
}

export function createWechatPhoneNumberResolver(caller = createRuntimeOpenApiCaller()): WechatPhoneNumberResolver {
  return {
    async resolve(phoneCode) {
      const code = phoneCode.trim();

      if (code.length === 0) {
        throw new MiniProgramAuthError("phone_number_unavailable");
      }

      try {
        const response = await caller.callWxOpenApi({
          apiName: "phonenumber.getPhoneNumber",
          requestData: { code }
        });
        const phoneNumber = readPhoneNumberFromOpenApiResponse(response);

        if (phoneNumber === null) {
          throw new MiniProgramAuthError("phone_number_unavailable");
        }

        return phoneNumber;
      } catch (error) {
        if (error instanceof MiniProgramAuthError) {
          throw error;
        }

        throw new MiniProgramAuthError("phone_number_unavailable");
      }
    }
  };
}

function createRuntimeOpenApiCaller(): WechatOpenApiCaller {
  const app = cloudbase.init(
    process.env.CLOUDBASE_ENV_ID === undefined || process.env.CLOUDBASE_ENV_ID.trim().length === 0
      ? {}
      : { env: process.env.CLOUDBASE_ENV_ID.trim() }
  );

  return {
    async callWxOpenApi(options) {
      return app.callWxOpenApi(options);
    }
  };
}

function readCloudBaseContext(context?: unknown): CloudBaseContext {
  try {
    return cloudbase.getCloudbaseContext(context as never) as CloudBaseContext;
  } catch {
    return {};
  }
}

function readPhoneNumberFromOpenApiResponse(response: unknown): string | null {
  const result = isRecord(response) && response.result !== undefined ? response.result : response;
  const errcode = isRecord(result) ? result.errcode : undefined;

  if (typeof errcode === "number" && errcode !== 0) {
    return null;
  }

  const phoneInfo = isRecord(result)
    ? isRecord(result.phone_info)
      ? result.phone_info
      : isRecord(result.phoneInfo)
        ? result.phoneInfo
        : result
    : {};

  return readNonEmptyString(phoneInfo.phoneNumber);
}

export function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

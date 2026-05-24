import { describe, expect, it } from "vitest";
import {
  MiniProgramAuthError,
  createWechatPhoneNumberResolver,
  readTrustedMiniProgramIdentity
} from "./miniprogram-auth.js";

describe("miniprogram trusted auth helpers", () => {
  it("derives a stable auth uid from runtime context", () => {
    expect(
      readTrustedMiniProgramIdentity({
        action: "loginByWechatPhone",
        payload: {
          authUid: "client-forged",
          phoneNumber: "13900139000"
        }
      }, createRuntimeContext({
        WX_APPID: "wx-app-a",
        WX_OPENID: "openid-a",
        WX_UNIONID: "union-a"
      }))
    ).toEqual({
      appId: "wx-app-a",
      openId: "openid-a",
      unionId: "union-a",
      authUid: "wx-union:union-a"
    });
  });

  it("falls back to app id and openid when runtime union id is absent", () => {
    expect(
      readTrustedMiniProgramIdentity({
        userInfo: {
          appId: "client-forged",
          openId: "client-forged"
        }
      }, createRuntimeContext({
        WX_APPID: "wx-app-a",
        WX_OPENID: "openid-a"
      }))
    ).toMatchObject({
      authUid: "wx-openid:wx-app-a:openid-a"
    });
  });

  it("ignores event userInfo because it is client supplied", () => {
    expect(
      readTrustedMiniProgramIdentity({
        userInfo: {
          appId: "wx-app-a",
          openId: "client-forged"
        },
        payload: { openId: "client-forged" }
      })
    ).toBeNull();
  });

  it("resolves phone number through the server-side WeChat open api response", async () => {
    const calls: unknown[] = [];
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi(options: unknown) {
        calls.push(options);

        return {
          result: {
            errcode: 0,
            phone_info: {
              phoneNumber: "13800138000"
            }
          }
        };
      }
    });

    await expect(
      resolver.resolve("phone-code-a", {
        authUid: "wx-openid:wx-app-a:openid-a",
        appId: "wx-app-a",
        openId: "openid-a"
      })
    ).resolves.toBe("13800138000");
    expect(calls).toEqual([
      {
        apiName: "phonenumber.getPhoneNumber",
        requestData: { code: "phone-code-a" }
      }
    ]);
  });

  it("throws a controlled auth error when the phone response is unusable", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 40029,
            errmsg: "invalid code"
          }
        };
      }
    });

    await expect(
      resolver.resolve("bad-code", {
        authUid: "wx-openid:wx-app-a:openid-a",
        appId: "wx-app-a",
        openId: "openid-a"
      })
    ).rejects.toEqual(new MiniProgramAuthError("phone_number_unavailable"));
  });
});

function createRuntimeContext(values: Record<string, string>) {
  const keys = ["WX_APPID", "WX_OPENID", "WX_UNIONID"];

  return {
    environment: JSON.stringify({
      WX_CONTEXT_KEYS: keys.join(","),
      ...values
    })
  };
}

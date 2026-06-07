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

  it("prefers the pure phone number over the country-code form", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 0,
            phone_info: {
              phoneNumber: "+8613800138000",
              purePhoneNumber: "13800138000",
              countryCode: "86"
            }
          }
        };
      }
    });

    await expect(resolver.resolve("phone-code-a", createResolverIdentity())).resolves.toBe("13800138000");
  });

  it("normalizes a country-code-prefixed phone number to 11 mainland digits", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 0,
            phone_info: { phoneNumber: "+86 138 0013 8000" }
          }
        };
      }
    });

    await expect(resolver.resolve("phone-code-a", createResolverIdentity())).resolves.toBe("13800138000");
  });

  it("rejects a watermark app id that does not match the trusted identity", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 0,
            phone_info: {
              phoneNumber: "13800138000",
              watermark: { appid: "wx-other-app", timestamp: 1700000000 }
            }
          }
        };
      }
    });

    await expect(resolver.resolve("phone-code-a", createResolverIdentity())).rejects.toEqual(
      new MiniProgramAuthError("phone_number_unavailable")
    );
  });

  it("accepts a watermark app id that matches the trusted identity", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 0,
            phone_info: {
              phoneNumber: "13800138000",
              watermark: { appid: "wx-app-a", timestamp: 1700000000 }
            }
          }
        };
      }
    });

    await expect(resolver.resolve("phone-code-a", createResolverIdentity())).resolves.toBe("13800138000");
  });

  it("ignores the watermark when the runtime identity carries no app id", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 0,
            phone_info: {
              phoneNumber: "13800138000",
              watermark: { appid: "wx-other-app", timestamp: 1700000000 }
            }
          }
        };
      }
    });

    await expect(
      resolver.resolve("phone-code-a", { authUid: "wx-openid:unknown:openid-a", openId: "openid-a" })
    ).resolves.toBe("13800138000");
  });

  it("rejects a phone number that is not a mainland mobile number", async () => {
    const resolver = createWechatPhoneNumberResolver({
      async callWxOpenApi() {
        return {
          result: {
            errcode: 0,
            phone_info: { purePhoneNumber: "5551234567", countryCode: "1" }
          }
        };
      }
    });

    await expect(resolver.resolve("phone-code-a", createResolverIdentity())).rejects.toEqual(
      new MiniProgramAuthError("phone_number_unavailable")
    );
  });
});

function createResolverIdentity() {
  return {
    authUid: "wx-openid:wx-app-a:openid-a",
    appId: "wx-app-a",
    openId: "openid-a"
  };
}

function createRuntimeContext(values: Record<string, string>) {
  const keys = ["WX_APPID", "WX_OPENID", "WX_UNIONID"];

  return {
    environment: JSON.stringify({
      WX_CONTEXT_KEYS: keys.join(","),
      ...values
    })
  };
}

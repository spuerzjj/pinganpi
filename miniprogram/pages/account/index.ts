import {
  createMiniProgramAccountCloudService,
  createSessionFromCloudData
} from "../../services/account-cloud.js";
import {
  clearStoredAccountSession,
  restoreStoredAccountSession,
  saveStoredAccountSession,
  type MiniProgramAccount,
  type MiniProgramBinding
} from "../../services/account-session.js";
import { PinganpiCloudFunctionError } from "../../services/cloud-functions.js";

const accountService = createMiniProgramAccountCloudService();

interface AccountPageData {
  kicker: string;
  title: string;
  body: string;
  loading: boolean;
  account: MiniProgramAccount | null;
  binding: MiniProgramBinding | null;
  devPhoneNumber: string;
  errorText: string;
  statusText: string;
}

interface AccountPageInstance {
  data: AccountPageData;
  setData(data: Partial<AccountPageData>): void;
  refreshAccount(): Promise<void>;
  loginWithWechatPhoneCode(phoneCode: string): Promise<void>;
}

Page({
  data: {
    kicker: "平安批 / 账号簿",
    title: "请先登录",
    body: "微信一键手机号为默认入口；短信验证码兜底和开发调试走同一处账号簿。",
    loading: false,
    account: null,
    binding: null,
    devPhoneNumber: "",
    errorText: "",
    statusText: "未登录"
  } satisfies AccountPageData,

  onShow(this: AccountPageInstance) {
    void this.refreshAccount();
  },

  async refreshAccount(this: AccountPageInstance) {
    const cached = restoreStoredAccountSession();

    if (cached !== null) {
      this.setData({
        account: cached.account,
        binding: cached.binding,
        statusText: createStatusText(cached.account, cached.binding)
      });
    }

    this.setData({ loading: true, errorText: "" });

    try {
      const data = await accountService.loadCurrentAccount();
      const session = createSessionFromCloudData(data);

      if (session === null) {
        clearStoredAccountSession();
        this.setData({
          account: null,
          binding: null,
          statusText: "未登录"
        });
      } else {
        saveStoredAccountSession(session);
        this.setData({
          account: session.account,
          binding: session.binding,
          statusText: createStatusText(session.account, session.binding)
        });
      }
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onGetPhoneNumber(this: AccountPageInstance, event: { detail?: { errMsg?: string; code?: string } }) {
    const code = event.detail?.code?.trim() ?? "";

    if (event.detail?.errMsg !== "getPhoneNumber:ok" || code.length === 0) {
      this.setData({ errorText: "未取得微信手机号授权，请稍后再试或使用兜底入口。" });
      showToast("未取得手机号授权");
      return;
    }

    await this.loginWithWechatPhoneCode(code);
  },

  async loginWithWechatPhoneCode(this: AccountPageInstance, phoneCode: string) {
    this.setData({ loading: true, errorText: "" });

    try {
      const data = await accountService.loginWithWechatPhoneCode(phoneCode);
      const session = createSessionFromCloudData(data);

      if (session === null) {
        throw new Error("empty_account");
      }

      saveStoredAccountSession(session);
      this.setData({
        account: session.account,
        binding: session.binding,
        statusText: createStatusText(session.account, session.binding)
      });
      routeAfterLogin(session.binding);
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
      showToast("登录未成");
    } finally {
      this.setData({ loading: false });
    }
  },

  onDevPhoneInput(this: AccountPageInstance, event: { detail?: { value?: string } }) {
    this.setData({ devPhoneNumber: event.detail?.value ?? "" });
  },

  async onDevLogin(this: AccountPageInstance) {
    const phoneNumber = this.data.devPhoneNumber.trim();

    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      this.setData({ errorText: "请填写 11 位中国大陆手机号。" });
      showToast("手机号不合规");
      return;
    }

    this.setData({ loading: true, errorText: "" });

    try {
      const data = await accountService.loginWithDevPhone(phoneNumber);
      const session = createSessionFromCloudData(data);

      if (session === null) {
        throw new Error("empty_account");
      }

      saveStoredAccountSession(session);
      this.setData({
        account: session.account,
        binding: session.binding,
        statusText: createStatusText(session.account, session.binding)
      });
      routeAfterLogin(session.binding);
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
      showToast("兜底登录未成");
    } finally {
      this.setData({ loading: false });
    }
  },

  goPair() {
    wx.redirectTo({ url: "/pages/pair/index" });
  },

  goToday() {
    wx.switchTab({ url: "/pages/today/index" });
  },

  logoutLocal(this: AccountPageInstance) {
    clearStoredAccountSession();
    this.setData({
      account: null,
      binding: null,
      statusText: "未登录",
      errorText: ""
    });
  }
});

function routeAfterLogin(binding: MiniProgramBinding | null): void {
  if (binding === null) {
    wx.redirectTo({ url: "/pages/pair/index" });
    return;
  }

  wx.switchTab({ url: "/pages/today/index" });
}

function createStatusText(account: MiniProgramAccount, binding: MiniProgramBinding | null): string {
  return binding === null
    ? `${account.phoneNumber} 已入账号簿，尚未建立关系`
    : `${account.phoneNumber} 已绑定关系`;
}

function showToast(title: string): void {
  wx.showToast({ title, icon: "none", duration: 1600 });
}

function toUserMessage(error: unknown): string {
  if (error instanceof PinganpiCloudFunctionError) {
    if (error.reason === "phone_number_unavailable") {
      return "微信手机号暂未换取成功，请确认小程序手机号能力或稍后重试。";
    }

    if (error.reason === "dev_login_disabled") {
      return "兜底登录入口未在云端开启；真机验证时请使用微信手机号按钮。";
    }

    if (error.reason === "unauthorized") {
      return "云函数没有取得微信身份，请确认小程序已关联 CloudBase 环境。";
    }
  }

  return "账号簿暂时无法登记，请稍后再试。";
}

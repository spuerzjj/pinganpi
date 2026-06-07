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
  errorText: string;
  statusText: string;
}

interface AccountPageInstance {
  data: AccountPageData;
  setData(data: Partial<AccountPageData>): void;
  refreshAccount(): Promise<void>;
  loginWithWechat(): Promise<void>;
}

Page({
  data: {
    kicker: "平安批 / 账号簿",
    title: "请先登录",
    body: "通过微信身份登录，进入你的账号簿。",
    loading: false,
    account: null,
    binding: null,
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
        statusText: createStatusText(cached.binding)
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
          statusText: createStatusText(session.binding)
        });
      }
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onWechatLogin(this: AccountPageInstance) {
    await this.loginWithWechat();
  },

  async loginWithWechat(this: AccountPageInstance) {
    this.setData({ loading: true, errorText: "" });

    try {
      const data = await accountService.loginWithWechat();
      const session = createSessionFromCloudData(data);

      if (session === null) {
        throw new Error("empty_account");
      }

      saveStoredAccountSession(session);
      this.setData({
        account: session.account,
        binding: session.binding,
        statusText: createStatusText(session.binding)
      });
      routeAfterLogin(session.binding);
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
      showToast("登录未成");
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

function createStatusText(binding: MiniProgramBinding | null): string {
  return binding === null ? "已登录，尚未建立关系" : "已登录，关系已绑定";
}

function showToast(title: string): void {
  wx.showToast({ title, icon: "none", duration: 1600 });
}

function toUserMessage(error: unknown): string {
  if (error instanceof PinganpiCloudFunctionError) {
    if (error.reason === "unauthorized") {
      return "云函数没有取得微信身份，请确认小程序已关联 CloudBase 环境。";
    }
  }

  return "账号簿暂时无法登记，请稍后再试。";
}

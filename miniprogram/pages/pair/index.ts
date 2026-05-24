import { createMiniProgramAccountCloudService } from "../../services/account-cloud.js";
import {
  restoreStoredAccountSession,
  saveStoredAccountSession,
  type MiniProgramAccount,
  type MiniProgramBinding
} from "../../services/account-session.js";
import { PinganpiCloudFunctionError } from "../../services/cloud-functions.js";

const accountService = createMiniProgramAccountCloudService();

interface PairPageData {
  kicker: string;
  title: string;
  body: string;
  loading: boolean;
  account: MiniProgramAccount | null;
  binding: MiniProgramBinding | null;
  inviteCode: string;
  joinCode: string;
  errorText: string;
  statusText: string;
}

interface PairPageInstance {
  data: PairPageData;
  setData(data: Partial<PairPageData>): void;
  refreshBinding(): Promise<void>;
  runPairAction(action: () => Promise<void>): Promise<void>;
  saveBinding(account: MiniProgramAccount, binding: MiniProgramBinding): void;
}

Page({
  data: {
    kicker: "平安批 / 关系",
    title: "创建一对关系",
    body: "一方创建邀请，另一方输入后加入。第一版只允许一对关系。",
    loading: false,
    account: null,
    binding: null,
    inviteCode: "",
    joinCode: "",
    errorText: "",
    statusText: "先登录，再建关系。"
  } satisfies PairPageData,

  onShow(this: PairPageInstance) {
    void this.refreshBinding();
  },

  async refreshBinding(this: PairPageInstance) {
    const cached = restoreStoredAccountSession();

    if (cached === null) {
      wx.redirectTo({ url: "/pages/account/index" });
      return;
    }

    this.setData({
      account: cached.account,
      binding: cached.binding,
      statusText: createStatusText(cached.binding)
    });

    this.setData({ loading: true, errorText: "" });

    try {
      const data = await accountService.loadActiveBinding();

      if (data.account === null) {
        wx.redirectTo({ url: "/pages/account/index" });
        return;
      }

      saveStoredAccountSession({
        account: data.account,
        binding: data.binding,
        authenticatedAtIso: new Date().toISOString()
      });
      this.setData({
        account: data.account,
        binding: data.binding,
        statusText: createStatusText(data.binding)
      });
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onCreateHousehold(this: PairPageInstance) {
    await this.runPairAction(async () => {
      const data = await accountService.createHousehold();

      this.saveBinding(data.account, data.binding);
      this.setData({ inviteCode: "" });
      showToast("关系已立");
    });
  },

  async onCreateInvite(this: PairPageInstance) {
    await this.runPairAction(async () => {
      const data = await accountService.createInvite();
      const currentBinding = this.data.binding ?? null;

      saveStoredAccountSession({
        account: data.account,
        binding: currentBinding,
        authenticatedAtIso: new Date().toISOString()
      });
      this.setData({
        account: data.account,
        inviteCode: data.code,
        errorText: ""
      });
      showToast("邀码已生成");
    });
  },

  onJoinCodeInput(this: PairPageInstance, event: { detail?: { value?: string } }) {
    this.setData({ joinCode: event.detail?.value ?? "" });
  },

  async onJoinByInvite(this: PairPageInstance) {
    const code = this.data.joinCode.trim();

    if (!/^\d{6}$/.test(code)) {
      this.setData({ errorText: "请填写 6 位邀请码。" });
      showToast("邀请码不合规");
      return;
    }

    await this.runPairAction(async () => {
      const data = await accountService.joinByInvite(code);

      this.saveBinding(data.account, data.binding);
      this.setData({ joinCode: "" });
      showToast("已加入关系");
    });
  },

  saveBinding(this: PairPageInstance, account: MiniProgramAccount, binding: MiniProgramBinding) {
    saveStoredAccountSession({
      account,
      binding,
      authenticatedAtIso: new Date().toISOString()
    });
    this.setData({
      account,
      binding,
      statusText: createStatusText(binding),
      errorText: ""
    });
  },

  async runPairAction(this: PairPageInstance, action: () => Promise<void>) {
    this.setData({ loading: true, errorText: "" });

    try {
      await action();
    } catch (error) {
      this.setData({ errorText: toUserMessage(error) });
      showToast("关系簿未成");
    } finally {
      this.setData({ loading: false });
    }
  },

  goToday() {
    wx.switchTab({ url: "/pages/today/index" });
  },

  goAccount() {
    wx.redirectTo({ url: "/pages/account/index" });
  }
});

function createStatusText(binding: MiniProgramBinding | null): string {
  if (binding === null) {
    return "尚未建立关系。";
  }

  return binding.activeMemberCount >= 2 ? "双方已入关系。" : "已创建关系，等待另一方输入邀请码。";
}

function showToast(title: string): void {
  wx.showToast({ title, icon: "none", duration: 1600 });
}

function toUserMessage(error: unknown): string {
  if (error instanceof PinganpiCloudFunctionError) {
    if (error.reason === "account_not_found" || error.reason === "unauthorized") {
      return "请先回账号簿登录。";
    }

    if (error.reason === "account_already_bound") {
      return "当前账号已经在一对关系里。";
    }

    if (error.reason === "cannot_join_own_invite") {
      return "不能用自己的邀请码加入。";
    }

    if (error.reason === "invite_expired") {
      return "邀请码已经过期，请重新生成。";
    }

    if (error.reason === "invite_used") {
      return "邀请码已经用过。";
    }

    if (error.reason === "household_full") {
      return "这对关系已经满员。";
    }

    if (error.reason === "invite_not_found") {
      return "没有找到这张邀请。";
    }
  }

  return "关系簿暂时无法办理，请稍后再试。";
}

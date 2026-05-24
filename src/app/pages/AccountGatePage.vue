<script setup lang="ts">
import { computed, ref } from "vue";
import { AccountAuthError, PairBindingError, type AccountAuthAdapter, type PairBindingAdapter, type PinganpiBinding, type PinganpiSession } from "../account/account-model.js";

const props = defineProps<{
  session: PinganpiSession | null;
  binding: PinganpiBinding | null;
  accountAdapter: AccountAuthAdapter;
  pairBindingAdapter: PairBindingAdapter;
  reloading: boolean;
}>();

const emit = defineEmits<{
  "session-change": [session: PinganpiSession | null];
  "binding-change": [binding: PinganpiBinding];
  notice: [text: string];
}>();

const phoneNumber = ref(props.session?.account.phoneNumber ?? "");
const smsCode = ref("");
const inviteCode = ref("");
const issuedInviteCode = ref("");
const issuedInviteExpiresAt = ref("");
const pending = ref(false);
const localBinding = ref<PinganpiBinding | null>(props.binding);
const errorText = ref("");

const hasSession = computed(() => props.session !== null);
const hasBinding = computed(() => props.binding !== null || localBinding.value !== null);
const accountId = computed(() => props.session?.account.accountId ?? null);

async function requestCode(): Promise<void> {
  await runGuarded(async () => {
    const result = await props.accountAdapter.requestSmsCode(phoneNumber.value);
    smsCode.value = result.devCode;
    emit("notice", "本地调试验证码已填入。真实短信验证码接入放在阶段 19。");
  });
}

async function login(): Promise<void> {
  await runGuarded(async () => {
    const session = await props.accountAdapter.loginWithSmsCode(phoneNumber.value, smsCode.value);
    localBinding.value = await props.pairBindingAdapter.getActiveBinding(session.account.accountId);
    emit("session-change", session);
    emit("notice", "手机号登录已建立。");
  });
}

async function logout(): Promise<void> {
  await runGuarded(async () => {
    await props.accountAdapter.logout();
    localBinding.value = null;
    issuedInviteCode.value = "";
    issuedInviteExpiresAt.value = "";
    emit("session-change", null);
  });
}

async function createPair(): Promise<void> {
  if (accountId.value === null) {
    return;
  }

  await runGuarded(async () => {
    const binding = await props.pairBindingAdapter.createHousehold(accountId.value as string);
    const invite = await props.pairBindingAdapter.createInvite(accountId.value as string);
    localBinding.value = binding;
    issuedInviteCode.value = invite.code;
    issuedInviteExpiresAt.value = invite.invite.expiresAtIso;
    emit("notice", "一对关系已立，邀请码二十四小时内有效。");
  });
}

async function joinPair(): Promise<void> {
  if (accountId.value === null) {
    return;
  }

  await runGuarded(async () => {
    const binding = await props.pairBindingAdapter.joinByInvite(accountId.value as string, inviteCode.value);
    localBinding.value = binding;
    emit("binding-change", binding);
  });
}

function enterApp(): void {
  if (localBinding.value === null) {
    return;
  }

  emit("binding-change", localBinding.value);
}

async function runGuarded(action: () => Promise<void>): Promise<void> {
  pending.value = true;
  errorText.value = "";

  try {
    await action();
  } catch (error) {
    errorText.value = createErrorText(error);
  } finally {
    pending.value = false;
  }
}

function createErrorText(error: unknown): string {
  if (error instanceof AccountAuthError) {
    const messages: Record<AccountAuthError["code"], string> = {
      invalid_phone_number: "请填写 11 位大陆手机号。",
      sms_code_not_requested: "请先取验证码。",
      invalid_sms_code: "验证码不对，请重试。",
      invalid_session: "登录态已失效，请重新登录。"
    };

    return messages[error.code];
  }

  if (error instanceof PairBindingError) {
    const messages: Record<PairBindingError["code"], string> = {
      account_already_bound: "这个手机号已经有一对关系。",
      account_not_bound: "请先创建一对关系。",
      invite_not_found: "没有找到这张邀请。",
      invite_expired: "这张邀请已经过期。",
      invite_used: "这张邀请已经用过。",
      household_full: "这对关系已经满员。",
      cannot_join_own_invite: "不能使用自己开的邀请。"
    };

    return messages[error.code];
  }

  return "此事暂未办成，请稍后再试。";
}
</script>

<template>
  <section class="mx-auto grid w-full max-w-3xl gap-4 py-6">
    <div class="archive-panel">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-[var(--app-muted)]">账号簿</p>
          <h2 class="mt-1 text-2xl font-semibold">先验明身份</h2>
        </div>
        <span class="thin-label">阶段 17 / 18</span>
      </div>

      <p class="mt-4 leading-7 text-[var(--app-muted)]">
        手机号只用于找回账号和绑定这对关系。写信、邮政记录和 AI 起稿不会写入手机号。
      </p>

      <div v-if="errorText" class="mt-4 border border-[#9b2f24] bg-[#fff4ef] px-4 py-3 text-sm text-[#7f251d]">
        {{ errorText }}
      </div>

      <div v-if="!hasSession" class="mt-6 grid gap-3">
        <label class="grid gap-2 text-sm">
          <span class="text-[var(--app-muted)]">手机号</span>
          <input v-model="phoneNumber" class="field-input" inputmode="tel" autocomplete="tel" placeholder="13800138000" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="text-[var(--app-muted)]">验证码</span>
          <input v-model="smsCode" class="field-input" inputmode="numeric" autocomplete="one-time-code" placeholder="本地调试会自动填入" />
        </label>
        <div class="flex flex-wrap gap-3">
          <var-button plain color="#253b5b" :loading="pending" @click="requestCode">取验证码</var-button>
          <var-button color="#253b5b" text-color="#f7f0df" :loading="pending" @click="login">登录</var-button>
        </div>
      </div>

      <div v-else class="mt-6 grid gap-4">
        <div class="ledger-cell">
          <dt>当前手机号</dt>
          <dd>{{ session?.account.phoneNumber }}</dd>
        </div>

        <div v-if="!hasBinding" class="grid gap-4">
          <div class="grid gap-3 border-t border-dashed border-[var(--app-rule)] pt-4">
            <h3 class="text-lg font-semibold">创建一对关系</h3>
            <p class="text-sm leading-6 text-[var(--app-muted)]">创建后会生成二十四小时有效的邀请码，另一方登录后输入即加入。</p>
            <var-button color="#253b5b" text-color="#f7f0df" :loading="pending" @click="createPair">创建关系并开邀请</var-button>
          </div>

          <div class="grid gap-3 border-t border-dashed border-[var(--app-rule)] pt-4">
            <h3 class="text-lg font-semibold">加入已有关系</h3>
            <input v-model="inviteCode" class="field-input" inputmode="numeric" placeholder="输入对方给你的邀请码" />
            <var-button plain color="#253b5b" :loading="pending" @click="joinPair">输入即加入</var-button>
          </div>
        </div>

        <div v-else class="grid gap-4">
          <div class="ledger-cell">
            <dt>关系编号</dt>
            <dd>{{ (localBinding ?? binding)?.household.householdId }}</dd>
          </div>
          <div v-if="issuedInviteCode" class="border border-[var(--app-rule)] bg-[#fbf5e8] px-4 py-4">
            <p class="text-sm text-[var(--app-muted)]">邀请码</p>
            <p class="mt-2 text-3xl font-semibold tracking-[0.2em]">{{ issuedInviteCode }}</p>
            <p class="mt-2 text-sm text-[var(--app-muted)]">有效至 {{ issuedInviteExpiresAt }}</p>
          </div>
          <var-button color="#253b5b" text-color="#f7f0df" :loading="reloading" @click="enterApp">进入平安批</var-button>
        </div>

        <var-button plain color="#9b2f24" :loading="pending" @click="logout">换一个手机号</var-button>
      </div>
    </div>
  </section>
</template>

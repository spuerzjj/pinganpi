<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from "vue";
import { resolveAccountAwareBrowserSyncConfig } from "./app/account/account-sync-config.js";
import type { PinganpiBinding, PinganpiSession } from "./app/account/account-model.js";
import { createLocalAccountAdapter, readLocalAccountSession } from "./app/account/local-account-adapter.js";
import { createLocalPairBindingAdapter, readLocalActiveBinding } from "./app/account/local-pair-binding-adapter.js";
import { cloneAppState, settleAppState, type AppState, type DraftPaper } from "./app/app-state.js";
import { createBrowserAppStateStore, createMemoryKeyValueStorage, type KeyValueStorage } from "./app/app-state-storage.js";
import { buildAppModel } from "./app/app-model.js";
import { deleteDraftPaper, postDraftPaper, saveDraftPaper, type SaveDraftPaperInput } from "./app/draft-paper-service.js";
import { openLetter } from "./app/mailbox-service.js";
import AccountGatePage from "./app/pages/AccountGatePage.vue";
import MailboxArchivePage from "./app/pages/MailboxArchivePage.vue";
import ScribesPage from "./app/pages/ScribesPage.vue";
import TodayPage from "./app/pages/TodayPage.vue";
import WalletPage from "./app/pages/WalletPage.vue";
import WriteLetterPage from "./app/pages/WriteLetterPage.vue";
import { readSyncMemberToken, readSyncProxyUrl } from "./app/runtime-config.js";
import { createRemoteSyncAdapter } from "./app/sync/remote-adapter-factory.js";
import { createLocalSyncStateStore } from "./app/sync/sync-state-storage.js";
import {
  prepareOnlineMutation,
  pushLocalChanges,
  syncNow as runSyncNow,
  type SyncRuntimeResult
} from "./app/sync/sync-runtime.js";
import { postLetter, type WriteLetterInput } from "./app/write-letter-service.js";

type NavKey = "today" | "write" | "scribes" | "wallet" | "mailbox";

interface NavItem {
  key: NavKey;
  label: string;
  mark: string;
  component: Component;
}

interface WriteLetterSubmitPayload {
  draftId?: string;
  input: WriteLetterInput;
}

const browserStorage: KeyValueStorage = typeof window === "undefined" ? createMemoryKeyValueStorage() : window.localStorage;
const browserLocation = typeof window === "undefined" ? "" : window.location;
const accountAdapter = createLocalAccountAdapter(browserStorage);
const pairBindingAdapter = createLocalPairBindingAdapter(browserStorage);
const initialAccountSession = readLocalAccountSession(browserStorage);
const initialAccountBinding =
  initialAccountSession === null ? null : readLocalActiveBinding(browserStorage, initialAccountSession.account.accountId);
const accountSession = ref<PinganpiSession | null>(initialAccountSession);
const accountBinding = ref<PinganpiBinding | null>(initialAccountBinding);
const reloadingAfterBinding = ref(false);
const shouldShowAccountGate = computed(
  () => accountSession.value === null || accountBinding.value === null || reloadingAfterBinding.value
);
const accountPhoneText = computed(() => accountSession.value?.account.phoneNumber ?? "未登录");
const syncConfig = resolveAccountAwareBrowserSyncConfig(browserLocation, browserStorage, accountBinding.value);
const remoteAdapter = createRemoteSyncAdapter({
  storage: browserStorage,
  syncProxyUrl: readSyncProxyUrl(),
  syncMemberToken: readSyncMemberToken()
});
const appStateStore = createBrowserAppStateStore(syncConfig.appStateStorageKey);
const syncStateStore = createLocalSyncStateStore(
  browserStorage,
  {
    householdId: syncConfig.householdId,
    deviceId: syncConfig.deviceId,
    memberId: syncConfig.memberId
  },
  syncConfig.syncStateStorageKey
);
const memberAlignment = alignAppStateWithSyncMember(appStateStore.load(), syncConfig.memberId);
const settlement = settleAppState(memberAlignment.state, new Date());
const appState = ref(settlement.state);
const syncState = ref(syncStateStore.load());
const model = computed(() => buildAppModel(new Date(), appState.value));
const noticeText = ref("");
const editingDraftId = ref<string | null>(null);
const composeResetKey = ref(0);
const composeSaveKey = ref(0);
let appStateRevision = 0;
let syncQueue: Promise<void> = Promise.resolve();
const staleLocalChangeText = "本地信纸已有新变化，请再试一次。";
const syncStatusText = computed(() => {
  switch (syncState.value.status) {
    case "syncing":
      return "同步中";
    case "synced":
      return "已同步";
    case "failed":
      return "同步失败";
    case "offline":
      return "离线";
    case "not_configured":
      return "未配置";
    case "idle":
    default:
      return "未同步";
  }
});
const canRetrySync = computed(() => syncState.value.status === "failed" || syncState.value.status === "offline");
const editingDraft = computed<DraftPaper | null>(() => {
  if (editingDraftId.value === null) {
    return null;
  }

  return appState.value.draftPapers.find((draft) => draft.id === editingDraftId.value) ?? null;
});

if (memberAlignment.changed || settlement.changed) {
  appStateStore.save(settlement.state);
}

const activeKey = ref<NavKey>("today");
const navItems: NavItem[] = [
  { key: "today", label: "今日", mark: "日", component: TodayPage },
  { key: "write", label: "写信", mark: "笔", component: WriteLetterPage },
  { key: "scribes", label: "先生", mark: "先", component: ScribesPage },
  { key: "wallet", label: "钱匣", mark: "钱", component: WalletPage },
  { key: "mailbox", label: "信箱", mark: "信", component: MailboxArchivePage }
];

const activePage = computed(() => {
  const found = navItems.find((item) => item.key === activeKey.value);

  if (found === undefined) {
    throw new Error(`Unknown nav key: ${activeKey.value}`);
  }

  return found;
});

function persistState(nextState: typeof appState.value): void {
  appStateRevision += 1;
  appState.value = nextState;
  appStateStore.save(nextState);
}

function persistSyncState(nextState: typeof syncState.value): void {
  syncState.value = nextState;
  syncStateStore.save(nextState);
}

function settleAndPersist(now = new Date()): void {
  const result = settleAppState(appState.value, now);

  if (!result.changed) {
    return;
  }

  persistState(result.state);
  void pushCurrentState();
}

function handleNavClick(key: NavKey): void {
  activeKey.value = key;

  if (key === "mailbox") {
    settleAndPersist();
    void syncNowAndPersist();
  }
}

function handleAccountSessionChange(nextSession: PinganpiSession | null): void {
  accountSession.value = nextSession;
  accountBinding.value =
    nextSession === null ? null : readLocalActiveBinding(browserStorage, nextSession.account.accountId);
}

function handleAccountBindingChange(nextBinding: PinganpiBinding): void {
  accountBinding.value = nextBinding;
  reloadingAfterBinding.value = true;
  noticeText.value = "关系已绑定，正在重开账簿。";

  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      window.location.reload();
    }, 0);
  }
}

function handleAccountNotice(text: string): void {
  noticeText.value = text;
}

function handleEditDraft(draftId: string): void {
  if (!appState.value.draftPapers.some((draft) => draft.id === draftId)) {
    noticeText.value = "没有找到这张草稿。";
    return;
  }

  editingDraftId.value = draftId;
  activeKey.value = "write";
  noticeText.value = "草稿已取出，可继续校改。";
}

function handleDeleteDraft(draftId: string): void {
  const result = deleteDraftPaper(appState.value, draftId);

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);

  if (editingDraftId.value === draftId) {
    editingDraftId.value = null;
  }

  noticeText.value = "草稿已从信纸匣移出。";
  void pushCurrentState();
}

function handleSaveDraft(payload: WriteLetterSubmitPayload): void {
  const input = buildSaveDraftInput(payload);
  const result = saveDraftPaper(appState.value, input, new Date());

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  editingDraftId.value = result.draftId;
  composeSaveKey.value += 1;
  noticeText.value = result.created ? "草稿已存入信纸匣。" : "草稿已重新存妥。";
  void pushCurrentState();
}

async function handlePostLetter(payload: WriteLetterSubmitPayload): Promise<void> {
  const input = buildSaveDraftInput(payload);
  const prepared = await prepareMutationOrNotice();

  if (!prepared.ok) {
    return;
  }

  const result =
    input.draftId === undefined
      ? postLetter(prepared.state, input, new Date())
      : postDraftPaper(prepared.state, input.draftId, input, new Date());

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  editingDraftId.value = null;
  composeResetKey.value += 1;
  noticeText.value = "信已封缄投寄，邮政存根已入档。";
  const pushed = await pushCurrentState();

  if (!pushed.ok) {
    noticeText.value = "信已封缄投寄，但同步未送达，稍后请重试。";
  }
}

async function handleOpenLetter(letterId: string): Promise<void> {
  const prepared = await prepareMutationOrNotice();

  if (!prepared.ok) {
    return;
  }

  const result = openLetter(prepared.state, letterId, new Date());

  if (!result.ok) {
    persistState(result.state);
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  noticeText.value = "信已拆阅，归入旧信匣。";
  const pushed = await pushCurrentState();

  if (!pushed.ok) {
    noticeText.value = "信已拆阅，但同步未送达，稍后请重试。";
  }
}

function buildSaveDraftInput(payload: WriteLetterSubmitPayload): SaveDraftPaperInput {
  if (payload.draftId === undefined) {
    return payload.input;
  }

  return {
    ...payload.input,
    draftId: payload.draftId
  };
}

async function prepareMutationOrNotice(): Promise<SyncRuntimeResult> {
  return enqueueSyncOperation(async () => {
    const startedRevision = appStateRevision;
    markSyncing();
    const result = await prepareOnlineMutation({
      state: appState.value,
      syncState: syncState.value,
      adapter: remoteAdapter
    });

    persistSyncState(result.syncState);

    if (!result.ok) {
      noticeText.value = result.syncState.lastError ?? "同步未完成，请稍后重试。";
      return result;
    }

    if (appStateRevision !== startedRevision) {
      const staleResult = createStaleLocalChangeResult(result.syncState);
      persistSyncState(staleResult.syncState);
      noticeText.value = staleLocalChangeText;
      return staleResult;
    }

    persistState(result.state);
    return result;
  });
}

async function syncNowAndPersist(): Promise<SyncRuntimeResult> {
  return enqueueSyncOperation(async () => {
    const startedRevision = appStateRevision;
    markSyncing();
    const result = await runSyncNow({
      state: appState.value,
      syncState: syncState.value,
      adapter: remoteAdapter
    });

    persistSyncResult(result, startedRevision);
    return result;
  });
}

async function pushCurrentState(): Promise<SyncRuntimeResult> {
  return enqueueSyncOperation(async () => {
    const startedRevision = appStateRevision;
    markSyncing();
    const result = await pushLocalChanges({
      state: appState.value,
      syncState: syncState.value,
      adapter: remoteAdapter
    });

    persistSyncResult(result, startedRevision);
    return result;
  });
}

function persistSyncResult(result: SyncRuntimeResult, startedRevision: number): void {
  if (result.ok) {
    if (appStateRevision !== startedRevision) {
      persistSyncState({
        ...result.syncState,
        status: "idle"
      });
      return;
    }

    persistState(result.state);
  }

  persistSyncState(result.syncState);
}

function enqueueSyncOperation(operation: () => Promise<SyncRuntimeResult>): Promise<SyncRuntimeResult> {
  const queued = syncQueue.then(operation, operation);
  syncQueue = queued.then(
    () => undefined,
    () => undefined
  );

  return queued;
}

function createStaleLocalChangeResult(syncStateAfterPull: typeof syncState.value): SyncRuntimeResult {
  return {
    ok: false,
    state: appState.value,
    syncState: {
      ...syncStateAfterPull,
      status: "failed",
      lastError: staleLocalChangeText
    },
    reason: "conflict"
  };
}

function markSyncing(): void {
  persistSyncState({
    ...syncState.value,
    status: "syncing",
    lastError: null
  });
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "visible" && !shouldShowAccountGate.value) {
    settleAndPersist();
    void syncNowAndPersist();
  }
}

function alignAppStateWithSyncMember(state: AppState, memberId: string): { state: AppState; changed: boolean } {
  if (state.currentMemberId === memberId && state.wallet.ownerMemberId === memberId) {
    return { state, changed: false };
  }

  const currentMember = state.members.find((member) => member.id === memberId);
  const recipientMember = state.members.find((member) => member.id !== memberId);

  if (currentMember === undefined || recipientMember === undefined) {
    return { state, changed: false };
  }

  const nextState = cloneAppState(state);
  nextState.currentMemberId = currentMember.id;
  nextState.recipientMemberId = recipientMember.id;
  nextState.wallet.ownerMemberId = currentMember.id;
  nextState.writingRoute = {
    fromCity: currentMember.city,
    toCity: recipientMember.city,
    distanceKm: nextState.writingRoute.distanceKm
  };

  return { state: nextState, changed: true };
}

onMounted(() => {
  if (!shouldShowAccountGate.value) {
    void syncNowAndPersist();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div class="min-h-dvh px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[env(safe-area-inset-top)] text-[var(--app-ink)]">
    <AccountGatePage
      v-if="shouldShowAccountGate"
      :session="accountSession"
      :binding="accountBinding"
      :account-adapter="accountAdapter"
      :pair-binding-adapter="pairBindingAdapter"
      :reloading="reloadingAfterBinding"
      @session-change="handleAccountSessionChange"
      @binding-change="handleAccountBindingChange"
      @notice="handleAccountNotice"
    />

    <div v-else class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header class="border-b border-[var(--app-rule)] px-1 py-4 sm:px-3">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-xs text-[var(--app-muted)]">清波门邮政代办处</p>
            <h1 class="mt-1 text-3xl font-semibold leading-none">平安批</h1>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <div class="hidden text-right text-xs text-[var(--app-muted)] sm:block">
              <p>账号</p>
              <p class="mt-1 text-[var(--app-ink)]">{{ accountPhoneText }}</p>
            </div>
            <button
              v-if="canRetrySync"
              type="button"
              class="border border-[var(--app-rule)] px-3 py-1 text-xs text-[var(--app-muted)]"
              @click="syncNowAndPersist"
            >
              重试同步
            </button>
            <div class="text-right text-xs text-[var(--app-muted)]">
              <p>同步</p>
              <p class="mt-1 text-[var(--app-ink)]">{{ syncStatusText }}</p>
            </div>
            <div class="stamp">慢信</div>
          </div>
        </div>
      </header>

      <main class="flex-1 py-4">
        <div
          v-if="noticeText"
          class="mb-4 border border-[var(--app-rule)] bg-[#fbf5e8] px-4 py-3 text-sm text-[var(--app-muted)]"
          role="status"
          aria-live="polite"
        >
          {{ noticeText }}
        </div>
        <component
          :is="activePage.component"
          :model="model"
          :app-state="appState"
          :editing-draft="editingDraft"
          :compose-reset-key="composeResetKey"
          :compose-save-key="composeSaveKey"
          @edit-draft="handleEditDraft"
          @delete-draft="handleDeleteDraft"
          @save-draft="handleSaveDraft"
          @post-letter="handlePostLetter"
          @open-letter="handleOpenLetter"
        />
      </main>

      <nav class="sticky bottom-0 z-10 border border-[var(--app-rule)] bg-[rgb(247_240_223_/_0.96)] shadow-[0_-8px_24px_rgb(60_49_31_/_0.12)] backdrop-blur">
        <div class="grid grid-cols-5">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="flex min-h-16 flex-col items-center justify-center gap-1 border-r border-[var(--app-rule)] px-1 text-xs text-[var(--app-muted)] last:border-r-0"
            :class="item.key === activeKey ? 'bg-[#ead8b5] text-[var(--app-ink)]' : 'bg-transparent'"
            :aria-current="item.key === activeKey ? 'page' : undefined"
            @click="handleNavClick(item.key)"
          >
            <span class="grid size-7 place-items-center rounded-full border border-current text-sm">{{ item.mark }}</span>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.stamp {
  display: grid;
  width: 3.75rem;
  height: 3.75rem;
  place-items: center;
  border: 2px solid var(--app-red);
  border-radius: 50%;
  color: var(--app-red);
  font-size: 1rem;
  font-weight: 700;
}
</style>

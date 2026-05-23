<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { settleAppState, type DraftPaper } from "./app/app-state.js";
import { createBrowserAppStateStore } from "./app/app-state-storage.js";
import { buildAppModel } from "./app/app-model.js";
import { deleteDraftPaper, postDraftPaper, saveDraftPaper, type SaveDraftPaperInput } from "./app/draft-paper-service.js";
import { openLetter } from "./app/mailbox-service.js";
import MailboxArchivePage from "./app/pages/MailboxArchivePage.vue";
import ScribesPage from "./app/pages/ScribesPage.vue";
import TodayPage from "./app/pages/TodayPage.vue";
import WalletPage from "./app/pages/WalletPage.vue";
import WriteLetterPage from "./app/pages/WriteLetterPage.vue";
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

const appStateStore = createBrowserAppStateStore();
const settlement = settleAppState(appStateStore.load(), new Date());
const appState = ref(settlement.state);
const model = computed(() => buildAppModel(new Date(), appState.value));
const noticeText = ref("");
const editingDraftId = ref<string | null>(null);
const composeResetKey = ref(0);
const composeSaveKey = ref(0);
const editingDraft = computed<DraftPaper | null>(() => {
  if (editingDraftId.value === null) {
    return null;
  }

  return appState.value.draftPapers.find((draft) => draft.id === editingDraftId.value) ?? null;
});

if (settlement.changed) {
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
  appState.value = nextState;
  appStateStore.save(nextState);
}

function settleAndPersist(now = new Date()): void {
  const result = settleAppState(appState.value, now);

  if (!result.changed) {
    return;
  }

  persistState(result.state);
}

function handleNavClick(key: NavKey): void {
  activeKey.value = key;

  if (key === "mailbox") {
    settleAndPersist();
  }
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
}

function handlePostLetter(payload: WriteLetterSubmitPayload): void {
  const input = buildSaveDraftInput(payload);
  const result =
    input.draftId === undefined
      ? postLetter(appState.value, input, new Date())
      : postDraftPaper(appState.value, input.draftId, input, new Date());

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  editingDraftId.value = null;
  composeResetKey.value += 1;
  noticeText.value = "信已封缄投寄，邮政存根已入档。";
}

function handleOpenLetter(letterId: string): void {
  const result = openLetter(appState.value, letterId, new Date());

  if (!result.ok) {
    persistState(result.state);
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  noticeText.value = "信已拆阅，归入旧信匣。";
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
</script>

<template>
  <div class="min-h-dvh px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[env(safe-area-inset-top)] text-[var(--app-ink)]">
    <div class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header class="border-b border-[var(--app-rule)] px-1 py-4 sm:px-3">
        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-xs text-[var(--app-muted)]">清波门邮政代办处</p>
            <h1 class="mt-1 text-3xl font-semibold leading-none">平安批</h1>
          </div>
          <div class="stamp shrink-0">慢信</div>
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

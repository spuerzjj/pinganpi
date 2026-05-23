<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { settleAppState } from "./app/app-state.js";
import { createBrowserAppStateStore } from "./app/app-state-storage.js";
import { buildAppModel } from "./app/app-model.js";
import MailboxArchivePage from "./app/pages/MailboxArchivePage.vue";
import ScribesPage from "./app/pages/ScribesPage.vue";
import TodayPage from "./app/pages/TodayPage.vue";
import WalletPage from "./app/pages/WalletPage.vue";
import WriteLetterPage from "./app/pages/WriteLetterPage.vue";

type NavKey = "today" | "write" | "scribes" | "wallet" | "mailbox";

interface NavItem {
  key: NavKey;
  label: string;
  mark: string;
  component: Component;
}

const appStateStore = createBrowserAppStateStore();
const settlement = settleAppState(appStateStore.load(), new Date());
const appState = ref(settlement.state);
const model = computed(() => buildAppModel(new Date(), appState.value));

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
        <component :is="activePage.component" :model="model" />
      </main>

      <nav class="sticky bottom-0 z-10 border border-[var(--app-rule)] bg-[rgb(247_240_223_/_0.96)] shadow-[0_-8px_24px_rgb(60_49_31_/_0.12)] backdrop-blur">
        <div class="grid grid-cols-5">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="flex min-h-16 flex-col items-center justify-center gap-1 border-r border-[var(--app-rule)] px-1 text-xs text-[var(--app-muted)] last:border-r-0"
            :class="item.key === activeKey ? 'bg-[#ead8b5] text-[var(--app-ink)]' : 'bg-transparent'"
            @click="activeKey = item.key"
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

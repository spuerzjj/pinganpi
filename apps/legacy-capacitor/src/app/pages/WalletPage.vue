<script setup lang="ts">
import type { AppModel } from "../app-model.js";

defineProps<{
  model: AppModel;
}>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">钱匣</p>
      <h2 class="mt-1 text-4xl font-semibold">{{ model.wallet.balanceText }}</h2>
      <p class="mt-4 leading-7 text-[var(--app-muted)]">
        普通平信邮票需 {{ model.wallet.plainLetterCostText }}，余额{{ model.wallet.canAffordPlainLetter ? "可投寄" : "不足" }}。
      </p>
      <var-button class="mt-5" color="#253b5b" text-color="#f7f0df">查账本</var-button>
    </section>

    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">账本近记</p>
      <h2 class="mt-1 text-2xl font-semibold">收支</h2>

      <div class="mt-5 overflow-hidden border border-[var(--app-rule)]">
        <div
          v-for="entry in model.wallet.ledgerPreview"
          :key="`${entry.note}-${entry.amountText}`"
          class="grid grid-cols-[1fr_auto] border-b border-[var(--app-rule)] bg-[#fbf5e8] px-3 py-3 text-sm last:border-b-0"
        >
          <span>{{ entry.note }}</span>
          <strong>{{ entry.amountText }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

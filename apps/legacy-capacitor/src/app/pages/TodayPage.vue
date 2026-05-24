<script setup lang="ts">
import type { AppModel } from "../app-model.js";

defineProps<{
  model: AppModel;
}>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
    <section class="archive-panel">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-[var(--app-muted)]">今日</p>
          <h2 class="mt-1 text-2xl font-semibold">{{ model.today.eraDateText }}</h2>
        </div>
        <span class="thin-label">值日簿</span>
      </div>

      <dl class="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div class="ledger-cell">
          <dt>收信处</dt>
          <dd>{{ model.today.currentMember.postOffice }}</dd>
        </div>
        <div class="ledger-cell">
          <dt>寄往</dt>
          <dd>{{ model.today.recipientMember.city }} {{ model.today.recipientMember.postOffice }}</dd>
        </div>
        <div class="ledger-cell">
          <dt>今日信箱</dt>
          <dd>{{ model.today.inboxCount }} 封可拆</dd>
        </div>
        <div class="ledger-cell">
          <dt>在途底稿</dt>
          <dd>{{ model.today.inTransitCount }} 封</dd>
        </div>
      </dl>

      <details class="mt-5 border-t border-dashed border-[var(--app-rule)] pt-4 text-sm text-[var(--app-muted)]">
        <summary class="cursor-pointer">今时对应</summary>
        <p class="mt-2">{{ model.today.presentCorrespondenceText }}</p>
      </details>
    </section>

    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">今日信箱</p>
      <div v-if="model.today.nextIncomingLetter" class="mt-4">
        <p class="text-xs text-[var(--app-muted)]">{{ model.today.nextIncomingLetter.sentDateText }}</p>
        <h3 class="mt-1 text-xl font-semibold">{{ model.today.nextIncomingLetter.subject }}</h3>
        <p class="mt-3 leading-7">{{ model.today.nextIncomingLetter.excerpt }}</p>
        <div class="mt-5 flex items-center justify-between gap-3">
          <span class="thin-label">{{ model.today.nextIncomingLetter.routeText }}</span>
          <var-button size="small" color="#253b5b" text-color="#f7f0df">拆阅</var-button>
        </div>
      </div>
      <div v-else class="mt-8 text-center text-xl">今日无信</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { AppModel } from "../app-model.js";

defineProps<{
  model: AppModel;
}>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">今日信箱</p>
      <h2 class="mt-1 text-2xl font-semibold">{{ model.mailbox.waitingText }}</h2>

      <div class="mt-5 space-y-3">
        <article v-for="letter in model.mailbox.arrivedLetters" :key="letter.id" class="letter-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-[var(--app-muted)]">{{ letter.sentDateText }} · {{ letter.routeText }}</p>
              <h3 class="mt-1 text-xl font-semibold">{{ letter.subject }}</h3>
            </div>
            <span class="stamp-small">{{ letter.statusText }}</span>
          </div>
          <p class="mt-3 leading-7">{{ letter.excerpt }}</p>
          <var-button class="mt-4" size="small" color="#253b5b" text-color="#f7f0df">拆阅</var-button>
        </article>
      </div>
    </section>

    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">旧信匣</p>
      <h2 class="mt-1 text-2xl font-semibold">存根与档案</h2>

      <div class="mt-5 space-y-3">
        <article v-for="letter in model.archive.letters" :key="letter.id" class="record-card">
          <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <p class="text-xs text-[var(--app-muted)]">{{ letter.directionText }} · {{ letter.sentDateText }}</p>
              <h3 class="mt-1 text-lg font-semibold">{{ letter.subject }}</h3>
            </div>
            <div class="flex items-center gap-2 sm:justify-end">
              <span v-if="letter.important" class="thin-label">要信</span>
              <span class="thin-label">{{ letter.statusText }}</span>
            </div>
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--app-muted)]">
            <div>
              <dt>邮资</dt>
              <dd class="text-[var(--app-ink)]">{{ letter.postageText }}</dd>
            </div>
            <div>
              <dt>邮路</dt>
              <dd class="text-[var(--app-ink)]">{{ letter.deliveryWindowText }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  </div>
</template>

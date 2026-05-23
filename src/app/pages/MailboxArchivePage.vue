<script setup lang="ts">
import type { AppModel } from "../app-model.js";

defineProps<{
  model: AppModel;
}>();

const emit = defineEmits<{
  "open-letter": [letterId: string];
}>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
    <div class="space-y-4">
      <section class="archive-panel">
        <p class="text-sm text-[var(--app-muted)]">今日信箱</p>
        <h2 class="mt-1 text-2xl font-semibold">{{ model.mailbox.waitingText }}</h2>

        <div class="mt-5 space-y-3">
          <p v-if="model.mailbox.arrivedLetters.length === 0" class="record-card text-sm text-[var(--app-muted)]">今日没有可拆的信。</p>

          <article v-for="letter in model.mailbox.arrivedLetters" :key="letter.id" class="letter-card">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs text-[var(--app-muted)]">{{ letter.sentDateText }} · {{ letter.routeText }}</p>
                <h3 class="mt-1 text-xl font-semibold">{{ letter.subject }}</h3>
              </div>
              <span class="stamp-small">{{ letter.statusText }}</span>
            </div>
            <p class="mt-3 leading-7">{{ letter.excerpt }}</p>
            <p class="mt-3 text-xs text-[var(--app-muted)]">{{ letter.latestRecordText }}</p>
            <var-button
              class="mt-4"
              size="small"
              color="#253b5b"
              text-color="#f7f0df"
              :disabled="!letter.canOpen"
              @click="emit('open-letter', letter.id)"
            >
              {{ letter.actionText }}
            </var-button>
          </article>
        </div>
      </section>

      <section class="archive-panel">
        <p class="text-sm text-[var(--app-muted)]">路上信札</p>
        <h2 class="mt-1 text-2xl font-semibold">候递登记</h2>

        <div class="mt-5 space-y-3">
          <p v-if="model.mailbox.pendingIncomingLetters.length === 0" class="record-card text-sm text-[var(--app-muted)]">暂无在路上的来信。</p>

          <article v-for="letter in model.mailbox.pendingIncomingLetters" :key="letter.id" class="record-card">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs text-[var(--app-muted)]">{{ letter.sentDateText }} · {{ letter.routeText }}</p>
                <h3 class="mt-1 text-lg font-semibold">{{ letter.subject }}</h3>
              </div>
              <span class="thin-label">{{ letter.statusText }}</span>
            </div>
            <dl class="mt-3 grid gap-2 text-xs text-[var(--app-muted)] sm:grid-cols-2">
              <div>
                <dt>预计窗口</dt>
                <dd class="text-[var(--app-ink)]">{{ letter.deliveryWindowText }}</dd>
              </div>
              <div>
                <dt>拆阅状态</dt>
                <dd class="text-[var(--app-ink)]">{{ letter.availabilityText }}</dd>
              </div>
            </dl>
            <p class="mt-3 border-t border-[var(--app-rule)] pt-3 text-xs leading-5 text-[var(--app-muted)]">
              {{ letter.latestRecordText }}
            </p>
          </article>
        </div>
      </section>
    </div>

    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">旧信匣 / 邮政档案</p>
      <h2 class="mt-1 text-2xl font-semibold">存根与档案</h2>

      <div class="mt-5 space-y-3">
        <p v-if="model.archive.letters.length === 0" class="record-card text-sm text-[var(--app-muted)]">档案尚空。</p>

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
          <p class="mt-3 text-xs leading-5 text-[var(--app-muted)]">{{ letter.latestRecordText }}</p>

          <details class="mt-3 border-t border-[var(--app-rule)] pt-3 text-xs text-[var(--app-muted)]">
            <summary class="cursor-pointer text-[var(--app-ink)]">邮政记录</summary>
            <ol class="mt-3 space-y-2">
              <li v-for="(record, recordIndex) in letter.recordItems" :key="`${letter.id}-record-${recordIndex}`">
                <p class="text-[var(--app-ink)]">{{ record.atText }}</p>
                <p class="mt-1 leading-5">{{ record.text }}</p>
              </li>
            </ol>
          </details>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { AppModel } from "../app-model.js";

defineProps<{
  model: AppModel;
}>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <section class="archive-panel">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-[var(--app-muted)]">{{ model.scribeDesk.city }}代书摊</p>
          <h2 class="mt-1 text-2xl font-semibold">今日出勤</h2>
        </div>
        <span class="thin-label">{{ model.scribeDesk.preferredScribeStatus }}</span>
      </div>

      <div class="mt-5 space-y-3">
        <article v-for="scribe in model.scribeDesk.presentScribes" :key="scribe.id" class="record-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-xl font-semibold">{{ scribe.name }}</h3>
              <p class="mt-1 text-sm text-[var(--app-muted)]">{{ scribe.styleText }} · {{ scribe.specialtiesText }}</p>
            </div>
            <span class="thin-label">{{ scribe.feeText }}</span>
          </div>
        </article>
      </div>
    </section>

    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">未到</p>
      <h2 class="mt-1 text-2xl font-semibold">今日不在摊</h2>

      <div class="mt-5 space-y-3">
        <article v-for="scribe in model.scribeDesk.absentScribes" :key="scribe.id" class="record-card opacity-70">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-xl font-semibold">{{ scribe.name }}</h3>
              <p class="mt-1 text-sm text-[var(--app-muted)]">{{ scribe.styleText }} · {{ scribe.specialtiesText }}</p>
            </div>
            <span class="thin-label">{{ scribe.feeText }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { AppModel } from "../app-model.js";

defineProps<{
  model: AppModel;
}>();
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">代书摊</p>
      <h2 class="mt-1 text-2xl font-semibold">请 {{ model.writeLetter.preferredScribeName }} 代笔</h2>

      <div class="mt-5 space-y-4">
        <label class="block">
          <span class="form-label">口述</span>
          <textarea class="paper-input min-h-28" :value="model.writeLetter.sampleOralText" />
        </label>

        <label class="block">
          <span class="form-label">先生初稿</span>
          <textarea class="paper-input min-h-40" :value="model.writeLetter.sampleDraftText" />
        </label>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <var-button color="#253b5b" text-color="#f7f0df">誊清封缄</var-button>
        <var-button plain color="#253b5b">存作草稿</var-button>
      </div>
    </section>

    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">邮资估记</p>
      <h2 class="mt-1 text-2xl font-semibold">{{ model.writeLetter.fromCity }} 至 {{ model.writeLetter.toCity }}</h2>

      <div class="mt-5 grid gap-3 text-sm">
        <div class="ledger-row">
          <span>普通平信</span>
          <strong>{{ model.writeLetter.plainPostageText }}</strong>
        </div>
        <div class="ledger-row">
          <span>挂号信</span>
          <strong>{{ model.writeLetter.registeredPostageText }}</strong>
        </div>
        <div class="ledger-row">
          <span>夹寄照片</span>
          <strong>{{ model.writeLetter.photoPostageText }}</strong>
        </div>
      </div>

      <div class="mt-5 border-t border-dashed border-[var(--app-rule)] pt-4">
        <p class="text-sm text-[var(--app-muted)]">邮路</p>
        <p class="mt-2 text-xl">{{ model.writeLetter.deliveryWindowText }}</p>
        <p class="mt-1 text-sm text-[var(--app-muted)]">{{ model.writeLetter.routeClassText }}，不显示实时地图。</p>
      </div>
    </section>
  </div>
</template>

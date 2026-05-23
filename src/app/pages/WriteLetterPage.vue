<script setup lang="ts">
import { computed, ref } from "vue";
import type { AppModel } from "../app-model.js";
import type { WriteLetterInput } from "../write-letter-service.js";

const props = defineProps<{
  model: AppModel;
}>();

const emit = defineEmits<{
  "save-draft": [input: WriteLetterInput];
  "post-letter": [input: WriteLetterInput];
}>();

const handwrittenValue = "__handwritten";
const oralText = ref(props.model.writeLetter.sampleOralText);
const finalText = ref(props.model.writeLetter.sampleDraftText);
const selectedScribeId = ref(props.model.writeLetter.defaultScribeId ?? handwrittenValue);
const registered = ref(false);
const selectedScribe = computed(() =>
  props.model.writeLetter.scribeOptions.find((option) => option.id === normalizedScribeId.value)
);
const normalizedScribeId = computed(() => (selectedScribeId.value === handwrittenValue ? null : selectedScribeId.value));
const canSubmit = computed(() => oralText.value.trim().length > 0 && finalText.value.trim().length > 0);

function buildInput(): WriteLetterInput {
  return {
    oralText: oralText.value,
    scribeId: normalizedScribeId.value,
    finalText: finalText.value,
    registered: registered.value
  };
}

function saveDraft(): void {
  if (!canSubmit.value) {
    return;
  }

  emit("save-draft", buildInput());
}

function postLetter(): void {
  if (!canSubmit.value) {
    return;
  }

  emit("post-letter", buildInput());
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">代书摊</p>
      <h2 class="mt-1 text-2xl font-semibold">
        {{ selectedScribe?.id === null ? "亲笔写信" : `请 ${selectedScribe?.name ?? model.writeLetter.preferredScribeName} 代笔` }}
      </h2>

      <div class="mt-5 space-y-4">
        <label class="block">
          <span class="form-label">写法</span>
          <select v-model="selectedScribeId" class="paper-input">
            <option v-for="option in model.writeLetter.scribeOptions" :key="option.id ?? handwrittenValue" :value="option.id ?? handwrittenValue">
              {{ option.name }} · {{ option.styleText }} · {{ option.feeText }}
            </option>
          </select>
        </label>

        <label class="block">
          <span class="form-label">口述</span>
          <textarea v-model="oralText" class="paper-input min-h-28" />
        </label>

        <label class="block">
          <span class="form-label">校改正文</span>
          <textarea v-model="finalText" class="paper-input min-h-40" />
        </label>

        <label class="flex items-center gap-2 text-sm text-[var(--app-muted)]">
          <input v-model="registered" type="checkbox" class="size-4 accent-[#253b5b]" />
          <span>挂号寄出</span>
        </label>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <var-button color="#253b5b" text-color="#f7f0df" :disabled="!canSubmit" @click="postLetter">誊清封缄</var-button>
        <var-button plain color="#253b5b" :disabled="!canSubmit" @click="saveDraft">存作草稿</var-button>
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

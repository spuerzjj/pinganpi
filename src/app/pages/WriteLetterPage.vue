<script setup lang="ts">
import { computed, ref } from "vue";
import { createDefaultAppState, settleAppState } from "../app-state.js";
import type { AppModel } from "../app-model.js";
import { formatFen } from "../../domain/index.js";
import { calculateWriteLetterCost, createScribeDraft, type WriteLetterInput } from "../write-letter-service.js";
import {
  canContinueFromStep,
  canEnterStep,
  canSaveDraft,
  createInitialWriteLetterWizardState,
  getNextStepId,
  getPreviousStepId,
  getStepIndex,
  markDraftGenerated,
  markFinalTextEdited,
  markTextBasisChanged,
  writeLetterSteps,
  type WriteLetterStepId
} from "../write-letter-wizard.js";

const props = defineProps<{
  model: AppModel;
}>();

const emit = defineEmits<{
  "save-draft": [input: WriteLetterInput];
  "post-letter": [input: WriteLetterInput];
}>();

const handwrittenValue = "__handwritten";
const wizard = ref(
  createInitialWriteLetterWizardState({
    defaultScribeId: props.model.writeLetter.defaultScribeId,
    sampleOralText: props.model.writeLetter.sampleOralText,
    sampleDraftText: props.model.writeLetter.sampleDraftText
  })
);
const serviceState = computed(() => settleAppState(createDefaultAppState(), new Date()).state);
const currentStep = computed(() => writeLetterSteps.find((step) => step.id === wizard.value.currentStepId) ?? writeLetterSteps[0]);
const currentStepEyebrow = computed(() => currentStep.value?.eyebrow ?? "");
const currentStepTitle = computed(() => currentStep.value?.title ?? "");
const currentStepIndex = computed(() => getStepIndex(wizard.value.currentStepId));
const selectedScribe = computed(() => props.model.writeLetter.scribeOptions.find((option) => option.id === wizard.value.selectedScribeId));
const draftNotice = computed(() => (wizard.value.draftDirty ? "口述或写法已有改动，请重新起稿后再校改投寄。" : ""));
const canSave = computed(() => canSaveDraft(wizard.value));
const canGoNext = computed(() => canContinueFromStep(wizard.value, wizard.value.currentStepId));
const canPost = computed(() => canContinueFromStep(wizard.value, "post"));
const selectedScribeFeeText = computed(() => selectedScribe.value?.feeText ?? "免代书费");
const currentPostageText = computed(() => (wizard.value.registered ? props.model.writeLetter.registeredPostageText : props.model.writeLetter.plainPostageText));
const postingCost = computed(() =>
  calculateWriteLetterCost(serviceState.value, {
    scribeId: wizard.value.selectedScribeId,
    registered: wizard.value.registered
  })
);
const totalCostText = computed(() => formatFen(postingCost.value.totalFen));
const letterPreviewText = computed(() => wizard.value.finalText || wizard.value.scribeDraft || "尚未起稿。");

function setStep(stepId: WriteLetterStepId): void {
  if (!canEnterStep(wizard.value, stepId)) {
    return;
  }

  wizard.value = {
    ...wizard.value,
    currentStepId: stepId
  };
}

function goPrevious(): void {
  wizard.value = {
    ...wizard.value,
    currentStepId: getPreviousStepId(wizard.value.currentStepId)
  };
}

function goNext(): void {
  if (wizard.value.currentStepId === "draft") {
    generateDraft();
  }

  if (!canContinueFromStep(wizard.value, wizard.value.currentStepId)) {
    return;
  }

  wizard.value = {
    ...wizard.value,
    currentStepId: getNextStepId(wizard.value, wizard.value.currentStepId)
  };
}

function handleScribeChange(event: Event): void {
  if (!(event.target instanceof HTMLSelectElement)) {
    return;
  }

  const nextScribeId = event.target.value === handwrittenValue ? null : event.target.value;

  if (nextScribeId === wizard.value.selectedScribeId) {
    return;
  }

  wizard.value = markTextBasisChanged({
    ...wizard.value,
    selectedScribeId: nextScribeId
  });
}

function handleOralInput(event: Event): void {
  if (!(event.target instanceof HTMLTextAreaElement)) {
    return;
  }

  wizard.value = markTextBasisChanged({
    ...wizard.value,
    oralText: event.target.value
  });
}

function handleFinalInput(event: Event): void {
  if (!(event.target instanceof HTMLTextAreaElement)) {
    return;
  }

  wizard.value = markFinalTextEdited(wizard.value, event.target.value);
}

function generateDraft(): void {
  if (wizard.value.oralText.trim().length === 0) {
    return;
  }

  const draft = createScribeDraft(serviceState.value, {
    oralText: wizard.value.oralText,
    scribeId: wizard.value.selectedScribeId
  });

  wizard.value = markDraftGenerated(wizard.value, draft);
}

function buildInput(): WriteLetterInput {
  return {
    oralText: wizard.value.oralText,
    scribeId: wizard.value.selectedScribeId,
    finalText: wizard.value.finalText,
    registered: wizard.value.registered
  };
}

function saveDraft(): void {
  if (!canSave.value) {
    return;
  }

  emit("save-draft", buildInput());
}

function postLetter(): void {
  if (!canPost.value) {
    return;
  }

  emit("post-letter", buildInput());
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">代书摊</p>
      <h2 class="mt-1 text-2xl font-semibold">写一封平安批</h2>

      <div class="mt-5 grid grid-cols-5 gap-1 border border-[var(--app-rule)] bg-[#f7f0df] p-1">
        <button
          v-for="(step, index) in writeLetterSteps"
          :key="step.id"
          type="button"
          class="min-h-11 border px-1 text-xs leading-tight"
          :class="[
            step.id === wizard.currentStepId
              ? 'border-[#253b5b] bg-[#253b5b] text-[#f7f0df]'
              : canEnterStep(wizard, step.id)
                ? 'border-[var(--app-rule)] bg-[#fffaf0] text-[#253b5b]'
                : 'border-[var(--app-rule)] bg-[#eee4cb] text-[var(--app-muted)]',
            index < currentStepIndex ? 'font-semibold' : ''
          ]"
          :disabled="!canEnterStep(wizard, step.id)"
          @click="setStep(step.id)"
        >
          {{ step.label }}
        </button>
      </div>

      <div class="mt-5 border border-[var(--app-rule)] bg-[#fffaf0] p-4">
        <p class="text-sm text-[var(--app-muted)]">{{ currentStepEyebrow }}</p>
        <h3 class="mt-1 text-xl font-semibold">{{ currentStepTitle }}</h3>

        <div v-if="wizard.currentStepId === 'method'" class="mt-4 space-y-3">
          <label class="block">
            <span class="form-label">写法</span>
            <select :value="wizard.selectedScribeId ?? handwrittenValue" class="paper-input" @change="handleScribeChange">
              <option v-for="option in model.writeLetter.scribeOptions" :key="option.id ?? handwrittenValue" :value="option.id ?? handwrittenValue">
                {{ option.name }} · {{ option.styleText }} · {{ option.feeText }}
              </option>
            </select>
          </label>
          <p class="text-sm leading-7 text-[var(--app-muted)]">
            {{ selectedScribe?.id === null ? "这封信由你亲笔写成。" : `请 ${selectedScribe?.name ?? model.writeLetter.preferredScribeName} 代笔。` }}
          </p>
        </div>

        <div v-else-if="wizard.currentStepId === 'oral'" class="mt-4">
          <label class="block">
            <span class="form-label">口述</span>
            <textarea :value="wizard.oralText" class="paper-input min-h-40" @input="handleOralInput" />
          </label>
        </div>

        <div v-else-if="wizard.currentStepId === 'draft'" class="mt-4 space-y-3">
          <p v-if="draftNotice" class="border border-dashed border-[var(--app-rule)] bg-[#f7f0df] p-3 text-sm text-[var(--app-muted)]">
            {{ draftNotice }}
          </p>
          <div class="paper-input min-h-40 whitespace-pre-wrap">
            {{ wizard.scribeDraft || "点下一步前，先生会依口述起一份初稿。" }}
          </div>
          <var-button plain color="#253b5b" :disabled="wizard.oralText.trim().length === 0" @click="generateDraft">重新起稿</var-button>
        </div>

        <div v-else-if="wizard.currentStepId === 'revise'" class="mt-4">
          <label class="block">
            <span class="form-label">校改正文</span>
            <textarea :value="wizard.finalText" class="paper-input min-h-52" @input="handleFinalInput" />
          </label>
        </div>

        <div v-else class="mt-4 space-y-4">
          <label class="flex items-center gap-2 text-sm text-[var(--app-muted)]">
            <input v-model="wizard.registered" type="checkbox" class="size-4 accent-[#253b5b]" />
            <span>挂号寄出</span>
          </label>
          <div class="grid gap-3 text-sm">
            <div class="ledger-row">
              <span>代书费</span>
              <strong>{{ selectedScribeFeeText }}</strong>
            </div>
            <div class="ledger-row">
              <span>平信邮资</span>
              <strong>{{ model.writeLetter.plainPostageText }}</strong>
            </div>
            <div class="ledger-row">
              <span>挂号邮资</span>
              <strong>{{ model.writeLetter.registeredPostageText }}</strong>
            </div>
            <div class="ledger-row">
              <span>本次邮资</span>
              <strong>{{ currentPostageText }}</strong>
            </div>
            <div class="ledger-row">
              <span>钱匣余额</span>
              <strong>{{ model.wallet.balanceText }}</strong>
            </div>
            <div class="ledger-row">
              <span>本次合计</span>
              <strong>{{ totalCostText }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <var-button plain color="#253b5b" :disabled="wizard.currentStepId === 'method'" @click="goPrevious">上一步</var-button>
        <var-button plain color="#253b5b" :disabled="!canSave" @click="saveDraft">存作草稿</var-button>
        <var-button v-if="wizard.currentStepId !== 'post'" color="#253b5b" text-color="#f7f0df" :disabled="!canGoNext" @click="goNext">下一步</var-button>
        <var-button v-else color="#253b5b" text-color="#f7f0df" :disabled="!canPost" @click="postLetter">封缄投寄</var-button>
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

      <div class="mt-5 border-t border-dashed border-[var(--app-rule)] pt-4">
        <p class="text-sm text-[var(--app-muted)]">誊清预览</p>
        <p class="mt-2 whitespace-pre-wrap text-sm leading-7">
          {{ letterPreviewText }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AppModel } from "../app-model.js";
import { settleAppState, type AppState, type DraftPaper } from "../app-state.js";
import { createHttpAiScribeAdapter } from "../ai-scribe-adapter.js";
import { formatFen } from "../../domain/index.js";
import { readAiProxyUrl } from "../runtime-config.js";
import {
  calculateWriteLetterCost,
  createAiScribeDraftInput,
  createScribeDraftResult,
  type WriteLetterInput
} from "../write-letter-service.js";
import {
  canContinueFromStep,
  canEnterStep,
  canSaveDraft,
  createInitialWriteLetterWizardState,
  createWriteLetterWizardStateFromDraft,
  getDraftWizardSyncAction,
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
  appState: AppState;
  editingDraft?: DraftPaper | null;
  composeResetKey?: number;
  composeSaveKey?: number;
}>();

interface WriteLetterSubmitPayload {
  draftId?: string;
  input: WriteLetterInput;
}

const emit = defineEmits<{
  (event: "edit-draft", draftId: string): void;
  (event: "delete-draft", draftId: string): void;
  (event: "save-draft", payload: WriteLetterSubmitPayload): void;
  (event: "post-letter", payload: WriteLetterSubmitPayload): void;
}>();

const handwrittenValue = "__handwritten";
const aiScribeAdapter = createHttpAiScribeAdapter({ proxyUrl: readAiProxyUrl() });
const activeDraftId = ref<string | undefined>(props.editingDraft?.id);
const wizard = ref(createFreshWizardState());
const draftPending = ref(false);
const draftErrorText = ref("");
const serviceState = computed(() => settleAppState(props.appState, new Date()).state);
const currentStep = computed(() => writeLetterSteps.find((step) => step.id === wizard.value.currentStepId) ?? writeLetterSteps[0]);
const currentStepEyebrow = computed(() => currentStep.value?.eyebrow ?? "");
const currentStepTitle = computed(() => currentStep.value?.title ?? "");
const currentStepIndex = computed(() => getStepIndex(wizard.value.currentStepId));
const selectedScribe = computed(() => props.model.writeLetter.scribeOptions.find((option) => option.id === wizard.value.selectedScribeId));
const draftNotice = computed(() => (wizard.value.draftDirty ? "口述或写法已有改动，请重新起稿后再校改投寄。" : ""));
const canSave = computed(() => canSaveDraft(wizard.value) && !draftPending.value);
const canGoNext = computed(() => canContinueFromStep(wizard.value, wizard.value.currentStepId) && !draftPending.value);
const canPost = computed(() => canContinueFromStep(wizard.value, "post") && !draftPending.value);
const canGenerateDraft = computed(() => wizard.value.oralText.trim().length > 0 && !draftPending.value);
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

function createFreshWizardState() {
  return createInitialWriteLetterWizardState({
    defaultScribeId: props.model.writeLetter.defaultScribeId,
    sampleOralText: props.model.writeLetter.sampleOralText,
    sampleDraftText: props.model.writeLetter.sampleDraftText
  });
}

watch(
  () => ({
    draftId: props.editingDraft?.id,
    resetKey: props.composeResetKey ?? 0,
    saveKey: props.composeSaveKey ?? 0
  }),
  (snapshot, previous) => {
    const action = getDraftWizardSyncAction(previous, snapshot);

    activeDraftId.value = snapshot.draftId;

    if (action === "keep") {
      return;
    }

    if (action === "reset" || props.editingDraft === null || props.editingDraft === undefined) {
      wizard.value = createFreshWizardState();
      return;
    }

    wizard.value = createWriteLetterWizardStateFromDraft(props.editingDraft);
  },
  { immediate: true }
);

function setStep(stepId: WriteLetterStepId): void {
  if (draftPending.value) {
    return;
  }

  if (!canEnterStep(wizard.value, stepId)) {
    return;
  }

  wizard.value = {
    ...wizard.value,
    currentStepId: stepId
  };
}

function goPrevious(): void {
  if (draftPending.value) {
    return;
  }

  wizard.value = {
    ...wizard.value,
    currentStepId: getPreviousStepId(wizard.value.currentStepId)
  };
}

function goNext(): void {
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

  draftErrorText.value = "";
  wizard.value = markTextBasisChanged({
    ...wizard.value,
    selectedScribeId: nextScribeId
  });
}

function handleOralInput(event: Event): void {
  if (!(event.target instanceof HTMLTextAreaElement)) {
    return;
  }

  draftErrorText.value = "";
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

async function generateDraft(): Promise<void> {
  if (!canGenerateDraft.value) {
    return;
  }

  const requestMarker = {
    oralText: wizard.value.oralText,
    scribeId: wizard.value.selectedScribeId,
    registered: wizard.value.registered
  };

  draftPending.value = true;
  draftErrorText.value = "";
  wizard.value = markTextBasisChanged(wizard.value);

  try {
    const draft =
      requestMarker.scribeId === null
        ? createScribeDraftResult(serviceState.value, requestMarker)
        : await generateAiScribeDraft(requestMarker);

    if (wizard.value.oralText !== requestMarker.oralText || wizard.value.selectedScribeId !== requestMarker.scribeId) {
      return;
    }

    wizard.value = markDraftGenerated(wizard.value, draft);
  } catch {
    if (wizard.value.oralText === requestMarker.oralText && wizard.value.selectedScribeId === requestMarker.scribeId) {
      draftErrorText.value = "先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。";
    }
  } finally {
    draftPending.value = false;
  }
}

async function generateAiScribeDraft(input: Pick<WriteLetterInput, "oralText" | "scribeId" | "registered">) {
  const aiInput = createAiScribeDraftInput(serviceState.value, input);

  if (aiInput === null) {
    return createScribeDraftResult(serviceState.value, input);
  }

  return aiScribeAdapter.generateDraft(aiInput);
}

function buildInput(): WriteLetterInput {
  const baseInput: WriteLetterInput = {
    oralText: wizard.value.oralText,
    scribeId: wizard.value.selectedScribeId,
    finalText: wizard.value.finalText,
    registered: wizard.value.registered
  };

  if (
    !wizard.value.draftDirty &&
    wizard.value.scribeDraft.trim().length > 0 &&
    wizard.value.draftSource !== undefined &&
    wizard.value.generationMeta !== undefined
  ) {
    return {
      ...baseInput,
      scribeDraft: wizard.value.scribeDraft,
      readAloudText: wizard.value.readAloudText,
      draftSource: wizard.value.draftSource,
      generationMeta: wizard.value.generationMeta
    };
  }

  return baseInput;
}

function buildSubmitPayload(): WriteLetterSubmitPayload {
  const input = buildInput();

  if (activeDraftId.value === undefined) {
    return { input };
  }

  return {
    draftId: activeDraftId.value,
    input
  };
}

function saveDraft(): void {
  if (!canSave.value) {
    return;
  }

  emit("save-draft", buildSubmitPayload());
}

function postLetter(): void {
  if (!canPost.value) {
    return;
  }

  emit("post-letter", buildSubmitPayload());
}

function editDraft(draftId: string): void {
  emit("edit-draft", draftId);
}

function deleteDraft(draftId: string): void {
  if (!window.confirm("删去这张草稿？")) {
    return;
  }

  emit("delete-draft", draftId);
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
    <section class="archive-panel min-w-0">
      <p class="text-sm text-[var(--app-muted)]">代书摊</p>
      <h2 class="mt-1 text-2xl font-semibold">写一封平安批</h2>
      <p v-if="activeDraftId" class="mt-2 text-sm text-[var(--app-muted)]">正在续写信纸匣中的草稿。</p>

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
          <p v-if="draftErrorText" class="border border-[#9b2f24] bg-[#fff3ed] p-3 text-sm text-[#7a241b]" role="alert">
            {{ draftErrorText }}
          </p>
          <p v-if="draftPending" class="border border-dashed border-[var(--app-rule)] bg-[#f7f0df] p-3 text-sm text-[var(--app-muted)]">
            先生正在照口述斟酌字句。
          </p>
          <div class="paper-input min-h-40 whitespace-pre-wrap">
            {{ wizard.scribeDraft || "请先生依口述起一份初稿。" }}
          </div>
          <var-button plain color="#253b5b" :loading="draftPending" :disabled="!canGenerateDraft" @click="generateDraft">重新起稿</var-button>
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
        <var-button plain color="#253b5b" :disabled="wizard.currentStepId === 'method' || draftPending" @click="goPrevious">上一步</var-button>
        <var-button plain color="#253b5b" :disabled="!canSave" @click="saveDraft">存作草稿</var-button>
        <var-button v-if="wizard.currentStepId !== 'post'" color="#253b5b" text-color="#f7f0df" :disabled="!canGoNext" @click="goNext">下一步</var-button>
        <var-button v-else color="#253b5b" text-color="#f7f0df" :disabled="!canPost" @click="postLetter">封缄投寄</var-button>
      </div>
    </section>

    <section class="archive-panel min-w-0">
      <p class="text-sm text-[var(--app-muted)]">信纸匣</p>
      <h2 class="mt-1 text-2xl font-semibold">草稿</h2>

      <div class="mt-5 space-y-3">
        <p v-if="model.writeLetter.drafts.length === 0" class="record-card text-sm text-[var(--app-muted)]">暂无草稿</p>
        <article
          v-for="draft in model.writeLetter.drafts"
          :key="draft.id"
          class="record-card"
          :class="draft.id === activeDraftId ? 'border-[#253b5b]' : ''"
        >
          <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div class="min-w-0">
              <p class="text-xs text-[var(--app-muted)]">{{ draft.updatedAtText }} · 收 {{ draft.recipientName }}</p>
              <h3 class="mt-1 break-words text-lg font-semibold">{{ draft.excerpt || "未落正文" }}</h3>
            </div>
            <div class="flex flex-wrap items-center gap-2 sm:justify-end">
              <span class="thin-label">{{ draft.writingMethodText }}</span>
              <span class="thin-label">{{ draft.statusText }}</span>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <var-button size="small" plain color="#253b5b" @click="editDraft(draft.id)">续写</var-button>
            <var-button size="small" plain color="#9b2f24" @click="deleteDraft(draft.id)">删去</var-button>
          </div>
        </article>
      </div>

      <div class="mt-5 border-t border-dashed border-[var(--app-rule)] pt-4">
        <p class="text-sm text-[var(--app-muted)]">邮资估记</p>
        <h2 class="mt-1 text-2xl font-semibold">{{ model.writeLetter.fromCity }} 至 {{ model.writeLetter.toCity }}</h2>
      </div>

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

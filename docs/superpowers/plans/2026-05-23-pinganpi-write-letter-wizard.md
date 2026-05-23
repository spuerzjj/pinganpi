# Pinganpi Write Letter Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把写信页从单页表单改为 5 步可回看流程：选写法、口述、起稿、校改、投寄。

**Architecture:** 新增一个轻量 `write-letter-wizard.ts` 管理步骤、可进入条件和 dirty 状态；`WriteLetterPage.vue` 只负责展示与调用现有 `createScribeDraft`、`saveDraftPaper`、`postLetter`、`calculateWriteLetterCost`。领域规则、钱匣扣款、邮资、代笔先生出勤和信件状态流转继续留在现有服务和 `src/domain`。

**Tech Stack:** TypeScript, Vue 3 Composition API, Vite, Tailwind CSS, Varlet, Vitest.

---

## File Structure

- Create: `src/app/write-letter-wizard.ts`
  - 负责步骤定义、步骤跳转、可继续条件、草稿是否过期。
- Create: `src/app/write-letter-wizard.test.ts`
  - 覆盖步骤可用性、修改口述 / 写法后的 dirty 规则、起稿后的状态同步。
- Modify: `src/app/pages/WriteLetterPage.vue`
  - 将单页表单改为 5 步 wizard UI。
  - 继续向父组件发出现有 `save-draft` 和 `post-letter` 事件。
- Modify: `docs/pinganpi-roadmap.md`
  - 记录写信分步流程完成状态和验证结果。

---

### Task 1: Wizard Helper

**Files:**
- Create: `src/app/write-letter-wizard.ts`
- Create: `src/app/write-letter-wizard.test.ts`

- [ ] **Step 1: Write failing tests for step navigation and dirty state**

Create `src/app/write-letter-wizard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canContinueFromStep,
  canEnterStep,
  createInitialWriteLetterWizardState,
  getNextStepId,
  markDraftGenerated,
  markTextBasisChanged,
  writeLetterSteps
} from "./write-letter-wizard.js";

describe("write letter wizard", () => {
  it("defines the five archival writing steps in order", () => {
    expect(writeLetterSteps.map((step) => step.id)).toEqual(["method", "oral", "draft", "revise", "post"]);
    expect(writeLetterSteps.map((step) => step.label)).toEqual(["选写法", "口述", "起稿", "校改", "投寄"]);
  });

  it("blocks later steps until the oral text and draft are ready", () => {
    const state = createInitialWriteLetterWizardState({
      defaultScribeId: "scribe-xu",
      sampleOralText: "",
      sampleDraftText: ""
    });

    expect(canEnterStep(state, "method")).toBe(true);
    expect(canEnterStep(state, "oral")).toBe(true);
    expect(canEnterStep(state, "draft")).toBe(false);
    expect(canEnterStep(state, "revise")).toBe(false);
    expect(canEnterStep(state, "post")).toBe(false);
    expect(canContinueFromStep(state, "oral")).toBe(false);
  });

  it("allows revise and post after a fresh draft and final text exist", () => {
    const initial = createInitialWriteLetterWizardState({
      defaultScribeId: "scribe-xu",
      sampleOralText: "今日雨停，心里记挂你。",
      sampleDraftText: ""
    });
    const drafted = markDraftGenerated(initial, "兰卿：今日雨停，心里记挂你。");

    expect(drafted.draftDirty).toBe(false);
    expect(drafted.scribeDraft).toBe("兰卿：今日雨停，心里记挂你。");
    expect(drafted.finalText).toBe("兰卿：今日雨停，心里记挂你。");
    expect(canEnterStep(drafted, "revise")).toBe(true);
    expect(canEnterStep(drafted, "post")).toBe(true);
    expect(canContinueFromStep(drafted, "revise")).toBe(true);
  });

  it("requires a new draft after the oral text or writing method changes", () => {
    const drafted = markDraftGenerated(
      createInitialWriteLetterWizardState({
        defaultScribeId: "scribe-xu",
        sampleOralText: "今日雨停，心里记挂你。",
        sampleDraftText: ""
      }),
      "兰卿：今日雨停，心里记挂你。"
    );

    const changed = markTextBasisChanged({
      ...drafted,
      oralText: "今日雨停，也添了些寒意。"
    });

    expect(changed.draftDirty).toBe(true);
    expect(canEnterStep(changed, "revise")).toBe(false);
    expect(canEnterStep(changed, "post")).toBe(false);
    expect(getNextStepId(changed, "oral")).toBe("draft");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/app/write-letter-wizard.test.ts
```

Expected: FAIL because `src/app/write-letter-wizard.ts` does not exist.

- [ ] **Step 3: Implement the wizard helper**

Create `src/app/write-letter-wizard.ts`:

```ts
export type WriteLetterStepId = "method" | "oral" | "draft" | "revise" | "post";

export interface WriteLetterStep {
  id: WriteLetterStepId;
  label: string;
  title: string;
  eyebrow: string;
}

export interface WriteLetterWizardState {
  currentStepId: WriteLetterStepId;
  selectedScribeId: string | null;
  oralText: string;
  scribeDraft: string;
  finalText: string;
  registered: boolean;
  draftDirty: boolean;
  finalTextFromDraft: boolean;
}

export interface CreateInitialWriteLetterWizardStateInput {
  defaultScribeId: string | null;
  sampleOralText: string;
  sampleDraftText: string;
}

export const writeLetterSteps: WriteLetterStep[] = [
  { id: "method", label: "选写法", title: "先定写法", eyebrow: "第一步" },
  { id: "oral", label: "口述", title: "向先生口述", eyebrow: "第二步" },
  { id: "draft", label: "起稿", title: "先生起稿", eyebrow: "第三步" },
  { id: "revise", label: "校改", title: "亲手校改", eyebrow: "第四步" },
  { id: "post", label: "投寄", title: "算账封缄", eyebrow: "第五步" }
];

const stepOrder = writeLetterSteps.map((step) => step.id);

export function createInitialWriteLetterWizardState(input: CreateInitialWriteLetterWizardStateInput): WriteLetterWizardState {
  return {
    currentStepId: "method",
    selectedScribeId: input.defaultScribeId,
    oralText: input.sampleOralText,
    scribeDraft: input.sampleDraftText,
    finalText: input.sampleDraftText,
    registered: false,
    draftDirty: input.sampleOralText.trim().length > 0 && input.sampleDraftText.trim().length === 0,
    finalTextFromDraft: true
  };
}

export function canSaveDraft(state: WriteLetterWizardState): boolean {
  return state.oralText.trim().length > 0;
}

export function canEnterStep(state: WriteLetterWizardState, stepId: WriteLetterStepId): boolean {
  if (stepId === "method" || stepId === "oral") {
    return true;
  }

  if (stepId === "draft") {
    return state.oralText.trim().length > 0;
  }

  if (stepId === "revise") {
    return hasFreshDraft(state);
  }

  return hasFreshDraft(state) && state.finalText.trim().length > 0;
}

export function canContinueFromStep(state: WriteLetterWizardState, stepId: WriteLetterStepId): boolean {
  if (stepId === "method") {
    return true;
  }

  if (stepId === "oral") {
    return state.oralText.trim().length > 0;
  }

  if (stepId === "draft") {
    return hasFreshDraft(state);
  }

  if (stepId === "revise") {
    return hasFreshDraft(state) && state.finalText.trim().length > 0;
  }

  return hasFreshDraft(state) && state.finalText.trim().length > 0;
}

export function getNextStepId(state: WriteLetterWizardState, currentStepId: WriteLetterStepId): WriteLetterStepId {
  const currentIndex = stepOrder.indexOf(currentStepId);
  const nextStepId = stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)];

  if (nextStepId === undefined || !canEnterStep(state, nextStepId)) {
    return currentStepId;
  }

  return nextStepId;
}

export function getPreviousStepId(currentStepId: WriteLetterStepId): WriteLetterStepId {
  const currentIndex = stepOrder.indexOf(currentStepId);
  return stepOrder[Math.max(currentIndex - 1, 0)] ?? "method";
}

export function markTextBasisChanged(state: WriteLetterWizardState): WriteLetterWizardState {
  return {
    ...state,
    draftDirty: state.oralText.trim().length > 0,
    finalTextFromDraft: state.finalTextFromDraft || state.finalText.trim().length === 0
  };
}

export function markDraftGenerated(state: WriteLetterWizardState, scribeDraft: string): WriteLetterWizardState {
  const normalizedDraft = scribeDraft.trim();
  const shouldReplaceFinalText = state.finalTextFromDraft || state.finalText.trim().length === 0;

  return {
    ...state,
    scribeDraft: normalizedDraft,
    finalText: shouldReplaceFinalText ? normalizedDraft : state.finalText,
    draftDirty: false,
    finalTextFromDraft: shouldReplaceFinalText
  };
}

export function markFinalTextEdited(state: WriteLetterWizardState, finalText: string): WriteLetterWizardState {
  return {
    ...state,
    finalText,
    finalTextFromDraft: finalText.trim() === state.scribeDraft.trim()
  };
}

export function getStepIndex(stepId: WriteLetterStepId): number {
  return stepOrder.indexOf(stepId);
}

function hasFreshDraft(state: WriteLetterWizardState): boolean {
  return state.oralText.trim().length > 0 && state.scribeDraft.trim().length > 0 && !state.draftDirty;
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- src/app/write-letter-wizard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/app/write-letter-wizard.ts src/app/write-letter-wizard.test.ts
git commit -m "feat(app): 添加写信分步流程状态"
```

---

### Task 2: Write Letter Page Wizard UI

**Files:**
- Modify: `src/app/pages/WriteLetterPage.vue`
- Use: `src/app/write-letter-wizard.ts`
- Use: `src/app/write-letter-service.ts`

- [ ] **Step 1: Replace page state with wizard state**

Modify the `<script setup>` section in `src/app/pages/WriteLetterPage.vue` so it imports the wizard helper and existing services:

```ts
import { computed, ref } from "vue";
import type { AppModel } from "../app-model.js";
import {
  calculateWriteLetterCost,
  createScribeDraft,
  type WriteLetterInput
} from "../write-letter-service.js";
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
import { createDefaultAppState, settleAppState } from "../app-state.js";
```

Use the existing props and emits unchanged:

```ts
const props = defineProps<{
  model: AppModel;
}>();

const emit = defineEmits<{
  "save-draft": [input: WriteLetterInput];
  "post-letter": [input: WriteLetterInput];
}>();
```

Create wizard state:

```ts
const handwrittenValue = "__handwritten";
const wizard = ref(
  createInitialWriteLetterWizardState({
    defaultScribeId: props.model.writeLetter.defaultScribeId,
    sampleOralText: props.model.writeLetter.sampleOralText,
    sampleDraftText: props.model.writeLetter.sampleDraftText
  })
);
```

- [ ] **Step 2: Add computed state for selected scribe, steps, and costs**

Still in `WriteLetterPage.vue`, add:

```ts
const currentStep = computed(() => writeLetterSteps.find((step) => step.id === wizard.value.currentStepId) ?? writeLetterSteps[0]);
const currentStepIndex = computed(() => getStepIndex(wizard.value.currentStepId));
const normalizedScribeId = computed(() => wizard.value.selectedScribeId);
const selectedScribe = computed(() =>
  props.model.writeLetter.scribeOptions.find((option) => option.id === normalizedScribeId.value)
);
const draftNotice = computed(() =>
  wizard.value.draftDirty ? "口述或写法已有改动，请重新起稿后再校改投寄。" : ""
);
const canSave = computed(() => canSaveDraft(wizard.value));
const canGoNext = computed(() => canContinueFromStep(wizard.value, wizard.value.currentStepId));
const canPost = computed(() => canContinueFromStep(wizard.value, "post"));
const postingCost = computed(() =>
  calculateWriteLetterCost(settleAppState(createDefaultAppState(), new Date()).state, {
    scribeId: wizard.value.selectedScribeId,
    registered: wizard.value.registered
  })
);
```

This first version uses default state for display-only fee breakdown. `postLetter` remains the source of truth for actual cost and balance mutation.

- [ ] **Step 3: Add methods for navigation and drafting**

Add:

```ts
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

function updateScribeId(rawValue: string): void {
  const nextScribeId = rawValue === handwrittenValue ? null : rawValue;

  if (nextScribeId === wizard.value.selectedScribeId) {
    return;
  }

  wizard.value = markTextBasisChanged({
    ...wizard.value,
    selectedScribeId: nextScribeId
  });
}

function updateOralText(value: string): void {
  wizard.value = markTextBasisChanged({
    ...wizard.value,
    oralText: value
  });
}

function updateFinalText(value: string): void {
  wizard.value = markFinalTextEdited(wizard.value, value);
}

function generateDraft(): void {
  if (wizard.value.oralText.trim().length === 0) {
    return;
  }

  const draft = createScribeDraft(settleAppState(createDefaultAppState(), new Date()).state, {
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
```

- [ ] **Step 4: Replace the template with 5 step sections**

Replace the current `<template>` with this structure, keeping Tailwind and Varlet:

```vue
<template>
  <div class="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
    <section class="archive-panel">
      <p class="text-sm text-[var(--app-muted)]">代书摊</p>
      <h2 class="mt-1 text-2xl font-semibold">写一封平安批</h2>

      <div class="mt-5 grid grid-cols-5 gap-1 rounded border border-[var(--app-rule)] bg-[#f7f0df] p-1">
        <button
          v-for="(step, index) in writeLetterSteps"
          :key="step.id"
          type="button"
          class="min-h-11 border px-1 text-xs"
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
        <p class="text-sm text-[var(--app-muted)]">{{ currentStep.eyebrow }}</p>
        <h3 class="mt-1 text-xl font-semibold">{{ currentStep.title }}</h3>

        <div v-if="wizard.currentStepId === 'method'" class="mt-4 space-y-3">
          <label class="block">
            <span class="form-label">写法</span>
            <select :value="wizard.selectedScribeId ?? handwrittenValue" class="paper-input" @change="updateScribeId(($event.target as HTMLSelectElement).value)">
              <option v-for="option in model.writeLetter.scribeOptions" :key="option.id ?? handwrittenValue" :value="option.id ?? handwrittenValue">
                {{ option.name }} · {{ option.styleText }} · {{ option.feeText }}
              </option>
            </select>
          </label>
          <p class="text-sm text-[var(--app-muted)]">
            {{ selectedScribe?.id === null ? "这封信由你亲笔写成。" : `请 ${selectedScribe?.name ?? model.writeLetter.preferredScribeName} 代笔。` }}
          </p>
        </div>

        <div v-else-if="wizard.currentStepId === 'oral'" class="mt-4">
          <label class="block">
            <span class="form-label">口述</span>
            <textarea :value="wizard.oralText" class="paper-input min-h-40" @input="updateOralText(($event.target as HTMLTextAreaElement).value)" />
          </label>
        </div>

        <div v-else-if="wizard.currentStepId === 'draft'" class="mt-4 space-y-3">
          <p v-if="draftNotice" class="border border-dashed border-[var(--app-rule)] bg-[#f7f0df] p-3 text-sm text-[var(--app-muted)]">{{ draftNotice }}</p>
          <div class="paper-input min-h-40 whitespace-pre-wrap">{{ wizard.scribeDraft || "点下一步前，先生会依口述起一份初稿。" }}</div>
          <var-button plain color="#253b5b" :disabled="wizard.oralText.trim().length === 0" @click="generateDraft">重新起稿</var-button>
        </div>

        <div v-else-if="wizard.currentStepId === 'revise'" class="mt-4">
          <label class="block">
            <span class="form-label">校改正文</span>
            <textarea :value="wizard.finalText" class="paper-input min-h-52" @input="updateFinalText(($event.target as HTMLTextAreaElement).value)" />
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
              <strong>{{ postingCost.scribeFeeFen }} 分</strong>
            </div>
            <div class="ledger-row">
              <span>邮资</span>
              <strong>{{ postingCost.postageFen }} 分</strong>
            </div>
            <div class="ledger-row">
              <span>合计</span>
              <strong>{{ postingCost.totalFen }} 分</strong>
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
    </section>
  </div>
</template>
```

- [ ] **Step 5: Run typecheck and fix any Vue template type errors**

Run:

```bash
npm run typecheck
```

Expected: PASS. If Vue reports event target type narrowing errors, move the casts into small script functions that accept `Event`.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/app/pages/WriteLetterPage.vue
git commit -m "feat(app): 拆分写信页面流程"
```

---

### Task 3: Polish Cost Display and Route Summary

**Files:**
- Modify: `src/app/pages/WriteLetterPage.vue`

- [ ] **Step 1: Replace raw fen values with formatted model strings where available**

In the投寄 step, display:

```vue
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
  <strong>{{ wizard.registered ? model.writeLetter.registeredPostageText : model.writeLetter.plainPostageText }}</strong>
</div>
```

Keep `postingCost` for enablement and debugging only if needed; do not duplicate final posting rules.

- [ ] **Step 2: Add final-text preview in the right panel**

Add a section under the route summary:

```vue
<div class="mt-5 border-t border-dashed border-[var(--app-rule)] pt-4">
  <p class="text-sm text-[var(--app-muted)]">誊清预览</p>
  <p class="mt-2 whitespace-pre-wrap text-sm leading-7">
    {{ wizard.finalText || wizard.scribeDraft || "尚未起稿。" }}
  </p>
</div>
```

- [ ] **Step 3: Run a production build**

Run:

```bash
npm run build
```

Expected: PASS. The existing Varlet chunk-size warning may still appear and is not a blocker.

- [ ] **Step 4: Commit Task 3**

```bash
git add src/app/pages/WriteLetterPage.vue
git commit -m "style(app): 优化写信投寄预览"
```

---

### Task 4: Roadmap and Full Verification

**Files:**
- Modify: `docs/pinganpi-roadmap.md`

- [ ] **Step 1: Update roadmap current progress**

In `docs/pinganpi-roadmap.md`, add a new current progress section after 阶段 6:

```md
### 阶段 7：写信分步流程

状态：5 步可回看流程已完成。

已实现：

- 写信页拆为 `选写法 → 口述 → 起稿 → 校改 → 投寄`。
- 已完成步骤可回看，未满足条件的后续步骤不可跳转。
- 修改口述或写法后需要重新起稿。
- 起稿、保存草稿、封缄投寄继续复用现有写信服务和模板代书引擎。
- 投寄页展示邮资、挂号选择、邮路和誊清预览。

当前测试覆盖：

- `src/app/write-letter-wizard.test.ts`
```

- [ ] **Step 2: Run all automated checks**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

Expected:

- `git diff --check`: no output.
- `npm test`: all test files pass.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, with only the known Varlet chunk-size warning if present.

- [ ] **Step 3: Browser smoke test**

Run the dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Then test in the in-app browser:

- Open the Vite URL.
- Go to 写信.
- Select a writing method.
- Move to 口述.
- Edit oral text.
- Move to 起稿 and generate draft.
- Move to 校改 and edit final text.
- Move to 投寄.
- Toggle 挂号.
- Save draft.
- Post letter.
- Confirm 钱匣 and 档案 reflect the change.

- [ ] **Step 4: Commit Task 4**

```bash
git add docs/pinganpi-roadmap.md
git commit -m "docs: 记录写信分步流程进展"
```

---

## Self-Review

- Spec coverage: 本计划覆盖 5 步流程、可回看跳转、dirty 规则、现有服务复用、测试和浏览器验证。
- Boundary check: 新 helper 只处理 UI wizard 状态，不处理领域层规则。
- Scope check: 草稿列表、AI、toast、云端、真机验证都保持在本阶段外。
- Type consistency: `WriteLetterStepId`、`WriteLetterWizardState`、helper 函数名在测试、页面和实现步骤中保持一致。

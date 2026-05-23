# Pinganpi Draft Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现阶段 8 草稿管理：信纸匣草稿列表、续写、覆盖保存、删除、从草稿投寄后清理。

**Architecture:** 新增 `draft-paper-service.ts` 作为 App 层纯函数服务，负责草稿新增、更新、删除和从草稿投寄；`write-letter-service.ts` 继续负责投寄、扣款、账本和邮政记录。`AppModel` 提供草稿摘要，`App.vue` 持有正在编辑的草稿 id，`WriteLetterPage.vue` 展示信纸匣并把草稿载入现有 wizard。

**Tech Stack:** TypeScript, Vue 3 Composition API, Tailwind CSS, Varlet, Vitest, localStorage AppState.

---

## File Structure And Ownership

- Create: `src/app/draft-paper-service.ts`
  - 草稿新增 / 更新 / 删除 / 从草稿投寄。
- Create: `src/app/draft-paper-service.test.ts`
  - 草稿服务单元测试。
- Modify: `src/app/write-letter-wizard.ts`
  - 增加 `createWriteLetterWizardStateFromDraft`。
- Modify: `src/app/write-letter-wizard.test.ts`
  - 覆盖草稿恢复 wizard。
- Modify: `src/app/app-model.ts`
  - `WriteLetterModel` 增加 `drafts` 摘要。
- Modify: `src/app/app-model.test.ts`
  - 覆盖草稿摘要排序和文案。
- Modify: `src/App.vue`
  - 持有 `editingDraftId`，接入草稿服务和新事件。
- Modify: `src/app/pages/WriteLetterPage.vue`
  - 展示信纸匣，支持续写、删除、保存更新、投寄清理。
- Modify: `docs/pinganpi-roadmap.md`
  - 阶段 8 完成后更新。
- Modify: `docs/pinganpi-roadmap-dashboard.html`
  - 阶段 8 完成后更新。

Subagent execution rule:

- Task 1 and Task 2 can run in parallel because write sets disjoint.
- Task 3 depends on Task 1 and Task 2.
- Task 4 depends on Task 2 and Task 3.
- Task 5 runs after implementation and verification.
- Every worker must not revert edits made by others. If files changed while it was running, it must re-read and adapt.

---

### Task 1: Draft Paper Service

**Worker ownership:**

- Create: `src/app/draft-paper-service.ts`
- Create: `src/app/draft-paper-service.test.ts`
- Do not edit Vue files.
- Do not edit `AppModel`.

- [ ] **Step 1: Write failing tests**

Create `src/app/draft-paper-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultAppState, settleAppState } from "./app-state.js";
import { deleteDraftPaper, postDraftPaper, saveDraftPaper } from "./draft-paper-service.js";

describe("draft paper service", () => {
  const now = new Date("2026-05-23T04:00:00.000Z");
  const later = new Date("2026-05-23T05:00:00.000Z");

  it("creates a new draft paper", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const result = saveDraftPaper(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.created).toBe(true);
    expect(result.state.draftPapers).toHaveLength(1);
    expect(result.state.draftPapers[0]).toMatchObject({
      id: result.draftId,
      oralText: "今日雨停，心里记挂你。",
      finalText: "兰卿：今日雨停，心里记挂你。",
      status: "revised"
    });
  });

  it("updates an existing draft without duplicating it", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);
    if (!created.ok) throw new Error(created.reason);

    const updated = saveDraftPaper(created.state, {
      draftId: created.draftId,
      oralText: "今日雨停，也添了些寒意。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，也添了些寒意。",
      registered: false
    }, later);

    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error(updated.reason);
    expect(updated.created).toBe(false);
    expect(updated.state.draftPapers).toHaveLength(1);
    expect(updated.state.draftPapers[0]).toMatchObject({
      id: created.draftId,
      createdAtIso: now.toISOString(),
      updatedAtIso: later.toISOString(),
      oralText: "今日雨停，也添了些寒意。",
      finalText: "兰卿：今日雨停，也添了些寒意。"
    });
  });

  it("fails to update a missing draft", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const result = saveDraftPaper(state, {
      draftId: "missing-draft",
      oralText: "今日雨停。",
      scribeId: null,
      finalText: "今日雨停。",
      registered: false
    }, now);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected missing draft update to fail");
    expect(result.reason).toBe("没有找到这张草稿。");
    expect(result.state.draftPapers).toHaveLength(0);
  });

  it("deletes an existing draft", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(state, {
      oralText: "今日雨停。",
      scribeId: null,
      finalText: "今日雨停。",
      registered: false
    }, now);
    if (!created.ok) throw new Error(created.reason);

    const deleted = deleteDraftPaper(created.state, created.draftId);

    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error(deleted.reason);
    expect(deleted.state.draftPapers).toHaveLength(0);
  });

  it("keeps state unchanged when deleting a missing draft", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const deleted = deleteDraftPaper(state, "missing-draft");

    expect(deleted.ok).toBe(false);
    if (deleted.ok) throw new Error("Expected missing draft delete to fail");
    expect(deleted.reason).toBe("没有找到这张草稿。");
    expect(deleted.state).toEqual(state);
  });

  it("posts an existing draft and removes it after success", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);
    if (!created.ok) throw new Error(created.reason);

    const posted = postDraftPaper(created.state, created.draftId, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: true
    }, now);

    expect(posted.ok).toBe(true);
    if (!posted.ok) throw new Error(posted.reason);
    expect(posted.state.draftPapers).toHaveLength(0);
    expect(posted.state.letters.find((letter) => letter.id === posted.letterId)).toMatchObject({
      registered: true,
      finalText: "兰卿：今日雨停，心里记挂你。"
    });
  });

  it("keeps an existing draft when posting fails", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    const created = saveDraftPaper(state, {
      oralText: "今日雨停。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停。",
      registered: false
    }, now);
    if (!created.ok) throw new Error(created.reason);
    created.state.wallet.balanceFen = 1;

    const posted = postDraftPaper(created.state, created.draftId, {
      oralText: "今日雨停。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停。",
      registered: true
    }, now);

    expect(posted.ok).toBe(false);
    if (posted.ok) throw new Error("Expected posting to fail");
    expect(posted.reason).toBe("钱匣余额不足，不能赊账。");
    expect(posted.state.draftPapers).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/draft-paper-service.test.ts
```

Expected: FAIL because `draft-paper-service.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `src/app/draft-paper-service.ts`:

```ts
import { cloneAppState, type AppState } from "./app-state.js";
import {
  postLetter,
  saveDraftPaper as createDraftPaper,
  type PostLetterResult,
  type WriteLetterInput
} from "./write-letter-service.js";

export interface SaveDraftPaperInput extends WriteLetterInput {
  draftId?: string;
}

export type SaveDraftPaperResult =
  | { ok: true; state: AppState; draftId: string; created: boolean }
  | { ok: false; state: AppState; reason: string };

export type DeleteDraftPaperResult =
  | { ok: true; state: AppState }
  | { ok: false; state: AppState; reason: string };

export type PostDraftPaperResult = PostLetterResult;

const missingDraftReason = "没有找到这张草稿。";

export function saveDraftPaper(state: AppState, input: SaveDraftPaperInput, now: Date): SaveDraftPaperResult {
  if (input.draftId === undefined) {
    const created = createDraftPaper(state, input, now);

    return {
      ok: true,
      state: created.state,
      draftId: created.draftId,
      created: true
    };
  }

  const draftIndex = state.draftPapers.findIndex((draft) => draft.id === input.draftId);

  if (draftIndex === -1) {
    return {
      ok: false,
      state: cloneAppState(state),
      reason: missingDraftReason
    };
  }

  const existingDraft = state.draftPapers[draftIndex];
  const created = createDraftPaper(state, input, now);
  const generatedDraft = created.state.draftPapers[created.state.draftPapers.length - 1];
  const nextState = cloneAppState(state);

  if (existingDraft === undefined || generatedDraft === undefined) {
    throw new Error("Cannot update missing draft");
  }

  nextState.draftPapers[draftIndex] = {
    ...generatedDraft,
    id: existingDraft.id,
    createdAtIso: existingDraft.createdAtIso,
    updatedAtIso: now.toISOString()
  };

  return {
    ok: true,
    state: nextState,
    draftId: existingDraft.id,
    created: false
  };
}

export function deleteDraftPaper(state: AppState, draftId: string): DeleteDraftPaperResult {
  const draftIndex = state.draftPapers.findIndex((draft) => draft.id === draftId);

  if (draftIndex === -1) {
    return {
      ok: false,
      state: cloneAppState(state),
      reason: missingDraftReason
    };
  }

  const nextState = cloneAppState(state);
  nextState.draftPapers.splice(draftIndex, 1);

  return {
    ok: true,
    state: nextState
  };
}

export function postDraftPaper(state: AppState, draftId: string, input: WriteLetterInput, now: Date): PostDraftPaperResult {
  if (!state.draftPapers.some((draft) => draft.id === draftId)) {
    return {
      ok: false,
      state: cloneAppState(state),
      reason: missingDraftReason
    };
  }

  const posted = postLetter(state, input, now);

  if (!posted.ok) {
    return posted;
  }

  const nextState = cloneAppState(posted.state);
  nextState.draftPapers = nextState.draftPapers.filter((draft) => draft.id !== draftId);

  return {
    ...posted,
    state: nextState
  };
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
npm test -- src/app/draft-paper-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/draft-paper-service.ts src/app/draft-paper-service.test.ts
git commit -m "feat(app): 添加草稿管理服务"
```

---

### Task 2: Wizard Restore And Draft Summaries

**Worker ownership:**

- Modify: `src/app/write-letter-wizard.ts`
- Modify: `src/app/write-letter-wizard.test.ts`
- Modify: `src/app/app-model.ts`
- Modify: `src/app/app-model.test.ts`
- Do not edit Vue files.
- Do not edit `draft-paper-service.ts`.

- [ ] **Step 1: Add wizard restore test**

Append to `src/app/write-letter-wizard.test.ts`:

```ts
import type { DraftPaper } from "./app-state.js";
import { createWriteLetterWizardStateFromDraft } from "./write-letter-wizard.js";

it("restores wizard state from an existing draft paper", () => {
  const draft: DraftPaper = {
    id: "draft-1",
    authorMemberId: "member-zhou",
    recipientMemberId: "member-lan",
    createdAtIso: "2026-05-23T04:00:00.000Z",
    updatedAtIso: "2026-05-23T05:00:00.000Z",
    oralText: "今日雨停。",
    scribeId: "scribe-xu",
    scribeDraft: "兰卿：今日雨停。",
    finalText: "兰卿：今日雨停，心里记挂你。",
    status: "revised"
  };

  const restored = createWriteLetterWizardStateFromDraft(draft);

  expect(restored).toMatchObject({
    currentStepId: "revise",
    selectedScribeId: "scribe-xu",
    oralText: "今日雨停。",
    scribeDraft: "兰卿：今日雨停。",
    finalText: "兰卿：今日雨停，心里记挂你。",
    registered: false,
    draftDirty: false,
    finalTextFromDraft: false
  });
  expect(canEnterStep(restored, "post")).toBe(true);
});
```

- [ ] **Step 2: Implement wizard restore**

Modify `src/app/write-letter-wizard.ts`:

```ts
import type { DraftPaper } from "./app-state.js";
```

Add:

```ts
export function createWriteLetterWizardStateFromDraft(draft: DraftPaper): WriteLetterWizardState {
  const hasFreshDraft = draft.oralText.trim().length > 0 && draft.scribeDraft.trim().length > 0;
  const hasFinalText = draft.finalText.trim().length > 0;

  return {
    currentStepId: hasFreshDraft && hasFinalText ? "revise" : "draft",
    selectedScribeId: draft.scribeId,
    oralText: draft.oralText,
    scribeDraft: draft.scribeDraft,
    finalText: draft.finalText,
    registered: false,
    draftDirty: false,
    finalTextFromDraft: draft.finalText.trim() === draft.scribeDraft.trim()
  };
}
```

- [ ] **Step 3: Add app-model draft summary tests**

Modify `src/app/app-model.test.ts` by adding a test that creates two drafts with different `updatedAtIso`, then calls `buildAppModel(now, state)` and asserts `model.writeLetter.drafts` is sorted newest first with status and excerpt:

```ts
it("summarizes draft papers newest first", () => {
  const now = new Date("2026-05-23T04:00:00.000Z");
  const state = createDefaultAppState();
  state.draftPapers.push(
    {
      id: "draft-old",
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      createdAtIso: "2026-05-23T02:00:00.000Z",
      updatedAtIso: "2026-05-23T02:30:00.000Z",
      oralText: "旧草稿口述",
      scribeId: null,
      scribeDraft: "旧草稿正文",
      finalText: "旧草稿正文",
      status: "draft"
    },
    {
      id: "draft-new",
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      createdAtIso: "2026-05-23T03:00:00.000Z",
      updatedAtIso: "2026-05-23T03:30:00.000Z",
      oralText: "新草稿口述",
      scribeId: "scribe-xu",
      scribeDraft: "新草稿初稿",
      finalText: "新草稿正文",
      status: "revised"
    }
  );

  const model = buildAppModel(now, state);

  expect(model.writeLetter.drafts.map((draft) => draft.id)).toEqual(["draft-new", "draft-old"]);
  expect(model.writeLetter.drafts[0]).toMatchObject({
    recipientName: "兰卿",
    writingMethodText: "许鹤年代笔",
    statusText: "已校改",
    excerpt: "新草稿正文"
  });
  expect(model.writeLetter.drafts[1]).toMatchObject({
    writingMethodText: "亲笔",
    statusText: "草稿"
  });
});
```

- [ ] **Step 4: Implement app-model summaries**

Modify `src/app/app-model.ts`:

```ts
import { createDefaultAppState, settleAppState, type AppState, type DraftPaper, type PersistedLetter } from "./app-state.js";
```

Extend `WriteLetterModel`:

```ts
drafts: WriteLetterDraftSummary[];
```

Add:

```ts
export interface WriteLetterDraftSummary {
  id: string;
  updatedAtText: string;
  recipientName: string;
  writingMethodText: string;
  statusText: string;
  excerpt: string;
}
```

In `writeLetter` model add:

```ts
drafts: state.draftPapers
  .slice()
  .sort((left, right) => Date.parse(right.updatedAtIso) - Date.parse(left.updatedAtIso))
  .map((draft) => summarizeDraftPaper(draft, state))
```

Add helpers:

```ts
const draftStatusText: Record<DraftPaper["status"], string> = {
  draft: "草稿",
  scribed: "先生初稿",
  revised: "已校改",
  sealed: "已封缄"
};

function summarizeDraftPaper(draft: DraftPaper, state: AppState): WriteLetterDraftSummary {
  const recipient = findMember(state, draft.recipientMemberId);
  const scribe = draft.scribeId === null ? null : state.scribes.find((candidate) => candidate.id === draft.scribeId);

  return {
    id: draft.id,
    updatedAtText: formatEraDate(new Date(draft.updatedAtIso)),
    recipientName: recipient.dailyName,
    writingMethodText: scribe === null ? "亲笔" : `${scribe?.name ?? "代笔先生"}代笔`,
    statusText: draftStatusText[draft.status],
    excerpt: makeTextExcerpt(draft.finalText || draft.scribeDraft || draft.oralText)
  };
}

function makeTextExcerpt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- src/app/write-letter-wizard.test.ts src/app/app-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/write-letter-wizard.ts src/app/write-letter-wizard.test.ts src/app/app-model.ts src/app/app-model.test.ts
git commit -m "feat(app): 添加草稿摘要和恢复状态"
```

---

### Task 3: App State Wiring

**Worker ownership:**

- Modify: `src/App.vue`
- May import from `src/app/draft-paper-service.ts`.
- Do not edit `WriteLetterPage.vue`.

- [ ] **Step 1: Update imports**

In `src/App.vue`, replace:

```ts
import { postLetter, saveDraftPaper, type WriteLetterInput } from "./app/write-letter-service.js";
```

with:

```ts
import type { DraftPaper } from "./app/app-state.js";
import {
  deleteDraftPaper,
  postDraftPaper,
  saveDraftPaper,
  type SaveDraftPaperInput
} from "./app/draft-paper-service.js";
import { postLetter, type WriteLetterInput } from "./app/write-letter-service.js";
```

- [ ] **Step 2: Add editing draft state**

Add:

```ts
const editingDraftId = ref<string | null>(null);
const editingDraft = computed<DraftPaper | null>(() =>
  editingDraftId.value === null ? null : (appState.value.draftPapers.find((draft) => draft.id === editingDraftId.value) ?? null)
);
```

- [ ] **Step 3: Update event handlers**

Replace handlers with:

```ts
function handleEditDraft(draftId: string): void {
  if (!appState.value.draftPapers.some((draft) => draft.id === draftId)) {
    editingDraftId.value = null;
    noticeText.value = "没有找到这张草稿。";
    return;
  }

  editingDraftId.value = draftId;
  activeKey.value = "write";
  noticeText.value = "草稿已取出，可继续校改。";
}

function handleDeleteDraft(draftId: string): void {
  const result = deleteDraftPaper(appState.value, draftId);

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  if (editingDraftId.value === draftId) {
    editingDraftId.value = null;
  }
  noticeText.value = "草稿已删去。";
}

function handleSaveDraft(payload: SaveDraftPaperInput): void {
  const result = saveDraftPaper(appState.value, payload, new Date());

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  editingDraftId.value = result.draftId;
  noticeText.value = result.created ? "草稿已存入信纸匣。" : "草稿已重新收好。";
}

function handlePostLetter(payload: SaveDraftPaperInput): void {
  const result =
    payload.draftId === undefined
      ? postLetter(appState.value, payload, new Date())
      : postDraftPaper(appState.value, payload.draftId, payload, new Date());

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  if (payload.draftId !== undefined) {
    editingDraftId.value = null;
  }
  noticeText.value = "信已封缄投寄，邮政存根已入档。";
}
```

- [ ] **Step 4: Pass props and events to page**

Update dynamic component:

```vue
<component
  :is="activePage.component"
  :model="model"
  :editing-draft="editingDraft"
  @edit-draft="handleEditDraft"
  @delete-draft="handleDeleteDraft"
  @save-draft="handleSaveDraft"
  @post-letter="handlePostLetter"
/>
```

- [ ] **Step 5: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS after Task 4 updates `WriteLetterPage.vue` event types. If running before Task 4, expected failure is missing props/events on page; do not commit until Task 4 is integrated or adapt types compatibly.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue
git commit -m "feat(app): 接入草稿编辑状态"
```

---

### Task 4: Write Letter Page Draft Box UI

**Worker ownership:**

- Modify: `src/app/pages/WriteLetterPage.vue`
- Use model summaries from Task 2.
- Use events from Task 3.

- [ ] **Step 1: Update imports and props**

Modify script imports:

```ts
import { computed, ref, watch } from "vue";
import type { DraftPaper } from "../app-state.js";
```

Update props:

```ts
const props = defineProps<{
  model: AppModel;
  editingDraft?: DraftPaper | null;
}>();
```

Update emits:

```ts
const emit = defineEmits<{
  "edit-draft": [draftId: string];
  "delete-draft": [draftId: string];
  "save-draft": [payload: { draftId?: string; input: WriteLetterInput }];
  "post-letter": [payload: { draftId?: string; input: WriteLetterInput }];
}>();
```

- [ ] **Step 2: Track active draft and restore wizard**

Import:

```ts
createWriteLetterWizardStateFromDraft
```

Add:

```ts
const activeDraftId = ref<string | null>(props.editingDraft?.id ?? null);

watch(
  () => props.editingDraft,
  (draft) => {
    activeDraftId.value = draft?.id ?? null;
    if (draft !== null && draft !== undefined) {
      wizard.value = createWriteLetterWizardStateFromDraft(draft);
    }
  },
  { immediate: true }
);
```

- [ ] **Step 3: Update save and post events**

Replace emits:

```ts
emit("save-draft", {
  draftId: activeDraftId.value ?? undefined,
  input: buildInput()
});
```

and:

```ts
emit("post-letter", {
  draftId: activeDraftId.value ?? undefined,
  input: buildInput()
});
```

Add:

```ts
function editDraft(draftId: string): void {
  emit("edit-draft", draftId);
}

function deleteDraft(draftId: string): void {
  if (!window.confirm("删去这张草稿？")) {
    return;
  }

  emit("delete-draft", draftId);
}
```

- [ ] **Step 4: Add draft box UI**

At top of the right `archive-panel`, before 邮资估记, insert:

```vue
<div>
  <div class="flex items-end justify-between gap-3">
    <div>
      <p class="text-sm text-[var(--app-muted)]">信纸匣</p>
      <h2 class="mt-1 text-2xl font-semibold">草稿</h2>
    </div>
    <span class="thin-label">{{ model.writeLetter.drafts.length }} 张</span>
  </div>

  <div v-if="model.writeLetter.drafts.length === 0" class="record-card mt-4 text-sm leading-7 text-[var(--app-muted)]">
    暂无草稿。
  </div>

  <div v-else class="mt-4 grid gap-3">
    <article v-for="draft in model.writeLetter.drafts" :key="draft.id" class="record-card">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-xs text-[var(--app-muted)]">{{ draft.updatedAtText }} · {{ draft.recipientName }}</p>
          <h3 class="mt-1 text-lg font-semibold">{{ draft.excerpt }}</h3>
        </div>
        <span class="thin-label">{{ draft.statusText }}</span>
      </div>
      <p class="mt-2 text-sm text-[var(--app-muted)]">{{ draft.writingMethodText }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <var-button plain color="#253b5b" @click="editDraft(draft.id)">续写</var-button>
        <var-button plain color="#9b2f24" @click="deleteDraft(draft.id)">删去</var-button>
      </div>
    </article>
  </div>
</div>

<div class="mt-5 border-t border-dashed border-[var(--app-rule)] pt-4">
```

Then wrap the existing 邮资估记 content in that opened block and remove duplicated top-level heading if needed.

- [ ] **Step 5: Add editing status label**

Near the left panel heading add:

```vue
<p v-if="activeDraftId" class="mt-2 text-sm text-[var(--app-muted)]">正在续写信纸匣中的草稿。</p>
```

- [ ] **Step 6: Typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS; known Varlet chunk warning may appear.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/WriteLetterPage.vue
git commit -m "feat(app): 添加信纸匣界面"
```

---

### Task 5: Documentation, Dashboard, And Verification

**Worker ownership:**

- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Do not edit app source unless fixing doc-caused type issues, which should not happen.

- [ ] **Step 1: Run full checks**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

Expected:

- `git diff --check`: no output.
- `npm test`: all tests pass. Test count should be recorded.
- `npm run typecheck`: PASS.
- `npm run build`: PASS with only the known Varlet chunk warning if present.

- [ ] **Step 2: Browser smoke test**

Use `npm run dev -- --host 127.0.0.1` and in-app browser.

Manual flow:

- Open App.
- Go to 写信.
- Save a new draft.
- Confirm 信纸匣 shows the draft.
- Click 续写.
- Confirm wizard restores draft content and enters edit flow.
- Save again.
- Confirm no duplicate draft appears.
- Delete draft.
- Refresh App.
- Confirm deleted draft stays deleted.
- Create another draft.
- Continue it, reach 投寄, post it.
- Confirm draft disappears, 钱匣扣款, 账本追加, 档案新增.

- [ ] **Step 3: Update roadmap**

In `docs/pinganpi-roadmap.md`:

- Current baseline: `已完成阶段 8 草稿管理`。
- Add `### 阶段 8：草稿管理` under 当前进展.
- Remove “草稿列表、草稿继续编辑和草稿删除” from 尚未完成.
- Renumber later recommended stages:
  - `阶段 9：信箱与真实时间送达推进`
  - `阶段 10：云端与双人同步准备`
- Update verification baseline test count.

- [ ] **Step 4: Update dashboard**

In `docs/pinganpi-roadmap-dashboard.html`:

- Top badge: `当前：阶段 8`.
- Key metric: `阶段 8 完成`.
- Next recommendation: `真实送达`.
- Test count: use actual `npm test` count.
- Progress text and width: if showing 8 / 10, use `80%`; if keeping active implementation milestones at 8 / 8, show `100%` and move future work to next candidates. Prefer 8 / 10 because roadmap already has future stages.
- Add 草稿管理 to completed abilities.
- Remove 草稿管理 from risk list.

- [ ] **Step 5: Commit**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html
git commit -m "docs: 记录草稿管理阶段进展"
```

---

## Final Review Requirements

After all tasks:

- Run `git status --short --branch`.
- Run `git log --oneline --decorate -8`.
- Dispatch a final reviewer subagent with the full spec and summary of commits.
- Fix any Important/Critical review findings.
- Final response must include:
  - changed files summary
  - test commands and results
  - browser smoke test result
  - latest commits
  - whether dev server is still running

## Self-Review

- Spec coverage: service upsert/delete/post, wizard restore, view-model summaries, UI list, App event wiring, docs/dashboard, verification are all covered.
- Boundary check: no domain rule is duplicated in UI. Posting still flows through `postLetter`.
- Scope check: no cloud sync, no full search, no global toast rewrite, no bottom nav change.
- Type consistency: `SaveDraftPaperInput`, `SaveDraftPaperResult`, `WriteLetterDraftSummary`, `createWriteLetterWizardStateFromDraft`, and event payloads match across tasks.

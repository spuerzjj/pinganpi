# 平安批 App 侧 AI 代笔接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让写信流程的“先生起稿”通过 App 侧 AI adapter 调用自有代理生成初稿，同时保留亲笔、手工校改、草稿保存、费用校验、封缄投寄和真实等待规则。

**Architecture:** 新增 `src/app/ai-scribe-adapter.ts` 定义客户端 AI adapter 边界，客户端只调用 `VITE_PINGANPI_AI_PROXY_URL` 或本地开发代理，不持有 provider key。扩展 `write-letter-service` 的输入结构，让页面生成的 AI 初稿和 metadata 能被保存到草稿与投寄信件中；旧模板结果仅作为历史兼容和亲笔流程保留。写信页将起稿改为异步，失败时不生成模板正文，只保留口述并提示稍后再请先生起稿。

**Tech Stack:** Vue 3, TypeScript, Vitest, existing `src/app` state/services, local AI proxy `POST /ai/scribe-draft`.

**Implementation status:** 已完成 App 侧本地可测链路。阶段 12 已落地 HTTP AI adapter、AI metadata 持久化、写信服务保存 AI 起稿结果、写信向导 metadata 状态、写信页异步 AI 起稿和失败提示。真实 MiMo env、费用告警、云函数 / CloudBase 落点和真实 AI 起稿烟测移至阶段 13。

**Implementation commits:**

- `2a24509 feat(app): 添加 AI 代笔适配器`
- `dead3c8 feat(app): 持久化 AI 起稿元数据`
- `19f12fb feat(app): 保存 AI 起稿结果`
- `9bc8be7 feat(app): 保留写信向导 AI 起稿元数据`
- `802ce24 feat(app): 接入写信页 AI 起稿`

---

## File Structure

- Create: `src/app/ai-scribe-adapter.ts`
  - 定义 `AiScribeAdapter`、HTTP adapter、fake-test-friendly fetch injection、受控错误类型。
- Create: `src/app/ai-scribe-adapter.test.ts`
  - 覆盖请求体、proxy URL、成功响应、provider 失败、网络失败和不读取 provider key。
- Modify: `src/app/scribe-template-engine.ts`
  - 将 `ScribeGenerationMeta` 扩展为 `local-template-v1 | ai-scribe-v1` union。
- Modify: `src/app/app-state.ts`
  - 允许持久化 `ai-scribe-v1` generation metadata。
- Modify: `src/app/write-letter-service.ts`
  - 允许 `WriteLetterInput` 携带已经生成好的 `ScribeDraftResult` 字段，保存 / 投寄时不重新模板起稿。
  - 新增 `createHandwrittenDraftResult` 或等价函数，亲笔流程保持本地生成。
- Modify: `src/app/write-letter-service.test.ts`
  - 覆盖 AI metadata 可保存到草稿和投寄信件；亲笔仍不走 AI。
- Modify: `src/app/write-letter-wizard.ts`
  - wizard state 保存 `draftSource`、`generationMeta`、`readAloudText`，从草稿恢复时不丢 metadata。
- Modify: `src/app/write-letter-wizard.test.ts`
  - 覆盖 AI 初稿 metadata 在 wizard 中保留，修改口述后清空旧 metadata。
- Modify: `src/app/pages/WriteLetterPage.vue`
  - 起稿按钮改为 async；代笔先生走 AI adapter，亲笔走本地亲笔草稿。
  - 起稿中禁用按钮；失败时展示克制提示，不填入模板正文。
  - 保存草稿 / 投寄 payload 带上 AI draft result。
- Modify: `src/App.vue`
  - 接收扩展后的 `WriteLetterInput`，现有保存 / 投寄流程保持不变。
- Modify: docs
  - 更新 `docs/pinganpi-roadmap.md`、`docs/pinganpi-roadmap-dashboard.html`、`AGENTS.md`，记录阶段 12 开始、App 侧 AI adapter 接入状态和验证基线。

---

### Task 1: AI adapter boundary

**Files:**
- Create: `src/app/ai-scribe-adapter.test.ts`
- Create: `src/app/ai-scribe-adapter.ts`

- [ ] **Step 1: Write failing adapter tests**

Create tests that instantiate `createHttpAiScribeAdapter({ proxyUrl: "http://127.0.0.1:8787", fetcher })` and verify:

```ts
expect(calls[0]?.url).toBe("http://127.0.0.1:8787/ai/scribe-draft");
expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
  oralText: "请替我问她近来安好。",
  scribeName: "陈启明",
  senderGreeting: "兰卿",
  senderSignature: "阿平",
  senderCity: "杭州",
  recipientCity: "西安",
  letterType: "ordinary"
});
expect(calls[0]?.init.headers).toEqual({ "content-type": "application/json" });
```

Also verify a successful response maps to `draftSource: "ai"` and `generationMeta.engine: "ai-scribe-v1"`, and failed / rejected fetches throw `AiScribeDraftError` with codes `proxy_unavailable`, `invalid_response`, or `provider_error`.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/app/ai-scribe-adapter.test.ts
```

Expected: fail because `src/app/ai-scribe-adapter.ts` does not exist.

- [ ] **Step 3: Implement adapter**

Implement:

```ts
export type AiScribeDraftErrorCode =
  | "network_unavailable"
  | "proxy_unavailable"
  | "provider_timeout"
  | "quota_exceeded"
  | "invalid_response"
  | "provider_error";

export class AiScribeDraftError extends Error {
  constructor(
    public readonly code: AiScribeDraftErrorCode,
    message: string
  ) {
    super(message);
  }
}
```

`createHttpAiScribeAdapter` must only use the given proxy URL and fetch; it must never read `MIMO_API_KEY`, `VITE_MIMO_API_KEY`, or provider secrets.

- [ ] **Step 4: Run adapter tests**

Run:

```bash
npm test -- src/app/ai-scribe-adapter.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/ai-scribe-adapter.ts src/app/ai-scribe-adapter.test.ts
git commit -m "feat(app): 添加 AI 代笔适配器"
```

---

### Task 2: Persist AI generation metadata

**Files:**
- Modify: `src/app/scribe-template-engine.ts`
- Modify: `src/app/app-state.ts`
- Modify: `src/app/app-state.test.ts`

- [ ] **Step 1: Write failing persistence test**

Add an `app-state` test that serializes and parses a draft paper with:

```ts
draftSource: "ai",
generationMeta: {
  engine: "ai-scribe-v1",
  provider: "xiaomi-mimo",
  model: "mimo-v2.5",
  promptVersion: "ai-scribe-prompt-v1",
  scribeId: "scribe-xu",
  sceneTags: ["问安"],
  letterType: "ordinary",
  senderCity: "杭州",
  recipientCity: "西安",
  latencyMs: 1200
}
```

Expected parsed state is not null and preserves metadata.

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/app-state.test.ts
```

Expected: fail because `isOptionalGenerationMeta` only accepts `local-template-v1`.

- [ ] **Step 3: Extend metadata types and guard**

Change `ScribeGenerationMeta` to a union:

```ts
export type ScribeGenerationMeta = LocalTemplateGenerationMeta | AiScribeGenerationMeta;
```

Add an `ai-scribe-v1` branch in `isOptionalGenerationMeta`.

- [ ] **Step 4: Run persistence tests**

Run:

```bash
npm test -- src/app/app-state.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/scribe-template-engine.ts src/app/app-state.ts src/app/app-state.test.ts
git commit -m "feat(app): 持久化 AI 起稿元数据"
```

---

### Task 3: Preserve generated AI draft through save and post

**Files:**
- Modify: `src/app/write-letter-service.ts`
- Modify: `src/app/write-letter-service.test.ts`
- Modify: `src/app/draft-paper-service.ts`
- Modify: `src/app/draft-paper-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests proving:

- `saveDraftPaper` persists provided `scribeDraft`, `readAloudText`, `draftSource: "ai"` and `generationMeta`.
- `postLetter` persists those same fields into `PersistedLetter`.
- If no AI draft result is provided, existing template / handwritten compatibility still works.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/app/write-letter-service.test.ts src/app/draft-paper-service.test.ts
```

Expected: fail because `WriteLetterInput` cannot carry generated draft metadata yet.

- [ ] **Step 3: Extend `WriteLetterInput`**

Add optional generated draft fields to `WriteLetterInput`:

```ts
scribeDraft?: string;
readAloudText?: string;
draftSource?: DraftSource;
generationMeta?: ScribeGenerationMeta;
```

Update `createDraftResult` to prefer these fields when present, otherwise keep existing local template / handwritten behavior for compatibility.

- [ ] **Step 4: Run service tests**

Run:

```bash
npm test -- src/app/write-letter-service.test.ts src/app/draft-paper-service.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/write-letter-service.ts src/app/write-letter-service.test.ts src/app/draft-paper-service.ts src/app/draft-paper-service.test.ts
git commit -m "feat(app): 保存 AI 起稿结果"
```

---

### Task 4: Wizard state carries draft metadata

**Files:**
- Modify: `src/app/write-letter-wizard.ts`
- Modify: `src/app/write-letter-wizard.test.ts`

- [ ] **Step 1: Write failing wizard tests**

Add tests proving:

- `markDraftGenerated` accepts a full `ScribeDraftResult` and stores `draftSource`, `generationMeta`, `readAloudText`.
- `createWriteLetterWizardStateFromDraft` restores those fields from `DraftPaper`.
- `markTextBasisChanged` clears generated metadata so stale AI metadata is not reused after oral text or method changes.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- src/app/write-letter-wizard.test.ts
```

Expected: fail because wizard state only stores plain `scribeDraft`.

- [ ] **Step 3: Extend wizard state**

Add:

```ts
readAloudText: string;
draftSource: DraftSource | undefined;
generationMeta: ScribeGenerationMeta | undefined;
```

Update `markDraftGenerated` to accept `ScribeDraftResult`.

- [ ] **Step 4: Run wizard tests**

Run:

```bash
npm test -- src/app/write-letter-wizard.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/write-letter-wizard.ts src/app/write-letter-wizard.test.ts
git commit -m "feat(app): 在写信向导保留 AI 起稿元数据"
```

---

### Task 5: Write page async AI draft generation

**Files:**
- Modify: `src/app/pages/WriteLetterPage.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Refactor page draft generation**

Change `generateDraft` to async:

- If `selectedScribeId === null`, use local handwritten result and never call AI.
- If a scribe is selected, call HTTP AI adapter.
- While pending, disable “重新起稿” and “下一步”.
- On failure, leave `scribeDraft` empty / dirty and show a message such as `先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。`

- [ ] **Step 2: Include generated result in submit payload**

`buildInput()` must include:

```ts
scribeDraft: wizard.value.scribeDraft,
readAloudText: wizard.value.readAloudText,
draftSource: wizard.value.draftSource,
generationMeta: wizard.value.generationMeta
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/WriteLetterPage.vue src/App.vue
git commit -m "feat(app): 接入写信页 AI 起稿"
```

---

### Task 6: Documentation and verification

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update docs for key node**

Record that stage 12 has App-side AI adapter in progress or complete, depending on verification state. Update test count and next recommended work.

- [ ] **Step 2: Full verification**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
rg -n "MIMO_API_KEY|VITE_MIMO|VITE_XIAOMI|tp-|sk-" src
```

Expected:

- `git diff --check`: no output, exit 0.
- `npm test`: all tests pass.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0; existing Varlet chunk warning may remain.
- secret scan in `src` has no real provider key and no `VITE_MIMO` secret usage.

- [ ] **Step 3: Commit**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md
git commit -m "docs: 更新 AI 起稿接入进度"
```

---

## Completion Criteria

- 代笔先生起稿通过 App 侧 AI adapter 调用自有代理；亲笔流程不调用 AI。
- AI 失败不会生成模板正文；用户口述仍可保存为草稿，稍后重试。
- 草稿和投寄信件保存 `draftSource: "ai"`、`scribeDraft`、`finalText`、`readAloudText` 和 `generationMeta`。
- 客户端不读取 `MIMO_API_KEY`、不使用 `VITE_MIMO_API_KEY`、不直连 Xiaomi MiMo。
- 投寄仍复用既有写信服务、费用校验、钱匣扣款、邮政记录和真实送达规则。
- Roadmap、dashboard 和 AGENTS 在阶段 12 关键节点后同步更新。

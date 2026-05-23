# 平安批草稿管理设计

## 背景

当前写信流程已经支持 `存作草稿`，草稿会进入本地 `AppState.draftPapers` 并持久化到 `localStorage`。但用户还看不到草稿列表，也不能继续编辑、覆盖保存或删除草稿。结果是“信纸匣”这个产品概念已经有数据基础，却没有形成可用体验。

本阶段将草稿管理作为阶段 8，实现第一版本地信纸匣。目标是补齐写信闭环，而不是新增云端同步或复杂档案系统。

## 目标

- 在写信页内提供“信纸匣”草稿列表。
- 草稿可继续编辑，并恢复口述、写法、先生初稿和最终正文。
- 继续编辑后保存会更新原草稿，不产生重复草稿。
- 草稿可删除，删除后刷新 App 仍保持删除状态。
- 从草稿投寄成功后清理对应草稿。
- 投寄失败时保留草稿。
- 草稿管理继续复用现有 `AppState`、写信服务、模板代书引擎和领域层规则。
- 移动端优先，同时保证 PC 浏览器可用。

## 非目标

- 不实现云端同步。
- 不实现多人协同编辑。
- 不实现草稿全文搜索。
- 不实现草稿恢复历史版本。
- 不把草稿入口新增为底部导航项。
- 不在本阶段统一修复全局 toast / snackbar 提示问题。

## 产品交互

### 入口位置

草稿管理放在写信页内，命名为“信纸匣”。

布局原则：

- 左侧或上方保持当前 5 步写信 wizard，作为“正在写的一封”。
- 右侧或下方显示“信纸匣”草稿列表。
- 移动端顺序为：写信 wizard 在前，信纸匣在后。
- PC 宽屏保留两栏：左侧写信，右侧信纸匣、邮资估记、邮路和誊清预览。

不新增底部导航，避免移动端导航拥挤。

### 草稿列表

每条草稿显示：

- 更新时间。
- 收信人。
- 写法：亲笔或代笔先生姓名。
- 状态：草稿 / 先生初稿 / 已校改。
- 摘要：优先取最终正文，其次先生初稿，其次口述。

列表按 `updatedAtIso` 倒序排列。第一版展示全部草稿；如果后续草稿过多，再做折叠或筛选。

### 草稿操作

每条草稿提供：

- `续写`：载入草稿到当前写信 wizard。
- `删去`：删除草稿。

删除需要明确确认。第一版可使用浏览器原生 `confirm`，后续 UI polish 再统一替换为更符合移动体验的确认组件。

投寄操作仍放在 wizard 的最后一步，而不是直接在草稿卡片上投寄。这样可以避免跳过费用确认和封缄确认。

### 继续编辑

点击 `续写` 后：

- 当前 wizard 载入该草稿。
- `selectedScribeId` 使用草稿的 `scribeId`。
- `oralText` 使用草稿的 `oralText`。
- `scribeDraft` 使用草稿的 `scribeDraft`。
- `finalText` 使用草稿的 `finalText`。
- `draftDirty = false`。
- `finalTextFromDraft = finalText.trim() === scribeDraft.trim()`。
- 当前步骤进入 `校改`，如果正文为空则进入 `起稿`。

如果用户修改口述或写法，沿用当前 wizard 规则：草稿变脏，需要重新起稿后才能进入校改或投寄。

### 保存草稿

保存行为分两种：

- 没有正在编辑的 `draftId`：新建草稿。
- 有正在编辑的 `draftId`：更新原草稿。

更新原草稿时：

- 保留 `createdAtIso`。
- 更新 `updatedAtIso`。
- 用当前 wizard 输入覆盖 `oralText`、`scribeId`、`scribeDraft`、`finalText`、生成元数据和状态。
- 不新增重复草稿。

### 投寄草稿

如果当前 wizard 来源于某个草稿：

- 投寄成功后删除该草稿。
- 投寄失败后保留草稿。

投寄仍必须复用现有余额校验、先生出勤校验、扣款、账本记录、信件副本和邮政记录逻辑。

## 数据与服务边界

### AppState

现有 `DraftPaper` 字段基本足够：

- `id`
- `authorMemberId`
- `recipientMemberId`
- `createdAtIso`
- `updatedAtIso`
- `oralText`
- `scribeId`
- `scribeDraft`
- `finalText`
- `readAloudText`
- `draftSource`
- `generationMeta`
- `status`

第一版不新增 `registered` 到 `DraftPaper`。挂号属于投寄前确认选项，继续编辑草稿时默认不挂号；用户可在投寄步骤重新选择。

### 新增草稿服务

新增文件：

- `src/app/draft-paper-service.ts`

服务为纯函数，只接收 `AppState` 并返回新状态。

建议接口：

```ts
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

export function saveDraftPaper(
  state: AppState,
  input: SaveDraftPaperInput,
  now: Date
): SaveDraftPaperResult;

export function deleteDraftPaper(
  state: AppState,
  draftId: string
): DeleteDraftPaperResult;

export function postDraftPaper(
  state: AppState,
  draftId: string,
  input: WriteLetterInput,
  now: Date
): PostDraftPaperResult;
```

`postDraftPaper` 内部调用现有 `postLetter`，并且只在 `postLetter` 成功后删除草稿。

现有 `write-letter-service.ts` 可保留 `postLetter`。原 `saveDraftPaper` 可以迁移到新服务，也可以保留 re-export；最终调用方应使用 `draft-paper-service.ts` 中支持 upsert 的版本。

### Wizard 恢复

在 `src/app/write-letter-wizard.ts` 增加：

```ts
export function createWriteLetterWizardStateFromDraft(
  draft: DraftPaper
): WriteLetterWizardState;
```

它只负责把持久化草稿转为 UI wizard 状态，不做邮资、钱匣、先生出勤等领域计算。

### View Model

在 `AppModel.writeLetter` 中增加草稿摘要列表：

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

摘要由 `AppState.draftPapers` 派生，按 `updatedAtIso` 倒序排列。

## UI 与事件边界

`WriteLetterPage.vue` 新增 props：

```ts
editingDraft: DraftPaper | null;
```

或等价的 `editingDraftId + draft lookup`，但推荐父组件直接传入 `DraftPaper | null`，避免页面读取全局状态。

事件调整为：

```ts
"edit-draft": [draftId: string]
"delete-draft": [draftId: string]
"save-draft": [payload: { draftId?: string; input: WriteLetterInput }]
"post-letter": [payload: { draftId?: string; input: WriteLetterInput }]
```

父组件 `App.vue` 负责：

- 持有 `editingDraftId`。
- 根据 `editingDraftId` 从 `appState.draftPapers` 找当前草稿。
- 调用草稿服务保存、删除、投寄。
- 持久化状态。
- 清理 `editingDraftId`。

子组件 `WriteLetterPage.vue` 负责：

- 展示草稿列表。
- 请求续写 / 删除。
- 载入 `editingDraft` 到 wizard。
- 发出保存和投寄事件。

## 错误处理

- 删除不存在的草稿：返回失败原因，不改变状态。
- 续写不存在的草稿：父组件清理 `editingDraftId`，展示失败提示。
- 更新不存在的草稿：按失败处理，不自动新增，避免用户误以为覆盖成功。
- 投寄失败：保留草稿，并展示现有失败原因，如余额不足或先生不在摊。
- 投寄成功：删除草稿并清理正在编辑状态。

## 测试

新增：

- `src/app/draft-paper-service.test.ts`
  - 新建草稿会追加。
  - 更新草稿不新增，并保留 `createdAtIso`。
  - 删除草稿成功。
  - 删除不存在草稿失败且状态不变。
  - 从草稿投寄成功后删除草稿。
  - 从草稿投寄失败后保留草稿。

修改：

- `src/app/write-letter-wizard.test.ts`
  - 草稿能恢复为 wizard 状态。
  - 恢复后 `draftDirty = false`。
  - 有正文时可进入校改 / 投寄。

- `src/app/app-model.test.ts`
  - 草稿摘要按更新时间倒序。
  - 草稿摘要显示写法、状态和正文摘要。

必要时修改：

- `src/app/write-letter-service.test.ts`
  - 如果 `saveDraftPaper` 从该文件迁移，需要调整 import。

## 验收标准

- 写信页能看到信纸匣草稿列表。
- 保存新草稿后，列表出现该草稿。
- 点击续写能恢复口述、写法、先生初稿和最终正文。
- 续写后保存会覆盖原草稿，不产生重复草稿。
- 删除草稿后刷新 App 仍保持删除状态。
- 从草稿投寄成功后，草稿从信纸匣消失，钱匣、账本、档案和邮政记录正常更新。
- 从草稿投寄失败后，草稿仍保留。
- 移动端不出现按钮文字挤压或底部导航遮挡关键操作。
- `npm test`、`npm run typecheck`、`npm run build` 通过。

## 文档同步

阶段完成后必须同步：

- `docs/pinganpi-roadmap.md`
  - 当前基线改为阶段 8 草稿管理。
  - 当前进展新增阶段 8。
  - 尚未完成移除草稿管理相关条目。
  - 后续推荐阶段编号顺延，真实时间送达推进成为下一推荐阶段。

- `docs/pinganpi-roadmap-dashboard.html`
  - 当前阶段改为阶段 8。
  - 下一推荐改为真实时间送达推进。
  - 更新测试数量和验证快照。
  - 草稿管理从风险项移到已完成能力。

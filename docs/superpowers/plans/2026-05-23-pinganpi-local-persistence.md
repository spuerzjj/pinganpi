# 平安批本地持久化层实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**目标：** 把当前静态 mock-only App 状态替换为可加载、保存、恢复的本地持久化状态，并保留后续云同步替换空间。

**架构：** 新增 `AppState` 作为本地数据 schema，日期统一存 ISO 字符串，进入领域规则前再转为 `Date`。新增 storage adapter 边界，第一版使用 `localStorage`，测试使用内存实现。`src/domain` 保持纯领域层，不引入浏览器、Capacitor 或存储依赖。

**技术栈：** TypeScript、Vue 3、Vitest、浏览器 `localStorage`、现有 `src/domain` 规则。

---

## 文件结构

- 新增 `src/app/app-state.ts`
  - 定义 `AppState`、`PersistedLetter`、`DraftPaper`、`PostalRecord`、`WalletState`、`LedgerEntry` 等本地 schema。
  - 从当前 mock 数据构造 `createDefaultAppState()`。
  - 提供 `serializeAppState()`、`parseAppState()`、`settleAppState()`。

- 新增 `src/app/app-state-storage.ts`
  - 定义 `KeyValueStorage` 和 `AppStateStore`。
  - 实现 `createAppStateStore()`。
  - 实现浏览器使用的 `createBrowserAppStateStore()`。

- 新增 `src/app/app-state.test.ts`
  - 使用 TDD 覆盖默认加载、保存读取、坏数据回退、schema 不合法回退、钱匣结算持久化。

- 修改 `src/app/mock-data.ts`
  - 保留 seed 数据和基础类型，但让 `createDefaultAppState()` 消费这些 seed。
  - 避免 UI model 继续直接依赖全局 mock-only 状态。

- 修改 `src/app/app-model.ts`
  - `buildAppModel(now, state)` 从 `AppState` 构建 UI model。
  - 保持 `buildAppModel(now)` 兼容现有测试，默认使用已结算的默认 state。
  - 邮政记录优先从 `postalRecords` 汇总，不再只依赖 letter 内部 records。

- 修改 `src/App.vue`
  - 启动时从 `localStorage` 加载 `AppState`。
  - 对钱匣进行一次结算，若状态变化则保存。
  - 用持久化 state 构建页面 model。

- 修改 `src/app/app-model.test.ts`
  - 补充 `buildAppModel()` 能读取自定义持久化 state 的测试。

## 任务 1：定义本地 AppState schema 与默认状态

- [x] **步骤 1：写失败测试**

在 `src/app/app-state.test.ts` 添加测试：

```ts
import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "./app-state.js";

describe("app state", () => {
  it("creates the first local state from seed data", () => {
    const state = createDefaultAppState();

    expect(state.schemaVersion).toBe(1);
    expect(state.currentMemberId).toBe("member-zhou");
    expect(state.recipientMemberId).toBe("member-lan");
    expect(state.members).toHaveLength(2);
    expect(state.wallet.balanceFen).toBe(235);
    expect(state.draftPapers).toEqual([]);
    expect(state.letters.map((letter) => letter.id)).toContain("letter-from-lan-0520");
    expect(state.postalRecords.some((record) => record.letterId === "letter-from-lan-0520")).toBe(true);
  });
});
```

- [x] **步骤 2：运行测试确认失败**

运行：`npm test -- src/app/app-state.test.ts`

预期：失败，提示找不到 `./app-state.js` 或 `createDefaultAppState`。

- [x] **步骤 3：写最小实现**

创建 `src/app/app-state.ts`，定义 schema，并从 `mock-data.ts` 构造默认状态。`PostalRecord` 从旧 mock letter 的 `records` 字符串拆出，保留顺序。

- [x] **步骤 4：运行测试确认通过**

运行：`npm test -- src/app/app-state.test.ts`

预期：新增测试通过。

## 任务 2：实现序列化、解析和坏数据回退

- [x] **步骤 1：写失败测试**

在 `src/app/app-state.test.ts` 增加：

```ts
import { parseAppState, serializeAppState } from "./app-state.js";

it("serializes and parses app state without losing drafts or letters", () => {
  const state = createDefaultAppState();
  state.draftPapers.push({
    id: "draft-1",
    authorMemberId: "member-zhou",
    recipientMemberId: "member-lan",
    createdAtIso: "2026-05-23T10:00:00.000+08:00",
    updatedAtIso: "2026-05-23T10:30:00.000+08:00",
    oralText: "今日先存一纸。",
    scribeId: "scribe-xu",
    scribeDraft: "兰卿：今日先存一纸。",
    finalText: "兰卿：今日先存一纸。",
    status: "draft"
  });

  const parsed = parseAppState(serializeAppState(state));

  expect(parsed?.draftPapers[0]?.oralText).toBe("今日先存一纸。");
  expect(parsed?.letters).toHaveLength(state.letters.length);
});

it("returns null for corrupt or invalid stored state", () => {
  expect(parseAppState("{bad json")).toBeNull();
  expect(parseAppState(JSON.stringify({ schemaVersion: 1, wallet: null }))).toBeNull();
});
```

- [x] **步骤 2：运行测试确认失败**

运行：`npm test -- src/app/app-state.test.ts`

预期：失败，提示 `parseAppState` 或 `serializeAppState` 不存在。

- [x] **步骤 3：写最小实现**

在 `src/app/app-state.ts` 中实现：

- `serializeAppState(state): string`
- `parseAppState(raw): AppState | null`
- 必要的 type guard，检查 `schemaVersion`、数组字段、wallet 数值和日期字符串。

- [x] **步骤 4：运行测试确认通过**

运行：`npm test -- src/app/app-state.test.ts`

预期：所有 app-state 测试通过。

## 任务 3：实现 storage adapter

- [x] **步骤 1：写失败测试**

在 `src/app/app-state.test.ts` 增加内存存储测试：

```ts
import { createAppStateStore, createMemoryKeyValueStorage } from "./app-state-storage.js";

it("loads defaults, saves state, and reloads saved state", () => {
  const storage = createMemoryKeyValueStorage();
  const store = createAppStateStore(storage);

  const firstLoad = store.load();
  firstLoad.wallet.balanceFen = 199;
  store.save(firstLoad);

  const secondLoad = store.load();

  expect(secondLoad.wallet.balanceFen).toBe(199);
});

it("falls back to defaults when stored data is corrupt", () => {
  const storage = createMemoryKeyValueStorage();
  storage.setItem("pinganpi.app-state.v1", "{bad json");

  const store = createAppStateStore(storage);

  expect(store.load().wallet.balanceFen).toBe(235);
});
```

- [x] **步骤 2：运行测试确认失败**

运行：`npm test -- src/app/app-state.test.ts`

预期：失败，提示找不到 `./app-state-storage.js`。

- [x] **步骤 3：写最小实现**

创建 `src/app/app-state-storage.ts`：

- `APP_STATE_STORAGE_KEY = "pinganpi.app-state.v1"`
- `KeyValueStorage`
- `createMemoryKeyValueStorage()`
- `createAppStateStore(storage, key?)`
- `createBrowserAppStateStore()`

- [x] **步骤 4：运行测试确认通过**

运行：`npm test -- src/app/app-state.test.ts`

预期：所有 app-state 测试通过。

## 任务 4：实现钱匣结算持久化

- [x] **步骤 1：写失败测试**

在 `src/app/app-state.test.ts` 增加：

```ts
import { settleAppState } from "./app-state.js";

it("settles wallet into persistent ledger entries", () => {
  const state = createDefaultAppState();

  const result = settleAppState(state, new Date("2026-05-23T04:00:00.000Z"));

  expect(result.changed).toBe(true);
  expect(result.state.wallet.balanceFen).toBe(230);
  expect(result.state.wallet.lastSettledAtIso).toBe("2026-05-23T04:00:00.000Z");
  expect(result.state.ledgerEntries.at(-1)).toMatchObject({
    kind: "living_cost",
    amountFen: -5,
    note: "饭食杂用一日"
  });
});
```

- [x] **步骤 2：运行测试确认失败**

运行：`npm test -- src/app/app-state.test.ts`

预期：失败，提示 `settleAppState` 不存在。

- [x] **步骤 3：写最小实现**

在 `src/app/app-state.ts` 中调用 `settleWallet()`，把结算结果写回 wallet，并把新 ledger entries 追加到 `state.ledgerEntries`。

- [x] **步骤 4：运行测试确认通过**

运行：`npm test -- src/app/app-state.test.ts`

预期：所有 app-state 测试通过。

## 任务 5：改造 AppModel 读取持久化状态

- [x] **步骤 1：写失败测试**

在 `src/app/app-model.test.ts` 增加：

```ts
import { createDefaultAppState, settleAppState } from "./app-state.js";

it("builds the UI model from a persisted app state", () => {
  const now = new Date("2026-05-23T04:00:00.000Z");
  const state = settleAppState(createDefaultAppState(), now).state;
  state.wallet.balanceFen = 88;
  state.ledgerEntries.push({
    id: "ledger-test",
    atIso: "2026-05-23T04:00:00.000Z",
    kind: "postage",
    amountFen: -8,
    note: "平信邮票"
  });

  const model = buildAppModel(now, state);

  expect(model.wallet.balanceText).toBe("8 角 8 分");
  expect(model.wallet.ledgerPreview[0]).toEqual({
    amountText: "-8 分",
    note: "平信邮票"
  });
});
```

- [x] **步骤 2：运行测试确认失败**

运行：`npm test -- src/app/app-model.test.ts`

预期：失败，因为 `buildAppModel()` 还不接受持久化 state，且 ledger 仍来自即时结算。

- [x] **步骤 3：写最小实现**

修改 `src/app/app-model.ts`：

- 导入 `AppState` 和 `createDefaultAppState`、`settleAppState`。
- `buildAppModel(now = new Date(), state = settleAppState(createDefaultAppState(), now).state)`。
- 成员、先生、信件、邮政记录、钱匣都从 state 读取。
- `ledgerPreview` 使用 `state.ledgerEntries` 倒序截取最近条目。

- [x] **步骤 4：运行测试确认通过**

运行：`npm test -- src/app/app-model.test.ts`

预期：app-model 测试通过。

## 任务 6：接入 Vue App 启动加载与保存

- [x] **步骤 1：写失败类型检查预期**

运行：`npm run typecheck`

预期：当前通过；作为改造前基线。

- [x] **步骤 2：修改实现**

修改 `src/App.vue`：

- 导入 `createBrowserAppStateStore` 和 `settleAppState`。
- 启动时 `store.load()`。
- 使用当前时间结算钱匣。
- 若 `settleAppState()` 返回 `changed: true`，调用 `store.save()`。
- 用已结算 state 构建 `computed` model。

- [x] **步骤 3：运行类型检查**

运行：`npm run typecheck`

预期：通过。

## 任务 7：全量验证与文档同步

- [x] **步骤 1：运行测试**

运行：`npm test`

预期：所有测试通过。

- [x] **步骤 2：运行类型检查**

运行：`npm run typecheck`

预期：通过。

- [x] **步骤 3：运行构建**

运行：`npm run build`

预期：构建通过；Varlet 首包超过 500 KB 的 warning 仍可接受。

- [x] **步骤 4：更新路线图**

修改 `docs/pinganpi-roadmap.md`，将阶段 4 标记为已完成本地存储基础，并保留写信主流程、模板代书、真实送达推进为后续阶段。

- [x] **步骤 5：最终状态检查**

运行：`git status --short --branch`

预期：只出现本阶段相关文件变更。

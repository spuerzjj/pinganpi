# 共享领域核心迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有纯领域规则迁移到 `shared/domain/`，让微信小程序和旧 App 都能复用同一套时间、钱匣、代笔先生、邮资、送达和状态机规则。

**Architecture:** `shared/domain/` 成为领域规则真实实现位置；`src/domain/` 保留为兼容 re-export，避免旧 App 一次性改动大量 import。小程序新增一个轻量 service 直接从 `shared/domain` 读取格式化日期、钱额和邮资示例，用测试证明小程序侧能复用共享规则。

**Tech Stack:** TypeScript、Vitest、微信原生小程序 TypeScript、现有 NodeNext 模块解析。

---

## Scope

本计划对应路线图阶段 23：共享领域核心迁移。

本阶段包含：

- 新增 `shared/domain/` 并迁入领域规则实现。
- 保留 `src/domain/` 作为兼容 re-export 和旧测试入口。
- 让小程序 TypeScript 配置包含 `shared/**/*.ts`。
- 新增小程序 service 直接使用共享领域核心。
- 更新小程序今日页展示共享规则产物。
- 更新 roadmap / dashboard / AGENTS 的阶段 23 状态和验证基线。

本阶段不包含：

- 不迁移 `src/app/` 业务服务。
- 不迁移同步模型。
- 不接真实云函数。
- 不改变任何领域规则行为。
- 不删除旧 `src/domain` 测试。

## File Structure

Create:

- `shared/domain/china-calendar.ts`
- `shared/domain/time.ts`
- `shared/domain/money.ts`
- `shared/domain/scribes.ts`
- `shared/domain/wallet.ts`
- `shared/domain/postal.ts`
- `shared/domain/index.ts`
- `miniprogram/services/domain-summary.ts`
- `miniprogram/services/domain-summary.test.ts`

Modify:

- `src/domain/china-calendar.ts`
- `src/domain/time.ts`
- `src/domain/money.ts`
- `src/domain/scribes.ts`
- `src/domain/wallet.ts`
- `src/domain/postal.ts`
- `src/domain/index.ts`
- `miniprogram/pages/today/index.ts`
- `tsconfig.json`
- `tsconfig.miniprogram.json`
- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`
- `AGENTS.md`

## Task 1: 迁移领域实现到 shared/domain

**Files:**
- Create: `shared/domain/*.ts`
- Modify: `src/domain/*.ts`
- Modify: `tsconfig.json`
- Modify: `tsconfig.miniprogram.json`

- [ ] **Step 1: 复制现有领域实现到 `shared/domain/`**

Run:

```bash
mkdir -p shared/domain
cp src/domain/china-calendar.ts shared/domain/china-calendar.ts
cp src/domain/time.ts shared/domain/time.ts
cp src/domain/money.ts shared/domain/money.ts
cp src/domain/scribes.ts shared/domain/scribes.ts
cp src/domain/wallet.ts shared/domain/wallet.ts
cp src/domain/postal.ts shared/domain/postal.ts
cp src/domain/index.ts shared/domain/index.ts
```

Expected: `shared/domain/` contains the same implementation files as `src/domain/`.

- [ ] **Step 2: 将 `src/domain` 改为兼容 re-export**

Replace `src/domain/china-calendar.ts` with:

```ts
export * from "../../shared/domain/china-calendar.js";
```

Replace `src/domain/time.ts` with:

```ts
export * from "../../shared/domain/time.js";
```

Replace `src/domain/money.ts` with:

```ts
export * from "../../shared/domain/money.js";
```

Replace `src/domain/scribes.ts` with:

```ts
export * from "../../shared/domain/scribes.js";
```

Replace `src/domain/wallet.ts` with:

```ts
export * from "../../shared/domain/wallet.js";
```

Replace `src/domain/postal.ts` with:

```ts
export * from "../../shared/domain/postal.js";
```

Replace `src/domain/index.ts` with:

```ts
export * from "../../shared/domain/index.js";
```

- [ ] **Step 3: 更新 TypeScript include**

Modify `tsconfig.json` include list to add:

```json
"shared/**/*.ts"
```

The include array should contain:

```json
[
  "src/**/*.ts",
  "src/**/*.vue",
  "server/**/*.ts",
  "shared/**/*.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "capacitor.config.ts"
]
```

Modify `tsconfig.miniprogram.json` include list to:

```json
["miniprogram/**/*.ts", "miniprogram/**/*.d.ts", "shared/**/*.ts"]
```

- [ ] **Step 4: 运行旧领域测试和类型检查**

Run:

```bash
npm test -- src/domain
npm run typecheck
npm run miniprogram:typecheck
```

Expected:

- Old `src/domain` tests still pass through re-export shims.
- Vue / server typecheck still passes.
- Miniprogram typecheck passes with `shared/**/*.ts` included.

- [ ] **Step 5: 提交任务 1**

```bash
git add shared/domain src/domain tsconfig.json tsconfig.miniprogram.json
git commit -m "refactor(domain): 迁移领域规则到共享核心"
```

## Task 2: 小程序接入共享领域核心

**Files:**
- Create: `miniprogram/services/domain-summary.ts`
- Create: `miniprogram/services/domain-summary.test.ts`
- Modify: `miniprogram/pages/today/index.ts`

- [ ] **Step 1: 写小程序共享领域 service 测试**

Create `miniprogram/services/domain-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTodayDomainSummary } from "./domain-summary.js";

describe("miniprogram domain summary", () => {
  it("uses shared domain rules for the today page", () => {
    expect(createTodayDomainSummary(new Date(Date.UTC(2026, 4, 23, 12, 0, 0)))).toEqual({
      eraDateText: "一九六〇年五月二十三日",
      presentDateText: "今时对应：2026 年 5 月 23 日",
      localPostageText: "4 分",
      registeredPostageText: "1 角 2 分"
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- miniprogram/services/domain-summary.test.ts
```

Expected: FAIL because `miniprogram/services/domain-summary.ts` does not exist.

- [ ] **Step 3: 实现小程序共享领域 service**

Create `miniprogram/services/domain-summary.ts`:

```ts
import { calculatePostage, formatEraDate, formatFen, formatPresentCorrespondence } from "../../shared/domain/index.js";

export interface TodayDomainSummary {
  readonly eraDateText: string;
  readonly presentDateText: string;
  readonly localPostageText: string;
  readonly registeredPostageText: string;
}

export function createTodayDomainSummary(now: Date): TodayDomainSummary {
  return {
    eraDateText: formatEraDate(now),
    presentDateText: formatPresentCorrespondence(now),
    localPostageText: formatFen(
      calculatePostage({
        local: true,
        registered: false,
        hasPhoto: false
      })
    ),
    registeredPostageText: formatFen(
      calculatePostage({
        local: true,
        registered: true,
        hasPhoto: false
      })
    )
  };
}
```

- [ ] **Step 4: 更新今日页面使用共享 service**

Replace `miniprogram/pages/today/index.ts` with:

```ts
import { createTodayDomainSummary } from "../../services/domain-summary.js";

const todaySummary = createTodayDomainSummary(new Date());

Page({
  data: {
    kicker: "平安批 / 今日",
    title: todaySummary.eraDateText,
    body: `${todaySummary.presentDateText}。本埠平信邮资 ${todaySummary.localPostageText}，挂号信 ${todaySummary.registeredPostageText}。`
  }
});
```

- [ ] **Step 5: 运行测试和小程序类型检查**

Run:

```bash
npm test -- miniprogram/services/domain-summary.test.ts
npm run miniprogram:typecheck
```

Expected:

- `miniprogram/services/domain-summary.test.ts` PASS.
- `npm run miniprogram:typecheck` PASS.

- [ ] **Step 6: 提交任务 2**

```bash
git add miniprogram/services/domain-summary.ts miniprogram/services/domain-summary.test.ts miniprogram/pages/today/index.ts
git commit -m "feat(miniprogram): 接入共享领域摘要"
```

## Task 3: 文档与路线图同步

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 `docs/pinganpi-roadmap.md`**

Change stage 23 row to:

```markdown
| 23 | 共享领域核心迁移 | 已完成基础 | 已新增 `shared/domain/` 作为领域规则真实实现，`src/domain/` 保留兼容 re-export，小程序今日页已直接使用共享领域摘要。 |
```

Change current target to stage 24:

```markdown
**本期目标：** 阶段 23 已完成共享领域核心迁移。下一步进入阶段 24：在小程序里接入本地 mock App 状态，补齐今日、写信、先生、钱匣、信箱 / 档案的本地核心界面。
```

Add verification lines:

```markdown
- `npm test -- src/domain`：通过，旧领域测试通过 `src/domain` re-export 验证共享核心行为未变。
- `npm test -- miniprogram/services/domain-summary.test.ts`：通过，确认小程序可直接使用 `shared/domain`。
- `npm run miniprogram:typecheck`：通过。
```

- [ ] **Step 2: 更新 `docs/pinganpi-roadmap-dashboard.html`**

Update top metric:

```html
<p class="metric-value">本地界面</p>
<p class="metric-note">进入阶段 24：把小程序页面从骨架推进到本地 mock 核心界面。</p>
```

Mark phase 23 as done and phase 24 as next:

```html
<div class="phase done">
  <span class="phase-number">23</span>
  <span class="phase-title">共享核心</span>
</div>
<div class="phase next">
  <span class="phase-number">24</span>
  <span class="phase-title">小程序界面</span>
</div>
```

Add verification snapshot:

```html
<li><code>npm test -- miniprogram/services/domain-summary.test.ts</code> 已通过，小程序可直接使用 <code>shared/domain</code>。</li>
```

- [ ] **Step 3: 更新 `AGENTS.md`**

Add current state:

```markdown
阶段 23 已完成共享领域核心迁移：`shared/domain/` 是领域规则真实实现位置，`src/domain/` 保留兼容 re-export，小程序今日页已通过 `miniprogram/services/domain-summary.ts` 使用共享规则。
```

Update recommended next step to stage 24.

- [ ] **Step 4: 运行文档检查**

Run:

```bash
git diff --check
rg -n "阶段 23|shared/domain|阶段 24" docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md
```

Expected:

- `git diff --check` has no output.
- `rg` confirms all three docs mention stage 23 shared domain completion and stage 24 next.

- [ ] **Step 5: 提交任务 3**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md
git commit -m "docs(miniprogram): 收口共享领域核心迁移"
```

## Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused verification**

```bash
npm test -- src/domain
npm test -- miniprogram/services/domain-summary.test.ts
npm run miniprogram:typecheck
git diff --check
```

Expected:

- Domain tests pass.
- Miniprogram shared-domain test passes.
- Miniprogram typecheck passes.
- `git diff --check` has no output.

- [ ] **Step 2: Run broad verification**

```bash
npm test
npm run typecheck
```

Expected:

- Existing Vitest suite passes.
- Existing Vue / server TypeScript check passes.

- [ ] **Step 3: Inspect git status**

```bash
git status --short --branch
```

Expected: the branch is `codex/wechat-miniprogram-pivot` and only intended committed changes are present.

## Execution Notes

- Preserve behavior exactly. Do not edit copied domain implementation unless tests expose a path issue.
- Keep `src/domain` imports working for旧 App code and tests.
- Do not move `src/app` services in this stage.
- Do not use CloudBase or微信 APIs in `shared/domain`.

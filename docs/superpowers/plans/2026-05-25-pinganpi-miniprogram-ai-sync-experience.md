# Pinganpi Miniprogram AI And Sync Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐阶段 27：让微信小程序写信页接入 AI 起稿，展示同步状态，并完成小程序端流式可行性专项验证。

**Architecture:** 小程序端只通过 `wx.cloud.callFunction` 调用 `pinganpi-ai` 和 `pinganpi-sync`，不直接持有 MiMo key，不调用本地 proxy。阶段 27 先保证非流式 AI 起稿可用；流式输出作为专项 spike，若微信小程序 / CloudBase event 云函数不适合 SSE，则保留非流式并提供明确等待反馈。同步状态只展示低调状态，不把产品改成现代在线聊天。

**Tech Stack:** 微信原生小程序、TypeScript、CloudBase event 云函数、Vitest、微信开发者工具自动化。

---

## Files

- Modify: `apps/miniprogram/services/write-flow.ts`
- Create: `apps/miniprogram/services/ai-scribe-cloud.ts`
- Test: `apps/miniprogram/services/ai-scribe-cloud.test.ts`
- Modify: `apps/miniprogram/pages/write/index.ts`
- Modify: `apps/miniprogram/pages/write/index.wxml`
- Modify: `apps/miniprogram/pages/write/index.wxss`
- Create: `apps/miniprogram/services/sync-status.ts`
- Test: `apps/miniprogram/services/sync-status.test.ts`
- Modify: `apps/miniprogram/pages/today/index.ts`
- Modify: `apps/miniprogram/pages/today/index.wxml`
- Modify: `tools/scripts/miniprogram-devtools-automator.cjs`
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `tools/roadmap-viewer/src/roadmap-data.json`
- Modify: `AGENTS.md`

## Task 1: 小程序 AI 起稿服务

- [x] 新增 `apps/miniprogram/services/ai-scribe-cloud.ts`，封装 `callPinganpiAi("scribeDraft", payload)`。
- [x] 请求 payload 只包含代笔所需字段：口述、先生、寄信人 / 收信人展示名、城市、邮路、信件类型；不包含真实 key、完整 prompt 或 provider 原始响应。
- [x] 新增 `apps/miniprogram/services/ai-scribe-cloud.test.ts`，覆盖成功映射、云函数失败归一、malformed response。
- [x] 运行 `npm test -- apps/miniprogram/services/ai-scribe-cloud.test.ts`。

验收：

- 成功返回可用于写信页的 `draftText`。
- 失败返回受控错误，页面不会回退模板正文。

## Task 2: 写信页接入非流式 AI 起稿

- [x] 扩展 `WriteFlowModel`：增加 `draftStatus`、`draftErrorText`、`draftSource`、`generationMeta`。
- [x] 保留本地 `generateLocalDraft` 作为测试或 fallback helper，但页面默认走 AI 起稿服务。
- [x] `onGenerateDraft` 改为 async：pending 时禁用“请先生起稿 / 下一步 / 本地投寄”。
- [x] AI 成功后进入校改步骤；AI 失败时停留在起稿步骤，保留口述，不生成模板正文。
- [x] 增加页面文案：`先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。`
- [x] 更新 `apps/miniprogram/services/write-flow.test.ts`，覆盖 pending、成功、失败、口述变更后旧稿失效。
- [x] 运行 `npm test -- apps/miniprogram/services/write-flow.test.ts apps/miniprogram/services/ai-scribe-cloud.test.ts`。

验收：

- AI 失败不能进入校改或投寄。
- 用户仍可手工修改 AI 起稿后的正文。
- 不绕过费用校验、钱匣余额和邮政规则。

## Task 3: 小程序同步状态展示

- [x] 新增 `apps/miniprogram/services/sync-status.ts`，定义 `idle`、`syncing`、`synced`、`failed`、`offlineRequired` 等小程序展示状态。
- [x] 通过 `callPinganpiSync("health")` 或轻量 pull 形成低风险状态检查。
- [x] 今日页展示低调同步状态：环境、最近同步时间、失败原因摘要。
- [x] 不展示现代在线状态、实时聊天状态或详细物流进度。
- [x] 新增 `apps/miniprogram/services/sync-status.test.ts`，覆盖状态文案、失败归一和不暴露原始异常。
- [x] 运行 `npm test -- apps/miniprogram/services/sync-status.test.ts`。

验收：

- 用户能知道当前是否已同步。
- 错误提示克制，不泄露云函数原始堆栈、token 或敏感正文。

## Task 4: 小程序流式专项验证

- [x] 记录微信小程序端是否能消费 CloudBase event 云函数的流式响应。
- [x] 若不可行，不强行模拟 SSE；保留非流式 AI 起稿，并在页面用“先生正在起稿”状态承接等待。
- [x] 若可行，另开阶段或子任务实现受控流式，不在本任务里改变投寄规则。
- [x] 将结论写入 `docs/pinganpi-roadmap.md` 和本计划的执行记录。

验收：

- 阶段 27 结束时必须明确：小程序端流式是否纳入当期实现。

## Task 5: DevTools 与云函数验证

- [x] 更新 `tools/scripts/miniprogram-devtools-automator.cjs` 的 `flow`：覆盖写信 AI 起稿成功路径的低风险检查；不要点击真实投寄。
- [x] 若需要避免真实 MiMo 额度消耗，可通过测试桩或 dev-only fake payload 做自动化；真实 MiMo 起稿只做一次人工 smoke。
- [x] 运行可自动完成的验证：

```bash
npm test
npm run miniprogram:check
npm run cloudbase:build:miniprogram
npm run miniprogram:devtools:flow
git diff --check
```

验收：

- DevTools flow 覆盖写信页 AI 起稿状态。
- 云函数构建通过。
- 不触发上传、发布、真机预览或审核提交。

## Task 6: 文档收口

- [x] 更新 `docs/pinganpi-roadmap.md`：阶段 27 状态、验证基线、流式结论、剩余风险。
- [x] 更新 `tools/roadmap-viewer/src/roadmap-data.json`：当前阶段、下一阶段、风险和验证状态。
- [x] 更新 `AGENTS.md`：阶段 27 最新边界、必跑验证和 DevTools 触发规则。
- [x] 如阶段状态变化，更新 Roadmap Viewer 数据源；旧 `docs/pinganpi-roadmap-dashboard.html` 已删除，不再维护。
- [ ] 提交消息使用 `feat(miniprogram): 接入 AI 起稿与同步状态` 或按实际拆分使用更小 Conventional Commits。

## 执行记录

- 2026-05-30：小程序 AI 起稿 service 已完成，成功响应把服务端 `scribeDraft` 映射为 `draftText`；云函数失败和畸形响应统一为受控错误，不暴露 prompt、key 或 provider 原始响应。
- 2026-05-30：写信页默认走非流式 AI 起稿；pending 状态禁用起稿、下一步和投寄；失败停留在起稿步骤并保留口述，不回退本地模板正文。
- 2026-05-30：今日页新增“同步簿”，通过 `pinganpi-sync/health` 做低风险云端查验；失败文案不暴露云函数原始异常。
- 2026-05-30：流式结论为“不纳入阶段 27”。原因是小程序主链路使用 CloudBase event 云函数 `wx.cloud.callFunction`，当前不按浏览器 SSE 分片消费；若后续恢复流式，应另开专项评估 HTTP 云函数 / CloudBase Run + `wx.request`。
- 2026-05-30：DevTools flow 已改为云函数测试桩，拦截 `pinganpi-ai/scribeDraft` 和 `pinganpi-sync/health`，覆盖 AI 成功路径且不消耗真实 MiMo 额度；真实 MiMo 起稿保留到阶段 29 人工 smoke。
- 2026-05-30：最终审查发现 AI 起稿 pending 时仍可后退的轻微 UX 边界；已补 `canNavigateBack` 并禁用 pending 后退，避免异步回包把用户从上一步带回校改。
- 2026-05-30：DevTools flow 首次输出 `ok: true` 后进程未自动退出；已修复脚本主流程完成后显式退出，并重新验证 `npm run miniprogram:devtools:flow` 可干净返回 0。
- 2026-05-30：验证已通过 `npm test`、`npm run miniprogram:check`、`npm run typecheck`、`npm run cloudbase:build:miniprogram`、`npm run roadmap:build`、`npm run structure:audit`、`node --check tools/scripts/miniprogram-devtools-automator.cjs`、`npm run miniprogram:devtools:flow` 和 `git diff --check`。

# Pinganpi Miniprogram AI And Sync Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐阶段 27：让微信小程序写信页接入 AI 起稿，展示同步状态，并完成小程序端流式可行性专项验证。

**Architecture:** 小程序端只通过 `wx.cloud.callFunction` 调用 `pinganpi-ai` 和 `pinganpi-sync`，不直接持有 MiMo key，不调用本地 proxy。阶段 27 先保证非流式 AI 起稿可用；流式输出作为专项 spike，若微信小程序 / CloudBase event 云函数不适合 SSE，则保留非流式并提供明确等待反馈。同步状态只展示低调状态，不把产品改成现代在线聊天。

**Tech Stack:** 微信原生小程序、TypeScript、CloudBase event 云函数、Vitest、微信开发者工具自动化。

---

## Files

- Modify: `miniprogram/services/write-flow.ts`
- Create: `miniprogram/services/ai-scribe-cloud.ts`
- Test: `miniprogram/services/ai-scribe-cloud.test.ts`
- Modify: `miniprogram/pages/write/index.ts`
- Modify: `miniprogram/pages/write/index.wxml`
- Modify: `miniprogram/pages/write/index.wxss`
- Create: `miniprogram/services/sync-status.ts`
- Test: `miniprogram/services/sync-status.test.ts`
- Modify: `miniprogram/pages/today/index.ts`
- Modify: `miniprogram/pages/today/index.wxml`
- Modify: `scripts/miniprogram-devtools-automator.cjs`
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `roadmap-viewer/src/roadmap-data.json`
- Modify: `AGENTS.md`

## Task 1: 小程序 AI 起稿服务

- [ ] 新增 `miniprogram/services/ai-scribe-cloud.ts`，封装 `callPinganpiAi("scribeDraft", payload)`。
- [ ] 请求 payload 只包含代笔所需字段：口述、先生、寄信人 / 收信人展示名、城市、邮路、信件类型；不包含真实 key、完整 prompt 或 provider 原始响应。
- [ ] 新增 `miniprogram/services/ai-scribe-cloud.test.ts`，覆盖成功映射、云函数失败归一、malformed response。
- [ ] 运行 `npm test -- miniprogram/services/ai-scribe-cloud.test.ts`。

验收：

- 成功返回可用于写信页的 `draftText`。
- 失败返回受控错误，页面不会回退模板正文。

## Task 2: 写信页接入非流式 AI 起稿

- [ ] 扩展 `WriteFlowModel`：增加 `draftStatus`、`draftErrorText`、`draftSource`、`generationMeta`。
- [ ] 保留本地 `generateLocalDraft` 作为测试或 fallback helper，但页面默认走 AI 起稿服务。
- [ ] `onGenerateDraft` 改为 async：pending 时禁用“请先生起稿 / 下一步 / 本地投寄”。
- [ ] AI 成功后进入校改步骤；AI 失败时停留在起稿步骤，保留口述，不生成模板正文。
- [ ] 增加页面文案：`先生暂未起成稿，口述已留在信纸上，稍后可再请先生起稿。`
- [ ] 更新 `miniprogram/services/write-flow.test.ts`，覆盖 pending、成功、失败、口述变更后旧稿失效。
- [ ] 运行 `npm test -- miniprogram/services/write-flow.test.ts miniprogram/services/ai-scribe-cloud.test.ts`。

验收：

- AI 失败不能进入校改或投寄。
- 用户仍可手工修改 AI 起稿后的正文。
- 不绕过费用校验、钱匣余额和邮政规则。

## Task 3: 小程序同步状态展示

- [ ] 新增 `miniprogram/services/sync-status.ts`，定义 `idle`、`syncing`、`synced`、`failed`、`offlineRequired` 等小程序展示状态。
- [ ] 通过 `callPinganpiSync("health")` 或轻量 pull 形成低风险状态检查。
- [ ] 今日页展示低调同步状态：环境、最近同步时间、失败原因摘要。
- [ ] 不展示现代在线状态、实时聊天状态或详细物流进度。
- [ ] 新增 `miniprogram/services/sync-status.test.ts`，覆盖状态文案、失败归一和不暴露原始异常。
- [ ] 运行 `npm test -- miniprogram/services/sync-status.test.ts`。

验收：

- 用户能知道当前是否已同步。
- 错误提示克制，不泄露云函数原始堆栈、token 或敏感正文。

## Task 4: 小程序流式专项验证

- [ ] 记录微信小程序端是否能消费 CloudBase event 云函数的流式响应。
- [ ] 若不可行，不强行模拟 SSE；保留非流式 AI 起稿，并在页面用“先生正在起稿”状态承接等待。
- [ ] 若可行，另开阶段或子任务实现受控流式，不在本任务里改变投寄规则。
- [ ] 将结论写入 `docs/pinganpi-roadmap.md` 和本计划的执行记录。

验收：

- 阶段 27 结束时必须明确：小程序端流式是否纳入当期实现。

## Task 5: DevTools 与云函数验证

- [ ] 更新 `scripts/miniprogram-devtools-automator.cjs` 的 `flow`：覆盖写信 AI 起稿成功路径的低风险检查；不要点击真实投寄。
- [ ] 若需要避免真实 MiMo 额度消耗，可通过测试桩或 dev-only fake payload 做自动化；真实 MiMo 起稿只做一次人工 smoke。
- [ ] 运行：

```bash
npm test
npm run miniprogram:check
npm run cloudbase:build:miniprogram
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:flow
git diff --check
```

验收：

- DevTools flow 覆盖写信页 AI 起稿状态。
- 云函数构建通过。
- 不触发上传、发布、真机预览或审核提交。

## Task 6: 文档收口

- [ ] 更新 `docs/pinganpi-roadmap.md`：阶段 27 状态、验证基线、流式结论、剩余风险。
- [ ] 更新 `roadmap-viewer/src/roadmap-data.json`：当前阶段、下一阶段、风险和验证状态。
- [ ] 更新 `AGENTS.md`：阶段 27 最新边界、必跑验证和 DevTools 触发规则。
- [ ] 如阶段状态变化，更新 Roadmap Viewer 数据源；旧 `docs/pinganpi-roadmap-dashboard.html` 已删除，不再维护。
- [ ] 提交消息使用 `feat(miniprogram): 接入 AI 起稿与同步状态` 或按实际拆分使用更小 Conventional Commits。

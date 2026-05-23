# 平安批写信主流程实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**目标：** 实现第一版本地写信流程：口述、代笔初稿、手工校改、存草稿、封缄投寄、扣款、记账、生成信件和邮政记录。

**架构：** 新增纯 TypeScript 写信服务，接受 `AppState` 和输入，返回新的 `AppState`，不直接操作 UI 或 storage。Vue 页面只负责表单和事件，`App.vue` 负责调用服务并保存状态。费用、出勤、邮资、信件状态继续复用 `src/domain`。

**技术栈：** TypeScript、Vue 3、Vitest、Tailwind CSS、Varlet、现有本地持久化 `AppState`。

---

## 范围

本阶段实现：

- 选择当天在场代笔先生或亲笔。
- 输入口述内容。
- 生成第一版先生初稿。
- 手工校改最终正文。
- 存为本地草稿。
- 普通信 / 挂号信费用计算。
- 校验余额，不允许赊账。
- 封缄投寄后扣款、记账、生成 `letters` 和 `postalRecords`。

本阶段不实现：

- 照片附件。
- 云同步。
- 正式可替换模板引擎边界。
- 真实送达时间推进。
- 草稿列表管理页面。

## 任务

- [x] 新增 `src/app/write-letter-service.test.ts`，先覆盖保存草稿、成功投寄、余额不足阻止、先生未到阻止。
- [x] 新增 `src/app/write-letter-service.ts`，实现纯状态变更函数。
- [x] 扩展 `src/app/app-model.ts` 的写信页 model，暴露可选先生、默认口述、默认初稿、费用说明。
- [x] 改造 `src/app/pages/WriteLetterPage.vue` 为真实表单，发出 `save-draft` 和 `post-letter` 事件。
- [x] 改造 `src/App.vue`，调用写信服务并保存本地状态。
- [x] 更新 `docs/pinganpi-roadmap.md`。
- [x] 运行 `npm test`、`npm run typecheck`、`npm run build`。

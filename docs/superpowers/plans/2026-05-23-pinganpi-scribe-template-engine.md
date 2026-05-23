# 平安批模板代书引擎实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**目标：** 增加第一版非 AI 模板代书引擎，让不同代笔先生生成风格可感知不同的草稿，并保存生成来源与元数据。

**架构：** 新增 `src/app/scribe-template-engine.ts` 作为可替换边界。写信服务只调用模板引擎，不再内置代书模板。`AppState` 中的草稿和信件保存 `draftSource`、`readAloudText`、`generationMeta`，为后续 AI 迁移预留结构。

**技术栈：** TypeScript、Vitest、现有 `AppState`、现有 `Scribe` 模型。

---

## 任务

- [x] 新增 `src/app/scribe-template-engine.test.ts`，覆盖不同先生风格、口述保留、场景标签、生成元数据。
- [x] 新增 `src/app/scribe-template-engine.ts`，实现 `generateScribeDraft()`。
- [x] 扩展 `DraftPaper` 和 `PersistedLetter`，保存 `draftSource`、`readAloudText`、`generationMeta`。
- [x] 改造 `write-letter-service.ts`，用模板引擎替代内置 switch。
- [x] 补充 `write-letter-service.test.ts`，验证草稿和投寄信件保存生成元数据。
- [x] 更新 `docs/pinganpi-roadmap.md`。
- [x] 运行 `npm test`、`npm run typecheck`、`npm run build`。

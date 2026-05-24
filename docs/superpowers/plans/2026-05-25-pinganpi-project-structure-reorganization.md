# Pinganpi Project Structure Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将仓库整理成清晰的 apps / packages / services / tools 分区，让后续 agent 能明确判断当前主线、旧 App、共享领域、云函数和工具脚本的边界。

**Architecture:** 保留根目录统一 `package.json` 和统一 npm 命令，不引入 workspace。通过物理目录迁移、路径修正、结构文档和自动审计脚本完成治理。

**Tech Stack:** TypeScript、Vue / Vite、微信原生小程序、CloudBase、Vitest、Capacitor。

---

## Tasks

- [x] 创建治理 worktree：`codex/project-structure-governance`。
- [x] 迁移小程序主线到 `apps/miniprogram/`。
- [x] 迁移旧 Vue / Capacitor App 到 `apps/legacy-capacitor/`。
- [x] 迁移共享领域到 `packages/domain/src/`，保留小程序根内副本 `apps/miniprogram/shared/domain/`。
- [x] 迁移服务端模块到 `services/`。
- [x] 迁移脚本到 `tools/scripts/`。
- [x] 迁移 Roadmap Viewer 到 `tools/roadmap-viewer/`。
- [x] 更新 `package.json`、`tsconfig.json`、`tsconfig.miniprogram.json`、`vitest.config.ts`、`capacitor.config.ts` 和 `.gitignore`。
- [x] 新增 `docs/project-structure.md`。
- [x] 新增 `tools/scripts/audit-project-structure.ts` 和测试，覆盖新分区存在、旧顶层目录 / 入口缺失和关键脚本配置。
- [x] 新增 `npm run structure:audit`。
- [x] 同步更新 `AGENTS.md`、`docs/pinganpi-roadmap.md`、`docs/agent-collaboration.md`、阶段 27 计划和 Roadmap Viewer 数据。
- [x] 新增治理审查记录 `docs/governance-reviews/2026-05-25-project-structure-governance.md`。

## Verification

收口时必须运行：

```bash
npm run structure:audit
npm test
npm run miniprogram:check
npm run typecheck
npm run build
npm run cap:sync
npm run cap:doctor
npm run roadmap:build
npm run cloudbase:build:miniprogram
git diff --check
```

本次不默认运行微信开发者工具自动化，因为没有改小程序页面、WXML、WXSS、页面路由或产品交互；只修改打开路径和脚本位置。

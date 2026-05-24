# Roadmap Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个独立于旧 Vue App 和微信小程序的 Vue Roadmap Viewer，用于日常查看《平安批》开发进度。

**Architecture:** Viewer 放在 `roadmap-viewer/`，使用独立 Vite 配置和独立入口；数据源现位于 `roadmap-viewer/src/roadmap-data.json`，由 Viewer 读取并渲染。根项目只提供 `npm run roadmap:dev`、`npm run roadmap:build` 和 `npm run roadmap:preview` 快捷脚本，不启动旧 `src/App.vue`，不进入 `miniprogram/`。

> 2026-05-25 更新：旧 `docs/pinganpi-roadmap-dashboard.html` 静态页面已删除，Roadmap Viewer 成为唯一可视化看板。

**Tech Stack:** Vue 3、Vite、TypeScript、Vitest、plain CSS。

---

## Tasks

### Task 1: 结构化 Roadmap 数据与视图模型

**Files:**

- Create: `roadmap-viewer/src/roadmap-data.json`
- Create: `roadmap-viewer/src/roadmap.ts`
- Test: `roadmap-viewer/src/roadmap.test.ts`

- [x] 写失败测试：能从结构化数据得出当前阶段、下一阶段、完成数量和风险数量。
- [x] 实现 `createRoadmapViewModel`，只做数据整理，不耦合 Vue 组件。

### Task 2: 独立 Vue Viewer 工程

**Files:**

- Create: `roadmap-viewer/index.html`
- Create: `roadmap-viewer/src/main.ts`
- Create: `roadmap-viewer/src/App.vue`
- Create: `roadmap-viewer/src/styles.css`
- Create: `roadmap-viewer/tsconfig.json`
- Create: `roadmap-viewer/vite.config.ts`

- [x] 使用独立 Vite root，不加载旧 App 入口。
- [x] 页面展示当前阶段、下一阶段、验证状态、风险、阶段列表和文档链接。

### Task 3: 根脚本与文档入口

**Files:**

- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `docs/pinganpi-roadmap.md`
- Delete: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [x] 新增 `roadmap:dev`、`roadmap:build`、`roadmap:preview`。
- [x] 忽略 `roadmap-viewer/dist/`。
- [x] 文档说明新 Viewer 是日常入口，旧静态 dashboard 已删除。

### Task 4: 验证

- [x] 运行 `npm test -- roadmap-viewer/src/roadmap.test.ts`。
- [x] 运行 `npm run roadmap:build`。
- [x] 运行 `git diff --check`。
- [x] 启动 `npm run roadmap:dev` 并给出访问地址。

## Verification

- `npm test -- roadmap-viewer/src/roadmap.test.ts`：通过，1 个测试通过。
- `npm run roadmap:build`：通过。
- `npm test`：通过，57 个测试文件，388 个测试通过。
- `npm run typecheck`：通过。
- `npm run miniprogram:check`：通过。
- `git diff --check`：通过。
- `npm run roadmap:dev -- --port 5190`：通过；浏览器验证 `http://localhost:5190/` 能显示 Roadmap 主界面，`/docs/pinganpi-roadmap.md` 返回 200。

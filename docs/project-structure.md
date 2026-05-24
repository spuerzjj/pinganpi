# 平安批工程结构说明

> 本文件说明当前仓库的长期目录边界。后续 agent 在开始开发前应先阅读本文件，避免把小程序主线、旧 App 历史实现、CloudBase 函数、工具脚本和 Roadmap Viewer 混在一起修改。

## 总原则

- 微信原生小程序是当前产品主线，位于 `apps/miniprogram/`。
- 旧 Capacitor / Vue App 已归档到 `apps/legacy-capacitor/`，只作为历史实现、业务参考和必要回归验证保留。
- 根目录 `capacitor.config.ts` 是 Capacitor CLI 所需的薄路由配置，只指向 `apps/legacy-capacitor/dist`、`apps/legacy-capacitor/android` 和 `apps/legacy-capacitor/ios`。
- 领域规则只有一份真实实现：`packages/domain/src/`。
- 小程序根目录内的 `apps/miniprogram/shared/domain/` 是生成副本，只能由 `npm run miniprogram:sync-shared` 更新，不要手工改。
- CloudBase 云函数入口和可复用服务端模块位于 `services/`，避免小程序 event 函数、旧 HTTP 函数和业务服务互相复制逻辑。
- 构建、部署、smoke、审计和开发者工具自动化脚本位于 `tools/scripts/`。
- Roadmap Viewer 是独立开发管理工具，位于 `tools/roadmap-viewer/`，不是正式 App。
- 生成目录、IDE 状态和本地 secret 不进入 Git。

## 根目录分区

| 路径 | 定位 | 当前策略 |
| --- | --- | --- |
| `apps/miniprogram/` | 微信原生小程序主线 | 当前 UI、页面、微信登录、双人关系、后续 AI / 同步体验都优先在这里实现。 |
| `apps/legacy-capacitor/` | 旧 Vue / Capacitor App 归档 | 不再作为主线扩展；保留测试、业务参考、迁移对照和必要原生回归能力。 |
| `capacitor.config.ts` | 旧 App 原生工具路由配置 | Capacitor CLI 需要在 npm package root 读取配置；该文件只指向旧 App 归档目录。 |
| `packages/domain/src/` | 领域规则真实实现 | 时间、钱、邮政、代笔先生、钱匣等规则只能在这里扩展。 |
| `apps/miniprogram/shared/domain/` | 小程序打包副本 | 由脚本从 `packages/domain/src/` 同步，不能手工编辑。 |
| `services/miniprogram-functions/` | 小程序 CloudBase event 云函数入口 | 面向 `wx.cloud.callFunction`，负责小程序 runtime 入参、可信身份和受控返回。 |
| `services/account-pair/` | 账号与双人关系服务 | 被小程序云函数复用，后续账号 / 关系持久化逻辑放这里。 |
| `services/ai-scribe-proxy/` | AI 起稿服务边界 | 复用 MiMo 配置、prompt、handler 和旧 HTTP 函数能力。 |
| `services/sync-proxy/` | 同步服务边界 | 复用远端快照、redaction、CloudBase store 和旧 HTTP 同步能力。 |
| `tools/scripts/` | 自动化脚本 | 构建、部署、smoke、审计、开发者工具自动化统一放这里。 |
| `tools/roadmap-viewer/` | 独立 Roadmap 可视化工具 | 日常查看路线图使用 `npm run roadmap:dev`。数据源为 `tools/roadmap-viewer/src/roadmap-data.json`。 |
| `docs/` | 产品、计划、治理和验证记录 | 记录决策、阶段状态、计划和治理审查。 |
| `vendor/` | npm override 本地 shim | 只放供应商兼容 shim，不放业务代码。 |
| `cloudbase/functions/` | CloudBase 构建产物 | 由构建脚本生成，已被 Git 忽略。 |
| `apps/legacy-capacitor/dist/`、`tools/roadmap-viewer/dist/` | 构建产物 | 已被 Git 忽略。 |

## 依赖与调用边界

### 小程序主线

- 微信开发者工具打开路径是 `apps/miniprogram/`。
- 页面文件位于 `apps/miniprogram/pages/*`。
- 页面只调用 `apps/miniprogram/services/*`，不要直接复制领域规则或拼 CloudBase 参数。
- `apps/miniprogram/services/cloud-functions.ts` 是 `wx.cloud.callFunction` 的统一边界。
- 小程序服务需要领域规则时，从 `apps/miniprogram/shared/domain/*` 导入。
- 小程序页面和服务不应依赖 `apps/legacy-capacitor/src/app/*`、Vue、Varlet、Capacitor、DOM API 或 Vite runtime。

### 共享领域层

- `packages/domain/src/` 不允许依赖小程序、Vue、CloudBase、浏览器、Capacitor 或 Node 专属 API。
- 旧 App 的 `apps/legacy-capacitor/src/domain/` 只保留兼容 re-export，后续新规则优先改 `packages/domain/src/`。
- 修改 `packages/domain/src/` 后必须运行 `npm run miniprogram:sync-shared` 或 `npm run miniprogram:check-shared`。

### 旧 App 归档

- 旧 App 源码、Vite 配置、iOS 和 Android 工程都位于 `apps/legacy-capacitor/`。
- 根目录 `capacitor.config.ts` 只保留给 Capacitor CLI 使用，`webDir` 和原生工程路径必须指向 `apps/legacy-capacitor/`。
- 根目录 `npm run dev`、`npm run build`、`npm run typecheck`、`npm run cap:sync`、`npm run cap:doctor` 仍保留为旧 App 历史验证入口。
- 新功能默认不改旧 App。只有迁移参考、回归修复、删除旧线或用户明确要求时才改。

### 服务端与云函数

- 小程序云函数入口只放在 `services/miniprogram-functions/`。
- 旧 HTTP 函数入口保留在 `services/ai-scribe-proxy/` 和 `services/sync-proxy/`，用于历史链路、诊断和复用。
- 账号、关系、AI、同步的核心逻辑应保持在可复用 handler / service 中，CloudBase event wrapper 只做 runtime 适配。
- 服务端代码不得信任客户端传入的账号身份字段；小程序主线应从可信微信 / CloudBase 上下文推导身份。

### Roadmap Viewer

- Roadmap Viewer 只读取 `tools/roadmap-viewer/src/roadmap-data.json`。
- 旧静态页面 `docs/pinganpi-roadmap-dashboard.html` 已删除，不再恢复。
- 修改 roadmap 数据或 Roadmap UI 后，至少运行 `npm test -- tools/roadmap-viewer/src/roadmap.test.ts` 和 `npm run roadmap:build`。

## Git 与多 agent 使用方式

- 主目录 `/Users/zhujunjie/code/pinganpi` 只用于查看、集成和创建 worktree。
- 所有开发、文档、配置改动都在 `.worktrees/<task-name>` 下完成。
- 一个 worktree 同一时间只允许一个 agent 写入。
- 高冲突文件由总控 agent 统一修改：`AGENTS.md`、`docs/pinganpi-roadmap.md`、`tools/roadmap-viewer/src/roadmap-data.json`、`package.json`、`package-lock.json`、`apps/miniprogram/app.json`、`apps/miniprogram/project.config.json`。

## 自动结构审计

运行：

```bash
npm run structure:audit
```

审计内容包括：

- `apps/`、`packages/`、`services/`、`tools/`、`docs/` 的关键目录存在。
- 旧顶层 `src/`、`android/`、`ios/`、`miniprogram/`、`server/`、`scripts/`、`shared/`、`roadmap-viewer/` 和旧根 `index.html` / `vite.config.ts` 不存在。
- 根目录 `capacitor.config.ts` 指向旧 App 归档路径，不把旧 App 源码放回根目录。
- 旧静态 roadmap 页面不存在，Roadmap 数据源位于 `tools/roadmap-viewer/src/roadmap-data.json`。
- Roadmap Viewer 不再从 `docs/` 导入结构化数据。
- 小程序 `apps/miniprogram/project.config.json` 启用 TypeScript 编译插件。
- 关键 npm scripts 存在。
- `.gitignore` 覆盖 worktree、构建产物、CloudBase 生成目录、本地 secret 和微信开发者工具本地状态。
- 小程序云函数入口齐全。

## 后续可选重构

当前结构已经完成主线、旧线、共享包、服务端和工具分区。后续是否删除 `apps/legacy-capacitor/` 应单独决策，至少满足以下条件后再做：

- 小程序阶段 27-29 完成，AI、同步、登录绑定和完整人工验证都已收口。
- 旧 App 不再提供独有业务能力或验证价值。
- Roadmap、AGENTS、测试命令和发布文档已去除旧 App 必跑要求。
- 用户确认不再需要 iOS / Android Capacitor 调试链路。

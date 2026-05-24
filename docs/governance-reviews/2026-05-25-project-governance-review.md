# 2026-05-25 项目治理审查

## 审查背景

项目已经从旧 iOS / Android Capacitor App 主线切换到微信原生小程序主线，并新增 CloudBase 云函数、多环境目标、独立 Roadmap Viewer、微信开发者工具自动化和多 agent 协作诉求。复杂度已高于初始预期，需要把开发治理规则固定下来。

本次审查依据：

- `docs/pinganpi-roadmap.md`
- `roadmap-viewer/src/roadmap-data.json`
- `AGENTS.md`
- `package.json`
- `miniprogram/`
- `server/miniprogram-functions/`
- `scripts/miniprogram-devtools-automator.cjs`
- 当前 Git 状态与最近提交

## 当前状态判断

- 当前主线分支为 `codex/wechat-miniprogram-pivot`。
- 阶段 1-19 的旧 Capacitor / Vue App 能力保留为历史业务参考。
- 阶段 21-26 已完成小程序迁移基线、小程序工程基座、共享领域核心、本地核心界面、CloudBase dev 主链路、登录与双人关系工程闭环。
- 下一阶段为阶段 27：小程序 AI 与同步体验补齐。
- Roadmap Viewer 已独立于旧 App 与小程序，可以通过 `npm run roadmap:dev` 查看；结构化数据源已放入 `roadmap-viewer/src/roadmap-data.json`。
- 微信开发者工具自动化已通过 `smoke` 与 `flow` 验证，但属于慢速且独占的测试资源。

## 结论

### Roadmap

整体阶段顺序合理：阶段 27 先补齐小程序 AI 与同步体验，阶段 28 再进入上架配置，阶段 29 做完整人工验证，阶段 30-33 处理邮政异常、订阅消息、照片附件和发布打磨。

主要问题是阶段 27 还缺可执行实施计划。已补充 `docs/superpowers/plans/2026-05-25-pinganpi-miniprogram-ai-sync-experience.md`，将阶段 27 拆为非流式 AI 起稿、同步状态、流式可行性专项和 DevTools 验证。

### 测试策略

现有测试基础合理，但必须分层运行：

- 纯函数、领域层、云函数 handler：优先 Vitest 和 TypeScript 检查。
- 小程序页面、WXML/WXSS、页面跳转、`app.json`、`project.config.json`：增加 DevTools `smoke`。
- 阶段收口或跨页面主流程变化：运行 DevTools `flow`。
- DevTools 自动化不作为每次小改必跑项，因为它启动慢、依赖服务端口，并占用独占资源。

### 项目结构

当前结构处于迁移期，保留旧 App 与新小程序是合理的：

- `shared/domain/` 是领域规则真实来源。
- `src/`、`ios/`、`android/` 是旧 App 历史实现。
- `miniprogram/` 是新主线前端。
- `server/miniprogram-functions/` 是小程序 CloudBase event 云函数。
- `server/ai-scribe-proxy/` 和 `server/sync-proxy/` 是旧 HTTP 代理能力与可复用 handler 来源。
- `roadmap-viewer/` 是项目管理工具，不属于正式 App。

短期不做目录大重构；通过文档和命令分组降低认知成本。

### 文档

文档覆盖面较好，但历史方案较多，后续 agent 容易误执行过时计划。已处理：

- 新增 `docs/agent-collaboration.md`。
- 本次审查记录写入 `docs/governance-reviews/2026-05-25-project-governance-review.md`。
- 被替代的 Roadmap Viewer Tesla 风格计划已标记为废弃。
- Roadmap Viewer Apple 风格计划已标记为已完成，以当前 `roadmap-viewer/src/` 为准。

### 开发策略

用户已确认以后都使用 worktree。治理规则调整为：

- 所有改动在独立 worktree 中完成。
- 主目录只作为基线查看、集成和创建 worktree 的入口。
- 多 agent 并行时，每个 agent 使用独立 branch + 独立 worktree。
- 高冲突文件默认由总控 agent 修改。
- DevTools、CloudBase 部署、真实 smoke、MiMo 额度测试和 Git 合并 / push 是独占资源。

## 后续必须执行

1. 阶段 27 开工前，先读取 `docs/superpowers/plans/2026-05-25-pinganpi-miniprogram-ai-sync-experience.md`。
2. 任何新任务都必须先创建独立 worktree。
3. DevTools 自动化按分层规则运行，不默认每次小改启动。
4. 每完成 2-3 个阶段，或发生架构 / 平台变化，必须做治理审查。
5. 阶段 27 完成后，同步更新 roadmap、Roadmap Viewer 数据源、AGENTS 和验证基线。

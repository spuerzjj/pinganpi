# 平安批多 Agent 协作规则

> 本文件用于约束多个 agent、多个会话、多个分支同时推进《平安批》时的开发方式。目标是让任何 agent 在脱离当前上下文后，仍能明确知道活干到哪里、下一步做什么、哪些资源不能并发使用。

## 核心原则

- 所有开发、文档和配置改动都必须在独立 worktree 中完成。
- 主目录 `/Users/zhujunjie/code/pinganpi` 只作为基线查看、集成和创建 worktree 的入口，不直接改文件。
- 一个 agent 同一时间只拥有一个任务 worktree；一个 worktree 同一时间只允许一个 agent 写入。
- 多 agent 可以并行阅读、分析和提出方案，但不能在同一个目录或同一个分支上并行写文件。
- 总控 agent 负责拆任务、分配文件范围、合并、最终验证、提交、更新 roadmap / AGENTS / 关键文档。

## Worktree 规则

开始任何任务前先在主目录运行：

```bash
git status --short --branch
git worktree list
git log --oneline --decorate -5
```

创建任务 worktree：

```bash
git worktree add .worktrees/<task-name> -b codex/<task-name>
```

命名建议：

- `codex/p27-ai-scribe`
- `codex/p27-sync-status`
- `codex/p27-stream-spike`
- `codex/governance-review-2026-05-25`

禁止事项：

- 不在主目录直接编辑业务、文档或配置文件。
- 不复用其他 agent 正在使用的 worktree。
- 不在一个 worktree 里混做多个无关阶段。
- 不把 `.worktrees/` 内任何内容提交到 Git。

## 文件所有权

这些文件属于高冲突文件，默认只由总控 agent 修改：

- `AGENTS.md`
- `docs/pinganpi-roadmap.md`
- `roadmap-viewer/src/roadmap-data.json`
- `package.json`
- `package-lock.json`
- `miniprogram/app.json`
- `miniprogram/project.config.json`

子 agent 如果必须修改这些文件，需要在交付说明中明确原因、影响和验证命令。

## 独占资源

以下资源同一时间只允许一个 agent 使用：

- 微信开发者工具自动化。
- CloudBase 部署。
- CloudBase 真实 smoke。
- Xiaomi MiMo 真实额度消耗测试。
- Git 合并、rebase、push、创建 PR。

微信开发者工具自动化只在需要时运行：

- 小程序页面、WXML、WXSS、页面跳转、`app.json` 或 `project.config.json` 变化后，运行 `WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:smoke`。
- 阶段收口、跨页面流程、账号 / 关系 / 写信路径变化后，运行 `WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:flow`。
- 普通纯函数、云函数 handler、文档或领域层改动，不默认启动微信开发者工具。

## 测试分层

常规代码改动：

```bash
npm test
npm run miniprogram:check
git diff --check
```

旧 Vue / Capacitor 入口变化：

```bash
npm run typecheck
npm run build
```

共享领域变化：

```bash
npm run miniprogram:sync-shared
npm run miniprogram:check-shared
npm test -- src/domain
```

小程序页面或配置变化：

```bash
npm run miniprogram:check
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:smoke
```

小程序阶段收口：

```bash
npm test
npm run miniprogram:check
npm run cloudbase:build:miniprogram
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:flow
git diff --check
```

Roadmap Viewer 变化：

```bash
npm test -- roadmap-viewer/src/roadmap.test.ts
npm run roadmap:build
```

依赖变化：

```bash
npm audit --omit=dev
```

不要把 DevTools 自动化作为每次小改的必跑项；它启动慢、依赖本机端口，并且会占用独占资源。

## 子 Agent 交付格式

子 agent 完成任务后必须给出：

```md
分支：
worktree：
改动范围：
涉及文件：
运行测试：
未运行测试及原因：
是否改动 roadmap / AGENTS：
剩余风险：
建议下一步：
```

总控 agent 合并前必须检查：

- `git status --short --branch`
- diff 是否只包含任务范围内文件
- 测试输出是否与当前代码匹配
- 是否需要同步 roadmap / AGENTS / 相关 plan

## 治理审查节奏

治理审查是固定节奏，不是临时补救。

必须触发治理审查：

- 每完成 2-3 个阶段。
- 发生架构、平台、目标运行环境或部署方式变化。
- 新增长期使用的工具链、测试入口或云服务。
- 多 agent 协作规则、Git 主线策略或发布策略发生变化。
- roadmap / AGENTS / 实施计划之间出现冲突或过时信息。

治理审查必须产出：

- 一份 `docs/governance-reviews/YYYY-MM-DD-*.md` 记录。
- 必要时更新 `AGENTS.md`。
- 必要时更新 `docs/pinganpi-roadmap.md`、`roadmap-viewer/src/roadmap-data.json` 和 `AGENTS.md`。
- 明确下一阶段是否已有可执行计划；没有则补齐计划或标记阻塞。

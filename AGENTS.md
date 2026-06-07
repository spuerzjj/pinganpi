# AGENTS.md

本文件适用于整个 `/Users/zhujunjie/code/pinganpi` 仓库。它的目标是让后续代理即使脱离当前对话上下文，也能根据既有产品设定、代码状态和路线计划继续开发《平安批》。

## 基本协作规则

- 始终使用简体中文回复用户，除非用户明确要求其他语言。
- 主目录 `/Users/zhujunjie/code/pinganpi` 只作为基线查看、集成和创建 worktree 的入口。
- 所有开发、文档和配置改动都必须在独立 worktree 中完成；不要在主目录直接编辑文件。
- 新任务开始前先运行 `git status --short --branch`、`git worktree list` 和 `git log --oneline --decorate -5`，再创建或复用对应任务 worktree。
- 多 agent 并行时，一个 agent 只拥有一个任务 worktree；一个 worktree 同一时间只允许一个 agent 写入。
- 改代码前先运行 `git status --short --branch`，确认当前分支和未提交改动。
- 不要覆盖用户未提交改动。遇到不属于本次任务的改动，先理解并避开。
- 手工编辑文件使用 `apply_patch`。
- 提交消息必须使用 Conventional Commits，摘要使用简体中文，例如 `feat(app): 添加本地草稿保存`。
- 不要添加 AI 署名、`@mention` 或 GitHub 自动关闭关键词。

## 产品上下文

《平安批》是只给两个人使用的慢通信产品。当前主线已从 iOS / Android Capacitor App 改为微信原生小程序，并以可上架为目标；它不是网页聊天产品。核心体验是模拟 1960 年左右中国旧时代纸质信件通信：

- App 内时间 = 现实时间减 66 年。
- 现实 `2026 年 5 月 23 日` 对应 App 内 `一九六〇年五月二十三日`。
- 真实时间默认隐藏，只在需要时显示：`今时对应：2026 年 5 月 23 日`。
- 信件按真实时间等待，预计几天到就现实中真的等几天。
- 写信入口是代笔先生，不是现代即时聊天输入框。
- 寄信需要付代书费、邮资等，余额不足不能投寄，不允许赊账。
- 普通信不主动推送，用户需要打开今日信箱查看。
- 整体体验保留克制、文字优先、慢通信的气质；小程序当前 UI 不再采用泛黄纸张、印章、账簿、旧报纸纹理或仿古装饰，而采用安静现代的记录感。
- 不做现代聊天气泡、消息流、实时地图、物流进度条、夸张动画或游戏化任务。

完整产品文档：

- `docs/superpowers/specs/2026-05-23-pinganpi-design.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-wechat-miniprogram-migration-design.md`

## 当前技术栈

- TypeScript
- 微信原生小程序（新主线，`apps/miniprogram/` 已创建）
- CloudBase 云函数，多环境目标为 `dev` / `prd`
- Vitest
- Vue 3 / Vite / Tailwind CSS / Varlet / Capacitor（旧 App 历史实现，暂存为业务和体验参考）
- iOS 原生工程：`apps/legacy-capacitor/ios/`（旧 App）
- Android 原生工程：`apps/legacy-capacitor/android/`（旧 App）

本地开发命令：

```bash
npm ci
npm test
npm run typecheck
npm run miniprogram:typecheck
npm run miniprogram:check
npm run dev
npm run build
npm run cap:sync
npm run ai-proxy:check
npm run ai-proxy:dev
npm run cloudbase:login
npm run cloudbase:build:ai
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:miniprogram-ai-env
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:ai
npm run cloudbase:build:sync
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:sync-env
npm run cloudbase:smoke:sync
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:sync
CLOUDBASE_ENV_ID=<env-id> WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:cloud:deploy:functions
CLOUDBASE_ENV_ID=<env-id> WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:cloud:init
npm run miniprogram:sync-shared
npm run miniprogram:check-shared
npm run miniprogram:check
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:smoke
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:flow
npm run roadmap:dev
npm run roadmap:build
npm run structure:audit
npm run cap:doctor
```

新主线的日常开发方式：用微信开发者工具打开 `apps/miniprogram/`，连接 CloudBase `dev` 环境，通过 `wx.cloud.callFunction` 调用云函数。`npm run dev`、`cap:sync`、`cap:doctor` 只代表旧 Capacitor / Vue 历史基线。

微信开发者工具自动化调试：先在微信开发者工具 `设置 -> 安全设置` 开启服务端口；优先显式传入 `WECHAT_DEVTOOLS_PORT=<端口>`，也可让脚本读取最近的 `.ide` 端口文件。`npm run miniprogram:devtools:smoke` 覆盖账号页 openid 微信登录测试桩；`npm run miniprogram:devtools:flow` 覆盖账号、关系、今日、写信、先生、钱匣、信箱和档案的低风险页面巡检。阶段 27 后，`flow` 会在自动化进程内用云函数测试桩拦截 `pinganpi-ai/scribeDraft` 和 `pinganpi-sync/health`；阶段 26 openid 登录调整后，脚本也会拦截 `pinganpi-account/loginByWechat` 和账号查询，避免消耗真实 MiMo 额度并降低 CloudBase 波动误报。脚本不点击上传、发布、真机预览或审核提交。

Roadmap 日常查看方式：使用独立 Vue 工具 `tools/roadmap-viewer/`，执行 `npm run roadmap:dev`。该工具独立于旧 App `apps/legacy-capacitor/src/` 和小程序 `apps/miniprogram/`，数据源是 `tools/roadmap-viewer/src/roadmap-data.json`；旧 `docs/pinganpi-roadmap-dashboard.html` 已删除，不再维护静态看板。

工程结构边界以 `docs/project-structure.md` 为准：当前仓库按 `apps/`、`packages/`、`services/`、`tools/`、`docs/` 分区。新增 `npm run structure:audit` 用于防止目录边界回退。

多 agent 协作、worktree、独占资源、测试分层和子 agent 交付格式以 `docs/agent-collaboration.md` 为准。

## 当前代码状态

当前主线以 `dev` 分支最新提交为准；开始任何新任务仍需先看 `git status --short --branch`、`git worktree list` 和 `git log --oneline --decorate -5`。最新路线图基线为：**阶段 1-19 的旧 Capacitor / Vue App 工程能力已形成完整业务参考；2026-05-24 用户确认项目主线切换为微信原生小程序 + TypeScript + CloudBase 云函数 `dev` / `prd` 多环境，本地开发和上线都优先走 CloudBase 云函数，本地 proxy 降级为诊断工具。阶段 21 已完成迁移设计与重基线；阶段 22 已完成小程序工程基座；阶段 23 已完成共享领域核心迁移；阶段 24 已完成小程序本地核心界面；阶段 25 已完成小程序 CloudBase dev 主链路；阶段 26 已完成小程序登录与双人关系工程闭环，并于 2026-05-31 因个人主体限制把当前小程序账号入口改为可信 `WX_OPENID` / `authUid` 静默登录；手机号仅保留为旧 App / 将来企业主体取号路径的展示字段，当前上架路径不依赖微信手机号能力或短信验证码兜底。阶段 27 已完成小程序 AI 与同步体验补齐：写信页默认通过 `wx.cloud.callFunction` 调用 `pinganpi-ai/scribeDraft` 非流式起稿，AI 成功后进入校改，失败保留口述且不回退模板；今日页新增“同步簿”，通过 `pinganpi-sync/health` 查验云端入口；DevTools flow 使用云函数测试桩覆盖 AI 成功路径，避免消耗真实 MiMo 额度。阶段 28 已完成小程序 UI 完整重设计：全局切换为非复古、安静现代视觉系统，写信页保留私密编辑感，账号、关系、今日、写信、先生、钱匣、信箱和档案页统一使用现代 token、轻边框、状态 pill、摘要卡、输入和按钮样式；设计文档为 `docs/superpowers/specs/2026-06-07-pinganpi-miniprogram-ui-redesign-design.md`，实施计划为 `docs/superpowers/plans/2026-06-07-pinganpi-miniprogram-ui-redesign.md`，概念图为 `docs/assets/stage28-ui-redesign/non-retro-ui-concept.png`。2026-05-30 小程序 `dev` 已切到当前 AppID 绑定的 `cloud1-d6gg9pfb476fc78b4`，用户已配置 `pinganpi-ai` MiMo env，真实 `wx.cloud.callFunction` AI 起稿 smoke 已通过；新增 `miniprogram:cloud:init` 显式初始化命令，用一次性 token 保护的维护函数创建 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`、`pinganpi_sync_snapshots`，业务云函数不在运行时自动建集合；当前 `cloud1-...` dev 已初始化并复测账号入口。MiMo client 已兼容微信工具默认 `Nodejs16.13` 云函数缺少全局 `fetch` / `Headers` 的运行时。小程序端流式结论：当前 CloudBase event 云函数主链路不能按浏览器 SSE 方式消费分片，本期不纳入流式实现，保留“先生起稿中”的等待状态。下一步进入阶段 29：微信小程序上架配置。2026-05-25 已完成治理审查并固化 worktree / 多 agent 协作规则：`docs/governance-reviews/2026-05-25-project-governance-review.md`、`docs/agent-collaboration.md`。迁移设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-wechat-miniprogram-migration-design.md`，阶段 22 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-foundation.md`，阶段 23 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-shared-domain-core.md`，阶段 24 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-local-ui.md`，阶段 25 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-cloudbase-dev.md`，阶段 26 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-login-pair.md`，阶段 27 实施计划为 `docs/superpowers/plans/2026-05-25-pinganpi-miniprogram-ai-sync-experience.md`。**

旧 App 能力基线仍然重要：阶段 16 双人真实同步 MVP 已完成云端 smoke；阶段 17 手机号账号本地工程闭环已完成；阶段 18 双人绑定与同步授权工程闭环已完成；阶段 19 外部平台配置已收口。阶段 13 / 14 的 CloudBase AI 代理、非流式 / 流式起稿、禁用 key 安全失败验证和恢复验证已跑通。继续开发前以 `git log --oneline --decorate -5` 为准。

最新关键提交以 `git log --oneline --decorate -8` 为准；阶段 13 相关提交包括：

- `274ba0d build(cloudbase): 添加 AI 代理部署入口`
- `11a1a4b refactor(ai): 抽出代理请求 handler`
- `44d2f06 feat(ai): 添加本地费用护栏`
- `6da325f docs: 将 AI 流式起稿拆为独立阶段`
- `802ce24 feat(app): 接入写信页 AI 起稿`

已完成阶段：

### 阶段 1：领域层基础

位置：`packages/domain/src/`；`apps/legacy-capacitor/src/domain/` 保留兼容 re-export，旧 App 和旧测试入口仍可继续使用。

已实现：

- 66 年时间映射。
- 中国大陆 `Asia/Shanghai` 本地日历边界。
- 旧币制金额 helper。
- 代笔先生模型与确定性每日出勤。
- 钱匣余额自然增长 / 自然消耗结算。
- 1960 年邮政风格邮资、传递窗口、信件状态机。

重要要求：

- 后续 UI、持久化、云端、通知等层不要重复实现领域规则。
- 所有时间、钱、代书先生出勤、邮资、邮路、信件状态计算优先复用 `packages/domain/src`；旧 App 代码可继续通过 `apps/legacy-capacitor/src/domain` 兼容入口导入。

### 阶段 2：Capacitor 移动壳层

已实现：

- Vue/Vite App 入口。
- Tailwind 全局样式。
- Varlet 组件注册。
- Capacitor iOS/Android 原生壳。
- 本地 mock 数据。
- `AppModel` view-model 层。
- 首批页面：
  - 今日
  - 写信
  - 代笔先生
  - 钱匣
  - 信箱 / 档案

关键文件：

- `apps/legacy-capacitor/src/App.vue`
- `apps/legacy-capacitor/src/main.ts`
- `apps/legacy-capacitor/src/styles.css`
- `apps/legacy-capacitor/src/app/mock-data.ts`
- `apps/legacy-capacitor/src/app/app-model.ts`
- `apps/legacy-capacitor/src/app/app-model.test.ts`
- `apps/legacy-capacitor/src/app/pages/`
- `capacitor.config.ts`（根目录薄路由配置，指向 `apps/legacy-capacitor/`）

### 阶段 3-14：本地慢通信核心闭环、AI 起稿链路与流式体验

已实现：

- 原生调试环境基础：Android Emulator 与 iOS Simulator 均已成功启动 App。
- 本地持久化：`AppState`、localStorage adapter、钱包结算、坏数据回退。
- 写信主流程：口述、起稿、校改、封缄投寄、扣款、账本、邮政记录。
- 模板代书引擎：非 AI 模板边界，保存 `draftSource`、`scribeDraft`、`finalText`、`generationMeta`。
- 写信分步流程：`选写法 → 口述 → 起稿 → 校改 → 投寄`。
- 草稿管理 / 信纸匣：续写、覆盖保存、删除、从草稿投寄。
- 信箱真实时间送达推进：`in_transit -> arrived`、到达前不可拆、拆阅写记录、邮政档案记录簿。
- AI 代笔接入设计：明确 AI 只负责代笔先生起稿，模板转为提示词素材，失败保存口述草稿。
- 本地最小 AI 代理脚手架：`services/ai-scribe-proxy/`、MiMo config/client、可复用 handler、`GET /health`、`POST /ai/scribe-draft`、本地 Origin 限制、32 KB 请求体限制、`npm run ai-proxy:check`、`npm run ai-proxy:dev`。
- App 侧 AI 起稿链路：`apps/legacy-capacitor/src/app/ai-scribe-adapter.ts`、`VITE_PINGANPI_AI_PROXY_URL` 代理配置、写信页异步起稿、AI metadata 持久化、失败不回退模板正文。
- 阶段 13 工程链路已完成，控制台人工事项已移入阶段 19：`npm run ai-proxy:check` / `npm run ai-proxy:dev` 已读取本机 `.env.ai.local` 并跑通真实 Xiaomi MiMo；本地代理 `/ai/scribe-draft`、写信页真实 AI 起稿烟测、本地费用护栏、可复用 handler 边界、CloudBase HTTP 云函数、云端 secret、`/api` 路由、云端 AI 起稿接口、浏览器写信页云端 AI 烟测、禁用 key 安全失败验证、恢复验证和 `/*` 路由清理已通过。
- 阶段 14 已完成工程实现：新增 `POST /ai/scribe-draft/stream` 和 CloudBase `POST /api/ai/scribe-draft/stream`，服务端只输出受控 SSE `delta` / `done` / `error`；App 侧 `generateDraftStream` 边收边显示，`done` 前不进入可投寄正文；保存口述草稿不会在 AI 失败后回落到模板正文。
- MiMo stream client 必须收到 provider `data: [DONE]` 才会完成；partial delta 后 EOF 会转为受控失败，避免半截正文进入可投寄状态。

已验证基线记录在：

- `docs/pinganpi-roadmap.md`
- `tools/roadmap-viewer/src/roadmap-data.json`
- `docs/superpowers/specs/2026-05-23-pinganpi-ai-scribe-design.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-minimal-ai-proxy.md`

最近验证基线：阶段 28 最新验证已通过 `npm test -- apps/miniprogram/styles/ui-redesign.test.ts`（1 个测试文件，3 个测试通过）、`npm test`（65 个测试文件，429 个测试通过）、`npm run miniprogram:check`、`npm run typecheck`、`npm run roadmap:build`、`npm run structure:audit`、`node --check tools/scripts/miniprogram-devtools-automator.cjs` 和 `git diff --check`；`git diff --check` 仅输出 Windows 工作区 LF/CRLF 提示。阶段 28 视觉验证已生成并查看 `docs/assets/stage28-ui-redesign/implementation-preview.png`，该图基于当前 token 与页面结构生成，用于服务端口不可用时的静态核对；本轮 `npm run miniprogram:devtools:flow` 因未找到微信开发者工具服务端口 / `WECHAT_DEVTOOLS_PORT` 未执行。阶段 27 基线保留：`npm test`（63 个测试文件，416 个测试通过）、`npm run miniprogram:check`、`npm run typecheck`、`npm run cloudbase:build:miniprogram`、`npm run roadmap:build`、`npm run structure:audit`、`node --check tools/scripts/miniprogram-devtools-automator.cjs`、`node --check tools/scripts/init-miniprogram-cloudbase.cjs`、`npm run miniprogram:devtools:flow` 和 `git diff --check` 已通过。2026-05-25 工程结构治理基线保留：`npm run cap:sync`、`npm run cap:doctor` 已通过；`npm run build` 已在该命令内重新执行并通过，保留 Varlet 首包超过 500 KB 的既有提示。Capacitor 根配置现在只作为 CLI 路由，指向 `apps/legacy-capacitor/dist`、`apps/legacy-capacitor/android` 和 `apps/legacy-capacitor/ios`。微信开发者工具基线保留：阶段 27 后的 `npm run miniprogram:devtools:flow` 已自动读取端口 `62046` 并通过，使用云函数测试桩覆盖 AI 成功路径，不调用真实 MiMo，也不点击真实投寄；当前脚本已将账号 smoke 改为 openid 登录测试桩，需在可用端口下复测。当前小程序 `dev` 环境已从历史腾讯云控制台环境切换为绑定当前 AppID 的 `cloud1-d6gg9pfb476fc78b4`；该环境当前由微信开发者工具 CLI 可见，腾讯云 `cloudbase` CLI 当前登录态不可见。部署四个小程序 event 云函数使用 `CLOUDBASE_ENV_ID=<env-id> WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:cloud:deploy:functions`；初始化账号、关系和同步集合使用 `CLOUDBASE_ENV_ID=<env-id> WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:cloud:init`，该命令部署并调用一次性 token 保护的 `pinganpi-init-db` 维护函数，业务云函数不在运行时自动建集合；`CLOUDBASE_ENV_ID=cloud1-d6gg9pfb476fc78b4 WECHAT_DEVTOOLS_PORT=24248 WECHAT_AUTOMATOR_PORT=9440 npm run miniprogram:cloud:init` 已创建 5 个集合，随后 `pinganpi-account/getCurrentAccount` 返回 `ok: true`、`account: null`、`binding: null`。`pinganpi-ai` 的 MiMo env 若目标环境能被腾讯云 CLI 看见，可用 `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:miniprogram-ai-env` 配置；当前 `cloud1-...` 环境由用户在微信开发者工具 / 小程序云开发控制台手工配置，真实 AI 起稿 smoke 已通过。阶段 26 云端历史基线保留：`CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:deploy:miniprogram` 与 `npm run cloudbase:smoke:miniprogram` 已在账号 / 关系可信身份改造后通过。阶段 16B 云端基线保留：`CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:deploy:sync` 通过，`npm run cloudbase:smoke:sync` 已通过真实云端 smoke。为避免 `@cloudbase/node-sdk` 传递引入存在原型污染公告的 `lodash.set` / `lodash.unset` 小包，已通过 `vendor/lodash-set` 和 `vendor/lodash-unset` 提供兼容 shim，内部调用已修复的主 `lodash` 子模块。

## 后续路线

以后开始新任务前，优先读取：

- `docs/pinganpi-roadmap.md`
- `tools/roadmap-viewer/src/roadmap-data.json`
- `docs/project-structure.md`
- `docs/agent-collaboration.md`
- `docs/governance-reviews/2026-05-25-project-governance-review.md`
- `docs/governance-reviews/2026-05-25-project-structure-governance.md`
- `docs/superpowers/plans/2026-05-25-pinganpi-project-structure-reorganization.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-wechat-miniprogram-migration-design.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-foundation.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-shared-domain-core.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-local-ui.md`
- `docs/superpowers/plans/2026-05-25-pinganpi-miniprogram-ai-sync-experience.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-dual-sync-mvp-design.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-dual-sync-mvp.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-cloudbase-sync-design.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-cloudbase-sync-adapter.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-phone-account-design.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-pair-binding-design.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-account-pair-binding.md`
- `docs/superpowers/specs/2026-05-24-pinganpi-cloud-sync-design.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-cloud-sync-foundation.md`
- `docs/superpowers/plans/2026-05-24-pinganpi-ai-scribe-streaming.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-cloud-ai-proxy.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-mobile-capacitor-shell.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-domain-foundation.md`

路线图维护规则：

- 每次阶段完成、阶段拆分 / 合并、下一阶段推荐顺序变化、验证基线变化或集中 UI 问题变化时，必须同步更新 `docs/pinganpi-roadmap.md`、`tools/roadmap-viewer/src/roadmap-data.json` 和 `AGENTS.md`；如涉及具体设计或实施边界，也要同步相关 spec / plan 文档。
- `docs/pinganpi-roadmap.md` 是详细文字源；`tools/roadmap-viewer/` 是给用户日常查看的可视化看板，不属于正式 App；旧 `docs/pinganpi-roadmap-dashboard.html` 已删除，不再恢复。
- 治理审查是固定节奏：每完成 2-3 个阶段，或发生架构 / 平台 / 目标运行环境 / 部署方式变化时，必须创建 `docs/governance-reviews/YYYY-MM-DD-*.md` 并同步必要的 roadmap / AGENTS / plan。
- 开发过程中遇到关键节点，必须同步更新 roadmap 和相关设计 / 计划 / AGENTS 文档。关键节点的判断标准是：该变化会影响后续代理判断、用户查看进度、实现边界、验证方式、部署方式或安全隐私边界。
- 关键节点包括：
  - 阶段状态变化：阶段开始、完成、暂停、拆分、合并、改名、重排，或当前推荐下一步变化。
  - 产品决策变化：新增 / 删除目标，非目标变化，用户确认的重要取舍，体验原则变化。
  - 技术架构变化：技术栈、目录结构、数据模型、状态机、adapter 边界、云端边界、AI / 同步 / 推送 / 附件方案变化。
  - 安全与隐私变化：secret 管理、第三方服务调用、日志策略、权限、费用风险、访问控制、未拆信或附件暴露边界变化。
  - 开发流程变化：新增或修改 npm scripts、调试流程、原生构建流程、浏览器 / 模拟器 / 真机验证方式。
  - 验证基线变化：测试数量明显变化，新增必跑命令，构建 / 审计 / cap sync 状态变化，已知 warning 从阻塞变为接受或反之。
  - 用户发现或确认的问题：集中 UI 问题、调试问题、体验问题、暂缓事项、后续必须回看的风险。
- 非关键节点通常不需要更新 roadmap：纯格式化、无行为变化的小重命名、局部测试内部重构、未改变命令和边界的实现细节。

推荐开发顺序：

当前新主线顺序如下，旧 App 阶段 13-20 仅作为历史基线和迁移参考：

1. **阶段 21：微信小程序迁移设计与重基线**
   - 状态：已完成。
   - 设计文档：`docs/superpowers/specs/2026-05-24-pinganpi-wechat-miniprogram-migration-design.md`。
   - 目标：同步迁移设计、roadmap、dashboard、AGENTS，并写出实施计划。
   - 用户已确认：采用微信原生小程序 + TypeScript + CloudBase 云函数 `dev` / `prd` 多环境；初始设计曾以手机号作为业务账号主键、微信一键取号为默认入口。2026-05-31 后当前小程序个人主体路径已修订为 openid 静默登录，手机号仅作为旧 App / 未来企业主体兼容字段。

2. **阶段 22：小程序工程基座**
   - 状态：已完成基础。
   - 已创建 `apps/miniprogram/`、小程序配置、TypeScript 页面骨架、基础样式、开发者工具打开方式和 `dev` 环境配置入口。
   - `apps/miniprogram/project.config.json` 必须保留 `setting.useCompilerPlugins: ["typescript"]`；否则微信开发者工具会按 `.js` 查找页面并报 `app.json: 未找到 ["pages"][0] 对应的 pages/account/index.js 文件`。
   - 不继续扩展 Capacitor 壳层。

3. **阶段 23：共享领域核心迁移**
   - 状态：已完成基础。
   - 已新增 `packages/domain/src/` 作为领域规则真实实现位置，`apps/legacy-capacitor/src/domain/` 保留兼容 re-export。
   - 已新增 `apps/miniprogram/shared/domain/` 根内副本、`npm run miniprogram:sync-shared` 和 `npm run miniprogram:check-shared`；脚本动态扫描 `packages/domain/src/*.ts`，避免微信小程序跨根打包风险和副本陈旧。
   - 小程序今日页已通过 `apps/miniprogram/services/domain-summary.ts` 使用共享旧历日期和邮资摘要。
   - 领域层不得引入小程序、CloudBase、Vue、浏览器或 Capacitor 依赖。

4. **阶段 24：小程序本地核心界面**
   - 状态：已完成基础。
   - 已新增 `apps/miniprogram/services/local-model.ts` 和测试，提供今日、先生、钱匣、信箱 / 档案的本地 mock view-model。
   - 今日、代笔先生、钱匣、信箱、档案页面已从占位内容改为读取本地模型。
   - 已新增 `apps/miniprogram/services/write-flow.ts` 和测试，提供本地五步写信流程、费用计算、挂号切换和投寄存根。
   - 写信页已支持口述、先生起稿、校改、投寄核算和本地投寄回执。
   - 写信 tab 切换不会重建本地 flow；口述变更会清空旧起稿 / 定稿，避免用旧正文投寄。
   - 本阶段仍不接 CloudBase、真实登录、真实同步或 AI 起稿。

5. **阶段 25：小程序 CloudBase dev 主链路**
   - 状态：已完成 dev smoke。
   - 已新增 `pinganpi-ai`、`pinganpi-sync`、`pinganpi-account`、`pinganpi-pair` 四个小程序 event 云函数入口。
   - `pinganpi-ai` 复用既有 AI proxy handler；health 不依赖 MiMo env，非流式 `scribeDraft` 使用受控返回。
   - `pinganpi-sync` 复用既有 sync handler、redaction 和 CloudBase snapshot store；阶段 25 event runtime 使用 dev-only payload namespace，不读取旧 HTTP header token auth，同步侧微信可信身份推导顺延到阶段 27。
   - `pinganpi-account` / `pinganpi-pair` 复用 `account-pair-service`，新增账号关系 CloudBase store，集合名为 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`；创建邀请码响应不向客户端返回 `codeHash`。
   - 已新增 `apps/miniprogram/services/cloud-functions.ts` 封装 `wx.cloud.callFunction`；本阶段尚未接入页面。
   - 已新增 `npm run cloudbase:build:miniprogram`、`npm run cloudbase:deploy:miniprogram`、`npm run cloudbase:smoke:miniprogram`。
   - 小程序 `dev` CloudBase 环境为 `cloud1-d6gg9pfb476fc78b4`，这是微信开发者工具内新开通并绑定当前 AppID 的环境。
   - 旧环境 `pinganpi-d7gml1f6sbcc172ea` 的四个 event 云函数部署和 smoke 记录只作为历史基线保留，不再作为小程序主线 dev 环境。
   - `cloud1-d6gg9pfb476fc78b4` 当前使用微信开发者工具 CLI 部署：`CLOUDBASE_ENV_ID=<env-id> WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:cloud:deploy:functions`。
   - CloudBase 空环境必须显式初始化集合，不在业务云函数运行时自动建集合；使用 `CLOUDBASE_ENV_ID=<env-id> WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:cloud:init` 部署并调用一次性 token 保护的 `pinganpi-init-db` 维护函数，初始化 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`、`pinganpi_sync_snapshots`。
   - `CLOUDBASE_ENV_ID=cloud1-d6gg9pfb476fc78b4 WECHAT_DEVTOOLS_PORT=24248 npm run miniprogram:cloud:deploy:functions` 已通过，四个 event 云函数部署成功；微信开发者工具运行时 `pinganpi-sync/health` 与 `pinganpi-ai/health` 均返回 `cloud.callFunction:ok`。
   - `CLOUDBASE_ENV_ID=cloud1-d6gg9pfb476fc78b4 WECHAT_DEVTOOLS_PORT=24248 WECHAT_AUTOMATOR_PORT=9440 npm run miniprogram:cloud:init` 已通过，5 个集合创建成功；随后 `pinganpi-account/getCurrentAccount` 已返回 `ok: true`、空账号和空绑定，确认不再触发 `Db or Table not exist`。
   - 微信开发者工具 CLI 当前把新建函数显示为默认 `Nodejs16.13`、`timeout=3`；MiMo client 已增加 Node HTTP fallback，兼容 Node 16 缺少全局 `fetch` / `Headers` 的运行时。
   - 用户已在微信开发者工具 / 小程序云开发控制台为 `pinganpi-ai` 配置 MiMo env；真实 `wx.cloud.callFunction({ name: "pinganpi-ai", data: { action: "scribeDraft" } })` 已通过，返回 AI 起稿正文，`provider=xiaomi-mimo`，`model=mimo-v2.5-pro`，本次 smoke 延迟约 `9026ms`。
   - `pinganpi-ai` 的 MiMo env 若目标环境能被腾讯云 CLI 看见，可用 `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:miniprogram-ai-env` 配置；旧 `cloudbase:configure:ai-env` 默认仍配置 HTTP `ai-scribe-proxy`。当前微信侧 `cloud1-...` 环境在腾讯云 CLI 当前登录态不可见，因此 env 仍以微信开发者工具 / 小程序云开发控制台为准。
   - HTTP AI / sync 函数保留为诊断工具，不作为小程序主链路；`prd` 仍未创建 / 配置 / 部署。

6. **阶段 26：小程序登录与双人关系真实闭环**
   - 状态：已完成工程闭环；当前小程序个人主体路径已转向 openid 静默登录，真实微信手机号能力和短信验证码不再作为当前上架前置。
   - 新增 `services/miniprogram-functions/miniprogram-auth.ts`，从 CloudBase / 微信可信上下文读取 `openid` / `unionid` 并生成稳定 `authUid`。
   - `pinganpi-account` 新增 `loginByWechat`、`loginByWechatPhone`、受控 `loginByDevPhone`、`getCurrentAccount` 和可信 `getActiveBinding`；当前客户端默认调用 `loginByWechat`，手机号取号路径仅作为未来企业主体兼容能力保留，不信任客户端伪造字段。
   - `pinganpi-pair` 的 `createHousehold`、`createInvite`、`joinByInvite` 和 `getActiveBinding` 均从当前可信账号推导，不再接收客户端 `accountId` 作为授权依据。
   - 新增 `apps/miniprogram/services/account-session.ts` 和 `account-cloud.ts`；小程序只缓存账号 / 绑定摘要，不保存验证码、token、secret 或邀请码 hash。
   - 账号页接入单个「微信登录」按钮、登录态恢复和登录后路由；关系页接入创建关系、生成邀请码、输入邀请码加入和本地会话刷新。
   - 微信小程序 AppID 关联 CloudBase 后，阶段 29 / 30 重点验证可信 `WX_OPENID`、双账号双端关系和 `prd`；若未来升级企业主体并恢复手机号登录，再重新验证 `getPhoneNumber` 与短信兜底。

7. **阶段 27：小程序 AI 与同步体验补齐**
   - 状态：已完成工程闭环。
   - 实施计划：`docs/superpowers/plans/2026-05-25-pinganpi-miniprogram-ai-sync-experience.md`。
   - 已新增 `apps/miniprogram/services/ai-scribe-cloud.ts`，小程序通过 `pinganpi-ai/scribeDraft` 非流式起稿；服务端 `scribeDraft` 映射为页面 `draftText`，失败归一为受控错误。
   - 写信页已接入 AI 起稿状态机：`draftStatus`、`draftErrorText`、`draftSource`、`generationMeta`；pending 禁用下一步和投寄，失败保留口述且不回退模板正文。
   - 今日页已新增“同步簿”，通过 `pinganpi-sync/health` 展示 dev / prd 环境、最近查验和克制失败摘要。
   - DevTools `flow` 已改为使用云函数测试桩覆盖 AI 成功路径，避免日常自动化消耗真实 MiMo 额度；`cloud1-...` dev 环境真实 MiMo 起稿 smoke 已通过，后续仍需控制真实调用频率。
   - 小程序端流式结论：当前 CloudBase event 云函数主链路不能按浏览器 SSE 方式消费分片；本期不纳入流式实现，后续若恢复流式需另开 HTTP / `wx.request` 专项。

8. **阶段 28：小程序 UI 完整重设计**
   - 状态：已完成。
   - 设计文档：`docs/superpowers/specs/2026-06-07-pinganpi-miniprogram-ui-redesign-design.md`。
   - 实施计划：`docs/superpowers/plans/2026-06-07-pinganpi-miniprogram-ui-redesign.md`。
   - 设计概念图：`docs/assets/stage28-ui-redesign/non-retro-ui-concept.png`。
   - 全小程序改为非复古、安静现代视觉；不要恢复泛黄纸张、印章、账簿、旧报纸纹理或仿古装饰。
   - 今日、写信、先生、钱匣、信箱、档案、账号和关系页已统一现代 token、轻边框、状态 pill、摘要卡、表单和按钮样式。
   - 写信页可保留私密编辑感，但不得改成聊天气泡、即时消息流或营销页。
   - 本阶段只改视觉系统、页面层级和状态表达，不改变领域规则、云函数协议、AI 起稿状态机、账号授权或同步边界。

9. **阶段 29：微信小程序上架配置**
   - 状态：下一步。
   - AppID、主体认证 / 个人主体服务类目、隐私保护指引、CloudBase `prd` 环境、审核发布需要用户人工介入；当前个人主体路径不申请手机号能力。

10. **阶段 30：小程序完整人工验证**
   - 双账号双端、AI 起稿、写信、真实等待、拆阅归档、断网恢复、`prd` smoke。

11. **阶段 31-34：异常、订阅消息、照片附件、发布打磨**
   - 原邮政异常、推送、照片附件和发布准备阶段顺延到小程序闭环后。

旧 App 历史阶段参考：

1. **阶段 13：云端 AI 代理与费用配置**
   - 阶段 13 工程链路已完成；真实 MiMo env、云函数 / CloudBase 落点、密钥 secret、禁用 / 恢复、资源删除 / 回滚步骤已建立。
   - 控制台费用告警、默认角色收敛、MiMo key 撤销 / 轮换入口等需要用户介入的事项统一移入阶段 19。
   - 真实 MiMo key 不要在聊天中发送；只能放在本机服务端 env、`.env.local` 或云平台 secret 中。
   - 本机优先使用 `.env.ai.local` 保存 MiMo env；该文件已被 Git 忽略，脚本会自动读取。真实 key 已在本机文件中配置，不要打印、发到聊天或提交到 Git。
   - Prompt 已补充约束：禁止 AI 编造日期、农历、干支或未给出的具体时间。
   - 本地代理已加入费用护栏：`PINGANPI_AI_MAX_ORAL_TEXT_CHARS` 默认 800，`MIMO_MAX_COMPLETION_TOKENS` 默认 900；这不能替代阶段 19 的云端预算和 MiMo 控制台费用告警。
   - `services/ai-scribe-proxy/handler.ts` 是云端代理入口应复用的核心边界；不要在 CloudBase / 云函数入口复制一套校验、prompt 或错误处理。
   - 用户已购买腾讯云 CloudBase，云端落点确定为 CloudBase HTTP 云函数。
   - CloudBase 环境 ID 为 `pinganpi-d7gml1f6sbcc172ea`，区域为 `ap-shanghai`。
   - CloudBase 默认代理地址为 `https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api`。客户端配置应使用完整 `/api` 前缀：`VITE_PINGANPI_AI_PROXY_URL=<该地址>`。
   - 项目已安装 `@cloudbase/cli`，使用 `npm run cloudbase:login` 登录，使用 `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env` 从本机 `.env.ai.local` 脱敏配置云端 env，使用 `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env` 临时移除云端 `MIMO_API_KEY` 并让 AI 起稿失败关闭，使用 `CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:ai` 部署 AI 代理。
   - CloudBase 生成目录 `cloudbase/functions/` 已被 Git 忽略；部署前运行 `npm run cloudbase:build:ai` 重新生成。
   - CloudBase HTTP 函数名为 `ai-scribe-proxy`，运行时 `Nodejs20.19`；构建入口会生成 Web Server 模式所需 `scf_bootstrap`。
   - 云端代理支持 `/api/health` 和 `/api/ai/scribe-draft`；历史遗留 `/*` 路由已删除，只保留 `/api`，`/health` 根路径当前会被 CloudBase 网关判定为无效路径，验证时使用 `/api/health`。
   - 云端 env 缺失时 `POST /api/ai/scribe-draft` 会返回受控 `502 proxy_unavailable`，不会打印或返回 provider 原始 body。
   - 需要用户从 Xiaomi MiMo 订阅页确认 `MIMO_API_BASE_URL`、`MIMO_MODEL_ID`、key 类型是 `tp-` 还是 `sk-`、额度和费用提醒方式。
   - 云端真实 AI 起稿、浏览器写信页云端 AI 起稿烟测、禁用 key 安全失败验证、恢复验证和路由收敛已通过；不要再把这一步标为未部署。
   - CloudBase 用量检查命令：`CLOUDBASE_ENV_ID=<env-id> cloudbase env usage --json`。最近基线为计费周期 `2026-05-23 ~ 2026-06-23`，`usedCredits: 0.56`，其中 NoSQL Database `0.52`、Cloud function `0.01`、API calls `0.03`。
   - 云函数公开面检查：状态 Available，触发器数量为 0，VPC 未配置，env 仅包含 AI 代理变量；默认角色为 `TCB_QcsRole`，是否支持更细粒度角色移入阶段 19 确认。
   - 不默认购买 CVM 或高规格包年资源。
   - 同步数据库、文件存储、身份认证和推送资源本阶段只做评估，不正式购买 / 初始化。

2. **阶段 14：AI 起稿流式体验优化的补测**
   - 工程实现已完成并部署：本地 / 云端代理支持 MiMo OpenAI-compatible `stream: true`，但保留非流式 `/ai/scribe-draft` 作为兜底。
   - App 起稿时边收边显示，完成前不能进入校改、投寄或保存为可投寄正文。
   - 流式中断时标记未完成并允许重新起稿，不暴露 provider 原始 chunk、完整 prompt 或 key。
   - GUI 浏览器点击验证待补：当前 Computer Use 缺少 macOS Accessibility / Screen Recording 权限。
   - 不改变写信、投寄、费用、送达和拆阅规则。

3. **阶段 15：云端与双人同步准备**
   - 阶段 15 已完成基础；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-cloud-sync-design.md`，实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-cloud-sync-foundation.md`。
   - 新同步模块位于 `apps/legacy-capacitor/src/app/sync/`：`remote-model.ts`、`remote-snapshot.ts`、`mock-remote-adapter.ts` 及对应测试。
   - 定义远端数据模型，不把整个 `AppState` 当成唯一同步单位。
   - 建立 sync adapter 边界，保持 `apps/legacy-capacitor/src/domain` 无云端依赖。
   - 设计 household / pair、members、wallets、ledger entries、draft papers、letters、postal records、sync cursors。
   - 远端模型显式包含 AI metadata，但不保存完整 prompt、原始 provider response 或敏感日志。
   - 预留邮政异常状态和记录类型，以及照片附件到达前不可访问的控制原则。
   - 设计 append-only 记录去重、信件状态单向推进、草稿冲突、草稿删除 tombstone 和钱包结算策略。
   - 远端记录预留 `deviceId` / `createdByDeviceId` / `updatedByDeviceId`，避免双设备 id 冲突和同时间冲突决胜不稳定。
   - 远端实体实际按 `remoteId` 去重，`id` 仅保留原始本地 id；收件方 pull 未到达来信时拿不到正文、摘要、口述、起稿正文或 AI metadata。
   - 已使用本地 mock remote adapter 和测试验证双设备合并。
   - 本阶段不接真实 CloudBase 数据库 SDK，不改 `apps/legacy-capacitor/src/domain`，不让远端同步绕过投寄、拆阅、钱匣和邮政状态机规则。

4. **阶段 16：双人真实同步 MVP**
   - 阶段 16A 已完成；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-dual-sync-mvp-design.md`，实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-dual-sync-mvp.md`。
   - 阶段 16B 工程实现已完成；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-cloudbase-sync-design.md`，实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-cloudbase-sync-adapter.md`。
   - 已用本地 / 模拟远端完成 App 侧同步闭环，并已完成 CloudBase HTTP 同步代理真实云端 smoke。
   - 新增同步 runtime、本地同步元数据、浏览器本地 remote adapter、同步状态 UI 和本地双设备生命周期测试。
   - 新增 `apps/legacy-capacitor/src/app/sync/http-remote-adapter.ts` 和 `apps/legacy-capacitor/src/app/sync/remote-adapter-factory.ts`；默认本地 adapter，配置 `VITE_PINGANPI_SYNC_PROXY_URL` 后才启用 HTTP 同步，配置 `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 后由客户端发送 `X-Pinganpi-Sync-Token`。
   - 新增 `services/sync-proxy/`：handler、CloudBase store、CloudBase event 入口、HTTP server 和 bootstrap；服务端用 `PINGANPI_SYNC_MEMBER_TOKENS` / `PINGANPI_SYNC_MEMBER_TOKENS_B64` 将 `householdId + memberId` 绑定到 token，缺失配置时同步请求 fail closed。
   - 服务端返回 snapshot 前必须过滤对方私有草稿，并 redaction 未到达来信正文 / 摘要 / 口述 / AI metadata，同时清空 `photoAttachments`，避免附件定位信息提前泄露。
   - CloudBase store 使用真实 SDK 写入形态 `doc.set(data)` / `transaction.set(docRef, data)`，写入数据不包含 `_id` 字段。
   - 新增 `tools/scripts/build-cloudbase-sync-proxy.ts`、`tools/scripts/configure-cloudbase-sync-env.ts`、`tools/scripts/smoke-cloudbase-sync-proxy.ts`、`npm run cloudbase:build:sync`、`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:sync-env`、`npm run cloudbase:smoke:sync`、`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:sync`；生成目录 `cloudbase/functions/sync-proxy/` 被 Git 忽略。
   - CloudBase 集合 `pinganpi_sync_snapshots` 已创建；HTTP 路由使用显式 `/sync/health`、`/sync/pull`、`/sync/push`，不要使用 `/api/sync/*` 或 `/sync/*`。
   - CloudBase 同步集合默认名为 `pinganpi_sync_snapshots`，可用 `PINGANPI_SYNC_SNAPSHOT_COLLECTION` 覆盖。
   - 两台设备共享同一对通信关系的数据。
   - 启动 pull、关键操作 push、回到前台 refresh。
   - 第一版只保证离线草稿；投寄和拆阅必须联网校验后才正式生效。
   - 本地调试使用 device namespace：同一浏览器可用不同 `device` 参数模拟两台设备，本地 AppState 分开，remote snapshot 共享。
   - 真实 CloudBase 部署 smoke 已通过；费用告警和默认角色收敛已在阶段 19 收口，小程序迁移后的双真机人工验证顺延到阶段 30。
   - 后续若支持离线投寄 / 拆阅请求，必须作为 command 入队，联网后重新校验钱包、状态机、收件人和到达时间。

5. **阶段 17：手机号账号系统**
   - 阶段 17 是独立账号系统阶段；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-phone-account-design.md`。
   - 阶段 17 工程闭环已完成；实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-account-pair-binding.md`。
   - 新增 `apps/legacy-capacitor/src/app/account/account-model.ts` 和 `apps/legacy-capacitor/src/app/account/local-account-adapter.ts`：本地手机号 mock 登录、稳定 `PinganpiAccount`、登录态恢复、登出和完整手机号展示。
   - 新增 `apps/legacy-capacitor/src/app/pages/AccountGatePage.vue`：未登录或未绑定时先进入账号簿，不进入写信主流程。
   - 新增 `services/account-pair/account-pair-service.ts`：按受信任 `authUid` 确保同一平安批业务账号，并更新 `lastLoginAtIso`。
   - 账号档案允许保存完整手机号，App 可展示当前登录手机号；不要把手机号复制到信件、邮政记录、AI metadata 或无关日志。
   - 真实 CloudBase 手机号验证码、token / refresh token 已在旧 App 阶段 19 收口到平台配置；小程序迁移后的账号恢复验证顺延到阶段 26 / 29。

6. **阶段 18：双人绑定与同步授权**
   - 设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-pair-binding-design.md`。
   - 阶段 18 工程闭环已完成；实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-account-pair-binding.md`。
   - 新增 `apps/legacy-capacitor/src/app/account/local-pair-binding-adapter.ts`：本地创建 household / pair、24 小时一次性邀请码、输入即加入、唯一 active household、自邀 / 过期 / 已用 / 满员拒绝。
   - 新增 `apps/legacy-capacitor/src/app/account/account-sync-config.ts`：已有绑定时用绑定的 household / member 驱动现有浏览器同步命名空间；无绑定时保留阶段 16 URL 参数调试。
   - `apps/legacy-capacitor/src/App.vue` 已接入账号 / 绑定入口；创建或加入关系后刷新一次，让同步 runtime 以正确 household / member 启动。
   - `services/sync-proxy/handler.ts` 已支持账号成员授权配置：服务端可从可信 auth uid 映射出 `householdId/memberId`，并覆盖客户端传入值；手工 member token 仅保留为阶段 16B 开发 fallback。
   - `services/sync-proxy/runtime-auth.ts` 支持 `PINGANPI_SYNC_ACCOUNT_BINDINGS` / `PINGANPI_SYNC_ACCOUNT_BINDINGS_B64` 和 `PINGANPI_SYNC_TRUSTED_AUTH_UID_HEADER`。
   - 不做独立设备授权、设备同步 token 签发、token 轮换或设备撤销；`deviceId` 只用于本地安装实例、同步 cursor、冲突标记和调试。
   - 不做多人关系、社交好友系统或现代在线状态。

7. **阶段 19：外部平台人工配置收口**
   - 统一处理需要用户介入的控制台、验证码、真实环境和费用事项。
   - 状态：已收口；执行计划为 `docs/superpowers/plans/2026-05-24-pinganpi-external-platform-closure.md`。
   - 已新增 `tools/scripts/audit-cloudbase-stage19.ts` 和 `npm run cloudbase:audit:stage19`，用于脱敏审计 CloudBase 用量和函数状态；不要再直接把 `cloudbase fn detail` 原始输出发给用户，因为它会明文返回 env。
   - 当前审计基线：CloudBase 计费周期 `2026-05-23 ~ 2026-06-23`，用量 `1.67 / 3000 credits`；`ai-scribe-proxy` 与 `sync-proxy` 均为 `Active / Available`，运行时 `Nodejs20.19`，PublicNet `ENABLE`，触发器 `0`，VPC 未配置，角色均为 `TCB_QcsRole`。
   - 用户确认当前 CloudBase 套餐 / 版本为腾讯云开发免费体验版；官方价格文档显示免费体验环境提供 `3000 点/月`，单次可续费 6 个月，不支持自动续费；免费环境可购买 Token 点资源包，暂不支持加购扩展资源包、大促资源包和开启按量付费。
   - 用户确认当前策略是不启用 CloudBase 按量付费，仅使用套餐内资源点；若后续资源不够再升级套餐。因此阶段 19 不把预算管理作为阻塞项；后续只要升级套餐、转付费、开启按量付费或新增腾讯云资源，必须重新配置预算 / 费用提醒检查。
   - 用户已在 CloudBase 控制台开启手机号短信登录；两个真实手机号验证码均已实际收到；短信资源包已购买；短信签名入口未找到；控制台未看到发送限制和费用说明，发送限制和费用策略暂以官方资料基线为准。
   - 短信发送限制和费用基线已记录：新开通按量计费环境首月 100 条免费额度；超出免费额度可购买资源包；同一号码 30 秒最多 1 条，同一手机号一个自然日最多 10 条。
   - App 第一版手机号登录采用 CloudBase Auth v2 HTTP API，不引入 CloudBase JS SDK：发送验证码 `/auth/v1/verification`，验证验证码 `/auth/v1/verification/verify`，登录 `/auth/v1/signin`，刷新 `/auth/v1/token`。
   - 账号 / 关系集合名确定为 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`；账号 / 关系写入必须走服务端可信身份边界，客户端不得直接写授权结果。
   - 2026-05-24 HTTP 路由 smoke 已确认：`/api/health` 和 `/sync/health` 返回 200；`/sync/pull` 与 `/sync/push` 未带 token 返回 401。
   - 2026-05-24 CLI 路由查询已确认：`/api` 指向 `ai-scribe-proxy`；`/sync/health`、`/sync/pull`、`/sync/push` 指向 `sync-proxy`；四条路由均启用，类型均为 `WEB_SCF`。
   - 2026-05-24 CLI 权限查询已确认：`pinganpi_sync_snapshots`、`pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites` 均为 `PRIVATE`；函数 invoke 权限为自定义规则，但 HTTP 访问服务路由 `enableAuth=false`，代理 handler 仍必须继续做应用层校验。
   - 2026-05-24 CLI 角色查询：只有系统角色，自定义角色 0 个；函数运行角色仍显示为 `TCB_QcsRole`。官方文档说明普通单环境账号可直接使用默认角色，本项目当前是单 CloudBase 环境，本阶段接受默认角色；后续多环境 / 多租户 / 商业化管理后台前必须复查并考虑每环境独立 CAM 角色。
   - 腾讯云预算建议保留为后续升级付费时使用：先建月度费用预算，费用范围选全部范围，推荐 `10 元/月`，阈值提醒使用 `80%` 和 `100%`；当前免费体验版不启用按量付费，本阶段暂缓预算管理。
   - MiMo 额度、费用提醒、key 撤销 / 轮换入口已暂缓；当前已有字符 / token 护栏和 `cloudbase:disable:ai-env` 停用方案。正式发布、扩大使用范围、怀疑 key 泄露、接入新模型或发生异常费用前必须复查。
   - 阶段 19 计划已新增剩余人工回报模板；用户按模板回报后再把对应人工项标记为完成、暂缓或不可配置。
   - 包括 CloudBase Auth 手机号验证码、短信签名 / 模板、账号 / 关系 CloudBase 持久化、数据库集合权限、HTTP 路由、费用告警、默认角色收敛、MiMo key 撤销 / 轮换入口和真实手机号验证码。
   - 不在本阶段新增业务功能，不把控制台 secret、验证码或真实 key 写入仓库。

8. **阶段 20：旧 App 完整人工验证引导**
   - 状态：计划已准备但暂存，执行计划为 `docs/superpowers/plans/2026-05-24-pinganpi-full-manual-verification.md`。
   - 小程序迁移后不作为当前主线执行，可作为业务验收 checklist 参考。
   - 原计划由 Codex 引导用户对旧 App 做端到端人工验证。
   - 覆盖账号登录、创建关系、邀请码加入、双设备同步、AI 起稿、写信投寄、真实等待送达、拆阅、断网恢复、iOS / Android 真机和 WebView console。
   - 验证记录建议写入 `docs/superpowers/reports/2026-05-24-pinganpi-full-manual-verification.md`。
   - 验证记录只写通过 / 失败 / 阻塞 / 待修复项，不记录手机号验证码、完整手机号、真实 key、SecretId、SecretKey、CloudBase token、MiMo key 或敏感正文。

9. **阶段 31：邮政异常规则**
   - 延误、错分、迷失、找回、退回采用确定性种子推进。
   - 所有异常必须产生邮政记录。

10. **阶段 32：系统推送 / 订阅消息**
   - 只推重要信、挂号信、迷失信找回、退回等少量事件。
   - 普通信默认不主动推送。

11. **阶段 33：照片附件**
   - 夹寄照片、费用、附件状态、到达前不泄露。
   - 云端文件存储依赖阶段 15 的规划；具体云存储购买 / 配置在阶段 33 实施，必要的控制台动作归入阶段 29 或当期上架配置阶段。

12. **阶段 34：发布准备与体验打磨**
   - toast / snackbar、小程序图标、启动配置、真机验证、隐私与备份检查。

## 开发原则

- 新主线移动端优先，目标运行环境是微信小程序，同时保证微信开发者工具和 PC 预览可用。
- 小程序 UI 使用 WXML / WXSS / TypeScript 和本地组件。
- 旧 App 的 Tailwind CSS / Varlet / Vue 页面只作为历史实现参考，不作为小程序 UI 主线。
- 小程序 UI 当前采用非复古、安静现代方向；不要恢复泛黄纸张、印章、账簿、旧报纸纹理或仿古装饰。
- 写信页可以保留更亲密的编辑感，但不得改成聊天气泡或即时消息流。
- 不要把小程序做成网页营销页或现代聊天页。
- 不要显示现代实时地图。
- AI 起稿已完成旧 App 侧与本地 / 云端流式代理链路；小程序迁移后先保证非流式起稿和失败关闭，流式输出单独验证。
- 不要在领域层引入小程序、浏览器、Capacitor、CloudBase、云服务或 UI 依赖。
- 对新增业务规则写测试，优先使用 Vitest。
- 小程序前端页面优先用微信开发者工具验证，再做真机预览 / 体验版验证。

## 验证要求

常规代码改动后至少运行：

```bash
npm test
npm run typecheck
```

涉及旧 App 构建、Capacitor、依赖或旧前端入口时运行：

```bash
npm run build
npm run cap:sync
npm run cap:doctor
```

涉及依赖时运行：

```bash
npm audit --omit=dev
```

阶段 24 后，小程序相关改动至少运行：

```bash
npm run miniprogram:typecheck
npm run miniprogram:check-shared
npm run miniprogram:check
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:smoke
WECHAT_DEVTOOLS_PORT=<port> npm run miniprogram:devtools:flow
npm run cloudbase:build:miniprogram
npm test -- apps/miniprogram/config/env.test.ts
npm test -- apps/miniprogram/services/domain-summary.test.ts
npm test -- apps/miniprogram/services/local-model.test.ts
npm test -- apps/miniprogram/services/write-flow.test.ts
npm test -- apps/miniprogram/services/cloud-functions.test.ts
npm test -- services/miniprogram-functions/pinganpi-ai.test.ts
npm test -- services/miniprogram-functions/pinganpi-sync.test.ts
npm test -- services/miniprogram-functions/pinganpi-account.test.ts
npm test -- services/miniprogram-functions/pinganpi-pair.test.ts
npm test -- tools/scripts/smoke-cloudbase-miniprogram-functions.test.ts
```

修改 `packages/domain/src/` 后必须运行 `npm run miniprogram:sync-shared` 更新小程序根内副本，并用 `npm run miniprogram:check-shared` 确认副本未陈旧；该检查会动态发现新增 `.ts` 领域文件。

微信开发者工具自动化依赖 `设置 -> 安全设置 -> 服务端口`。当前已验证端口为 `62046`；端口变化时改用新的 `WECHAT_DEVTOOLS_PORT`，不要硬编码到源码。

已知现象：

- `npm run build` 目前会提示 Varlet 相关首包超过 500 KB。这个是旧 App 优化项，不是小程序迁移阻塞项。

## 小程序调试提示

- 用微信开发者工具打开 `apps/miniprogram/`。
- 小程序本地开发默认连接 CloudBase `dev` 环境。
- 小程序端通过 `wx.cloud.callFunction` 调用云函数，不依赖本地 proxy 才能完成主流程。
- 若开发者工具控制台报 `app.json: 未找到 ["pages"][0] 对应的 ...index.js 文件`，先检查 `apps/miniprogram/project.config.json` 和本机 `apps/miniprogram/project.private.config.json` 是否启用了 `setting.useCompilerPlugins: ["typescript"]`，然后关闭并重新打开项目。
- `prd` 只用于审核、发布和线上 smoke；部署生产必须显式指定环境。
- AppID、主体 / 服务类目、隐私保护指引、CloudBase 环境关联和审核发布需要用户在微信公众平台 / 微信开发者工具 / 腾讯云控制台确认；当前个人主体路径不依赖手机号能力。

## Capacitor 调试提示（旧 App）

- 浏览器优先：`npm run dev`。
- 不使用 live reload 时，Web 改动进入原生壳前必须执行 `npm run cap:sync`。
- iOS 调试入口：`npm run cap:open:ios`。
- Android 调试入口：`npm run cap:open:android`。
- iOS WebView console 用 Safari Web Inspector。
- Android WebView console 用 Chrome `chrome://inspect/#devices`。

当前本机原生调试环境状态记录在：

- `docs/superpowers/plans/2026-05-23-pinganpi-native-debug-environment.md`

截至该记录：

- Android 原生调试环境已可用，App 已成功安装并启动过。
- Xcode 26.5 已可用，iOS Simulator 已成功安装并启动 App。
- iOS Safari Web Inspector 的 WebView console 仍需手工确认。

## Git 与发布状态

- 当前迁移工作基于 `codex/wechat-miniprogram-pivot`。如需回到 `main` 或创建新分支，先确认用户意图。
- 当前本地 `main` 可能尚未 push 到远端，继续开发或发布前先确认：

```bash
git status --short --branch
git remote -v
git log --oneline --decorate -5
```

- 如需 push 或创建 PR，先征得用户明确同意。

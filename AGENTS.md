# AGENTS.md

本文件适用于整个 `/Users/zhujunjie/code/pinganpi` 仓库。它的目标是让后续代理即使脱离当前对话上下文，也能根据既有产品设定、代码状态和路线计划继续开发《平安批》。

## 基本协作规则

- 始终使用简体中文回复用户，除非用户明确要求其他语言。
- 默认在主目录开发：`/Users/zhujunjie/code/pinganpi`。
- 不要再默认创建或使用 `.worktrees/`。只有用户明确要求隔离 worktree 时才使用。
- 改代码前先运行 `git status --short --branch`，确认当前分支和未提交改动。
- 不要覆盖用户未提交改动。遇到不属于本次任务的改动，先理解并避开。
- 手工编辑文件使用 `apply_patch`。
- 提交消息必须使用 Conventional Commits，摘要使用简体中文，例如 `feat(app): 添加本地草稿保存`。
- 不要添加 AI 署名、`@mention` 或 GitHub 自动关闭关键词。

## 产品上下文

《平安批》是只给两个人使用的 iOS/Android 慢通信 App，不是网页聊天产品。核心体验是模拟 1960 年左右中国旧时代纸质信件通信：

- App 内时间 = 现实时间减 66 年。
- 现实 `2026 年 5 月 23 日` 对应 App 内 `一九六〇年五月二十三日`。
- 真实时间默认隐藏，只在需要时显示：`今时对应：2026 年 5 月 23 日`。
- 信件按真实时间等待，预计几天到就现实中真的等几天。
- 写信入口是代笔先生，不是现代即时聊天输入框。
- 寄信需要付代书费、邮资等，余额不足不能投寄，不允许赊账。
- 普通信不主动推送，用户需要打开今日信箱查看。
- 整体视觉是克制的文字档案风格：旧账簿、代书簿、寄信存根、邮局登记册、旧信件。
- 不做现代聊天气泡、消息流、实时地图、物流进度条、夸张动画或游戏化任务。

完整产品文档：

- `docs/superpowers/specs/2026-05-23-pinganpi-design.md`

## 当前技术栈

- TypeScript
- Vue 3
- Vite
- Tailwind CSS
- Varlet
- Capacitor
- Vitest
- iOS 原生工程：`ios/`
- Android 原生工程：`android/`

本地开发命令：

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run cap:sync
npm run ai-proxy:check
npm run ai-proxy:dev
npm run cloudbase:login
npm run cloudbase:build:ai
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:ai
npm run cloudbase:build:sync
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:sync-env
npm run cloudbase:smoke:sync
CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:sync
npx cap doctor
```

## 当前代码状态

当前主线开发基于 `main`，最新路线图基线为：**阶段 17 / 18 已完成工程闭环：阶段 17 新增手机号账号本地 adapter、稳定 `PinganpiAccount`、登录态恢复和账号入口页；阶段 18 新增创建一对关系、24 小时一次性邀请码、输入即加入、唯一 active household、本地绑定驱动同步命名空间、服务端账号 / 关系约束和 `sync-proxy` 账号成员授权边界。阶段 16 双人真实同步 MVP 已完成云端 smoke 收口：阶段 16A 的同步 runtime、本地同步状态、localStorage remote adapter、浏览器 device / household 配置、联网投寄 / 拆阅护栏和双设备生命周期测试已完成；阶段 16B 的 HTTP SyncAdapter、`VITE_PINGANPI_SYNC_PROXY_URL` / `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 配置开关、CloudBase `sync-proxy` HTTP 函数、CloudBase 数据库 snapshot store、服务端 redaction / 私有草稿 / 照片附件过滤、member token fail closed、stale revision CAS、构建 / 部署 / env / smoke 脚本已完成；CloudBase 集合 `pinganpi_sync_snapshots` 已创建，显式路由 `/sync/health`、`/sync/pull`、`/sync/push` 已配置，云端 smoke 已通过 health、未带 token 401、合法 pull、push、再 pull。阶段 19 正在收口外部平台配置：CloudBase 手机号短信登录已开启且两个真实手机号验证码均已收到；App 登录确定采用 CloudBase Auth v2 HTTP API；账号 / 关系集合命名、集合权限、HTTP 路由 smoke 和 CLI 路由查询已确认；预算告警、函数运行角色收敛、MiMo key 管理和真实双设备验证继续放到阶段 19 / 20。阶段 20 是完整人工验证引导。阶段 15 已完成云端与双人同步准备基础，远端实体使用 `remoteId` 避免跨设备同本地 id 数据丢失，pull 会按成员 redaction 未到达来信正文，本地删除草稿会生成 tombstone。阶段 16 设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-dual-sync-mvp-design.md` 和 `docs/superpowers/specs/2026-05-24-pinganpi-cloudbase-sync-design.md`，阶段 17 设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-phone-account-design.md`，阶段 18 设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-pair-binding-design.md`，阶段 17 / 18 实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-account-pair-binding.md`。阶段 13 已跑通本机 Xiaomi MiMo、本地代理、App 写信页、CloudBase HTTP 云函数部署、云端 secret 配置、云端 AI 起稿接口、浏览器写信页云端 AI 烟测、CloudBase 用量基线、禁用 key 安全失败验证、恢复验证和 `/*` 路由清理；控制台人工事项统一进入阶段 19。阶段 14 已完成本地 / 云端受控 SSE、App streaming adapter、写信页 partial 预览和完成前不可投寄保护，并已部署 CloudBase 后通过 `/api/ai/scribe-draft/stream` 非敏感烟测；GUI 浏览器点击验证因 Computer Use 权限未授予待补**。继续开发前以 `git log --oneline --decorate -5` 为准。

最新关键提交以 `git log --oneline --decorate -8` 为准；阶段 13 相关提交包括：

- `274ba0d build(cloudbase): 添加 AI 代理部署入口`
- `11a1a4b refactor(ai): 抽出代理请求 handler`
- `44d2f06 feat(ai): 添加本地费用护栏`
- `6da325f docs: 将 AI 流式起稿拆为独立阶段`
- `802ce24 feat(app): 接入写信页 AI 起稿`

已完成阶段：

### 阶段 1：领域层基础

位置：`src/domain/`

已实现：

- 66 年时间映射。
- 中国大陆 `Asia/Shanghai` 本地日历边界。
- 旧币制金额 helper。
- 代笔先生模型与确定性每日出勤。
- 钱匣余额自然增长 / 自然消耗结算。
- 1960 年邮政风格邮资、传递窗口、信件状态机。

重要要求：

- 后续 UI、持久化、云端、通知等层不要重复实现领域规则。
- 所有时间、钱、代书先生出勤、邮资、邮路、信件状态计算优先复用 `src/domain`。

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

- `src/App.vue`
- `src/main.ts`
- `src/styles.css`
- `src/app/mock-data.ts`
- `src/app/app-model.ts`
- `src/app/app-model.test.ts`
- `src/app/pages/`
- `capacitor.config.ts`

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
- 本地最小 AI 代理脚手架：`server/ai-scribe-proxy/`、MiMo config/client、可复用 handler、`GET /health`、`POST /ai/scribe-draft`、本地 Origin 限制、32 KB 请求体限制、`npm run ai-proxy:check`、`npm run ai-proxy:dev`。
- App 侧 AI 起稿链路：`src/app/ai-scribe-adapter.ts`、`VITE_PINGANPI_AI_PROXY_URL` 代理配置、写信页异步起稿、AI metadata 持久化、失败不回退模板正文。
- 阶段 13 工程链路已完成，控制台人工事项已移入阶段 19：`npm run ai-proxy:check` / `npm run ai-proxy:dev` 已读取本机 `.env.ai.local` 并跑通真实 Xiaomi MiMo；本地代理 `/ai/scribe-draft`、写信页真实 AI 起稿烟测、本地费用护栏、可复用 handler 边界、CloudBase HTTP 云函数、云端 secret、`/api` 路由、云端 AI 起稿接口、浏览器写信页云端 AI 烟测、禁用 key 安全失败验证、恢复验证和 `/*` 路由清理已通过。
- 阶段 14 已完成工程实现：新增 `POST /ai/scribe-draft/stream` 和 CloudBase `POST /api/ai/scribe-draft/stream`，服务端只输出受控 SSE `delta` / `done` / `error`；App 侧 `generateDraftStream` 边收边显示，`done` 前不进入可投寄正文；保存口述草稿不会在 AI 失败后回落到模板正文。
- MiMo stream client 必须收到 provider `data: [DONE]` 才会完成；partial delta 后 EOF 会转为受控失败，避免半截正文进入可投寄状态。

已验证基线记录在：

- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`
- `docs/superpowers/specs/2026-05-23-pinganpi-ai-scribe-design.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-minimal-ai-proxy.md`

最近验证基线：阶段 17 / 18 已通过 `git diff --check`；`npm test`：40 个测试文件、320 个测试通过；`/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` 通过；`/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build` 通过但保留 Varlet 首包超过 500 KB 的既有提示；`/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx scripts/build-cloudbase-sync-proxy.ts` 通过；`cap sync` / `cap doctor` 通过；`npm audit --omit=dev` 通过，0 vulnerabilities；真实 key 正则扫描无命中；浏览器烟测 `http://localhost:5174/` 已验证账号簿、手机号本地登录、创建关系、生成邀请码和进入主界面。阶段 16B 云端基线保留：`CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:deploy:sync` 通过，`npm run cloudbase:smoke:sync` 已通过真实云端 smoke。为避免 `@cloudbase/node-sdk` 传递引入存在原型污染公告的 `lodash.set` / `lodash.unset` 小包，已通过 `vendor/lodash-set` 和 `vendor/lodash-unset` 提供兼容 shim，内部调用已修复的主 `lodash` 子模块。

## 后续路线

以后开始新任务前，优先读取：

- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`
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

- 每次阶段完成、阶段拆分 / 合并、下一阶段推荐顺序变化、验证基线变化或集中 UI 问题变化时，必须同步更新 `docs/pinganpi-roadmap.md`、`docs/pinganpi-roadmap-dashboard.html` 和 `AGENTS.md`；如涉及具体设计或实施边界，也要同步相关 spec / plan 文档。
- `docs/pinganpi-roadmap.md` 是详细文字源；`docs/pinganpi-roadmap-dashboard.html` 是给用户日常查看的静态可视化看板，不属于正式 App。
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

1. **阶段 13：云端 AI 代理与费用配置**
   - 阶段 13 工程链路已完成；真实 MiMo env、云函数 / CloudBase 落点、密钥 secret、禁用 / 恢复、资源删除 / 回滚步骤已建立。
   - 控制台费用告警、默认角色收敛、MiMo key 撤销 / 轮换入口等需要用户介入的事项统一移入阶段 19。
   - 真实 MiMo key 不要在聊天中发送；只能放在本机服务端 env、`.env.local` 或云平台 secret 中。
   - 本机优先使用 `.env.ai.local` 保存 MiMo env；该文件已被 Git 忽略，脚本会自动读取。真实 key 已在本机文件中配置，不要打印、发到聊天或提交到 Git。
   - Prompt 已补充约束：禁止 AI 编造日期、农历、干支或未给出的具体时间。
   - 本地代理已加入费用护栏：`PINGANPI_AI_MAX_ORAL_TEXT_CHARS` 默认 800，`MIMO_MAX_COMPLETION_TOKENS` 默认 900；这不能替代阶段 19 的云端预算和 MiMo 控制台费用告警。
   - `server/ai-scribe-proxy/handler.ts` 是云端代理入口应复用的核心边界；不要在 CloudBase / 云函数入口复制一套校验、prompt 或错误处理。
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
   - 新同步模块位于 `src/app/sync/`：`remote-model.ts`、`remote-snapshot.ts`、`mock-remote-adapter.ts` 及对应测试。
   - 定义远端数据模型，不把整个 `AppState` 当成唯一同步单位。
   - 建立 sync adapter 边界，保持 `src/domain` 无云端依赖。
   - 设计 household / pair、members、wallets、ledger entries、draft papers、letters、postal records、sync cursors。
   - 远端模型显式包含 AI metadata，但不保存完整 prompt、原始 provider response 或敏感日志。
   - 预留邮政异常状态和记录类型，以及照片附件到达前不可访问的控制原则。
   - 设计 append-only 记录去重、信件状态单向推进、草稿冲突、草稿删除 tombstone 和钱包结算策略。
   - 远端记录预留 `deviceId` / `createdByDeviceId` / `updatedByDeviceId`，避免双设备 id 冲突和同时间冲突决胜不稳定。
   - 远端实体实际按 `remoteId` 去重，`id` 仅保留原始本地 id；收件方 pull 未到达来信时拿不到正文、摘要、口述、起稿正文或 AI metadata。
   - 已使用本地 mock remote adapter 和测试验证双设备合并。
   - 本阶段不接真实 CloudBase 数据库 SDK，不改 `src/domain`，不让远端同步绕过投寄、拆阅、钱匣和邮政状态机规则。

4. **阶段 16：双人真实同步 MVP**
   - 阶段 16A 已完成；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-dual-sync-mvp-design.md`，实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-dual-sync-mvp.md`。
   - 阶段 16B 工程实现已完成；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-cloudbase-sync-design.md`，实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-cloudbase-sync-adapter.md`。
   - 已用本地 / 模拟远端完成 App 侧同步闭环，并已完成 CloudBase HTTP 同步代理真实云端 smoke。
   - 新增同步 runtime、本地同步元数据、浏览器本地 remote adapter、同步状态 UI 和本地双设备生命周期测试。
   - 新增 `src/app/sync/http-remote-adapter.ts` 和 `src/app/sync/remote-adapter-factory.ts`；默认本地 adapter，配置 `VITE_PINGANPI_SYNC_PROXY_URL` 后才启用 HTTP 同步，配置 `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 后由客户端发送 `X-Pinganpi-Sync-Token`。
   - 新增 `server/sync-proxy/`：handler、CloudBase store、CloudBase event 入口、HTTP server 和 bootstrap；服务端用 `PINGANPI_SYNC_MEMBER_TOKENS` / `PINGANPI_SYNC_MEMBER_TOKENS_B64` 将 `householdId + memberId` 绑定到 token，缺失配置时同步请求 fail closed。
   - 服务端返回 snapshot 前必须过滤对方私有草稿，并 redaction 未到达来信正文 / 摘要 / 口述 / AI metadata，同时清空 `photoAttachments`，避免附件定位信息提前泄露。
   - CloudBase store 使用真实 SDK 写入形态 `doc.set(data)` / `transaction.set(docRef, data)`，写入数据不包含 `_id` 字段。
   - 新增 `scripts/build-cloudbase-sync-proxy.ts`、`scripts/configure-cloudbase-sync-env.ts`、`scripts/smoke-cloudbase-sync-proxy.ts`、`npm run cloudbase:build:sync`、`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:sync-env`、`npm run cloudbase:smoke:sync`、`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:sync`；生成目录 `cloudbase/functions/sync-proxy/` 被 Git 忽略。
   - CloudBase 集合 `pinganpi_sync_snapshots` 已创建；HTTP 路由使用显式 `/sync/health`、`/sync/pull`、`/sync/push`，不要使用 `/api/sync/*` 或 `/sync/*`。
   - CloudBase 同步集合默认名为 `pinganpi_sync_snapshots`，可用 `PINGANPI_SYNC_SNAPSHOT_COLLECTION` 覆盖。
   - 两台设备共享同一对通信关系的数据。
   - 启动 pull、关键操作 push、回到前台 refresh。
   - 第一版只保证离线草稿；投寄和拆阅必须联网校验后才正式生效。
   - 本地调试使用 device namespace：同一浏览器可用不同 `device` 参数模拟两台设备，本地 AppState 分开，remote snapshot 共享。
   - 真实 CloudBase 部署 smoke 已通过；费用告警、默认角色收敛和双真机人工验证统一进入阶段 19 / 20 收口。
   - 后续若支持离线投寄 / 拆阅请求，必须作为 command 入队，联网后重新校验钱包、状态机、收件人和到达时间。

5. **阶段 17：手机号账号系统**
   - 阶段 17 是独立账号系统阶段；设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-phone-account-design.md`。
   - 阶段 17 工程闭环已完成；实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-account-pair-binding.md`。
   - 新增 `src/app/account/account-model.ts` 和 `src/app/account/local-account-adapter.ts`：本地手机号 mock 登录、稳定 `PinganpiAccount`、登录态恢复、登出和完整手机号展示。
   - 新增 `src/app/pages/AccountGatePage.vue`：未登录或未绑定时先进入账号簿，不进入写信主流程。
   - 新增 `server/account-pair/account-pair-service.ts`：按受信任 `authUid` 确保同一平安批业务账号，并更新 `lastLoginAtIso`。
   - 账号档案允许保存完整手机号，App 可展示当前登录手机号；不要把手机号复制到信件、邮政记录、AI metadata 或无关日志。
   - 真实 CloudBase 手机号验证码、token / refresh token、卸载重装后的服务端账号恢复验证进入阶段 19 / 20。

6. **阶段 18：双人绑定与同步授权**
   - 设计文档为 `docs/superpowers/specs/2026-05-24-pinganpi-pair-binding-design.md`。
   - 阶段 18 工程闭环已完成；实施计划为 `docs/superpowers/plans/2026-05-24-pinganpi-account-pair-binding.md`。
   - 新增 `src/app/account/local-pair-binding-adapter.ts`：本地创建 household / pair、24 小时一次性邀请码、输入即加入、唯一 active household、自邀 / 过期 / 已用 / 满员拒绝。
   - 新增 `src/app/account/account-sync-config.ts`：已有绑定时用绑定的 household / member 驱动现有浏览器同步命名空间；无绑定时保留阶段 16 URL 参数调试。
   - `src/App.vue` 已接入账号 / 绑定入口；创建或加入关系后刷新一次，让同步 runtime 以正确 household / member 启动。
   - `server/sync-proxy/handler.ts` 已支持账号成员授权配置：服务端可从可信 auth uid 映射出 `householdId/memberId`，并覆盖客户端传入值；手工 member token 仅保留为阶段 16B 开发 fallback。
   - `server/sync-proxy/runtime-auth.ts` 支持 `PINGANPI_SYNC_ACCOUNT_BINDINGS` / `PINGANPI_SYNC_ACCOUNT_BINDINGS_B64` 和 `PINGANPI_SYNC_TRUSTED_AUTH_UID_HEADER`。
   - 不做独立设备授权、设备同步 token 签发、token 轮换或设备撤销；`deviceId` 只用于本地安装实例、同步 cursor、冲突标记和调试。
   - 不做多人关系、社交好友系统或现代在线状态。

7. **阶段 19：外部平台人工配置收口**
   - 统一处理需要用户介入的控制台、验证码、真实环境和费用事项。
   - 状态：进行中；执行计划为 `docs/superpowers/plans/2026-05-24-pinganpi-external-platform-closure.md`。
   - 已新增 `scripts/audit-cloudbase-stage19.ts` 和 `npm run cloudbase:audit:stage19`，用于脱敏审计 CloudBase 用量和函数状态；不要再直接把 `cloudbase fn detail` 原始输出发给用户，因为它会明文返回 env。
   - 当前审计基线：CloudBase 计费周期 `2026-05-23 ~ 2026-06-23`，用量 `1.67 / 3000 credits`；`ai-scribe-proxy` 与 `sync-proxy` 均为 `Active / Available`，运行时 `Nodejs20.19`，PublicNet `ENABLE`，触发器 `0`，VPC 未配置，角色均为 `TCB_QcsRole`。
   - 用户已在 CloudBase 控制台开启手机号短信登录；两个真实手机号验证码均已实际收到，下一步记录短信签名 / 模板 / 发送限制 / 费用策略。
   - App 第一版手机号登录采用 CloudBase Auth v2 HTTP API，不引入 CloudBase JS SDK：发送验证码 `/auth/v1/verification`，验证验证码 `/auth/v1/verification/verify`，登录 `/auth/v1/signin`，刷新 `/auth/v1/token`。
   - 账号 / 关系集合名确定为 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`；账号 / 关系写入必须走服务端可信身份边界，客户端不得直接写授权结果。
   - 2026-05-24 HTTP 路由 smoke 已确认：`/api/health` 和 `/sync/health` 返回 200；`/sync/pull` 与 `/sync/push` 未带 token 返回 401。
   - 2026-05-24 CLI 路由查询已确认：`/api` 指向 `ai-scribe-proxy`；`/sync/health`、`/sync/pull`、`/sync/push` 指向 `sync-proxy`；四条路由均启用，类型均为 `WEB_SCF`。
   - 2026-05-24 CLI 权限查询已确认：`pinganpi_sync_snapshots`、`pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites` 均为 `PRIVATE`；函数 invoke 权限为自定义规则，但 HTTP 访问服务路由 `enableAuth=false`，代理 handler 仍必须继续做应用层校验。
   - 2026-05-24 CLI 角色查询：只有系统角色，自定义角色 0 个；函数运行角色仍显示为 `TCB_QcsRole`，是否能收敛仍需控制台 / 云函数平台确认。
   - 包括 CloudBase Auth 手机号验证码、短信签名 / 模板、账号 / 关系 CloudBase 持久化、数据库集合权限、HTTP 路由、费用告警、默认角色收敛、MiMo key 撤销 / 轮换入口和真实手机号验证码。
   - 不在本阶段新增业务功能，不把控制台 secret、验证码或真实 key 写入仓库。

8. **阶段 20：完整人工验证引导**
   - 由 Codex 引导用户对系统做端到端人工验证。
   - 覆盖账号登录、创建关系、邀请码加入、双设备同步、AI 起稿、写信投寄、真实等待送达、拆阅、断网恢复、iOS / Android 真机和 WebView console。
   - 验证记录只写通过 / 失败 / 阻塞 / 待修复项，不记录手机号验证码、真实 key 或敏感正文。

9. **阶段 21：邮政异常规则**
   - 延误、错分、迷失、找回、退回采用确定性种子推进。
   - 所有异常必须产生邮政记录。

10. **阶段 22：系统推送**
   - 只推重要信、挂号信、迷失信找回、退回等少量事件。
   - 普通信默认不主动推送。

11. **阶段 23：照片附件**
   - 夹寄照片、费用、附件状态、到达前不泄露。
   - 云端文件存储依赖阶段 15 的规划；具体云存储购买 / 配置在阶段 23 实施，必要的控制台动作归入阶段 19。

12. **阶段 24：发布准备与体验打磨**
   - toast / snackbar、App 图标、启动页、真机验证、bundle 优化、隐私与备份检查。

## 开发原则

- 移动端优先，同时保证 PC 浏览器预览可用。
- UI 使用 Tailwind CSS。
- 组件库使用 Varlet。
- 页面风格保持旧账簿、档案、信件、邮政登记感。
- 不要把 App 做成网页营销页或现代聊天页。
- 不要显示现代实时地图。
- AI 起稿已完成 App 侧与本地 / 云端流式代理链路；后续继续保留既有写信流程边界、手工校改、费用校验和真实等待规则。
- 不要在领域层引入浏览器、Capacitor、云服务或 UI 依赖。
- 对新增业务规则写测试，优先使用 Vitest。
- 前端页面可以先浏览器验证，再进行 Capacitor 原生验证。

## 验证要求

常规代码改动后至少运行：

```bash
npm test
npm run typecheck
```

涉及构建、Capacitor、依赖或前端入口时运行：

```bash
npm run build
npx cap sync
npx cap doctor
```

涉及依赖时运行：

```bash
npm audit --omit=dev
```

已知现象：

- `npm run build` 目前会提示 Varlet 相关首包超过 500 KB。这个是优化项，不是当前阻塞项。

## Capacitor 调试提示

- 浏览器优先：`npm run dev`。
- 不使用 live reload 时，Web 改动进入原生壳前必须执行 `npm run cap:sync`。
- iOS 调试入口：`npx cap open ios`。
- Android 调试入口：`npx cap open android`。
- iOS WebView console 用 Safari Web Inspector。
- Android WebView console 用 Chrome `chrome://inspect/#devices`。

当前本机原生调试环境状态记录在：

- `docs/superpowers/plans/2026-05-23-pinganpi-native-debug-environment.md`

截至该记录：

- Android 原生调试环境已可用，App 已成功安装并启动过。
- Xcode 26.5 已可用，iOS Simulator 已成功安装并启动 App。
- iOS Safari Web Inspector 的 WebView console 仍需手工确认。

## Git 与发布状态

- 当前工作应基于 `main`。
- 当前本地 `main` 可能尚未 push 到远端，继续开发或发布前先确认：

```bash
git status --short --branch
git remote -v
git log --oneline --decorate -5
```

- 如需 push 或创建 PR，先征得用户明确同意。

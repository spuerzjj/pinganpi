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
npx cap doctor
```

## 当前代码状态

当前主线开发基于 `main`，最新路线图基线为：**已完成阶段 9 信箱真实时间送达推进**。继续开发前以 `git log --oneline --decorate -5` 为准。

最新关键提交包括：

- `71133d3 docs: 更新真实送达推进进度`
- `3c2d85c feat(app): 接入信箱拆阅界面`
- `76f325d feat(app): 扩展信箱档案视图模型`
- `334c304 feat(app): 接入信件送达与拆阅结算`
- `3e26a29 feat(app): 添加邮政送达推进服务`
- `4cb07a6 feat(domain): 添加信件送达时间判断`

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

### 阶段 3-9：本地慢通信核心闭环

已实现：

- 原生调试环境基础：Android Emulator 与 iOS Simulator 均已成功启动 App。
- 本地持久化：`AppState`、localStorage adapter、钱包结算、坏数据回退。
- 写信主流程：口述、起稿、校改、封缄投寄、扣款、账本、邮政记录。
- 模板代书引擎：非 AI 模板边界，保存 `draftSource`、`scribeDraft`、`finalText`、`generationMeta`。
- 写信分步流程：`选写法 → 口述 → 起稿 → 校改 → 投寄`。
- 草稿管理 / 信纸匣：续写、覆盖保存、删除、从草稿投寄。
- 信箱真实时间送达推进：`in_transit -> arrived`、到达前不可拆、拆阅写记录、邮政档案记录簿。

已验证基线记录在：

- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`

## 后续路线

以后开始新任务前，优先读取：

- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`
- `docs/superpowers/plans/2026-05-23-pinganpi-mobile-capacitor-shell.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-domain-foundation.md`

路线图维护规则：

- 每次阶段完成、下一阶段推荐顺序变化、验证基线变化或集中 UI 问题变化时，必须同步更新 `docs/pinganpi-roadmap.md` 和 `docs/pinganpi-roadmap-dashboard.html`。
- `docs/pinganpi-roadmap.md` 是详细文字源；`docs/pinganpi-roadmap-dashboard.html` 是给用户日常查看的静态可视化看板，不属于正式 App。

推荐开发顺序：

1. **阶段 10：AI 代笔接入设计**
   - 本期目标是接入 AI 能力生成信件正文，但 AI 只负责代笔先生起稿。
   - 复用现有代书流程和数据结构，设计 AI generation adapter、输入输出类型、错误类型和失败处理。
   - AI 输入限定为用户口述、代笔先生、双方成员、城市、信件类型、情绪标签和必要上下文。
   - 允许将用户口述发送到第三方模型服务。
   - 生成结果必须保存 `draftSource: "ai"` 与 `generationMeta`。
   - 模板不再作为完整正文生成 fallback，只作为 AI 提示词素材、风格样例和约束规则。
   - AI 失败、超时、额度不足或无网时，保存口述草稿，稍后再起稿。
   - 用户仍必须手工校改正文，AI 不能自动封缄投寄。
   - 移动端 / Vite 客户端不得直连 AI 供应商，不得携带 provider key；真实 AI key 只能在云函数或服务端代理中使用。
   - `src/domain` 不得引入 AI、浏览器、Capacitor 或云服务依赖。

2. **阶段 11：云服务器与 AI 能力最小配置**
   - 在阶段 10 的 AI 接入设计明确后，基于用户已购买的 Xiaomi MiMo 模型创建最小 AI 服务端代理环境。
   - 优先评估腾讯云 CloudBase 是否适合承载最小 AI 服务端代理，不默认购买 CVM 或高规格包年资源。
   - 默认供应商为 Xiaomi MiMo；模型 ID、API base URL、调用协议、额度和费用告警必须在阶段 11 实施时与用户确认。
   - 配置费用限额、余额提醒、AI 调用费用告警、最小代理权限、服务端环境变量和密钥管理。
   - 真实 secret 不入库，不使用 `VITE_` 暴露 AI key；必要时提供 `.env.example`。
   - 同步数据库、文件存储、身份认证和推送资源本阶段只做评估，不正式购买 / 初始化。
   - 输出可复现的最小 AI 代理 / AI 配置文档、连接验证命令和资源删除 / 回滚步骤。

3. **阶段 12：AI 生成信件正文落地**
   - 实现 AI generation adapter，并通过阶段 11 确认的调用方式连接真实 AI 能力。
   - 写信流程“起稿”步骤使用 AI 起稿，失败时保存口述草稿，不生成模板正文。
   - 生成结果继续进入校改步骤，最终投寄仍以用户确认的 `finalText` 为准。
   - 增加 fake AI adapter 测试、失败保存口述草稿测试、metadata 保存测试和 UI 起稿流程测试。
   - 构建产物不得包含第三方 AI provider key。

4. **阶段 13：云端与双人同步准备**
   - 定义远端数据模型，不把整个 `AppState` 当成唯一同步单位。
   - 建立 sync adapter 边界，保持 `src/domain` 无云端依赖。
   - 设计 household / pair、members、wallets、ledger entries、draft papers、letters、postal records、sync cursors。
   - 远端模型显式包含 AI metadata，但不保存完整 prompt、原始 provider response 或敏感日志。
   - 预留邮政异常状态和记录类型，以及照片附件到达前不可访问的控制原则。
   - 设计 append-only 记录去重、信件状态单向推进、草稿冲突和钱包结算策略。
   - 先使用本地 mock remote adapter 和测试验证双设备合并。

5. **阶段 14：双人真实同步 MVP**
   - 两台设备共享同一对通信关系的数据。
   - 启动 pull、关键操作 push、回到前台 refresh。
   - 第一版只保证离线草稿；投寄和拆阅必须联网校验后才正式生效。
   - 后续若支持离线投寄 / 拆阅请求，必须作为 command 入队，联网后重新校验钱包、状态机、收件人和到达时间。

6. **阶段 15：邮政异常规则**
   - 延误、错分、迷失、找回、退回采用确定性种子推进。
   - 所有异常必须产生邮政记录。

7. **阶段 16：系统推送**
   - 只推重要信、挂号信、迷失信找回、退回等少量事件。
   - 普通信默认不主动推送。

8. **阶段 17：照片附件**
   - 夹寄照片、费用、附件状态、到达前不泄露。
   - 云端文件存储依赖阶段 13 的规划；具体云存储购买 / 配置在阶段 17 实施。

9. **阶段 18：发布准备与体验打磨**
   - toast / snackbar、App 图标、启动页、真机验证、bundle 优化、隐私与备份检查。

## 开发原则

- 移动端优先，同时保证 PC 浏览器预览可用。
- UI 使用 Tailwind CSS。
- 组件库使用 Varlet。
- 页面风格保持旧账簿、档案、信件、邮政登记感。
- 不要把 App 做成网页营销页或现代聊天页。
- 不要显示现代实时地图。
- AI 接入是当前本期目标，但必须走既有写信流程边界，保留手工校改；模板只作为提示词素材，不作为完整正文 fallback。
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

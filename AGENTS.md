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

当前主线开发已合并到 `main`，最新关键提交：

- `37a4593 feat(app): 搭建 Capacitor 移动壳层`
- `4c0d184 docs: 记录当前进度与后续路线`

已完成两大阶段：

### Phase 1: 领域层基础

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

### Phase 2: Capacitor 移动壳层

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

已验证基线记录在：

- `docs/superpowers/plans/2026-05-23-pinganpi-next-roadmap.md`

## 后续路线

以后开始新任务前，优先读取：

- `docs/superpowers/plans/2026-05-23-pinganpi-next-roadmap.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-mobile-capacitor-shell.md`
- `docs/superpowers/plans/2026-05-23-pinganpi-domain-foundation.md`

推荐开发顺序：

1. **原生调试环境**
   - 跑通 Xcode iOS Simulator。
   - 跑通 Android Studio Emulator。
   - 确认 Safari Web Inspector 和 Chrome WebView inspect 可用。

2. **本地持久化层**
   - 定义本地 app state schema。
   - 保存 members、wallet、ledger、draft papers、letters、postal records。
   - 建立 storage adapter 边界，为后续云同步留接口。

3. **写信主流程**
   - 选择先生或亲笔。
   - 输入口述。
   - 生成先生初稿。
   - 手工校改。
   - 计算费用。
   - 校验余额。
   - 封缄投寄。
   - 扣款、记账、生成存根和邮政记录。

4. **模板代书引擎**
   - 第一版不接 AI。
   - 先实现可替换的 template engine boundary。
   - 保留 `draftSource`、`oralText`、`scribeDraft`、`finalText`、`scribeId`、`generationMeta`。

5. **信箱与真实时间推进**
   - 按真实时间判断信件是否可拆。
   - 到达前不可打开。
   - 延误、迷失、找回、退回都必须产生邮政记录。

6. **云端与双人同步准备**
   - 本地流程稳定后再设计云端。
   - 保持 `src/domain` 无云端依赖。

## 开发原则

- 移动端优先，同时保证 PC 浏览器预览可用。
- UI 使用 Tailwind CSS。
- 组件库使用 Varlet。
- 页面风格保持旧账簿、档案、信件、邮政登记感。
- 不要把 App 做成网页营销页或现代聊天页。
- 不要显示现代实时地图。
- 不要在第一版接 AI 代写；先做模板引擎。
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

当前本机原生调试环境仍未完全安装完成。此前检查到：

- Node/npm 已可用。
- 完整 Xcode 尚未安装完成。
- Android Studio / Android SDK / JDK 尚未安装完成。

## Git 与发布状态

- 当前工作应基于 `main`。
- 当前本地 `main` 可能尚未 push 到远端，继续开发或发布前先确认：

```bash
git status --short --branch
git remote -v
git log --oneline --decorate -5
```

- 如需 push 或创建 PR，先征得用户明确同意。

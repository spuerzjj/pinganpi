# Pinganpi Miniprogram UI Redesign Design

## Goal

阶段 28 在上架配置前完成微信小程序全量 UI 重设计。新方向是非复古、安静现代：保留慢通信、两个人、信件和等待的产品气质，但不再使用泛黄纸张、印章、账簿、旧报纸纹理或仿古装饰。

## Scope

覆盖小程序当前全部页面：账号、关系、今日、写信、代笔先生、钱匣、信箱和档案。覆盖登录态、关系态、AI 起稿 pending / ready / failed、同步状态、空状态和错误状态。

本阶段不改变领域规则、账号授权、CloudBase 云函数、AI 起稿协议、写信状态机、钱包扣款、邮路送达或同步协议。页面仍使用现有 TypeScript view-model 字段。

## Visual Direction

设计概念图：`docs/assets/stage28-ui-redesign/non-retro-ui-concept.png`。

概念图采用安静现代的移动产品风格：白色和灰绿背景、轻边框、低阴影、6-8px 圆角、清晰中文排版和少量温暖强调色。写信页吸收更亲密的编辑感，但不新增语音录入，不采用聊天气泡，不改为即时消息体验。

## Design System

全局 token 使用现代语义：

- `--app-bg`：小程序背景。
- `--surface` / `--surface-raised` / `--surface-muted`：页面面板与轻量状态底色。
- `--text-primary` / `--text-secondary` / `--text-muted`：正文、辅助信息和弱信息。
- `--accent` / `--accent-soft` / `--accent-warm`：主操作、选中态和低频暖色强调。
- `--border` / `--border-strong`：分隔和可交互边界。
- `--radius-sm` / `--radius-md` / `--radius-lg`：稳定 6-8px 级别圆角。

旧复古语义 `paper`、`seal`、`stamp`、`archive-panel`、`ledger-button`、`paper-input` 不再出现在小程序 UI 文件中。

## Page Interaction

- 今日页：突出日期、信箱、钱匣和同步状态，减少登记册语气。
- 写信页：步骤条改为轻量横向进度；口述和定稿 textarea 使用现代编辑器样式；AI 起稿状态用低噪声状态块表达。
- 先生页：列表使用头像字母标识和状态 pill，保留“今日在馆 / 未到”。
- 钱匣页：余额为主视觉，账目用清晰行列表。
- 信箱 / 档案页：保留慢通信规则，到达前不展示正文；用状态 pill 和列表层级代替印章。
- 账号 / 关系页：表单、邀请码和错误状态使用统一按钮、输入框和状态块。

## Verification

阶段完成需要通过：

- `npm test`
- `npm run miniprogram:check`
- `npm run roadmap:build`
- `npm run structure:audit`
- `git diff --check`

视觉验证需要使用概念图和本地渲染截图做对照，至少检查配色、圆角、按钮/输入、写信步骤、状态 pill、空状态、移动视口无溢出。

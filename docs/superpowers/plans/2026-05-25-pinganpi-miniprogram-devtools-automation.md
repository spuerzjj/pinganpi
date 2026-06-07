# Pinganpi Miniprogram DevTools Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable WeChat DevTools automation commands for low-risk Pinganpi miniprogram UI smoke and flow debugging.

**Architecture:** Use WeChat DevTools CLI to launch automation mode and `miniprogram-automator` to drive page-level selectors. Keep all high-risk platform actions out of scripts: no upload, publish, preview, real phone authorization, or review submission.

**Tech Stack:** Node.js CommonJS script, `miniprogram-automator`, WeChat DevTools CLI, npm scripts, existing Vitest and miniprogram type checks.

> **2026-06-07 账号 smoke 修订：** 当前脚本已迁移到 `tools/scripts/miniprogram-devtools-automator.cjs`，账号 smoke 不再输入无效手机号或点击“使用兜底入口”。现行 `smoke` / `flow` 会安装云函数测试桩并通过 `pinganpi-account/loginByWechat` 覆盖 openid 静默登录，避免触达真实账号云函数。

---

### Task 1: Add Automator Dependency And Shared Runner

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/miniprogram-devtools-automator.cjs`

- [x] **Step 1: Install `miniprogram-automator`**

Run:

```bash
npm install --save-dev miniprogram-automator@0.12.1
```

Expected: `package.json` and `package-lock.json` include the dev dependency.

- [x] **Step 2: Create the runner**

Create `scripts/miniprogram-devtools-automator.cjs` with a command parser for `smoke` and `flow`, helpers to resolve the DevTools CLI path, read `WECHAT_DEVTOOLS_PORT` or the newest `.ide` file, launch automation, assert page state, and disconnect cleanly.

- [x] **Step 3: Add npm scripts**

Add:

```json
"miniprogram:devtools:smoke": "node scripts/miniprogram-devtools-automator.cjs smoke",
"miniprogram:devtools:flow": "node scripts/miniprogram-devtools-automator.cjs flow"
```

Expected: scripts can be run from the repository root.

### Task 2: Cover Safe Page Interactions

**Files:**
- Modify: `scripts/miniprogram-devtools-automator.cjs`

- [x] **Step 1: Implement account smoke**

Install the cloud function test stub, use `miniProgram.reLaunch('/pages/account/index')`, tap the button whose text includes `微信登录`, and assert the account page shows the stubbed openid login session.

- [x] **Step 2: Implement full low-risk flow**

Visit `pages/account/index`, `pages/pair/index`, `pages/today/index`, `pages/write/index`, `pages/scribes/index`, `pages/wallet/index`, `pages/mailbox/index`, and `pages/archive/index`. For write flow, use local-only safe input and inspect page data without sending a letter. For account flow, use the stubbed openid login path only.

- [x] **Step 3: Verify structured output**

Each scenario prints a JSON result with scenario name, route, and key assertions so future debugging can see what failed without relying on screenshots.

### Task 3: Update Documentation And Verification Baseline

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-foundation.md`

- [x] **Step 1: Document prerequisites**

Record that WeChat DevTools service port must be enabled in `设置 -> 安全设置 -> 服务端口`, and scripts can use `WECHAT_DEVTOOLS_PORT=<port>`.

- [x] **Step 2: Document commands**

Add `npm run miniprogram:devtools:smoke` and `npm run miniprogram:devtools:flow` to the miniprogram development and verification commands.

- [x] **Step 3: Document safety boundary**

State that automation scripts do not click upload, publish, preview, real phone authorization, or review submission controls.

### Task 4: Verify

**Files:**
- Test: `scripts/miniprogram-devtools-automator.cjs`
- Test: existing miniprogram and Vitest suites

- [x] **Step 1: Run focused automator smoke**

Run:

```bash
WECHAT_DEVTOOLS_PORT=62046 npm run miniprogram:devtools:smoke
```

Expected: PASS and JSON output includes the stubbed account openid login validation.

- [x] **Step 2: Run full automator flow**

Run:

```bash
WECHAT_DEVTOOLS_PORT=62046 npm run miniprogram:devtools:flow
```

Expected: PASS and JSON output lists all safe routes.

- [x] **Step 3: Run repository checks**

Run:

```bash
npm run miniprogram:check
npm test
git diff --check
```

Expected: all commands pass.

## Execution Notes

- 2026-05-25 已安装 `miniprogram-automator@0.12.1` 并新增 `scripts/miniprogram-devtools-automator.cjs`。
- 微信开发者工具服务端口已用 `62046` 验证；脚本也会尝试读取最近的 `.ide` 端口文件。
- 控制台曾显示阻断错误：`app.json: 未找到 ["pages"][0] 对应的 pages/account/index.js 文件`。根因是微信开发者工具没有启用 TypeScript 编译插件，已通过 `miniprogram/project.config.json` 的 `setting.useCompilerPlugins: ["typescript"]` 修复。
- `WECHAT_DEVTOOLS_PORT=62046 npm run miniprogram:devtools:smoke` 已通过。
- `WECHAT_DEVTOOLS_PORT=62046 npm run miniprogram:devtools:flow` 已通过，覆盖账号、关系、今日、写信、先生、钱匣、信箱和档案；写信场景不点击投寄。
- `npm run miniprogram:check` 已通过。
- `npm test` 已通过，58 个测试文件，389 个测试通过。
- `npm run typecheck`、`npm run cloudbase:build:miniprogram`、`npm run roadmap:build`、`npm audit --omit=dev` 和 `git diff --check` 已通过。
- `npm install` 报告 dev 依赖链存在 10 个 audit vulnerabilities；不要使用 `npm audit fix --force` 直接升级破坏性依赖。

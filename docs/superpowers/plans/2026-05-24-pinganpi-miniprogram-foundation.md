# 微信小程序工程基座 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立《平安批》微信原生小程序工程基座，让仓库出现可被微信开发者工具打开、可 TypeScript 检查、带首批页面骨架和 CloudBase `dev` 环境入口的 `miniprogram/`。

**Architecture:** 本阶段只做小程序工程外壳，不迁移完整业务逻辑。小程序端使用原生 WXML / WXSS / TypeScript；CloudBase 配置集中在 `miniprogram/config/env.ts`；页面骨架先只展示克制的档案式标题和状态文案，后续阶段再接共享领域核心、账号、同步和 AI。

**Tech Stack:** 微信原生小程序、TypeScript、WXSS、CloudBase `wx.cloud`、Vitest、现有 npm / TypeScript 工具链。

---

## Scope

本计划对应路线图阶段 22：小程序工程基座。

本阶段包含：

- 创建 `miniprogram/` 根目录和微信小程序必需配置。
- 添加小程序 TypeScript 类型检查配置。
- 添加首批页面骨架：账号簿、双人绑定、今日、写信、代笔先生、钱匣、信箱、档案。
- 添加 CloudBase `dev` 环境配置入口。
- 添加 npm 脚本和最小测试。
- 更新 roadmap / dashboard / AGENTS 的阶段 22 状态和验证基线。

本阶段不包含：

- 不接真实微信手机号能力。
- 不接真实 CloudBase 云函数调用。
- 不迁移完整写信业务逻辑。
- 不删除 Vue / Capacitor 旧实现。
- 不配置 `prd` 真实环境。

## File Structure

Create:

- `tsconfig.miniprogram.json`：小程序 TypeScript 类型检查配置。
- `miniprogram/app.ts`：小程序启动入口，初始化 CloudBase。
- `miniprogram/app.json`：页面、窗口和 tabBar 配置。
- `miniprogram/app.wxss`：全局小程序样式。
- `miniprogram/project.config.json`：微信开发者工具项目配置，使用 `touristappid`。
- `miniprogram/sitemap.json`：小程序索引配置。
- `miniprogram/types/wx.d.ts`：最小微信小程序类型声明，避免本阶段引入新依赖。
- `miniprogram/config/env.ts`：`dev` / `prd` 环境配置和读取函数。
- `miniprogram/config/env.test.ts`：环境配置测试。
- `miniprogram/pages/account/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/pair/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/today/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/write/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/scribes/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/wallet/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/mailbox/index.{json,wxml,wxss,ts}`。
- `miniprogram/pages/archive/index.{json,wxml,wxss,ts}`。
- `miniprogram/styles/tokens.wxss`：小程序视觉 token。

Modify:

- `package.json`：新增 `miniprogram:typecheck` 和 `miniprogram:check`。
- `.gitignore`：忽略微信开发者工具私有配置。
- `docs/pinganpi-roadmap.md`：阶段 22 状态和验证基线。
- `docs/pinganpi-roadmap-dashboard.html`：阶段 22 状态。
- `AGENTS.md`：小程序调试和验证命令。

## Task 1: 小程序 TypeScript 检查与环境配置

**Files:**
- Create: `tsconfig.miniprogram.json`
- Create: `miniprogram/types/wx.d.ts`
- Create: `miniprogram/config/env.ts`
- Create: `miniprogram/config/env.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写环境配置测试**

Create `miniprogram/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getMiniProgramCloudbaseEnvId,
  getMiniProgramRuntimeConfig,
  miniProgramEnvironments,
} from "./env";

describe("miniprogram env config", () => {
  it("uses the current CloudBase environment as dev by default", () => {
    expect(getMiniProgramRuntimeConfig()).toEqual({
      envName: "dev",
      cloudbaseEnvId: "pinganpi-d7gml1f6sbcc172ea",
    });
  });

  it("keeps prd empty until the user creates the production environment", () => {
    expect(miniProgramEnvironments.prd.cloudbaseEnvId).toBe("");
  });

  it("returns a concrete env id for the active environment", () => {
    expect(getMiniProgramCloudbaseEnvId()).toBe("pinganpi-d7gml1f6sbcc172ea");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- miniprogram/config/env.test.ts
```

Expected: FAIL，因为 `miniprogram/config/env.ts` 还不存在。

- [ ] **Step 3: 添加小程序最小微信类型声明**

Create `miniprogram/types/wx.d.ts`:

```ts
export {};

declare global {
  const wx: WechatMiniprogram.Wx;

  function App(options: WechatMiniprogram.AppOptions): void;
  function Page(options: WechatMiniprogram.PageOptions): void;

  namespace WechatMiniprogram {
    interface Wx {
      cloud?: {
        init(options: CloudInitOptions): void;
      };
    }

    interface CloudInitOptions {
      env: string;
      traceUser?: boolean;
    }

    interface AppOptions {
      globalData?: Record<string, unknown>;
      onLaunch?(): void;
      onShow?(): void;
      onHide?(): void;
    }

    interface PageOptions {
      data?: Record<string, unknown>;
      onLoad?(): void;
      onShow?(): void;
      [key: string]: unknown;
    }
  }
}
```

- [ ] **Step 4: 添加环境配置实现**

Create `miniprogram/config/env.ts`:

```ts
export type MiniProgramEnvironmentName = "dev" | "prd";

export interface MiniProgramEnvironmentConfig {
  readonly cloudbaseEnvId: string;
}

export interface MiniProgramRuntimeConfig {
  readonly envName: MiniProgramEnvironmentName;
  readonly cloudbaseEnvId: string;
}

export const activeMiniProgramEnvironment: MiniProgramEnvironmentName = "dev";

export const miniProgramEnvironments: Record<
  MiniProgramEnvironmentName,
  MiniProgramEnvironmentConfig
> = {
  dev: {
    cloudbaseEnvId: "pinganpi-d7gml1f6sbcc172ea",
  },
  prd: {
    cloudbaseEnvId: "",
  },
};

export function getMiniProgramRuntimeConfig(): MiniProgramRuntimeConfig {
  const activeConfig = miniProgramEnvironments[activeMiniProgramEnvironment];

  if (!activeConfig.cloudbaseEnvId) {
    throw new Error(`missing CloudBase env id for ${activeMiniProgramEnvironment}`);
  }

  return {
    envName: activeMiniProgramEnvironment,
    cloudbaseEnvId: activeConfig.cloudbaseEnvId,
  };
}

export function getMiniProgramCloudbaseEnvId(): string {
  return getMiniProgramRuntimeConfig().cloudbaseEnvId;
}
```

- [ ] **Step 5: 添加小程序 TypeScript 配置**

Create `tsconfig.miniprogram.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "noEmit": true
  },
  "include": ["miniprogram/**/*.ts", "miniprogram/**/*.d.ts"]
}
```

- [ ] **Step 6: 添加 npm 脚本**

Modify `package.json` scripts section by adding:

```json
"miniprogram:typecheck": "tsc -p tsconfig.miniprogram.json --noEmit",
"miniprogram:check": "npm run miniprogram:typecheck"
```

Keep the existing scripts unchanged.

- [ ] **Step 7: 运行测试和类型检查**

Run:

```bash
npm test -- miniprogram/config/env.test.ts
npm run miniprogram:typecheck
```

Expected:

- `miniprogram/config/env.test.ts` PASS。
- `npm run miniprogram:typecheck` PASS。

- [ ] **Step 8: 提交任务 1**

```bash
git add package.json tsconfig.miniprogram.json miniprogram/types/wx.d.ts miniprogram/config/env.ts miniprogram/config/env.test.ts
git commit -m "build(miniprogram): 添加小程序类型检查配置"
```

## Task 2: 小程序根配置与 CloudBase 初始化

**Files:**
- Create: `miniprogram/app.ts`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/project.config.json`
- Create: `miniprogram/sitemap.json`
- Create: `miniprogram/styles/tokens.wxss`
- Modify: `.gitignore`

- [ ] **Step 1: 添加 CloudBase 初始化入口**

Create `miniprogram/app.ts`:

```ts
import { getMiniProgramRuntimeConfig } from "./config/env";

const runtimeConfig = getMiniProgramRuntimeConfig();

App({
  globalData: {
    runtimeConfig,
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: runtimeConfig.cloudbaseEnvId,
        traceUser: true,
      });
    }
  },
});
```

- [ ] **Step 2: 添加小程序全局配置**

Create `miniprogram/app.json`:

```json
{
  "pages": [
    "pages/account/index",
    "pages/pair/index",
    "pages/today/index",
    "pages/write/index",
    "pages/scribes/index",
    "pages/wallet/index",
    "pages/mailbox/index",
    "pages/archive/index"
  ],
  "window": {
    "navigationBarTitleText": "平安批",
    "navigationBarBackgroundColor": "#f7f1e4",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f7f1e4",
    "backgroundTextStyle": "dark"
  },
  "tabBar": {
    "color": "#7b6a55",
    "selectedColor": "#2f2418",
    "backgroundColor": "#f7f1e4",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/today/index",
        "text": "今日"
      },
      {
        "pagePath": "pages/write/index",
        "text": "写信"
      },
      {
        "pagePath": "pages/scribes/index",
        "text": "先生"
      },
      {
        "pagePath": "pages/wallet/index",
        "text": "钱匣"
      },
      {
        "pagePath": "pages/mailbox/index",
        "text": "信箱"
      }
    ]
  },
  "style": "v2",
  "lazyCodeLoading": "requiredComponents"
}
```

- [ ] **Step 3: 添加全局样式和 token**

Create `miniprogram/styles/tokens.wxss`:

```css
page {
  --paper: #f7f1e4;
  --paper-strong: #efe1c5;
  --ink: #2f2418;
  --muted: #7b6a55;
  --line: #d9c9a8;
  --seal: #8f2f1f;
  --surface: #fffaf0;
}
```

Create `miniprogram/app.wxss`:

```css
@import "./styles/tokens.wxss";

page {
  min-height: 100%;
  background: var(--paper);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", sans-serif;
}

.page-shell {
  min-height: 100vh;
  padding: 32rpx 28rpx 56rpx;
  box-sizing: border-box;
}

.archive-panel {
  border: 2rpx solid var(--line);
  background: var(--surface);
  padding: 28rpx;
}

.kicker {
  color: var(--muted);
  font-size: 24rpx;
  line-height: 1.5;
}

.title {
  margin-top: 12rpx;
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.25;
}

.body-copy {
  margin-top: 20rpx;
  color: var(--muted);
  font-size: 28rpx;
  line-height: 1.75;
}
```

- [ ] **Step 4: 添加微信开发者工具配置**

Create `miniprogram/project.config.json`:

```json
{
  "appid": "touristappid",
  "compileType": "miniprogram",
  "libVersion": "latest",
  "miniprogramRoot": "./",
  "setting": {
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true,
    "minifyWXSS": true,
    "minifyWXML": true
  }
}
```

Create `miniprogram/sitemap.json`:

```json
{
  "rules": [
    {
      "action": "allow",
      "page": "*"
    }
  ]
}
```

- [ ] **Step 5: 忽略微信开发者工具私有配置**

Modify `.gitignore` by adding:

```gitignore
# WeChat Mini Program local IDE state
miniprogram/project.private.config.json
miniprogram/miniprogram_npm/
```

- [ ] **Step 6: 运行小程序类型检查**

Run:

```bash
npm run miniprogram:typecheck
```

Expected: PASS.

- [ ] **Step 7: 提交任务 2**

```bash
git add .gitignore miniprogram/app.ts miniprogram/app.json miniprogram/app.wxss miniprogram/project.config.json miniprogram/sitemap.json miniprogram/styles/tokens.wxss
git commit -m "feat(miniprogram): 添加小程序根配置"
```

## Task 3: 首批页面骨架

**Files:**
- Create page files under `miniprogram/pages/{account,pair,today,write,scribes,wallet,mailbox,archive}/`

- [ ] **Step 1: 创建账号簿页面**

Create `miniprogram/pages/account/index.json`:

```json
{
  "navigationBarTitleText": "账号簿"
}
```

Create `miniprogram/pages/account/index.ts`:

```ts
Page({
  data: {
    kicker: "平安批 / 账号簿",
    title: "请先登录",
    body: "微信一键登录将作为默认入口，短信验证码保留为备用。手机号仍是平安批账号。"
  }
});
```

Create `miniprogram/pages/account/index.wxml`:

```xml
<view class="page-shell">
  <view class="archive-panel">
    <view class="kicker">{{kicker}}</view>
    <view class="title">{{title}}</view>
    <view class="body-copy">{{body}}</view>
  </view>
</view>
```

Create `miniprogram/pages/account/index.wxss`:

```css
```

- [ ] **Step 2: 创建双人绑定页面**

Create `miniprogram/pages/pair/index.json`:

```json
{
  "navigationBarTitleText": "关系"
}
```

Create `miniprogram/pages/pair/index.ts`:

```ts
Page({
  data: {
    kicker: "平安批 / 关系",
    title: "创建一对关系",
    body: "一方创建邀请，另一方输入后加入。第一版只允许一对关系。"
  }
});
```

Create `miniprogram/pages/pair/index.wxml`:

```xml
<view class="page-shell">
  <view class="archive-panel">
    <view class="kicker">{{kicker}}</view>
    <view class="title">{{title}}</view>
    <view class="body-copy">{{body}}</view>
  </view>
</view>
```

Create `miniprogram/pages/pair/index.wxss`:

```css
```

- [ ] **Step 3: 创建五个 tab 页面和档案页面**

For each row, create the four files using the same templates as Step 1, changing only title text:

| Directory | navigationBarTitleText | kicker | title | body |
| --- | --- | --- | --- | --- |
| `miniprogram/pages/today` | `今日` | `平安批 / 今日` | `今日` | `旧历日期、钱匣摘要、来信提示和待办事项会放在这里。` |
| `miniprogram/pages/write` | `写信` | `平安批 / 写信` | `写信` | `写信仍按选写法、口述、起稿、校改、投寄分步完成。` |
| `miniprogram/pages/scribes` | `先生` | `平安批 / 代笔先生` | `代笔先生` | `不同城市的先生会有不同出勤和代书风格。` |
| `miniprogram/pages/wallet` | `钱匣` | `平安批 / 钱匣` | `钱匣` | `余额、自然收支和寄信费用会记录到账本。` |
| `miniprogram/pages/mailbox` | `信箱` | `平安批 / 信箱` | `今日信箱` | `到达前不可拆阅，拆阅后进入旧信档案。` |
| `miniprogram/pages/archive` | `档案` | `平安批 / 档案` | `旧信档案` | `旧信、邮政记录和账本线索会在这里归档。` |

The `.wxml` content for every page:

```xml
<view class="page-shell">
  <view class="archive-panel">
    <view class="kicker">{{kicker}}</view>
    <view class="title">{{title}}</view>
    <view class="body-copy">{{body}}</view>
  </view>
</view>
```

The `.wxss` content for every page:

```css
```

The `.ts` content shape for each page:

```ts
Page({
  data: {
    kicker: "平安批 / 今日",
    title: "今日",
    body: "旧历日期、钱匣摘要、来信提示和待办事项会放在这里。"
  }
});
```

- [ ] **Step 4: 运行小程序类型检查**

Run:

```bash
npm run miniprogram:typecheck
```

Expected: PASS.

- [ ] **Step 5: 提交任务 3**

```bash
git add miniprogram/pages
git commit -m "feat(miniprogram): 添加首批页面骨架"
```

## Task 4: 文档与路线图同步

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 `docs/pinganpi-roadmap.md`**

Change stage 22 from `未开始` to `已完成基础` and add verification lines:

```markdown
| 22 | 小程序工程基座 | 已完成基础 | 已新增 `miniprogram/`、TypeScript 检查、页面骨架、微信开发者工具配置和 `dev` CloudBase 环境入口。 |
```

Add to verification baseline:

```markdown
- `npm run miniprogram:typecheck`：通过，小程序 TypeScript 入口、环境配置和页面骨架可检查。
- `npm test -- miniprogram/config/env.test.ts`：通过，确认当前小程序默认使用 `dev` CloudBase 环境 `pinganpi-d7gml1f6sbcc172ea`，`prd` 仍为空等待用户创建。
```

- [ ] **Step 2: 更新 `docs/pinganpi-roadmap-dashboard.html`**

Change stage 22 in the phase grid to class `phase done`, change the next marker to stage 23, and update the top metric:

```html
<p class="metric-value">共享核心</p>
<p class="metric-note">进入阶段 23：抽取或适配领域规则，确保小程序不重复实现业务规则。</p>
```

Add verification snapshot item:

```html
<li><code>npm run miniprogram:typecheck</code> 已通过，小程序页面骨架和 CloudBase dev 配置入口可检查。</li>
```

- [ ] **Step 3: 更新 `AGENTS.md`**

Add the new command to the local command list:

```bash
npm run miniprogram:typecheck
npm run miniprogram:check
```

Update current state to mention stage 22 completed:

```markdown
阶段 22 已完成小程序工程基座：`miniprogram/`、页面骨架、TypeScript 检查、微信开发者工具配置和 `dev` CloudBase 环境入口。
```

- [ ] **Step 4: 运行文档检查**

Run:

```bash
git diff --check
rg -n "阶段 22 \\| 小程序工程基座" docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md
```

Expected:

- `git diff --check` has no output.
- `rg` shows stage 22 mentioned as completed or current in all three docs.

- [ ] **Step 5: 提交任务 4**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md
git commit -m "docs(miniprogram): 更新小程序工程基座进度"
```

## Task 5: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused verification**

```bash
npm test -- miniprogram/config/env.test.ts
npm run miniprogram:typecheck
git diff --check
```

Expected:

- The focused Vitest file passes.
- The miniprogram TypeScript check passes.
- `git diff --check` has no output.

- [ ] **Step 2: Run broad verification**

```bash
npm test
npm run typecheck
```

Expected:

- Existing Vitest suite passes.
- Existing Vue / server TypeScript check passes.

- [ ] **Step 3: Inspect git status**

```bash
git status --short --branch
```

Expected: the branch is `codex/wechat-miniprogram-pivot` and only intended committed changes are present.

## Execution Notes

- Do not put a real WeChat AppID in `miniprogram/project.config.json`; keep `touristappid` in Git. Real AppID belongs in local developer tooling / private config.
- Do not put `prd` CloudBase env id in this stage unless the user has created and explicitly provided it.
- Do not create or edit `.worktrees/`.
- Keep the old Vue / Capacitor files unchanged except documentation and scripts required by this plan.
- Do not use local proxy as a runtime dependency for the miniprogram skeleton.

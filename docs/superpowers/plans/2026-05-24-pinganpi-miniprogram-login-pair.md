# 小程序登录与双人关系真实闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成阶段 26 的工程闭环，让小程序通过 CloudBase event 云函数完成微信手机号登录、账号恢复、创建关系、生成邀请码和加入关系。

**Architecture:** 小程序端只传微信手机号授权 code、短信兜底凭据或邀请码；账号、household、member 都由云函数从可信微信 / CloudBase 上下文推导。阶段 25 的 dev payload 身份通道不再作为授权依据，短信真实验证码、微信手机号能力和真机弹窗仍进入阶段 29 人工验证。

**Tech Stack:** 微信原生小程序、TypeScript、CloudBase event 云函数、Vitest、现有 `account-pair-service`。

---

## Scope

本计划对应路线图阶段 26：小程序登录与双人关系真实闭环。当前状态：已完成工程闭环；真实微信手机号能力和短信验证码人工验证顺延到阶段 29。

本阶段包含：

- 小程序账号页接入 `wx.getPhoneNumber` 返回的 `code`，通过 `pinganpi-account` 云函数登录或恢复账号。
- 小程序关系页接入 `pinganpi-pair` 云函数，支持查询绑定、创建关系、生成 24 小时一次性邀请码、输入邀请码加入。
- 服务端账号 / 关系云函数从可信上下文推导当前账号，不再信任客户端传入的 `authUid`、`phoneNumber`、`accountId`、`householdId` 或 `memberId`。
- 本地小程序会话只缓存展示和页面跳转所需的账号 / 绑定摘要，不保存验证码、CloudBase token、secret 或邀请码 hash。

本阶段不包含：

- 微信公众平台 AppID 关联、手机号能力开通、隐私保护指引、服务类目或审核发布。
- `prd` 环境创建、配置或部署。
- AI 起稿页面接入、同步状态页面补齐、订阅消息或照片附件。

## Tasks

### Task 1: 服务端可信身份与手机号解析边界

**Files:**

- Create: `server/miniprogram-functions/miniprogram-auth.ts`
- Modify: `server/miniprogram-functions/result.ts`
- Test: `server/miniprogram-functions/miniprogram-auth.test.ts`

- [x] 写失败测试：能从 CloudBase / 微信运行时上下文推导 `authUid`，并忽略 payload / `event.userInfo` 中伪造的身份字段。
- [x] 写失败测试：缺少可信 openid 时返回 `unauthorized`。
- [x] 实现 `readTrustedMiniProgramIdentity`、`createWechatPhoneNumberResolver` 和受控错误类型。

### Task 2: 账号云函数改为可信登录

**Files:**

- Modify: `server/miniprogram-functions/pinganpi-account.ts`
- Modify: `server/miniprogram-functions/pinganpi-account.test.ts`

- [x] 写失败测试：`loginByWechatPhone` 只接受 `phoneCode`，手机号由服务端 resolver 返回。
- [x] 写失败测试：payload 中伪造 `authUid` / `phoneNumber` 不会生效。
- [x] 写失败测试：`getCurrentAccount` / `getActiveBinding` 不接受客户端 `accountId`。
- [x] 实现 `loginByWechatPhone`、`loginByDevPhone`、`getCurrentAccount` 和可信 `getActiveBinding`。

### Task 3: 关系云函数改为当前账号动作

**Files:**

- Modify: `server/miniprogram-functions/pinganpi-pair.ts`
- Modify: `server/miniprogram-functions/pinganpi-pair.test.ts`

- [x] 写失败测试：创建关系、生成邀请码、加入邀请码都从可信身份查当前账号。
- [x] 写失败测试：payload 中伪造 `accountId` 不会生效。
- [x] 实现 `createHousehold`、`createInvite`、`joinByInvite` 的可信账号推导。

### Task 4: 小程序账号与关系客户端服务

**Files:**

- Create: `miniprogram/services/account-session.ts`
- Create: `miniprogram/services/account-cloud.ts`
- Test: `miniprogram/services/account-session.test.ts`
- Test: `miniprogram/services/account-cloud.test.ts`

- [x] 写失败测试：会话缓存只保存账号和绑定摘要。
- [x] 写失败测试：账号云服务调用 `loginByWechatPhone`、`loginByDevPhone`、`getCurrentAccount` 和 `getActiveBinding`。
- [x] 写失败测试：关系云服务不向云函数传 `accountId`。
- [x] 实现本地会话缓存和云函数 service wrapper。

### Task 5: 小程序账号页与关系页接入真实流程

**Files:**

- Modify: `miniprogram/pages/account/index.ts`
- Modify: `miniprogram/pages/account/index.wxml`
- Modify: `miniprogram/pages/account/index.wxss`
- Modify: `miniprogram/pages/pair/index.ts`
- Modify: `miniprogram/pages/pair/index.wxml`
- Modify: `miniprogram/pages/pair/index.wxss`
- Modify: `miniprogram/types/wx.d.ts`

- [x] 账号页显示登录状态、微信手机号按钮、短信 / 开发兜底入口、错误提示和跳转。
- [x] 关系页显示当前账号、绑定状态、创建关系、生成邀请码和输入邀请码加入。
- [x] 页面操作成功后刷新会话，已绑定进入今日页，未绑定进入关系页。

### Task 6: 文档、验证与提交

**Files:**

- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [x] 更新阶段 26 状态、已完成内容、人工阻塞项和验证基线。
- [x] 运行 `npm run miniprogram:check`、`npm test`、`npm run typecheck`、`npm run cloudbase:build:miniprogram`、`git diff --check`。
- [x] 提交阶段 26 工程闭环。

## Notes

- 阶段 26 的服务端默认不启用不可信手机号登录；`loginByDevPhone` 只能在显式 dev guard 打开时使用，避免把开发入口误带入真实闭环。
- 微信手机号 code 只能由用户点击授权按钮产生；没有 AppID 关联、手机号能力或真机环境时，真实授权验证必须留到阶段 29。
- CloudBase 官方文档说明小程序 `wx.cloud.callFunction` 会自动携带用户 `OPENID`，这是本阶段可信身份推导的基础。

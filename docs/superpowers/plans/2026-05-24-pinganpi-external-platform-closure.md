# 平安批外部平台人工配置收口计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成阶段 19 外部平台人工配置收口，把 CloudBase Auth、短信、费用告警、权限、MiMo 费用 / key 管理和真实环境配置逐项记录为完成、暂缓或不可配置。

**Architecture:** 本阶段不新增业务功能。自动部分只做脱敏审计和文档记录；需要用户登录控制台、输入验证码、确认费用或查看私密页面的动作，由 Codex 给出步骤，用户执行后回报结果。任何 key、验证码、SecretId、SecretKey、真实 token 不写入聊天和仓库。

**Tech Stack:** CloudBase CLI、CloudBase 控制台、腾讯云费用中心、Xiaomi MiMo 控制台、Markdown checklist。

---

## 当前自动审计基线

运行命令：

```bash
CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:audit:stage19
```

结果：

- CloudBase 环境：`pinganpi-d7gml1f6sbcc172ea`
- 计费周期：`2026-05-23 ~ 2026-06-23`
- 用量：`1.67 / 3000 credits`
- 产生用量的模块：
  - NoSQL Database：`0.52`
  - Cloud function：`0.98`
  - Cloud storage：`0.01`
  - API calls：`0.16`
- `ai-scribe-proxy`：
  - 状态：`Active / Available`
  - Runtime：`Nodejs20.19`
  - 类型：`HTTP`
  - PublicNet：`ENABLE`
  - Triggers：`0`
  - VPC：未配置
  - Role：`TCB_QcsRole`
  - Env：`MIMO_API_BASE_URL`、`MIMO_API_KEY`、`MIMO_MAX_COMPLETION_TOKENS`、`MIMO_MODEL_ID`、`MIMO_REQUEST_TIMEOUT_MS`、`PINGANPI_AI_MAX_ORAL_TEXT_CHARS`
- `sync-proxy`：
  - 状态：`Active / Available`
  - Runtime：`Nodejs20.19`
  - 类型：`HTTP`
  - PublicNet：`ENABLE`
  - Triggers：`0`
  - VPC：未配置
  - Role：`TCB_QcsRole`
  - Env：`PINGANPI_SYNC_MEMBER_TOKENS_B64`、`PINGANPI_SYNC_SNAPSHOT_COLLECTION`

当前只读 CLI 补充检查：

- `cloudbase routes list --json` 返回 4 条启用路由：`/api -> ai-scribe-proxy`，`/sync/health -> sync-proxy`，`/sync/pull -> sync-proxy`，`/sync/push -> sync-proxy`；均为 `WEB_SCF`，`enableAuth=false`，`enablePathTransmission=true`。
- `cloudbase permission get collection:... --json` 返回 `pinganpi_sync_snapshots`、`pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites` 的权限均为 `PRIVATE`。
- `cloudbase permission get function --json` 返回函数 invoke 规则为 `auth != null && auth.loginType != 'ANONYMOUS'`；HTTP 访问服务路由仍是公开入口，实际访问控制必须继续由代理 handler 做 fail closed。
- `cloudbase role list --json` 返回系统角色 5 个、自定义角色 0 个。

安全规则：

- 不再直接运行会打印完整 env 的 `cloudbase fn detail` 给用户看；统一使用 `npm run cloudbase:audit:stage19`。
- `MIMO_API_KEY`、`PINGANPI_SYNC_MEMBER_TOKENS_B64` 和未来账号 token / secret 必须脱敏。
- 阶段 19 必须完成或记录 MiMo key 撤销 / 轮换入口。

## 官方资料入口

- CloudBase 登录方式管理：`https://docs.cloudbase.net/en/authentication-v2/auth/manage-login`
- CloudBase 发送短信 / 邮箱验证码 HTTP API：`https://docs.cloudbase.net/http-api/auth/auth-send-verification`
- CloudBase 验证短信 / 邮箱验证码 HTTP API：`https://docs.cloudbase.net/http-api/auth/auth-verify-verification`
- CloudBase 用户登录 HTTP API：`https://docs.cloudbase.net/http-api/auth/auth-sign-in`
- CloudBase token 获取 / 刷新 HTTP API：`https://docs.cloudbase.net/http-api/auth/auth-grant-token`
- CloudBase 短信验证码登录旧版说明与费用 / 频率限制：`https://docs.cloudbase.net/authentication/method/sms-login`
- 腾讯云费用中心预算管理：`https://cloud.tencent.com/document/product/555/65784`

## Checklist

### 1. CloudBase Auth 手机号登录

- [x] 用户打开 CloudBase 控制台：`https://tcb.cloud.tencent.com/`
- [x] 进入环境 `pinganpi-d7gml1f6sbcc172ea`
- [x] 进入 Authentication / Login Methods 或登录授权页面
- [x] 开启手机号短信登录
- [x] 确认地域限制：手机号短信登录官方文档标注仅支持上海地域；本环境是 `ap-shanghai`
- [ ] 记录是否需要短信签名、短信模板、资质审核或资源包购买
- [x] 记录发送限制和费用策略：官方资料显示新开通按量计费环境首月 100 条免费额度；超出免费额度可购买资源包；同一号码 30 秒最多 1 条，同一手机号一个自然日最多 10 条
- [x] 真实手机号 A 可收到验证码
- [x] 真实手机号 B 可收到验证码
- [x] 若出现图片验证码或频率限制，记录具体提示，不把验证码写进仓库；本次两次真实手机号触发均未出现图片验证码或频率限制

当前触发记录：

- 已确认 Auth 发送入口应使用 CloudBase HTTP API 统一域名：`https://pinganpi-d7gml1f6sbcc172ea.api.tcloudbasegateway.com/auth/v1/verification`
- 曾误用 HTTP 访问服务默认域名 `/auth/v1/verification`，返回 `INVALID_PATH`；不要再用 `app.tcloudbase.com` 域名触发 Auth API。
- 已对两个真实手机号各触发一次发送请求，均返回 HTTP 200，响应包含 `verification_id`，`expires_in` 为 `300` 秒。
- 用户已确认两台手机均实际收到验证码；验证码不要写入聊天、文档或 Git。

### 2. 账号 / 关系 CloudBase 持久化准备

- [x] 确认是否使用 CloudBase Auth v2 HTTP API 还是 JS SDK 接入 App：第一版采用 HTTP API
- [x] 确认 `PinganpiAccount` 集合名：`pinganpi_accounts`
- [x] 确认 household 集合名：`pinganpi_households`
- [x] 确认 member 集合名：`pinganpi_members`
- [x] 确认 invite 集合名：`pinganpi_invites`
- [x] 确认各集合权限：`pinganpi_sync_snapshots`、`pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites` 均为 `PRIVATE`
- [x] 确认邀请码服务端只保存 hash，不保存明文

账号接入决策：

- App 第一版采用 CloudBase Auth v2 HTTP API：发送验证码 `/auth/v1/verification`，验证验证码 `/auth/v1/verification/verify`，登录 `/auth/v1/signin`，刷新 `/auth/v1/token`。
- 采用 HTTP API 的原因：当前 App 是 Capacitor WebView + Vite/Vue，已有 fetch adapter 形态；第一版只需要手机号验证码和 token 刷新，不引入额外 CloudBase JS SDK 依赖。
- CloudBase `access_token` / `refresh_token` 只保存在本机登录态存储中；验证码、管理密钥、provider 原始响应和 SecretId / SecretKey 不进入 AppState、RemoteSnapshot、日志或 Git。
- 账号 / 关系写入仍必须走服务端可信边界：服务端验证 CloudBase 登录身份后推导 `authUid`，客户端不得直接提交可信 `authUid`、`householdId` 或 `memberId`。
- 现有 `server/account-pair/account-pair-service.ts` 已按 `codeHash` 存储邀请码，返回明文邀请码只用于创建当次展示。

### 3. CloudBase HTTP 路由与函数

- [x] `ai-scribe-proxy` 状态为 `Active / Available`
- [x] `sync-proxy` 状态为 `Active / Available`
- [x] `ai-scribe-proxy` 使用 `Nodejs20.19`
- [x] `sync-proxy` 使用 `Nodejs20.19`
- [x] 两个函数触发器数量为 `0`
- [x] 两个函数 VPC 未配置
- [x] 两个函数 PublicNet 为 `ENABLE`
- [x] HTTP smoke：`/api/health` 返回 200 和 `{"ok":true}`
- [x] HTTP smoke：`/sync/health` 返回 200 和 `{"ok":true}`
- [x] HTTP smoke：`/sync/pull` 未带 token 返回 401 `unauthorized`
- [x] HTTP smoke：`/sync/push` 未带 token 返回 401 `unauthorized`
- [x] CLI 确认 `/api` 指向 `ai-scribe-proxy`
- [x] CLI 确认 `/sync/health` 指向 `sync-proxy`
- [x] CLI 确认 `/sync/pull` 指向 `sync-proxy`
- [x] CLI 确认 `/sync/push` 指向 `sync-proxy`
- [x] 如果新增账号服务函数，确认其路由不与 `/api` / `/sync/*` 冲突；当前未新增账号服务函数，后续新增时不得复用 `/api` 或 `/sync/*`

当前路由 smoke 记录：

- 2026-05-24 运行 `curl` 检查 CloudBase 默认访问域名。
- `/api/health` 和 `/sync/health` 均返回 200；`/sync/pull`、`/sync/push` 在未带同步 token 时均返回 401。
- 2026-05-24 运行 `cloudbase routes list --json` 检查 HTTP 访问服务路由；四条路由均启用，且指向预期函数。
- HTTP 访问服务路由 `enableAuth=false`，属于公网入口；AI / 同步代理必须继续在 handler 内做 Origin、token、账号关系等应用层校验。

### 4. CloudBase 费用与权限

- [x] 当前计费周期用量已记录：`1.67 / 3000 credits`
- [ ] 在腾讯云费用中心创建或确认预算
- [x] 预算建议：先建月度费用预算，费用范围选全部范围；建议月上限先用低额，推荐 `10 元/月`，阈值提醒用 `80%` 和 `100%`，具体金额由用户最终确认
- [ ] 配置余额提醒或可用额度提醒
- [ ] 配置 CloudBase / 云函数 / 数据库相关告警
- [ ] 确认 `TCB_QcsRole` 是否可收敛为更小权限
- [ ] 若不能收敛，记录理由和风险
- [x] 只读查询当前 CloudBase 环境角色：系统角色 5 个，自定义角色 0 个
- [ ] 确认是否开启自动续费；第一版建议不要开启高规格包年资源

### 5. Xiaomi MiMo 费用与 key 管理

- [ ] 打开 Xiaomi MiMo 平台控制台
- [ ] 确认当前模型 ID：本地记录为 `mimo-v2.5-pro`
- [ ] 确认 API Base URL：本地记录为 `https://api.xiaomimimo.com/v1`
- [ ] 确认当前 key 类型，不在聊天中粘贴完整 key
- [ ] 确认额度、费用提醒、余额提醒或月上限
- [ ] 找到 key 撤销入口
- [ ] 找到 key 轮换 / 新建入口
- [x] 记录“出现异常费用时如何停用”：运行 `CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:disable:ai-env` 移除 CloudBase `MIMO_API_KEY`，使云端 AI 代理 fail closed

### 6. 阶段 19 结束条件

- [ ] 所有人工项标记为：完成 / 暂缓 / 不可配置
- [ ] roadmap、dashboard、AGENTS 更新阶段 19 状态
- [ ] 若新增脚本或配置，运行 `npm test`、`npm run typecheck`
- [ ] 若涉及 App / CloudBase 配置，运行相关 smoke
- [ ] 阶段 20 可拿本 checklist 进入完整人工验证

## 剩余人工回报模板

用户完成控制台确认后，只需要按下面格式回报结果；不要粘贴验证码、完整 key、SecretId、SecretKey 或真实 token。

```text
CloudBase 短信：
- 短信签名 / 模板 / 资质审核：无 / 已配置 / 需要后续处理（说明）
- 短信资源包：暂不购买 / 已购买 / 待定

腾讯云费用：
- 预算：已创建 / 已确认已有 / 暂缓
- 月上限：例如 10 元
- 阈值提醒：例如 80%、100%
- 余额或额度提醒：已配置 / 暂缓
- CloudBase / 云函数 / 数据库告警：已配置 / 暂缓
- 自动续费：关闭 / 开启 / 不适用

CloudBase 权限：
- TCB_QcsRole 是否可收敛：可以 / 不可以 / 找不到入口
- 如果不可以或找不到入口：控制台提示或原因

Xiaomi MiMo：
- 模型 ID：只确认是否仍是 mimo-v2.5-pro
- API Base URL：只确认是否仍是 https://api.xiaomimimo.com/v1
- key 类型：只写前缀类型，例如 tp 或 sk，不要写完整 key
- 额度 / 费用提醒 / 月上限：已配置 / 暂缓 / 平台不支持
- key 撤销入口：找到 / 未找到
- key 新建或轮换入口：找到 / 未找到
```

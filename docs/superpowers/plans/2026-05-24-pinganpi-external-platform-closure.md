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

安全规则：

- 不再直接运行会打印完整 env 的 `cloudbase fn detail` 给用户看；统一使用 `npm run cloudbase:audit:stage19`。
- `MIMO_API_KEY`、`PINGANPI_SYNC_MEMBER_TOKENS_B64` 和未来账号 token / secret 必须脱敏。
- 阶段 19 必须完成或记录 MiMo key 撤销 / 轮换入口。

## 官方资料入口

- CloudBase 登录方式管理：`https://docs.cloudbase.net/en/authentication-v2/auth/manage-login`
- CloudBase 发送短信 / 邮箱验证码 HTTP API：`https://docs.cloudbase.net/http-api/auth/auth-send-verification`
- CloudBase 用户登录 HTTP API：`https://docs.cloudbase.net/http-api/auth/auth-sign-in`
- CloudBase 短信验证码登录旧版说明与费用 / 频率限制：`https://docs.cloudbase.net/authentication/method/sms-login`
- 腾讯云费用中心预算管理：`https://cloud.tencent.com/document/product/555/65784`

## Checklist

### 1. CloudBase Auth 手机号登录

- [ ] 用户打开 CloudBase 控制台：`https://tcb.cloud.tencent.com/`
- [ ] 进入环境 `pinganpi-d7gml1f6sbcc172ea`
- [ ] 进入 Authentication / Login Methods 或登录授权页面
- [ ] 开启手机号短信登录
- [ ] 确认地域限制：手机号短信登录官方文档标注仅支持上海地域；本环境是 `ap-shanghai`
- [ ] 记录是否需要短信签名、短信模板、资质审核或资源包购买
- [ ] 记录发送限制和费用策略
- [ ] 真实手机号 A 可收到验证码
- [ ] 真实手机号 B 可收到验证码
- [ ] 若出现图片验证码或频率限制，记录具体提示，不把验证码写进仓库

### 2. 账号 / 关系 CloudBase 持久化准备

- [ ] 确认是否使用 CloudBase Auth v2 HTTP API 还是 JS SDK 接入 App
- [ ] 确认 `PinganpiAccount` 集合名：建议 `pinganpi_accounts`
- [ ] 确认 household 集合名：建议 `pinganpi_households`
- [ ] 确认 member 集合名：建议 `pinganpi_members`
- [ ] 确认 invite 集合名：建议 `pinganpi_invites`
- [ ] 确认各集合权限：客户端不得直接写入授权结果；账号 / 关系写入应通过服务端可信身份完成
- [ ] 确认邀请码服务端只保存 hash，不保存明文

### 3. CloudBase HTTP 路由与函数

- [x] `ai-scribe-proxy` 状态为 `Active / Available`
- [x] `sync-proxy` 状态为 `Active / Available`
- [x] `ai-scribe-proxy` 使用 `Nodejs20.19`
- [x] `sync-proxy` 使用 `Nodejs20.19`
- [x] 两个函数触发器数量为 `0`
- [x] 两个函数 VPC 未配置
- [x] 两个函数 PublicNet 为 `ENABLE`
- [ ] 控制台确认 `/api` 指向 `ai-scribe-proxy`
- [ ] 控制台确认 `/sync/health` 指向 `sync-proxy`
- [ ] 控制台确认 `/sync/pull` 指向 `sync-proxy`
- [ ] 控制台确认 `/sync/push` 指向 `sync-proxy`
- [ ] 如果新增账号服务函数，确认其路由不与 `/api` / `/sync/*` 冲突

### 4. CloudBase 费用与权限

- [x] 当前计费周期用量已记录：`1.67 / 3000 credits`
- [ ] 在腾讯云费用中心创建或确认预算
- [ ] 预算建议：月费用上限先设低额，超过阈值提醒；具体金额由用户确认
- [ ] 配置余额提醒或可用额度提醒
- [ ] 配置 CloudBase / 云函数 / 数据库相关告警
- [ ] 确认 `TCB_QcsRole` 是否可收敛为更小权限
- [ ] 若不能收敛，记录理由和风险
- [ ] 确认是否开启自动续费；第一版建议不要开启高规格包年资源

### 5. Xiaomi MiMo 费用与 key 管理

- [ ] 打开 Xiaomi MiMo 平台控制台
- [ ] 确认当前模型 ID：本地记录为 `mimo-v2.5-pro`
- [ ] 确认 API Base URL：本地记录为 `https://api.xiaomimimo.com/v1`
- [ ] 确认当前 key 类型，不在聊天中粘贴完整 key
- [ ] 确认额度、费用提醒、余额提醒或月上限
- [ ] 找到 key 撤销入口
- [ ] 找到 key 轮换 / 新建入口
- [ ] 记录“出现异常费用时如何停用”：可先移除 CloudBase `MIMO_API_KEY`，使云端 AI 代理 fail closed

### 6. 阶段 19 结束条件

- [ ] 所有人工项标记为：完成 / 暂缓 / 不可配置
- [ ] roadmap、dashboard、AGENTS 更新阶段 19 状态
- [ ] 若新增脚本或配置，运行 `npm test`、`npm run typecheck`
- [ ] 若涉及 App / CloudBase 配置，运行相关 smoke
- [ ] 阶段 20 可拿本 checklist 进入完整人工验证

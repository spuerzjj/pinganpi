# 平安批云端 AI 代理与费用配置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《平安批》建立生产可用的 AI 起稿服务端边界，让移动端只调用自有代理，不接触 MiMo key，并具备费用、密钥、部署和回滚检查流程。

**Architecture:** 继续复用 `server/ai-scribe-proxy/` 的请求校验、MiMo client、prompt 和错误归一逻辑。云端只承载服务端代理与 secret，不把云 SDK、AI SDK 或 provider key 引入 `src/domain` 或 Vite 客户端包。

**Tech Stack:** TypeScript, Node 运行时, Xiaomi MiMo OpenAI-compatible API, 腾讯云 CloudBase 或等价云函数平台。

---

## 当前基线

已完成：

- 本机 `.env.ai.local` 已配置真实 MiMo env，且被 Git 忽略。
- `npm run ai-proxy:check` 已真实连通 Xiaomi MiMo。
- 本地 `POST /ai/scribe-draft` 已能返回 AI 初稿。
- 写信页真实 AI 起稿烟测已通过。
- 代理核心逻辑已抽为 `server/ai-scribe-proxy/handler.ts`，本地 dev server 已复用该 handler。
- 本地代理已加入费用护栏：
  - `PINGANPI_AI_MAX_ORAL_TEXT_CHARS` 默认 800。
  - `MIMO_MAX_COMPLETION_TOKENS` 默认 900。

仍需云端控制台人工确认：

- MiMo 订阅页的额度、余额提醒、费用告警和 key 类型。
- 云端代理落点，优先评估 CloudBase；不默认购买 CVM。
- 云端 secret、部署凭据、回滚删除步骤。

## 环境命名

推荐命名：

- 开发环境：`pinganpi-dev`
- 未来生产环境：`pinganpi-prod`

开发期先只创建 `pinganpi-dev`。`pinganpi-prod` 等双人同步、推送和发布路径明确后再创建。

## 必需环境变量

服务端代理需要：

```bash
MIMO_API_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL_ID=mimo-v2.5-pro
MIMO_API_KEY=<cloud-secret-only>
MIMO_REQUEST_TIMEOUT_MS=30000
PINGANPI_AI_MAX_ORAL_TEXT_CHARS=800
MIMO_MAX_COMPLETION_TOKENS=900
```

客户端只允许配置自有代理地址：

```bash
VITE_PINGANPI_AI_PROXY_URL=https://<your-cloud-ai-proxy-domain>
```

禁止：

- 不使用 `VITE_MIMO_API_KEY`、`VITE_XIAOMI_MIMO_API_KEY` 或任何 `VITE_` provider key。
- 不把真实 key 写入 `.env.example`、文档、测试、提交信息或聊天。
- 不记录完整 prompt、用户完整口述、provider 原始响应或 key 到云端日志。

## Task 1: 购买前确认

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] 登录 Xiaomi MiMo 控制台，确认当前模型、key 类型、额度、余额提醒方式和费用告警入口。
- [ ] 登录腾讯云控制台，只评估 CloudBase / 云函数是否满足最小 Node 服务端代理，不购买 CVM 或长期包年资源。
- [ ] 记录最终选择的云端落点、区域、环境名和预计月费用上限。
- [ ] 更新 roadmap / dashboard / AGENTS，明确阶段 13 的云端落点决策。

验收标准：

- 能说清楚为什么选择 CloudBase 或其他云函数平台。
- 有明确费用上限或人工检查频率。
- 没有创建不必要的长期付费资源。

## Task 2: 云端 secret 与最小权限

**Files:**
- Modify: `docs/superpowers/plans/2026-05-23-pinganpi-cloud-ai-proxy.md`
- Modify: `docs/pinganpi-roadmap.md`

- [ ] 在云平台 secret / 环境变量中配置 `MIMO_API_BASE_URL`、`MIMO_MODEL_ID`、`MIMO_API_KEY`、`MIMO_REQUEST_TIMEOUT_MS`、`PINGANPI_AI_MAX_ORAL_TEXT_CHARS`、`MIMO_MAX_COMPLETION_TOKENS`。
- [ ] 确认云函数日志不会打印 env。
- [ ] 为云函数配置最小权限，不授予数据库、文件存储、推送等暂未使用的权限。
- [ ] 记录 secret 更新、禁用和轮换步骤。

验收标准：

- 云平台页面中能看到变量名，但不在仓库中出现真实值。
- 代理可以读取 secret 调用 MiMo。
- 关闭或删除 secret 后，代理失败为受控错误，不泄露 provider body。

## Task 3: 部署与连接验证

**Files:**
- Modify: `server/ai-scribe-proxy/`
- Modify: `package.json`（如需要新增部署脚本）
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`

- [x] 抽出 `server/ai-scribe-proxy/handler.ts`，集中校验、prompt、MiMo client 和错误归一逻辑。
- [ ] 新增具体云函数入口，让 CloudBase / 云函数复用 `handleAiProxyRequest`。
- [ ] 部署 `GET /health`，确认返回 `{ "ok": true }`。
- [ ] 部署 `POST /ai/scribe-draft`，用非敏感口述烟测 AI 起稿。
- [ ] 配置 `VITE_PINGANPI_AI_PROXY_URL` 指向云端代理。
- [ ] 浏览器写信页完成一次真实云端 AI 起稿烟测。

验收标准：

- 移动端 / Vite 客户端构建产物不包含 MiMo key。
- 代理仍保留本地 Origin / Capacitor Origin 策略，生产域名策略单独记录。
- 超出口述长度时不调用 MiMo。
- provider 错误不会把原始错误 body 返回给客户端。

## Task 4: 费用告警与回滚删除

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] 在 MiMo 控制台配置余额提醒、额度提醒或人工检查流程。
- [ ] 在云平台配置函数调用量、出网流量、错误率和费用告警。
- [ ] 记录关闭入口：禁用云函数、删除环境变量、撤销 MiMo key。
- [ ] 记录删除入口：删除云函数、删除 CloudBase 环境、删除日志或设置日志保留期。
- [ ] 做一次“禁用 key 后代理安全失败”的验证。

验收标准：

- 有可复现的费用告警和人工检查清单。
- 任何后续代理都能按文档停止费用继续产生。
- 回滚不会影响本地数据、草稿、信件状态或 `src/domain` 规则。

## 完成定义

阶段 13 完成需要同时满足：

- 本机和云端 AI 代理都能通过非敏感烟测。
- 云端 proxy URL 可配置到 App。
- 云端 secret 不进入 Git 或客户端。
- 本地费用护栏、MiMo 控制台费用告警、云平台费用告警均有记录。
- 回滚和资源删除步骤可执行。
- `npm test`、`npm run typecheck`、`npm run build` 通过。

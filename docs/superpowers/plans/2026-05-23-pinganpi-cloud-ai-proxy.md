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
- 用户已购买腾讯云 CloudBase，阶段 13 云端落点确定为 CloudBase HTTP 云函数。
- 已安装项目级 CloudBase CLI：`@cloudbase/cli@3.4.0`。
- 已新增 CloudBase HTTP 入口：`server/ai-scribe-proxy/cloudbase-entry.ts`。
- 已新增 CloudBase Web Server 启动入口：`server/ai-scribe-proxy/cloudbase-bootstrap.ts` 和 `server/ai-scribe-proxy/cloudbase-http-server.ts`。
- 已新增 CloudBase 构建脚本：`npm run cloudbase:build:ai`。
- 已新增 CloudBase secret 配置脚本：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env`，从 `.env.ai.local` 读取变量并脱敏输出。
- 已新增 CloudBase secret 禁用脚本：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env`，移除云端 `MIMO_API_KEY`，用于验证代理安全失败和临时停用 AI 起稿。
- 已新增 CloudBase 部署脚本：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:deploy:ai`。
- CloudBase 环境 ID 已确认为 `pinganpi-d7gml1f6sbcc172ea`，区域为 `ap-shanghai`。
- CloudBase HTTP 函数 `ai-scribe-proxy` 已部署，默认访问地址为 `https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api`。
- CloudBase HTTP 路由已收敛为只保留 `/api`，历史遗留 `/*` 路由已删除；`/health` 根路径继续由网关返回 404。
- `GET /api/health` 已返回 `{ "ok": true }`。
- 云端 `POST /api/ai/scribe-draft` 已通过非敏感口述烟测，返回 `xiaomi-mimo / mimo-v2.5-pro` 的 AI 初稿。
- 浏览器写信页已通过真实云端 AI 起稿烟测。
- 禁用云端 `MIMO_API_KEY` 后，云端 `POST /api/ai/scribe-draft` 已验证返回受控 `502 proxy_unavailable`，不会生成正文或暴露 provider 原始错误；随后已恢复真实 env 并重新验证 HTTP 200。
- CloudBase 用量基线已读取：当前计费周期 `2026-05-23 ~ 2026-06-23`，`usedCredits: 0.04`，其中 Cloud function `0.01`、API calls `0.03`。
- 云函数公开面初步检查完成：函数类型为 HTTP，运行时 `Nodejs20.19`，状态 Available，触发器数量为 0，VPC 未配置，云端 env 仅包含 6 个 AI 代理所需变量。CloudBase 默认角色仍为 `TCB_QcsRole`，后续如平台支持更细 IAM，应继续收敛。
- 本地代理已加入费用护栏：
  - `PINGANPI_AI_MAX_ORAL_TEXT_CHARS` 默认 800。
  - `MIMO_MAX_COMPLETION_TOKENS` 默认 900。

仍需云端控制台人工确认：

- MiMo 订阅页的额度、余额提醒、费用告警和 key 类型。
- CloudBase 函数调用量、出网流量、错误率和费用告警。
- CloudBase 控制台告警策略，以及是否可替换 `TCB_QcsRole` 为更细粒度角色。

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
VITE_PINGANPI_AI_PROXY_URL=https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api
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
- [x] 登录腾讯云控制台，确认已购买 CloudBase；阶段 13 云端落点确定为 CloudBase HTTP 云函数，不购买 CVM 或长期包年资源。
- [x] 记录最终选择的云端落点、区域和环境 ID：CloudBase HTTP 云函数，`ap-shanghai`，`pinganpi-d7gml1f6sbcc172ea`。
- [x] 更新 roadmap / dashboard / AGENTS，明确阶段 13 的云端落点决策。
- [x] 记录预计费用控制方式：阶段 13 期间不购买 CVM 或长期包年资源；CloudBase 每周用 `cloudbase env usage --json` 人工检查一次；MiMo 控制台未配置告警前，每次真实云端烟测后人工检查余额 / 用量。
- [ ] 记录 MiMo 与 CloudBase 控制台中的实际告警配置结果。

验收标准：

- 能说清楚为什么选择 CloudBase 或其他云函数平台。
- 有明确费用上限或人工检查频率。
- 没有创建不必要的长期付费资源。

## Task 2: 云端 secret 与最小权限

**Files:**
- Modify: `docs/superpowers/plans/2026-05-23-pinganpi-cloud-ai-proxy.md`
- Modify: `docs/pinganpi-roadmap.md`

- [x] 在云平台 secret / 环境变量中配置 `MIMO_API_BASE_URL`、`MIMO_MODEL_ID`、`MIMO_API_KEY`、`MIMO_REQUEST_TIMEOUT_MS`、`PINGANPI_AI_MAX_ORAL_TEXT_CHARS`、`MIMO_MAX_COMPLETION_TOKENS`。
- [x] 确认配置脚本和验证命令不会打印 env 真实值；当前云函数代码不打印 env。
- [x] 初步检查云函数公开面：仅保留 `/api` HTTP 路由，函数无触发器、无 VPC、env 仅包含 AI 代理变量；数据库、文件存储、推送未初始化。
- [ ] 检查 CloudBase 控制台是否可把默认 `TCB_QcsRole` 收敛为更细粒度角色。
- [x] 记录 secret 更新和禁用步骤：
  - 更新 / 恢复：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:configure:ai-env`
  - 临时禁用：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env`
  - 本机轮换：更新 `.env.ai.local` 后重新运行配置脚本，不把真实 key 写入 Git。
- [ ] 记录 MiMo 控制台撤销 / 轮换 key 的实际入口。

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
- [x] 新增具体云函数入口，让 CloudBase / 云函数复用 `handleAiProxyRequest`。
- [x] 新增 CloudBase CLI 和构建 / 部署脚本。
- [x] 部署 `GET /api/health`，确认返回 `{ "ok": true }`。
- [x] 部署 `POST /api/ai/scribe-draft`，用非敏感口述烟测 AI 起稿。
- [x] 配置 `VITE_PINGANPI_AI_PROXY_URL` 指向云端代理并完成本地启动验证。
- [x] 浏览器写信页完成一次真实云端 AI 起稿烟测。
- [x] 删除历史遗留 `/*` HTTP 路由，只保留 App 使用的 `/api` 路由，并重新验证 `/api/health` 与 `/api/ai/scribe-draft`。

验收标准：

- 移动端 / Vite 客户端构建产物不包含 MiMo key。
- 代理仍保留本地 Origin / Capacitor Origin 策略，生产域名策略单独记录。
- 超出口述长度时不调用 MiMo。
- provider 错误不会把原始错误 body 返回给客户端。

部署命令：

```bash
npm run cloudbase:login
CLOUDBASE_ENV_ID=<你的 CloudBase 环境 ID> npm run cloudbase:configure:ai-env
CLOUDBASE_ENV_ID=<你的 CloudBase 环境 ID> npm run cloudbase:deploy:ai
```

配置脚本会从本机 `.env.ai.local` 读取服务端环境变量，生成临时 CloudBase 配置并脱敏输出；不要把真实 key 写进 `cloudbaserc.json` 或聊天。

云端代理地址：

```bash
VITE_PINGANPI_AI_PROXY_URL=https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api
```

CloudBase 函数需要以下服务端环境变量：

```bash
MIMO_API_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL_ID=mimo-v2.5-pro
MIMO_API_KEY=<只放云端 secret>
MIMO_REQUEST_TIMEOUT_MS=30000
PINGANPI_AI_MAX_ORAL_TEXT_CHARS=800
MIMO_MAX_COMPLETION_TOKENS=900
```

安全失败验证命令：

```bash
CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:disable:ai-env
curl -i \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Type: application/json' \
  --data '{"oralText":"请替我问她近来安好。","scribeName":"陈启明","scribeStyle":"语气温和，字句端正","senderGreeting":"兰卿","senderSignature":"阿平","senderCity":"广州","recipientCity":"上海","letterType":"ordinary"}' \
  https://pinganpi-d7gml1f6sbcc172ea-1258361524.ap-shanghai.app.tcloudbase.com/api/ai/scribe-draft
CLOUDBASE_ENV_ID=pinganpi-d7gml1f6sbcc172ea npm run cloudbase:configure:ai-env
```

预期：禁用后返回 `502`，body 为 `{"ok":false,"reason":"proxy_unavailable","message":"AI proxy is not configured."}`；恢复后同一类非敏感请求返回 `200`。

## Task 4: 费用告警与回滚删除

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] 在 MiMo 控制台配置余额提醒、额度提醒或人工检查流程。
- [ ] 在云平台配置函数调用量、出网流量、错误率和费用告警。
- [x] 记录关闭入口：`CLOUDBASE_ENV_ID=<env-id> npm run cloudbase:disable:ai-env` 可移除云端 `MIMO_API_KEY`，让 AI 起稿失败关闭；恢复用 `cloudbase:configure:ai-env`。
- [x] 记录删除入口：
  - 预览删除函数：`CLOUDBASE_ENV_ID=<env-id> cloudbase fn delete ai-scribe-proxy --dry-run`
  - 删除路由预览：`CLOUDBASE_ENV_ID=<env-id> cloudbase routes delete <domain> -p /api --dry-run`
  - 删除环境预览：`cloudbase env delete --env-id <env-id> --dry-run`
  - 真正删除前必须再次确认，因为这会破坏云端 AI 代理。
- [x] 做一次“禁用 key 后代理安全失败”的验证。

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

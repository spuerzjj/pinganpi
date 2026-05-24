# 平安批 CloudBase 同步 Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把阶段 16A 的本地 / 模拟远端同步闭环接入真实 CloudBase 同步函数，同时保持 App 默认本地调试可用。

**Architecture:** App 新增 HTTP `SyncAdapter`，配置 `VITE_PINGANPI_SYNC_PROXY_URL` 后调用 CloudBase HTTP 云函数；云函数内通过 CloudBase 数据库保存每个 household 的完整 `RemoteSnapshot`，并复用既有 merge/redaction 规则。真实控制台权限、费用告警和部署烟测作为阶段末手工收口。

**Security Note:** 阶段 16B 同步函数要求成员 token。App 配置 `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 后由 HTTP adapter 发送 `X-Pinganpi-Sync-Token`；云端用 `PINGANPI_SYNC_MEMBER_TOKENS` 校验 `householdId + memberId`，缺失配置时同步请求 fail closed。

**Tech Stack:** TypeScript、Vue 3、Vitest、CloudBase HTTP 云函数、CloudBase Node SDK、既有 `SyncAdapter` / `RemoteSnapshot`。

---

### Task 1: HTTP SyncAdapter

**Files:**
- Create: `src/app/sync/http-remote-adapter.ts`
- Test: `src/app/sync/http-remote-adapter.test.ts`

- [x] 写失败测试：`pull` 向 `<baseUrl>/sync/pull` 发送 `SyncPullInput`，返回 `RemoteSnapshot`。
- [x] 写失败测试：`push` 向 `<baseUrl>/sync/push` 发送 `SyncPushInput`，返回 `SyncPushResult`。
- [x] 写失败测试：云端返回 `409 { error: "stale_remote_revision" }` 时抛出带 `code: "stale_remote_revision"` 的错误。
- [x] 写失败测试：HTTP 500 或坏 JSON 抛出受控错误，错误消息不包含响应体中的 secret。
- [x] 写失败测试：成功响应 revision 不一致或缺少 cursor 时拒绝 malformed response。
- [x] 写失败测试：配置 member token 时发送 `X-Pinganpi-Sync-Token`。
- [x] 写失败测试：成功响应中远端实体字段畸形时拒绝进入 runtime。
- [x] 实现 `createHttpRemoteSyncAdapter({ baseUrl, fetch })`，去掉 baseUrl 尾部斜杠，固定使用 JSON POST。
- [x] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/app/sync/http-remote-adapter.test.ts
```

### Task 2: CloudBase Sync Handler

**Files:**
- Create: `server/sync-proxy/handler.ts`
- Test: `server/sync-proxy/handler.test.ts`

- [x] 定义 `SyncSnapshotStore`：`loadSnapshot(householdId)` 与 `saveSnapshot(input)`。
- [x] 写失败测试：`GET /health` 返回 `{ ok: true }`。
- [x] 写失败测试：`POST /sync/pull` 在空 household 返回 revision 0 的空快照，并按 member redaction。
- [x] 写失败测试：`POST /sync/push` 创建或合并快照，递增 revision，更新 cursor。
- [x] 写失败测试：`baseRemoteRevision` 过期返回 409 `stale_remote_revision`。
- [x] 写失败测试：返回给客户端的 snapshot 过滤对方私有草稿，未到达来信不含正文、摘要、口述、代笔稿、AI metadata。
- [x] 写失败测试：返回给客户端的 snapshot 不带照片附件定位信息。
- [x] 写失败测试：member token 不匹配时拒绝冒充其他成员。
- [x] 写失败测试：handler 不把 store 原始错误正文透出。
- [x] 实现 handler，复用 `createEmptyRemoteSnapshot`、`mergeRemoteSnapshots`、`redactRemoteSnapshotForMember`。
- [x] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run server/sync-proxy/handler.test.ts
```

### Task 3: CloudBase Store 与函数入口

**Files:**
- Create: `server/sync-proxy/cloudbase-store.ts`
- Create: `server/sync-proxy/cloudbase-entry.ts`
- Create: `server/sync-proxy/cloudbase-http-server.ts`
- Create: `server/sync-proxy/cloudbase-bootstrap.ts`
- Test: `server/sync-proxy/cloudbase-store.test.ts`
- Test: `server/sync-proxy/cloudbase-entry.test.ts`
- Test: `server/sync-proxy/cloudbase-http-server.test.ts`

- [x] 添加依赖 `@cloudbase/node-sdk`，仅用于云函数服务端访问数据库。
- [x] 写 fake collection 测试：不存在文档时 `loadSnapshot` 返回 `null`。
- [x] 写 fake collection 测试：`saveSnapshot` 保存 `schemaVersion: 1`、`householdId`、`snapshot`、`updatedAtIso`。
- [x] 写 fake collection 测试：expected revision 不匹配时抛出 `StaleRemoteRevisionError`，且不改变已存 snapshot。
- [x] 修正 CloudBase SDK 调用形状：真实 `doc.set(data)` 不能写 `{ data }`，事务内使用 `transaction.get(doc)` / `transaction.set(doc, data)`。
- [x] 实现 `createCloudBaseSyncSnapshotStore(db, options)`，集合名默认 `pinganpi_sync_snapshots`。
- [x] 实现 CloudBase HTTP event 入口和本地 Node HTTP 桥接，复用 handler。
- [x] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run server/sync-proxy/cloudbase-store.test.ts server/sync-proxy/cloudbase-entry.test.ts
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run server/sync-proxy/cloudbase-http-server.test.ts
```

### Task 4: 构建与部署脚本

**Files:**
- Create: `scripts/build-cloudbase-sync-proxy.ts`
- Modify: `package.json`
- Modify: `cloudbaserc.json`
- Modify: `.env.example`

- [x] 新增脚本 `cloudbase:build:sync`、`cloudbase:deploy:sync`。
- [x] `cloudbase:build:sync` 生成 `cloudbase/functions/sync-proxy/`，该目录继续被 Git 忽略。
- [x] `cloudbaserc.json` 增加 HTTP 函数 `sync-proxy`，运行时 `Nodejs20.19`。
- [x] `.env.example` 增加 `VITE_PINGANPI_SYNC_PROXY_URL` 和 `PINGANPI_SYNC_SNAPSHOT_COLLECTION` 示例。
- [x] `.env.example` 增加 `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 和 `PINGANPI_SYNC_MEMBER_TOKENS` 示例。
- [x] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx scripts/build-cloudbase-sync-proxy.ts
```

### Task 5: App 配置接入

**Files:**
- Create: `src/app/sync/remote-adapter-factory.ts`
- Test: `src/app/sync/remote-adapter-factory.test.ts`
- Modify: `src/App.vue`

- [x] 写失败测试：没有 `syncProxyUrl` 时返回 localStorage adapter。
- [x] 写失败测试：有 `syncProxyUrl` 时返回 HTTP adapter。
- [x] 写失败测试：有 `syncMemberToken` 时 HTTP adapter 带同步 token header。
- [x] 修改 App 初始化，把 `createLocalStorageRemoteSyncAdapter` 替换为 factory。
- [x] UI 文案保持“同步”而不是“云端 / 在线”。
- [x] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/app/sync/remote-adapter-factory.test.ts
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
```

### Task 6: 文档、路线图与全量验证

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [x] 记录阶段 16B 已开始 / 完成状态、CloudBase sync 函数路径、配置变量和手工收口项。
- [x] 更新验证基线。
- [x] 记录审查修正：member token 绑定、缺失 token fail closed、照片附件过滤、HTTP response 深校验和 CloudBase SDK `doc.set(data)` 写入形态。
- [x] 运行：

```bash
git diff --check
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@capacitor/cli/bin/capacitor sync
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@capacitor/cli/bin/capacitor doctor
rg -n "(tp|sk)-[A-Za-z0-9]{8,}" src server scripts vendor docs --glob '!**/*.test.ts'
npm audit --omit=dev
```

执行记录：本阶段新增 6 个聚焦测试文件、29 个测试用例；全量 Vitest 最近通过为 34 个测试文件、292 个测试通过。`vite build` 仍保留 Varlet 首包超过 500 KB 的既有提示，不作为当前阻塞项。`npm audit --omit=dev` 最近通过，0 vulnerabilities。

- [x] 提交：`feat(sync): 接入 CloudBase 同步代理`

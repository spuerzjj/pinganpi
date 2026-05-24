# 平安批双人真实同步 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不接真实 CloudBase 数据库 SDK 的前提下，把阶段 15 的同步模型接入 App 运行时，跑通本地 / 模拟远端的双设备同步闭环。

**Architecture:** 在 `src/app/sync/` 增加本地同步元数据、同步控制器和浏览器本地 remote adapter。`App.vue` 通过这些边界执行启动 pull、操作后 push、前台 refresh 和手动重试；投寄与拆阅必须先完成同步校验，保存 / 删除草稿允许离线后补同步。

**Tech Stack:** TypeScript、Vue 3、Vitest、现有 `AppState`、阶段 15 `SyncAdapter` / `RemoteSnapshot`。

---

### Task 1: 同步元数据与本地存储

**Files:**
- Create: `src/app/sync/sync-state.ts`
- Create: `src/app/sync/sync-state-storage.ts`
- Test: `src/app/sync/sync-state.test.ts`
- Modify: `src/app/app-state-storage.ts`

- [ ] 定义 `LocalSyncState`、`LocalSyncStatus`、`createDefaultLocalSyncState(input)`、`parseLocalSyncState(raw)`、`serializeLocalSyncState(state)`。
- [ ] `LocalSyncState` 字段固定为：`schemaVersion`、`householdId`、`deviceId`、`memberId`、`lastRemoteRevision`、`lastSyncedAtIso`、`status`、`lastError`。
- [ ] `deviceId` 生成使用安全随机值；测试中允许注入固定 generator。
- [ ] 新增 `LocalSyncStateStore`，风格与 `AppStateStore` 一致：`load()`、`save(state)`、`reset(input)`。
- [ ] 修改 `createBrowserAppStateStore(key = APP_STATE_STORAGE_KEY)`，支持后续按 device namespace 存储本地 AppState。
- [ ] 测试坏 JSON、schema 错误、非法状态、非法 revision 会回退默认同步状态。
- [ ] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/app/sync/sync-state.test.ts
```

### Task 2: 同步控制器

**Files:**
- Create: `src/app/sync/sync-runtime.ts`
- Test: `src/app/sync/sync-runtime.test.ts`

- [ ] 实现 `pullRemoteChanges(input)`：调用 `adapter.pull`，用 `mergeRemoteSnapshotIntoAppState` 合并远端快照，更新 `lastRemoteRevision`、`lastSyncedAtIso` 和 `status: "synced"`。
- [ ] 实现 `pushLocalChanges(input)`：用 `createRemoteSnapshotFromAppState` 导出本地快照，调用 `adapter.push`，更新 `lastRemoteRevision`、`lastSyncedAtIso` 和 `status: "synced"`。
- [ ] 实现 `syncNow(input)`：先 pull，再在需要时 push；默认 `pushLocalChanges: true`，用于启动、前台 refresh 和手动重试。
- [ ] 实现 `prepareOnlineMutation(input)`：只做 pull 和合并；失败返回 `ok: false`，成功返回可供投寄 / 拆阅继续执行的最新本地状态。
- [ ] 所有函数失败时返回 `status: "failed"` 和面向用户的短 `lastError`，不抛出 provider / 云端原始错误给 UI。
- [ ] 测试覆盖成功 pull、成功 push、pull 后 push、本地 revision 更新、adapter 失败、失败不吞掉本地草稿。
- [ ] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/app/sync/sync-runtime.test.ts
```

### Task 3: 浏览器本地 Remote Adapter 与开发期设备配置

**Files:**
- Create: `src/app/sync/local-remote-adapter.ts`
- Create: `src/app/sync/browser-sync-config.ts`
- Test: `src/app/sync/local-remote-adapter.test.ts`
- Test: `src/app/sync/browser-sync-config.test.ts`

- [ ] 实现 `createLocalStorageRemoteSyncAdapter(storage)`，用 localStorage 保存 household remote snapshot，仍实现阶段 15 的 `SyncAdapter`。
- [ ] remote snapshot 存储 key 使用 `pinganpi.remote-snapshot.v1.<householdId>`，设备本地 AppState 不共用这个 key。
- [ ] adapter push 时复用 `mergeRemoteSnapshots`，pull 时复用 `redactRemoteSnapshotForMember`。
- [ ] 实现 `resolveBrowserSyncConfig(location, storage)`，支持 URL 参数：`household`、`device`、`member`。无参数时使用默认 household 和持久化 device id。
- [ ] AppState storage key 使用 `pinganpi.app-state.v1.<deviceId>`，从而同一浏览器两个 tab 可模拟两台设备，同时共用同一个 remote snapshot。
- [ ] 测试覆盖两个 device namespace 本地状态互不覆盖、同一个 household remote 可共享、收件方未到达正文仍被红action。
- [ ] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/app/sync/local-remote-adapter.test.ts src/app/sync/browser-sync-config.test.ts
```

### Task 4: App 运行时接入与同步状态 UI

**Files:**
- Modify: `src/App.vue`
- Test: `src/app/sync/sync-runtime.test.ts`

- [ ] App 启动时根据 `resolveBrowserSyncConfig` 创建 AppState store、SyncState store 和 local remote adapter。
- [ ] App 启动后执行一次 `syncNow`；如果本地 settle 产生变化，确保这次同步会 push 变化。
- [ ] 监听 `visibilitychange`，页面回到前台时执行 `syncNow`。
- [ ] 顶部或现有通知区增加低调同步状态：未同步、同步中、已同步、同步失败。
- [ ] 增加“重试同步”入口，只在失败或离线状态显示。
- [ ] UI 不显示 remote revision、device id、现代在线状态、实时聊天提示或 provider 原始错误。
- [ ] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
```

### Task 5: 投寄 / 拆阅联网护栏

**Files:**
- Modify: `src/App.vue`
- Test: `src/app/sync/sync-runtime.test.ts`

- [ ] `handleSaveDraft` 和 `handleDeleteDraft` 保持离线可用；成功后尝试后台 `pushLocalChanges`，失败只标记未同步。
- [ ] `handlePostLetter` 在调用 `postLetter` / `postDraftPaper` 前先执行 `prepareOnlineMutation`；失败时不投寄、不扣款、不写邮政记录。
- [ ] `handleOpenLetter` 在调用 `openLetter` 前先执行 `prepareOnlineMutation`；失败时不拆阅、不写拆阅记录。
- [ ] 投寄 / 拆阅成功后立即执行 `pushLocalChanges`；push 失败时保留本地成功结果并标记同步失败，后续手动重试可补推。
- [ ] 测试覆盖：adapter pull 失败时投寄不改变钱包和信件；adapter pull 失败时拆阅不推进状态；保存草稿在 adapter 失败时仍保留本地草稿。

### Task 6: 双设备生命周期验证

**Files:**
- Create: `src/app/sync/dual-device-sync.test.ts`

- [ ] 用同一个 local remote adapter 或 mock remote adapter 创建 device A / member-zhou 与 device B / member-lan。
- [ ] A 保存并投寄一封给 B 的信，push 后 B pull。
- [ ] B 在信件未到达前拿不到正文；推进到到达后 B 可以拆阅。
- [ ] B 拆阅并 push 后，A pull 能看到 opened 状态。
- [ ] 断言账本记录和邮政记录不会重复。
- [ ] 断言 B 的私有草稿不会导入 A 的本地草稿箱。
- [ ] 运行：

```bash
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/app/sync/dual-device-sync.test.ts
```

### Task 7: 路线图、看板与代理上下文同步

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] 将阶段 16 标记为 16A 进行中或已完成，取决于代码验收结果。
- [ ] 记录阶段 16 设计文档、实施计划、新增同步 runtime 文件和本地双设备调试方式。
- [ ] 修正 roadmap 中旧的“当前完成阶段 14 / 下一阶段 15”表述。
- [ ] 更新验证基线和剩余风险，明确真实 CloudBase 数据库 adapter 仍是阶段 16 后半段或 16B。

### Task 8: 全量验证与提交

**Commands:**

```bash
git diff --check
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run
/Users/zhujunjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
rg -n "MIMO_API_KEY|VITE_MIMO|VITE_XIAOMI|tp-|sk-" src --glob '!**/*.test.ts'
```

- [ ] 若修改了 Vite / Capacitor 入口或依赖，再运行 `npm run build`、`npx cap sync`、`npx cap doctor`。
- [ ] 审阅 `git diff`，确认未提交真实 key、云端 secret、provider 原始响应或完整 prompt。
- [ ] 提交：`feat(sync): 接入双人同步运行时`

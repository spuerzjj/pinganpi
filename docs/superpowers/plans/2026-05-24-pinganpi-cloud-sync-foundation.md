# 平安批云端同步准备 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立阶段 15 的远端模型、sync adapter 边界和本地 mock remote 合并验证，为阶段 16 真实双人同步做准备。

**Architecture:** 在 `src/app/sync/` 下新增独立同步模块。模块从现有 `AppState` 导出远端实体快照，并把远端快照按确定性冲突策略合并回本地；真实 CloudBase SDK 暂不接入，先用内存 mock adapter 验证两设备同步。

**Tech Stack:** TypeScript、Vitest、现有 AppState / domain 类型。

---

### Task 1: 远端模型与 Adapter 类型

**Files:**
- Create: `src/app/sync/remote-model.ts`

- [x] 定义 `RemoteHousehold`、`RemoteMember`、`RemoteWallet`、`RemoteLedgerEntry`、`RemoteDraftPaper`、`RemoteLetter`、`RemotePostalRecord`、`RemoteSyncCursor`、`RemotePhotoAttachment`。
- [x] 定义 `RemoteSnapshot`，包含拆分后的远端数组、`householdId`、`remoteRevision`、`exportedAtIso`。
- [x] 定义 `SyncAdapter`、`SyncPullInput`、`SyncPushInput`、`SyncPushResult`，后续 CloudBase adapter 必须实现此接口。
- [x] 确认类型只依赖 `src/app/app-state.ts`、`src/app/mock-data.ts` 和 `src/domain` 类型，不引入 CloudBase SDK。

### Task 2: AppState 与远端快照转换

**Files:**
- Create: `src/app/sync/remote-snapshot.ts`
- Test: `src/app/sync/remote-snapshot.test.ts`

- [x] 写测试：从 `AppState` 导出远端快照时，members、当前成员钱包、账本、草稿、信件、邮政记录被拆为独立实体。
- [x] 写测试：AI `generationMeta` 被保留，但远端模型里没有 prompt、provider raw response 或 key 字段。
- [x] 实现 `createRemoteSnapshotFromAppState(state, options)`。
- [x] 实现 `mergeRemoteSnapshotIntoAppState(state, snapshot, options)`，保留本地 `currentMemberId`、`recipientMemberId`、`scribes`、`writingRoute`。

### Task 3: 冲突合并规则

**Files:**
- Modify: `src/app/sync/remote-snapshot.ts`
- Test: `src/app/sync/remote-snapshot.test.ts`

- [x] 写测试：ledger entries 和 postal records 按 id 去重并稳定排序。
- [x] 写测试：letters 状态只向更晚状态推进，旧远端状态不能覆盖本地新状态。
- [x] 写测试：draft papers 按 `updatedAtIso` 后写胜出；时间相同时用 `updatedByDeviceId` 稳定打破平局。
- [x] 写测试：本地设备只导入当前成员自己的草稿，不导入对方未投寄草稿。
- [x] 实现对应 merge helper，保持纯函数。

### Task 4: 本地 Mock Remote Adapter

**Files:**
- Create: `src/app/sync/mock-remote-adapter.ts`
- Test: `src/app/sync/mock-remote-adapter.test.ts`

- [x] 写测试：设备 A push 后，设备 B pull 能看到新信件和邮政记录。
- [x] 写测试：设备 B push 拆阅记录后，设备 A pull 能看到信件推进到 `opened`，邮政记录不重复。
- [x] 实现内存版 `createMockRemoteSyncAdapter()`，按 household 保存远端快照。
- [x] 每次 push 合并快照并递增 `remoteRevision`，更新当前 device cursor。
- [x] 每次 pull 返回深拷贝快照，避免测试误改 adapter 内部状态。

### Task 5: 路线图与代理上下文同步

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [x] 将阶段 15 标记为进行中或完成，取决于代码验收结果。
- [x] 记录新同步模块路径、同步边界和阶段 16 的前置条件。
- [x] 更新验证基线。

### Task 6: 验证与提交

**Commands:**

```bash
git diff --check
npm test
npm run typecheck
```

- [x] 若涉及构建入口变化再运行 `npm run build`；本阶段仅新增 app 纯 TS 模块时不强制。
- [x] 审阅 `git diff`，确认未包含 secret、CloudBase 真实 token 或 provider key。
- [x] 提交：`feat(sync): 添加云端同步准备模型`

执行记录：

- 当前 Codex shell 中 `npm` 不在 PATH，已使用项目依赖的等价 Node 入口执行验证。
- `git diff --check`：通过。
- `node node_modules/vitest/vitest.mjs run`：23 个测试文件，225 个测试通过。
- `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`：通过。

最终审查修复记录：

- 远端实体新增 `remoteId` / `localId`，远端合并按 `remoteId` 去重，避免跨设备同本地 id 数据丢失。
- mock remote pull 按 `memberId` 红action 未到达来信正文，收件方到达前拿不到正文、摘要、起稿正文或 AI metadata。
- draft / letter 远端转换改为白名单字段，不再用对象 rest/spread 原样同步潜在 prompt、provider raw response 或 key。
- 本地删除草稿会写入 `draftTombstones`，远端导出时可推送删除 tombstone。

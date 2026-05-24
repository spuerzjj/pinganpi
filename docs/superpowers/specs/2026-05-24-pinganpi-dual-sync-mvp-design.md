# 平安批双人真实同步 MVP 设计

## 背景

阶段 15 已经完成远端模型、`SyncAdapter` 边界、`AppState` 与 `RemoteSnapshot` 转换、本地 mock remote adapter、跨设备 `remoteId` 防冲突、未到达来信正文红action、草稿 tombstone 和双设备 push / pull / merge 测试。阶段 16 的目标是把这些同步能力接入 App 运行时，让两台设备或两个浏览器 profile 可以围绕同一个 household 共享信件、草稿、账本和邮政记录，同时不破坏《平安批》的慢通信体验。

本设计采用阶段 16A 的推进方式：先用本地 / 模拟远端跑通 App 侧同步闭环，再接真实 CloudBase 数据库 adapter。真实云数据库、登录绑定和安全规则会复用本阶段形成的 runtime 边界，但不抢在本地闭环稳定前实现。

## 目标

- 建立 App 侧同步控制器，复用阶段 15 的 `SyncAdapter`，不让云端 SDK 渗入 `src/domain`。
- 为本地 App 增加同步元数据：household、device、member、last revision、同步状态和错误摘要。
- 支持启动 pull、手动 sync、关键操作后 push、回到前台 refresh 的同步节奏。
- 第一版只保证离线写草稿和保存草稿；投寄和拆阅必须在“可同步”状态下通过在线校验后才正式生效。
- UI 增加低调同步状态，让用户知道“未同步 / 同步中 / 已同步 / 同步失败”，但不把 App 做成现代在线聊天。
- 保证收信方仍受真实到达时间和未拆阅边界约束；同步不等于即时看到正文。
- 用本地 mock remote adapter 和测试验证两个设备的数据合并、去重、状态推进和离线草稿恢复。

## 非目标

- 不在 16A 直接接 CloudBase 数据库 SDK。
- 不实现真实手机号、微信或账号登录。
- 不实现多人群组、家庭成员扩展或复杂后台权限。
- 不允许离线投寄或离线拆阅正式生效。
- 不把普通信改造成即时消息提醒。
- 不改变阶段 1-15 已有的时间、邮资、钱匣、AI 起稿、送达和拆阅规则。

## 架构

阶段 16A 新增 App 层同步 runtime，放在 `src/app/sync/` 内：

- `sync-runtime.ts`：纯 TypeScript 同步控制器。它负责 pull、push、syncNow、关键操作前的联网校验和同步状态转移。
- `sync-state.ts`：定义本地同步元数据、默认配置、解析和序列化。它不进入 `AppState`，避免业务状态和设备运行时状态混在一起。
- `sync-state-storage.ts`：浏览器 localStorage / 内存版同步状态存储，和现有 `app-state-storage.ts` 保持同样风格。
- `local-remote-adapter.ts`：可选的浏览器本地模拟远端 adapter，用于两个浏览器 profile 或本机调试共享一个 remote backend。它仍实现阶段 15 的 `SyncAdapter`。

`App.vue` 只依赖同步 runtime 的公开函数和 `SyncAdapter`，不直接读写远端模型细节。`src/domain` 不知道同步存在。

## 同步元数据

本地同步元数据最小字段：

- `householdId`：固定的一对通信关系 id。本地开发默认使用 `household-main`。
- `deviceId`：当前设备 id。首次启动生成并持久化；浏览器 profile / 真机各自不同。
- `memberId`：当前使用者，对应 `AppState.currentMemberId`。
- `lastRemoteRevision`：最近成功 pull / push 后看到的远端版本。
- `lastSyncedAtIso`：最近一次成功同步时间。
- `status`：`not_configured`、`idle`、`syncing`、`synced`、`failed`、`offline`。
- `lastError`：面向用户的短错误摘要，不保存 provider 原始响应、secret、完整 prompt 或远端原始异常。

同步元数据属于设备本地运行时信息，不随 household 远端实体同步。

## 数据流

启动时：

1. 从 localStorage 读取 `AppState` 和 `SyncState`。
2. 先执行本地 `settleAppState`，推进钱匣和邮政状态。
3. 若同步已配置，调用 `pull` 获取远端快照并合并到本地。
4. 若本地 settle 产生变化，再执行一次 `push`，把新产生的账本 / 邮政记录推远端。

关键操作：

- 保存草稿：允许离线完成，本地保存后标记未同步；可同步时自动 push。
- 删除草稿：允许离线完成，本地写 tombstone，恢复同步后 push。
- 投寄：必须先执行同步校验。校验成功后在最新本地状态上调用现有 `postLetter` / `postDraftPaper`，再 push。失败则不投寄。
- 拆阅：必须先执行同步校验。校验成功后在最新本地状态上调用现有 `openLetter`，再 push。失败则不拆阅。
- 进入信箱 / App 回到前台：执行 refresh；本地仍调用 `settleAppState` 推进到达，再同步产生的状态变化。

同步校验不是新业务规则，只是保证投寄和拆阅发生在已拉取最新远端快照后，再复用现有业务服务完成规则判断。

## 冲突与失败处理

- 远端合并继续使用阶段 15 的 `mergeRemoteSnapshotIntoAppState` 和 `mergeRemoteSnapshots`。
- append-only 记录继续按远端身份去重，避免账本和邮政记录重复显示。
- 信件状态只能单向推进，旧状态不能覆盖新状态。
- 草稿继续按 `updatedAtIso + updatedByDeviceId` 后写胜出，删除通过 tombstone 传播。
- 钱匣在 16A 不允许离线投寄，避免双设备离线同时扣款；真实云端阶段再把投寄升级为远端事务或 command 校验。
- 同步失败时保留本地草稿和本地状态，不吞掉用户输入；投寄 / 拆阅失败只显示失败提示，不产生半投寄或半拆阅状态。

## UI

UI 只增加低调同步状态：

- 顶部或通知区展示“未同步 / 同步中 / 已同步 / 同步失败”。
- 同步失败时给出短提示和手动重试入口。
- 投寄或拆阅因同步失败被拒绝时，用现有通知区提示原因。
- 不增加聊天在线状态、已读回执、实时输入状态或现代物流进度条。

## 安全与隐私

- 不在本阶段新增 secret 存储。
- 同步错误不展示远端原始错误堆栈。
- 未到达来信仍由 adapter pull 红action，收件方到达前拿不到正文、摘要、口述、代笔稿、最终稿、AI metadata 或附件定位信息。
- 远端模型继续不保存完整 prompt、provider 原始响应、真实 key 或敏感日志。

## 测试与验收

- 单元测试覆盖同步状态解析、坏数据回退、device id 稳定生成。
- 单元测试覆盖 `syncNow`：pull 合并、push 本地变化、revision 更新、失败状态记录。
- 单元测试覆盖操作护栏：离线保存草稿允许，离线投寄 / 拆阅拒绝且不改状态。
- 集成测试覆盖两个本地设备通过同一个 mock adapter 同步一封信：A 投寄、B 到达后拆阅、A 再拉取 opened 状态，账本和邮政记录不重复。
- 浏览器验证两个 profile 或两个 storage namespace 可以共享同一个 household。
- 常规验证通过：`npm test`、`npm run typecheck`。当前 Codex shell 如无 `npm`，使用项目依赖的 Node 入口执行等价命令。

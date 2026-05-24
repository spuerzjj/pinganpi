# 平安批云端与双人同步准备设计

## 背景

阶段 15 的目标是为《平安批》后续真实两人同步做准备。当前 App 已有本地 `AppState`、写信、投寄、邮政推进、拆阅、账本和 AI 起稿链路，但所有数据仍在单设备 localStorage 中。阶段 15 不接真实 CloudBase 数据库 SDK，也不做真实登录；本阶段先把远端模型、同步边界和冲突策略固定下来，并用本地 mock remote adapter 验证双设备合并行为。

## 目标

- 定义远端数据模型，不把整个 `AppState` JSON blob 当成唯一同步单位。
- 建立 App 层 sync adapter 边界，保持 `src/domain` 无浏览器、云端、Capacitor 或 CloudBase 依赖。
- 支持 household / pair、members、wallets、ledger entries、draft papers、letters、postal records、sync cursors 等远端实体。
- 显式保留 AI 起稿元数据，但不保存完整 prompt、provider 原始响应、真实 key 或敏感日志。
- 预留邮政异常状态与照片附件访问控制原则。
- 用本地 mock remote adapter 验证两台设备的 push / pull / merge。

## 非目标

- 不接 CloudBase 数据库 SDK。
- 不实现真实账号登录、短信、微信登录或设备绑定 UI。
- 不实现真实双设备生产同步。
- 不支持离线投寄或离线拆阅正式生效。
- 不把收件方尚未到达的信件正文、照片缩略图、remote key、可访问 URL 或可猜测路径提前暴露给收件方。

## 远端模型

远端模型按业务实体拆分：

- `RemoteHousehold`：两人通信关系，包含 household id、成员 id、创建和更新时间。
- `RemoteMember`：成员档案，来自现有 `MemberProfile`。
- `RemoteWallet`：按成员拆分的钱匣状态。当前 AppState 只保存当前成员的钱匣，远端模型预留双方钱包。
- `RemoteLedgerEntry`：账本记录，append-only，按稳定 id 去重，携带 owner member id。
- `RemoteDraftPaper`：草稿纸，按作者私有。收件方不导入对方草稿。
- `RemoteLetter`：已投寄信件，双方可见，但收件方 UI 仍必须遵守到达前不可拆、不可展示正文摘要的现有规则。
- `RemotePostalRecord`：邮政记录簿，append-only，按稳定 id 去重。
- `RemoteSyncCursor`：设备同步游标，按 household + device id 记录最后 pull / push 时间和远端版本。
- `RemotePhotoAttachment`：阶段 19 预留。到达前收件方不能得到 storage key、缩略图 URL、下载 URL 或可猜测路径。

远端业务实体同时保存 `remoteId` 和 `localId`。`localId` 是当前设备原有的本地 id；`remoteId` 是带 `deviceId` 维度的全局身份，用于避免两台设备在同毫秒、同数组长度下生成相同本地 id 后互相覆盖。导入本机自己创建的实体时可恢复本地 id；导入其他设备创建且可能冲突的实体时使用 `remoteId` 作为本地 id。

## 本地与远端边界

App 侧新增 `sync` 模块：

- `remote-model.ts` 只定义远端实体和同步 adapter 类型。
- `remote-snapshot.ts` 负责从 `AppState` 导出远端快照，以及把远端快照合并回本地 `AppState`。
- `mock-remote-adapter.ts` 提供本地内存版 remote adapter，用于阶段 15 测试双设备同步行为。

`src/domain` 不知道同步存在；同步逻辑复用领域层已经定义的信件状态枚举，不重新实现邮资、钱匣结算、到达时间和状态机规则。

## 冲突策略

- `ledgerEntries` 和 `postalRecords`：append-only，按 `id` 去重，按时间和 id 稳定排序。
- 远端 append-only 记录实际按 `remoteId` 去重；`id` 仅保留为原始本地 id，避免跨设备同 id 数据丢失。
- `letters`：按 `id` 合并。状态只允许向更晚状态推进，旧状态不能覆盖新状态。正文、AI metadata、寄信人、收信人等内容字段以已投寄信件为不可变事实处理。
- `letters`：远端存储按 `remoteId` 合并；按成员 pull 时，收件方在信件未到达前只获得信封和状态，不获得正文、摘要、口述、起稿正文或 AI metadata。
- `draftPapers`：按 `updatedAtIso` 后写胜出；时间相同时用 `updatedByDeviceId` 稳定打破平局。草稿只导入当前成员自己写的草稿。删除草稿必须产生 tombstone，避免旧设备把已删草稿同步回来。
- `wallets`：按 owner member id 合并，先采用 `lastSettledAtIso` 较新的版本。阶段 16 投寄必须联网校验钱包，避免双设备离线并发投寄造成余额冲突。
- `members`：按 id 合并，远端成员档案可更新本地档案；当前设备的 `currentMemberId` 和 `recipientMemberId` 保持本地设置，不被远端覆盖。
- `sync cursors`：每次 push / pull 更新当前 device 的 cursor，供后续 CloudBase 增量同步设计使用。

## 安全与隐私

- AI 元数据只保留 provider、model、prompt version、scene tags、letter type、城市、latency 和 failure reason。
- 不保存完整 prompt、provider 原始响应、真实 provider key 或云端 secret。
- 草稿按作者私有导入，避免对方设备看到未投寄草稿。
- 未到达来信对收件方做内容红action：不下发正文、摘要、口述、代笔稿、最终正文、AI metadata 或附件定位信息。
- 未来照片附件必须先有 letter 状态校验：未到达前收件方不能获得可访问资源定位信息。

## 验收

- 有远端模型和 adapter 类型，后续 CloudBase 实现可替换 mock adapter。
- 有本地 mock remote adapter，能模拟两台设备分别 push / pull。
- 测试覆盖 append-only 去重、信件状态单向推进、草稿冲突、成员私有草稿过滤、AI metadata 保留和敏感字段不入远端模型。
- 常规验证通过：`npm test`、`npm run typecheck`。

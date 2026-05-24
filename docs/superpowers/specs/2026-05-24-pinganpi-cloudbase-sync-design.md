# 平安批 CloudBase 同步 Adapter 设计

## 背景

阶段 15 已完成远端模型、`SyncAdapter` 边界、`AppState` 与 `RemoteSnapshot` 的转换和合并规则。阶段 16A 已把这些能力接入 App 运行时，用本地 / 模拟远端验证启动同步、前台 refresh、操作后 push、联网投寄 / 拆阅护栏和双设备生命周期。

阶段 16B 的目标是把 16A 的本地远端替换为真实 CloudBase 落点，同时不改变领域规则、不让云 SDK 渗入 `src/domain`，也不把同步做成现代实时聊天。

## 方案选择

采用 **App HTTP SyncAdapter + CloudBase HTTP 云函数 + CloudBase 数据库单 household 快照**。

不采用 App 直接使用 CloudBase Web JS SDK 读写数据库作为第一版，原因：

- CloudBase Web SDK 需要安全域名、登录态和客户端权限规则；移动端 Capacitor、本地浏览器、iOS / Android WebView 的调试来源会带来额外配置面。
- 投寄和拆阅需要服务端统一做 revision 检查。CloudBase 事务文档说明事务目前是服务端能力，第一版把关键并发边界放在云函数里更稳。
- App 只需要实现既有 `SyncAdapter`，后续从 localStorage adapter 切换到 HTTP adapter，不影响 `sync-runtime`、写信、钱匣或邮政规则。

## 目标

- 新增 HTTP 版 `SyncAdapter`，通过 `POST /sync/pull` 和 `POST /sync/push` 与云端同步。
- 新增 CloudBase 同步云函数入口，复用 `mergeRemoteSnapshots`、`redactRemoteSnapshotForMember` 和 cursor 规则。
- 云端按 `householdId` 保存一个完整 `RemoteSnapshot` 文档，第一版不拆多集合事务。
- `push` 必须检查 `baseRemoteRevision`。过期 revision 返回受控冲突错误，不接受写入。
- `pull` 和 `push` 返回给 App 的快照必须按 `memberId` redaction，未到达来信不泄露正文、口述、代笔稿或 AI metadata，也不返回对方未投寄私有草稿。
- App 默认仍使用本地 adapter；只有配置 `VITE_PINGANPI_SYNC_PROXY_URL` 时才启用云同步。
- 云端同步请求必须带成员 token。服务端用 `PINGANPI_SYNC_MEMBER_TOKENS` 或 CloudBase env 中的 `PINGANPI_SYNC_MEMBER_TOKENS_B64` 把 `householdId + memberId` 绑定到 token；缺失配置时同步请求 fail closed，`GET /health` / `GET /sync/health` 仍可用于部署检查。

## 非目标

- 不在本阶段实现真实账号绑定、手机号登录、微信登录或邀请流程。
- 不在本阶段购买或配置 CloudBase 控制台权限、费用告警、安全域名；这些保留为阶段末手工收口。
- 不拆分远端实体到多个数据库集合；阶段 16B 先落单文档快照，阶段 16C 再根据容量和权限需要拆实体集合。
- 不实现实时监听、在线状态、聊天式已读回执或普通信主动推送。
- 不允许离线投寄或离线拆阅正式生效。

## 数据模型

CloudBase 数据库集合：

- 集合名：`pinganpi_sync_snapshots`
- 文档 id：`householdId`
- 文档字段：
  - `schemaVersion`: `1`
  - `householdId`
  - `snapshot`: `RemoteSnapshot`
  - `updatedAtIso`

CloudBase 文档 id 即 `householdId`；真实 SDK 写入使用 `doc(householdId).set(data)` / `transaction.set(docRef, data)`，写入数据不包含 `_id` 字段。

第一版保存完整快照，是为了复用阶段 15 / 16A 的合并和 redaction 规则，降低真实云端接入风险。数据量增长后，再把 `letters`、`postalRecords`、`draftPapers` 等拆成实体集合。

服务端保存的是完整 household snapshot；返回给客户端的是 member-scoped snapshot：信件按到达状态裁剪，草稿只返回 `authorMemberId === memberId` 的草稿或 tombstone。

## API

### `GET /health` / `GET /sync/health`

返回 `{ "ok": true }`，用于部署和路由验证。

### `POST /sync/pull`

请求头：

```http
X-Pinganpi-Sync-Token: <member-token>
```

服务端也接受 `Authorization: Bearer <member-token>`。token 必须与请求体中的 `householdId + memberId` 匹配。

请求体：

```json
{
  "householdId": "household-main",
  "deviceId": "device-a",
  "memberId": "member-zhou",
  "sinceRemoteRevision": 3
}
```

响应体：

```json
{
  "snapshot": { "remoteRevision": 4 }
}
```

返回的 `snapshot` 已按 `memberId` redaction。

### `POST /sync/push`

请求头同 `/sync/pull`，必须能绑定请求体里的 `householdId + memberId`。

请求体：

```json
{
  "householdId": "household-main",
  "deviceId": "device-a",
  "memberId": "member-zhou",
  "baseRemoteRevision": 4,
  "snapshot": { "remoteRevision": 4 }
}
```

成功响应：

```json
{
  "householdId": "household-main",
  "deviceId": "device-a",
  "acceptedRemoteRevision": 5,
  "cursor": { "remoteRevision": 5 },
  "snapshot": { "remoteRevision": 5 }
}
```

冲突响应：

```json
{
  "error": "stale_remote_revision"
}
```

HTTP adapter 会把该错误转换为 `code: "stale_remote_revision"`，让现有 `sync-runtime` 显示“账本已有新变化，请先收取后再试”。

## 安全与隐私

- App 不保存 CloudBase 管理密钥。
- `VITE_PINGANPI_SYNC_MEMBER_TOKEN` 是阶段 16B 的临时双人同步凭据，不能等同正式账号体系；后续真实登录 / 双人绑定阶段应替换为 CloudBase Auth 或等价身份方案。
- 同步代理不能信任客户端传入的 `memberId` 本身，必须通过服务端 `PINGANPI_SYNC_MEMBER_TOKENS` 做 `householdId + memberId + token` 绑定校验；缺失或解析失败时，除 `GET /health` 外的同步请求必须 fail closed。
- CloudBase 函数环境变量中使用 `PINGANPI_SYNC_MEMBER_TOKENS_B64` 保存 token map，避免 CloudBase CLI 把 JSON env 值误解析为对象；本地开发仍可直接使用 `PINGANPI_SYNC_MEMBER_TOKENS` 明文 JSON。
- CloudBase 服务端环境不打印完整快照、信件正文、AI prompt、provider raw response 或 key。
- HTTP handler 只返回受控 JSON 错误，不把 CloudBase SDK 原始异常透给 UI。
- 未到达来信的正文、摘要、口述、代笔稿、最终稿、AI metadata 和附件定位信息必须在服务端 redaction 后才返回。
- 对方未投寄私有草稿不能进入客户端 HTTP 响应；不能只依赖 App 合并时忽略。
- `push` 的 revision 校验必须发生在服务端写入边界。CloudBase store 使用事务或等价 CAS，保证 stale push 不部分写入 cursor、snapshot 或 revision。
- 本阶段仍需用户最后在 CloudBase 控制台确认数据库集合权限、费用告警和默认角色收敛。

## 验收

- HTTP adapter 单测覆盖 pull、push、成员 token header、冲突错误、HTTP 失败短错误、请求体字段和 malformed response。
- CloudBase sync handler 单测覆盖 health、pull 空 household、push 创建快照、stale push 拒绝、redaction、私有草稿过滤、附件过滤、member token 绑定、不泄露原始错误。
- CloudBase store 单测使用 fake collection 覆盖 load/save CAS 语义和真实 SDK 的 `doc.set(data)` / `transaction.set(doc, data)` 调用形状。
- App 配置测试覆盖未设置 `VITE_PINGANPI_SYNC_PROXY_URL` 使用本地 adapter，设置后使用 HTTP adapter。
- 全量通过 `vitest`、`vue-tsc`、`vite build`、`cap sync`、`cap doctor`。
- CloudBase 部署使用显式路由 `/sync/health`、`/sync/pull`、`/sync/push`；`/api/sync/*` 会被既有 AI `/api` 路由优先匹配，`/sync/*` 在默认域名下对子路径返回 `INVALID_PATH`，不要使用。
- `npm run cloudbase:smoke:sync` 真实云端 smoke 通过，覆盖 health、未带 token 401、合法 pull、push、再 pull。

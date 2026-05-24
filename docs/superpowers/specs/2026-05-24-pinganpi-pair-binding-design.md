# 平安批双人绑定与同步授权设计

## 背景

阶段 16B 已经实现 CloudBase `sync-proxy` 工程链路，但当前同步身份仍依赖开发期手工配置的 `householdId + memberId + token`。阶段 17 会先建立手机号账号系统，让用户可通过手机号验证码恢复同一个平安批账号。

阶段 18 在此基础上解决真实两人关系：谁创建这对关系、另一方如何加入、同步代理如何判断当前登录账号是否有权访问这对关系的数据。

## 决策

阶段 18 正式命名为 **双人绑定与同步授权**。

本阶段不做独立设备授权。手机号登录态代表账号身份；服务端再根据账号所属的双人关系推导 `householdId` 和 `memberId`。`deviceId` 保留为本地安装实例、同步 cursor、冲突标记和调试字段，但不是权限边界。

已确认产品规则：

- 一个手机号账号同一时间只允许属于一个有效双人关系。
- 第一版不做自助解除关系；绑错或需要重置时由开发者手工处理数据。
- 邀请码 24 小时有效，只能使用一次。
- 另一方手机号登录后输入邀请码即加入，不需要创建方二次确认。
- 真实账号第一次登录后从空数据开始，不自动迁移旧本地测试信件。
- 账号档案允许保存完整手机号，并可在 App 内展示当前登录手机号。

## 阶段边界

### 包含

- 创建 `household / pair`。
- 为创建方分配第一个 `member` 席位。
- 生成 24 小时有效的一次性邀请码。
- 另一方登录后输入邀请码，立即占用第二个 `member` 席位。
- 限制每个账号只能创建或加入一个有效关系。
- 将 `sync-proxy` 从手工 `PINGANPI_SYNC_MEMBER_TOKENS` 迁移到 CloudBase 登录态 + 账号 / 关系 / 成员映射。
- 服务端根据当前登录账号推导 `accountId -> householdId -> memberId`，不信任客户端传入的 `memberId`。
- 继续保留未到达来信正文 redaction、对方私有草稿过滤和照片附件过滤。

### 不包含

- 不做独立设备授权。
- 不做设备同步 token 签发、轮换、撤销。
- 不做自助解除关系、换绑或多人关系。
- 不做好友系统、联系人导入、现代在线状态。
- 不改变写信、投寄、等待、拆阅、钱匣和邮政状态机规则。

## 数据模型

建议新增三个集合，命名在 implementation plan 中可再细化：

```ts
interface PinganpiHousehold {
  householdId: string;
  status: "active" | "disabled";
  createdByAccountId: string;
  createdAtIso: string;
  updatedAtIso: string;
}

interface PinganpiMember {
  memberId: string;
  householdId: string;
  accountId: string;
  role: "first" | "second";
  joinedAtIso: string;
  status: "active";
}

interface PinganpiInvite {
  inviteId: string;
  householdId: string;
  createdByAccountId: string;
  codeHash: string;
  expiresAtIso: string;
  usedAtIso: string | null;
  usedByAccountId: string | null;
  status: "active" | "used" | "expired" | "revoked";
}
```

说明：

- 邀请码服务端只保存 hash，不保存明文码。
- `PinganpiMember` 是同步授权的核心依据。
- `role` 只表示两个席位，不代表权限等级。
- 一个账号是否已有 active household 必须由服务端查询约束，不能由客户端自行判断。

## 同步授权流程

1. App 通过 CloudBase Auth v2 HTTP API 恢复或完成手机号登录。
2. 客户端请求同步时携带 CloudBase 登录态，不再携带手工 `X-Pinganpi-Sync-Token`。
3. `sync-proxy` 从 CloudBase 登录态得到 `authUid`。
4. 服务端按 `authUid` 查询 `PinganpiAccount`。
5. 服务端查询该账号唯一 active `PinganpiMember`。
6. 服务端由 member 推导 `householdId` 和 `memberId`。
7. 服务端读取 / 写入该 household 的 remote snapshot。
8. 返回 snapshot 前继续按 member 做 redaction 和私有数据过滤。

如果客户端传入了 `memberId` 或 `householdId`，只能作为一致性校验或调试信息；授权结果必须以服务端查询为准。

## 主要流程

### 创建关系

1. 用户已手机号登录，且账号没有 active household。
2. 用户选择“创建一对关系”。
3. 服务端创建 household。
4. 服务端创建第一个 member，绑定当前 account。
5. App 进入等待另一方加入状态。

### 生成邀请

1. 创建方请求生成邀请码。
2. 服务端确认创建方属于该 household。
3. 服务端生成短码，保存 hash、过期时间和未使用状态。
4. App 显示明文邀请码和过期时间。

### 加入关系

1. 另一方已手机号登录，且账号没有 active household。
2. 输入邀请码。
3. 服务端校验邀请码未过期、未使用、household 仍只有一个 active member。
4. 服务端创建第二个 member，并标记邀请码 used。
5. App 立即进入已绑定状态。

### 失败处理

- 邀请码过期：提示重新向对方索取。
- 邀请码已使用：提示这张邀请已经作废。
- 当前账号已有关系：不允许加入或创建新关系。
- household 已满员：拒绝加入。
- 创建方自己输入自己的邀请码：拒绝。
- 登录态失效：暂停云同步，要求重新登录。

## 验收标准

- A 登录后可创建 household，并成为第一个 member。
- A 可生成 24 小时有效的一次性邀请码。
- B 登录后输入邀请码立即加入，并成为第二个 member。
- A / B 都不能再创建或加入第二个 active household。
- 第三个账号不能通过已使用的邀请码加入。
- 过期的邀请码不能加入。
- 客户端篡改 `memberId` 或 `householdId` 不能冒充另一方。
- `sync-proxy` 不再依赖手工 `PINGANPI_SYNC_MEMBER_TOKENS`。
- 未到达来信正文、AI metadata、私有草稿和照片附件过滤规则继续通过测试。

## 后续衔接

阶段 19 统一处理外部平台人工配置收口，包括 CloudBase 身份认证、短信验证码、费用告警、数据库权限、HTTP 路由、真实双设备配置和控制台人工确认。阶段 19 已确认 App 侧第一版采用 CloudBase Auth v2 HTTP API，不引入 CloudBase JS SDK；账号 / 关系集合名为 `pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`。

阶段 20 由 Codex 引导用户进行完整人工验证，覆盖账号登录、创建关系、邀请加入、双人同步、写信、送达、拆阅、AI 起稿、断网恢复和原生真机检查。

## 实现状态

截至阶段 17 / 18 工程闭环：

- 已新增 `src/app/account/local-pair-binding-adapter.ts`，支持本地创建 household / pair、创建方 first member、24 小时一次性邀请码、另一方输入即加入 second member。
- 已实现唯一 active household、自邀、过期、已用、满员等拒绝规则。
- 已新增 `src/app/account/account-sync-config.ts`，已有绑定时用绑定的 household / member 驱动现有浏览器同步命名空间；无绑定时继续兼容阶段 16 URL 参数调试。
- `src/App.vue` 已接入账号 / 绑定入口；创建或加入关系后刷新一次，让同步 runtime 以正确 household / member 启动。
- `server/account-pair/account-pair-service.ts` 已实现服务端账号 / 关系约束纯逻辑。
- `server/sync-proxy/handler.ts` 已支持账号成员授权配置：服务端可从可信 auth uid 映射出 `householdId/memberId` 并覆盖客户端传入值，避免篡改 `memberId` 或 `householdId` 冒充另一方。
- `server/sync-proxy/runtime-auth.ts` 已支持 `PINGANPI_SYNC_ACCOUNT_BINDINGS` / `PINGANPI_SYNC_ACCOUNT_BINDINGS_B64` 和 `PINGANPI_SYNC_TRUSTED_AUTH_UID_HEADER`；手工 member token 仍保留为阶段 16B 开发 fallback。
- 真实 CloudBase Auth、账号 / 关系数据库持久化、可信 UID 注入、短信验证码和双真机验证进入阶段 19 / 20。

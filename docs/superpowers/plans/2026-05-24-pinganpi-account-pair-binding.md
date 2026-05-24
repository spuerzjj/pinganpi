# 平安批账号与双人绑定实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成阶段 17 手机号账号系统与阶段 18 双人绑定 / 同步授权的工程闭环，让 App 有账号入口、关系创建 / 加入入口，并让同步授权边界从“手工 token”过渡到“账号成员关系”模型。

**Architecture:** 本阶段先建立可测试的账号 / 绑定模型、浏览器本地 adapter 和 App 引导界面；CloudBase Auth、短信验证码、控制台配置和真机人工验证留到阶段 19 / 20。同步代理新增账号成员授权边界，保留阶段 16B 的手工 token 作为开发期 fallback，后续真实 CloudBase 登录态接入时替换 resolver 即可。

**Tech Stack:** TypeScript、Vue 3、Vite、Tailwind CSS、Varlet、Vitest、CloudBase HTTP 函数边界。

---

## 文件结构

- `src/app/account/account-model.ts`：账号、会话、household、member、invite 等类型与常量。
- `src/app/account/local-account-adapter.ts`：浏览器本地手机号登录 mock adapter，模拟验证码登录和登录态恢复。
- `src/app/account/local-pair-binding-adapter.ts`：浏览器本地双人关系 / 邀请码 adapter。
- `src/app/account/account-sync-config.ts`：把已绑定账号关系转换为现有 `BrowserSyncConfig`。
- `src/app/pages/AccountGatePage.vue`：未登录 / 未绑定时的移动端入口页。
- `src/App.vue`：启动时读取账号绑定，绑定后才进入主 App；已绑定时用账号关系驱动同步命名空间。
- `server/account-pair/`：服务端纯逻辑模型与内存 store，用于阶段 17/18 约束测试。
- `server/sync-proxy/handler.ts`：增加账号成员授权输入，授权结果由服务端推导 `householdId/memberId`，不信任客户端传入值。
- `docs/pinganpi-roadmap.md`、`docs/pinganpi-roadmap-dashboard.html`、`AGENTS.md`：同步阶段状态、剩余人工事项和验证基线。

## Task 1: 账号会话本地 adapter

- [x] 写失败测试：同一手机号登录后生成稳定 `PinganpiAccount`，恢复会话仍是同一 `accountId`。
- [x] 写失败测试：登出后恢复会话返回未登录。
- [x] 实现 `account-model.ts` 与 `local-account-adapter.ts`。
- [x] 运行 `npm test -- src/app/account/local-account-adapter.test.ts`。

## Task 2: 双人绑定本地 adapter

- [x] 写失败测试：A 创建 household 后成为 first member。
- [x] 写失败测试：邀请码 24 小时有效且只能使用一次，B 输入即加入 second member。
- [x] 写失败测试：同一账号不能创建或加入第二个 active household。
- [x] 写失败测试：过期、已使用、满员、自邀均拒绝。
- [x] 实现 `local-pair-binding-adapter.ts`。
- [x] 运行 `npm test -- src/app/account/local-pair-binding-adapter.test.ts`。

## Task 3: 账号关系驱动同步配置

- [x] 写失败测试：已有绑定时 `BrowserSyncConfig` 使用 binding 的 `householdId/memberId`，仍保留 device namespace。
- [x] 写失败测试：没有绑定时仍兼容阶段 16 的 URL 参数调试方式。
- [x] 实现 `account-sync-config.ts` 并接入 `App.vue`。
- [x] 运行 `npm test -- src/app/account/account-sync-config.test.ts src/app/sync/browser-sync-config.test.ts`。

## Task 4: App 账号 / 绑定入口页

- [x] 新增 `AccountGatePage.vue`，提供手机号登录、本地验证码、创建关系、生成邀请码、输入邀请码加入。
- [x] 登录态未建立或没有绑定时，`App.vue` 只显示入口页，不启动写信主流程。
- [x] 创建 / 加入关系后刷新本地同步配置，进入主 App。
- [x] 保持手机号只出现在账号入口 / 账号摘要，不写入信件、邮政记录或 AI metadata。

## Task 5: 服务端账号 / 关系约束

- [x] 写失败测试：服务端账号服务按 `authUid` 确保同一 `PinganpiAccount`。
- [x] 写失败测试：服务端绑定服务实现创建、邀请、加入、唯一 active household、24 小时过期和一次性使用。
- [x] 实现 `server/account-pair/` 纯逻辑与内存 store。
- [x] 运行 `npm test -- server/account-pair`.

## Task 6: 同步代理账号成员授权边界

- [x] 写失败测试：账号授权模式下客户端篡改 `householdId/memberId` 不能冒充另一方。
- [x] 写失败测试：未登录或无 active member 时同步请求 401。
- [x] 写失败测试：原有手工 token 模式继续通过，作为开发期 fallback。
- [x] 修改 `server/sync-proxy/handler.ts`，让授权结果可以覆盖 pull / push 的 `householdId/memberId`。
- [x] 运行 `npm test -- server/sync-proxy/handler.test.ts`。

## Task 7: 文档、验证和提交

- [x] 更新 roadmap、roadmap dashboard 和 AGENTS，标记阶段 17/18 工程完成，阶段 19/20 保留人工事项。
- [x] 运行 `git diff --check`。
- [x] 运行 `npm test`。
- [x] 运行 `npm run typecheck`。
- [x] 运行 `npm run build`。
- [x] 涉及 App 入口后运行 `npx cap sync` 和 `npx cap doctor`。
- [x] 提交：`feat(account): 添加账号与双人绑定流程`。

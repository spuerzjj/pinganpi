# 小程序 CloudBase dev 主链路 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 让微信小程序通过 `wx.cloud.callFunction` 调用 CloudBase `dev` 云函数，跑通账号、关系、同步和 AI 的工程通道。

**Architecture:** 本阶段新增小程序专用 event 云函数，不让小程序主流程依赖 HTTP proxy。云函数 wrapper 复用既有 `server/ai-scribe-proxy`、`server/sync-proxy` 和 `server/account-pair` 逻辑；HTTP 函数继续保留为诊断工具。小程序端新增轻量调用 adapter，页面仍可继续使用阶段 24 本地 mock。

**Tech Stack:** 微信原生小程序、TypeScript、CloudBase 云函数、`@cloudbase/node-sdk`、Vitest、esbuild。

---

## Scope

本计划对应路线图阶段 25：小程序 CloudBase dev 主链路。当前状态：已完成 dev smoke；下方 checkbox 是实施记录，不是待执行事项。

本阶段包含：

- 新增 `pinganpi-ai` event 云函数：支持 health 和非流式 AI 起稿。
- 新增 `pinganpi-sync` event 云函数：支持 health、pull、push，并复用现有 sync handler、redaction 和 CloudBase snapshot store。
- 新增 `pinganpi-account` / `pinganpi-pair` event 云函数：支持 dev 工程通道的账号确保、绑定查询、创建关系、生成邀请码和邀请码加入。
- 新增账号 / 关系 CloudBase store，使用阶段 19 已确认的集合名：`pinganpi_accounts`、`pinganpi_households`、`pinganpi_members`、`pinganpi_invites`。
- 新增小程序端 `wx.cloud.callFunction` adapter 和类型。
- 新增构建、部署和 smoke 脚本。
- 更新 roadmap、dashboard 和 AGENTS。

本阶段不包含：

- 不实现微信一键手机号真实登录 UI。
- 不实现短信验证码兜底 UI。
- 不把阶段 24 页面切到真实云端数据。
- 不实现小程序 AI 流式输出。
- 不创建或部署 `prd` 环境。
- 不改变旧 HTTP AI / sync proxy 的诊断用途。

## Event Contract

四个小程序 event 云函数统一接受：

```ts
export interface PinganpiMiniFunctionEvent<TPayload = unknown> {
  action?: string;
  payload?: TPayload;
}
```

统一返回：

```ts
export type PinganpiMiniFunctionResult<TData = unknown> =
  | {
      ok: true;
      action: string;
      data: TData;
    }
  | {
      ok: false;
      action: string;
      reason: string;
      message: string;
      statusCode?: number;
    };
```

Wrapper 行为：

- action 缺失、未知或 payload 不符合要求时返回 `ok: false`，不抛 provider 原始错误。
- `health` 不依赖 secret 或真实外部服务。
- AI wrapper 调用既有 `handleAiProxyRequest`，并设置 `allowMissingOrigin: true`，因为 `wx.cloud.callFunction` 没有浏览器 Origin。
- Sync wrapper 调用既有 `handleSyncProxyRequest`。阶段 25 dev 通道允许 payload 中携带 `householdId` / `memberId`；阶段 26 再接入真实微信身份并由服务端可信推导成员身份。
- Account / Pair wrapper 的 dev 通道允许 payload 中携带 `authUid` / `phoneNumber` / `accountId`；阶段 26 再替换为微信手机号能力和服务端可信身份。
- `pinganpi-sync` event runtime 不读取旧 HTTP header token auth；真实上线前由阶段 26 接入微信可信身份推导。

## Files

Create:

- `server/miniprogram-functions/result.ts`
- `server/miniprogram-functions/pinganpi-ai.ts`
- `server/miniprogram-functions/pinganpi-ai.test.ts`
- `server/miniprogram-functions/pinganpi-sync.ts`
- `server/miniprogram-functions/pinganpi-sync.test.ts`
- `server/account-pair/cloudbase-store.ts`
- `server/account-pair/cloudbase-store.test.ts`
- `server/miniprogram-functions/pinganpi-account.ts`
- `server/miniprogram-functions/pinganpi-account.test.ts`
- `server/miniprogram-functions/pinganpi-pair.ts`
- `server/miniprogram-functions/pinganpi-pair.test.ts`
- `miniprogram/services/cloud-functions.ts`
- `miniprogram/services/cloud-functions.test.ts`
- `scripts/build-cloudbase-miniprogram-functions.ts`
- `scripts/smoke-cloudbase-miniprogram-functions.ts`
- `scripts/smoke-cloudbase-miniprogram-functions.test.ts`

Modify:

- `miniprogram/types/wx.d.ts`
- `cloudbaserc.json`
- `package.json`
- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`
- `AGENTS.md`

## Task 1: Common Result Contract

**Files:**

- Create: `server/miniprogram-functions/result.ts`

- [x] **Step 1: Implement common helpers**

Create `server/miniprogram-functions/result.ts`:

```ts
export interface PinganpiMiniFunctionEvent<TPayload = unknown> {
  action?: string;
  payload?: TPayload;
}

export type PinganpiMiniFunctionResult<TData = unknown> =
  | {
      ok: true;
      action: string;
      data: TData;
    }
  | {
      ok: false;
      action: string;
      reason: string;
      message: string;
      statusCode?: number;
    };

export function readMiniAction(event: PinganpiMiniFunctionEvent, fallback = "health"): string {
  const action = typeof event.action === "string" ? event.action.trim() : "";

  return action.length === 0 ? fallback : action;
}

export function miniOk<TData>(action: string, data: TData): PinganpiMiniFunctionResult<TData> {
  return { ok: true, action, data };
}

export function miniFail(
  action: string,
  reason: string,
  message: string,
  statusCode?: number
): PinganpiMiniFunctionResult<never> {
  return { ok: false, action, reason, message, ...(statusCode === undefined ? {} : { statusCode }) };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [x] **Step 2: Commit Task 1**

```bash
git add server/miniprogram-functions/result.ts
git commit -m "feat(miniprogram): 添加云函数返回契约"
```

## Task 2: AI And Sync Event Wrappers

**Files:**

- Create: `server/miniprogram-functions/pinganpi-ai.ts`
- Create: `server/miniprogram-functions/pinganpi-ai.test.ts`
- Create: `server/miniprogram-functions/pinganpi-sync.ts`
- Create: `server/miniprogram-functions/pinganpi-sync.test.ts`

- [x] **Step 1: Write AI wrapper tests**

Create `server/miniprogram-functions/pinganpi-ai.test.ts` with tests for:

- `health` returns `{ ok: true, action: "health", data: { ok: true } }` without MiMo env.
- `scribeDraft` calls `handleAiProxyRequest` through the existing handler and returns `scribeDraft`.
- Missing AI env returns controlled `ok: false`, reason `proxy_unavailable`.
- Unknown action returns `ok: false`, reason `not_found`.

Run:

```bash
npm test -- server/miniprogram-functions/pinganpi-ai.test.ts
```

Expected: FAIL because the wrapper file does not exist.

- [x] **Step 2: Implement AI wrapper**

Create `server/miniprogram-functions/pinganpi-ai.ts`:

- Export `main(event)`.
- Export `handlePinganpiAiEvent(event, options)` for tests.
- `health` must not read MiMo env.
- `scribeDraft` must call `handleAiProxyRequest` with:
  - `method: "POST"`
  - `url: "/ai/scribe-draft"`
  - `headers: {}`
  - `allowMissingOrigin: true`
  - JSON string body from `event.payload`.
- Convert handler `200` body to `miniOk(action, parsedBody)`.
- Convert handler errors to `miniFail(action, reason, message, statusCode)`.
- Catch config errors from `readAiProxyConfig(process.env)` and return `proxy_unavailable`.

- [x] **Step 3: Write sync wrapper tests**

Create `server/miniprogram-functions/pinganpi-sync.test.ts` with tests for:

- `health` returns ok.
- `pull` invokes existing sync handler and returns redacted snapshot.
- `push` invokes existing sync handler and returns accepted revision.
- Unknown action returns controlled `not_found`.

Run:

```bash
npm test -- server/miniprogram-functions/pinganpi-sync.test.ts
```

Expected: FAIL because the wrapper file does not exist.

- [x] **Step 4: Implement sync wrapper**

Create `server/miniprogram-functions/pinganpi-sync.ts`:

- Export `main(event)`.
- Export `handlePinganpiSyncEvent(store, event, authConfig?)` for tests.
- Map action to existing sync handler:
  - `health` -> `GET /sync/health`
  - `pull` -> `POST /sync/pull`
  - `push` -> `POST /sync/push`
- Runtime `main` creates `CloudBaseSyncSnapshotStore` exactly as `server/sync-proxy/cloudbase-entry.ts` does.
- Runtime `main` reads auth config with `readSyncProxyAuthConfig(process.env)`.
- Test helper can pass `authConfig` undefined to verify dev channel.

- [x] **Step 5: Run focused tests**

```bash
npm test -- server/miniprogram-functions/pinganpi-ai.test.ts
npm test -- server/miniprogram-functions/pinganpi-sync.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit Task 2**

```bash
git add server/miniprogram-functions/pinganpi-ai.ts server/miniprogram-functions/pinganpi-ai.test.ts server/miniprogram-functions/pinganpi-sync.ts server/miniprogram-functions/pinganpi-sync.test.ts
git commit -m "feat(miniprogram): 添加 AI 与同步云函数入口"
```

## Task 3: Account And Pair Event Wrappers

**Files:**

- Create: `server/account-pair/cloudbase-store.ts`
- Create: `server/account-pair/cloudbase-store.test.ts`
- Create: `server/miniprogram-functions/pinganpi-account.ts`
- Create: `server/miniprogram-functions/pinganpi-account.test.ts`
- Create: `server/miniprogram-functions/pinganpi-pair.ts`
- Create: `server/miniprogram-functions/pinganpi-pair.test.ts`

- [x] **Step 1: Write CloudBase account store tests**

Create `server/account-pair/cloudbase-store.test.ts` with tests for:

- Empty collections load as `createInMemoryAccountPairStore()` shape.
- Saving a store writes schema-versioned documents into four collections.
- Loading strips schema wrappers and returns `AccountPairStore`.
- Default collection names are `pinganpi_accounts`, `pinganpi_households`, `pinganpi_members`, `pinganpi_invites`.

Run:

```bash
npm test -- server/account-pair/cloudbase-store.test.ts
```

Expected: FAIL because `cloudbase-store.ts` does not exist.

- [x] **Step 2: Implement CloudBase account store**

Create `server/account-pair/cloudbase-store.ts`:

- Export default collection constants.
- Export `createCloudBaseAccountPairStore(db, options?)`.
- Return repository with `loadStore()` and `saveStore(store)`.
- Use `collection(name).get()` to load arrays.
- Use `collection(name).doc(id).set(document)` to save each entity.
- Store documents as `{ schemaVersion: 1, ...entity }`.
- Use ids:
  - account -> `accountId`
  - household -> `householdId`
  - member -> `memberId`
  - invite -> `inviteId`
- Do not persist raw invite codes; existing service stores only `codeHash`.

- [x] **Step 3: Write account wrapper tests**

Create `server/miniprogram-functions/pinganpi-account.test.ts` with tests for:

- `health` returns ok.
- `ensureAccount` creates an account using `authUid` and full `phoneNumber`.
- Repeated `ensureAccount` updates `lastLoginAtIso` but keeps stable `accountId`.
- `getActiveBinding` returns null before relation is created.
- Invalid payload returns `bad_request`.

- [x] **Step 4: Implement account wrapper**

Create `server/miniprogram-functions/pinganpi-account.ts`:

- Actions:
  - `health`
  - `ensureAccount`
  - `getActiveBinding`
- Use `createAccountPairService(store, options)` after loading repository store.
- Save store after `ensureAccount`.
- Runtime `main` creates CloudBase DB with `cloudbase.init({ env: process.env.CLOUDBASE_ENV_ID })` when env is present.
- Test helper accepts in-memory repository and deterministic `now` / `idGenerator`.

- [x] **Step 5: Write pair wrapper tests**

Create `server/miniprogram-functions/pinganpi-pair.test.ts` with tests for:

- `createHousehold` creates first member binding.
- `createInvite` returns a one-time code and does not expose `codeHash` as code.
- `joinByInvite` joins second account.
- Duplicate household and own invite errors return controlled failure.

- [x] **Step 6: Implement pair wrapper**

Create `server/miniprogram-functions/pinganpi-pair.ts`:

- Actions:
  - `health`
  - `getActiveBinding`
  - `createHousehold`
  - `createInvite`
  - `joinByInvite`
- Convert `PairBindingError.code` to controlled `reason`.
- Save store after mutating actions.
- Test helper accepts in-memory repository and deterministic clock/id/code generator.

- [x] **Step 7: Run focused tests**

```bash
npm test -- server/account-pair/cloudbase-store.test.ts
npm test -- server/miniprogram-functions/pinganpi-account.test.ts
npm test -- server/miniprogram-functions/pinganpi-pair.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit Task 3**

```bash
git add server/account-pair/cloudbase-store.ts server/account-pair/cloudbase-store.test.ts server/miniprogram-functions/pinganpi-account.ts server/miniprogram-functions/pinganpi-account.test.ts server/miniprogram-functions/pinganpi-pair.ts server/miniprogram-functions/pinganpi-pair.test.ts
git commit -m "feat(miniprogram): 添加账号关系云函数入口"
```

## Task 4: Mini Program Cloud Function Client

**Files:**

- Create: `miniprogram/services/cloud-functions.ts`
- Create: `miniprogram/services/cloud-functions.test.ts`
- Modify: `miniprogram/types/wx.d.ts`

- [x] **Step 1: Write client adapter tests**

Create `miniprogram/services/cloud-functions.test.ts` with tests for:

- Calls `wx.cloud.callFunction` with correct function name, action and payload.
- Returns `result` when `ok: true`.
- Throws a controlled error when `ok: false`.
- Throws `cloud_unavailable` when `wx.cloud.callFunction` is absent.

- [x] **Step 2: Add WeChat cloud call types**

Modify `miniprogram/types/wx.d.ts`:

```ts
interface Wx {
  cloud?: {
    init(options: CloudInitOptions): void;
    callFunction<T = unknown>(options: CloudCallFunctionOptions): Promise<CloudCallFunctionResult<T>>;
  };
}

interface CloudCallFunctionOptions {
  name: string;
  data?: unknown;
}

interface CloudCallFunctionResult<T = unknown> {
  result?: T;
}
```

- [x] **Step 3: Implement client adapter**

Create `miniprogram/services/cloud-functions.ts`:

- Export function name constants:
  - `PINGANPI_ACCOUNT_FUNCTION = "pinganpi-account"`
  - `PINGANPI_PAIR_FUNCTION = "pinganpi-pair"`
  - `PINGANPI_SYNC_FUNCTION = "pinganpi-sync"`
  - `PINGANPI_AI_FUNCTION = "pinganpi-ai"`
- Export `callPinganpiCloudFunction<TData>(name, action, payload?)`.
- Export convenience wrappers:
  - `callPinganpiAccount(action, payload?)`
  - `callPinganpiPair(action, payload?)`
  - `callPinganpiSync(action, payload?)`
  - `callPinganpiAi(action, payload?)`
- Do not call these from pages yet.

- [x] **Step 4: Run focused tests**

```bash
npm test -- miniprogram/services/cloud-functions.test.ts
npm run miniprogram:check
```

Expected: PASS.

- [x] **Step 5: Commit Task 4**

```bash
git add miniprogram/types/wx.d.ts miniprogram/services/cloud-functions.ts miniprogram/services/cloud-functions.test.ts
git commit -m "feat(miniprogram): 添加云函数调用适配器"
```

## Task 5: Build, Deploy, And Smoke Scripts

**Files:**

- Create: `scripts/build-cloudbase-miniprogram-functions.ts`
- Create: `scripts/smoke-cloudbase-miniprogram-functions.ts`
- Create: `scripts/smoke-cloudbase-miniprogram-functions.test.ts`
- Modify: `cloudbaserc.json`
- Modify: `package.json`

- [x] **Step 1: Write build script**

Create `scripts/build-cloudbase-miniprogram-functions.ts`:

- Build entries:
  - `server/miniprogram-functions/pinganpi-ai.ts` -> `cloudbase/functions/pinganpi-ai/index.js`
  - `server/miniprogram-functions/pinganpi-sync.ts` -> `cloudbase/functions/pinganpi-sync/index.js`
  - `server/miniprogram-functions/pinganpi-account.ts` -> `cloudbase/functions/pinganpi-account/index.js`
  - `server/miniprogram-functions/pinganpi-pair.ts` -> `cloudbase/functions/pinganpi-pair/index.js`
- Use esbuild `platform: "node"`, `target: "node20"`, `format: "cjs"`.
- Event functions do not need `scf_bootstrap`.
- Write package.json and README in each generated function directory.

- [x] **Step 2: Update CloudBase config**

Modify `cloudbaserc.json` and append four functions:

- `pinganpi-ai`
- `pinganpi-sync`
- `pinganpi-account`
- `pinganpi-pair`

Use runtime `Nodejs20.19`, handler `index.main`, timeout `30`, memory `256`, `installDependency: false`, and generated dirs under `cloudbase/functions/<name>`. Use event function type, not HTTP type.

- [x] **Step 3: Add npm scripts**

Modify `package.json`:

```json
"cloudbase:build:miniprogram": "node --import tsx scripts/build-cloudbase-miniprogram-functions.ts",
"cloudbase:deploy:miniprogram": "npm run cloudbase:build:miniprogram && cloudbase fn deploy pinganpi-ai --force && cloudbase fn deploy pinganpi-sync --force && cloudbase fn deploy pinganpi-account --force && cloudbase fn deploy pinganpi-pair --force",
"cloudbase:smoke:miniprogram": "node --env-file-if-exists=.env.ai.local --env-file-if-exists=.env.sync.local --import tsx scripts/smoke-cloudbase-miniprogram-functions.ts"
```

- [x] **Step 4: Write smoke helper tests**

Create `scripts/smoke-cloudbase-miniprogram-functions.test.ts`:

- Test helper builds `cloudbase fn invoke <name> -d <payload> --json`.
- Test parser accepts CloudBase CLI JSON wrapper and extracts function result.
- Test redaction never prints phone numbers, invite codes, `MIMO_API_KEY`, token values or provider raw body.

- [x] **Step 5: Implement smoke script**

Create `scripts/smoke-cloudbase-miniprogram-functions.ts`:

- Require `CLOUDBASE_ENV_ID`.
- Invoke:
  - `pinganpi-ai` health
  - `pinganpi-account` health
  - `pinganpi-pair` health
  - `pinganpi-sync` health
- If env `PINGANPI_MINIPROGRAM_SMOKE_AI_DRAFT=1` is set, also invoke `pinganpi-ai` `scribeDraft` using a non-sensitive oral text.
- Print only pass/fail summaries, no raw secrets or real phone numbers.

- [x] **Step 6: Run build and tests**

```bash
npm run cloudbase:build:miniprogram
npm test -- scripts/smoke-cloudbase-miniprogram-functions.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit Task 5**

```bash
git add scripts/build-cloudbase-miniprogram-functions.ts scripts/smoke-cloudbase-miniprogram-functions.ts scripts/smoke-cloudbase-miniprogram-functions.test.ts cloudbaserc.json package.json
git commit -m "build(miniprogram): 添加小程序云函数构建部署脚本"
```

## Task 6: Final Verification And Docs

**Files:**

- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-cloudbase-dev.md`

- [x] **Step 1: Run final verification**

```bash
npm run miniprogram:check
npm test
npm run typecheck
npm run cloudbase:build:miniprogram
git diff --check
```

Expected: PASS. 当前验证基线为 53 个测试文件、373 个测试通过。

- [x] **Step 2: Update docs**

Update docs to record:

- Stage 25 status and exact completed scope.
- New npm scripts.
- New event function names.
- Verification baseline.
- HTTP functions remain diagnostic.
- `prd` remains unconfigured and not deployed.

- [x] **Step 3: Commit docs**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md docs/superpowers/plans/2026-05-24-pinganpi-miniprogram-cloudbase-dev.md
git commit -m "docs(miniprogram): 收口 CloudBase dev 主链路进度"
```

## Final Review

After Task 6, dispatch an independent code review subagent for:

- `server/miniprogram-functions/`
- `server/account-pair/cloudbase-store.ts`
- `miniprogram/services/cloud-functions.ts`
- `scripts/build-cloudbase-miniprogram-functions.ts`
- `scripts/smoke-cloudbase-miniprogram-functions.ts`
- `cloudbaserc.json`
- `package.json`
- roadmap/dashboard/AGENTS

Must fix Critical and Important issues before moving to phase 26.

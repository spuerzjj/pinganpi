# 平安批信箱真实送达推进设计

## 背景

《平安批》的核心体验不是即时聊天，而是按真实时间等待纸质信件送达。当前系统已经具备邮政状态机、传递窗口、投寄时间、信件和邮政记录持久化，但这些能力还没有形成真实推进闭环：

- 信件投寄后会进入 `in_transit`，但不会随真实时间变成 `arrived`。
- 到达前不可拆目前只体现在 UI 的 `canOpen` 判断，没有服务层保护。
- “拆阅”按钮还没有事件处理，不会把 `arrived` 推进到 `opened`。
- 邮政记录已经持久化，但信箱 / 档案页面没有展示完整记录簿。
- 延误、错分、丢失、找回、退回等状态已有领域状态机和 UI 文案基础，但还没有确定性推进规则。

阶段 9 的目标是先完成“真实时间送达与拆阅”的最小可用闭环，让信件必须经过现实时间等待才能拆阅，并且所有状态变化都有记录。

## 目标

- 基于 `sentAtIso`、`distanceKm` 和现有 `estimateDeliveryWindow` 计算信件是否已经到达。
- App 启动、进入信箱、拆阅前都会推进一次本地邮政状态。
- 新投寄信件不会立即可拆。
- 到达前不能打开，服务层必须拒绝非法拆阅。
- 已到达的收进信件可以拆阅，拆阅后状态从 `arrived` 变为 `opened`。
- 状态推进和拆阅都会追加 `PostalRecord`，并且重复结算不会重复追加同一条记录。
- 信箱页区分“今日信箱”“路上信札”“旧信匣 / 邮政档案”。
- 到达前的收进信件不展示正文摘要，避免提前泄露信件内容。
- 档案页展示每封信的最后邮政记录，并可展开完整邮政记录簿。
- 继续复用 `src/domain` 的邮资、传递窗口和状态机，不在 UI 中重复实现规则。

## 非目标

- 本阶段不实现云端同步。
- 本阶段不实现系统推送。
- 本阶段不实现照片附件。
- 本阶段不实现复杂随机延误、迷失、找回、退回自动规则。
- 本阶段不修改 `PersistedLetter` schema 增加 `estimatedArrivalIso`、`arrivedAtIso` 或结构化 `PostalRecord.event`。
- 本阶段不做路线地图或现代物流式进度条。
- 本阶段不统一修复全局 toast / snackbar。

## 产品规则

### App 内时间与现实等待

信件等待使用真实时间推进。现有 App 内时间映射仍然只用于展示旧时代日期：

- 真实 `2026-05-23T10:00:00+08:00` 投寄，距离对应 `7 至 12 日`。
- 最早到达真实时间为投寄后第 7 个 24 小时。
- 真实时间到达后，展示日期仍使用 `formatEraDate(now)` 显示为 App 内旧时代日期。

第一版按真实毫秒推进，不按中国本地自然日零点推进。理由是规则简单、可测试，并且符合“预计几天到，就现实中真的等几天”的直觉。

### 到达判断

第一版使用传递窗口的 `minDays` 作为最早可到达时间：

- `now < sentAtIso + minDays`：保持原状态，不可拆。
- `now >= sentAtIso + minDays` 且当前状态为 `in_transit`：推进为 `arrived`。
- `arrived`、`opened`、`archived` 不再自动推进。
- `delayed`、`misrouted`、`lost`、`found`、`returned` 本阶段不自动生成，但如果既有数据中出现，UI 要能正确展示并阻止非法拆阅。

`maxDays` 继续用于展示“约 X 至 Y 日”，不在本阶段触发自动延误。后续延误规则必须是确定性的，例如基于 `letterId + sentAtIso + routeClass` 的稳定判定。

### 邮政记录

状态变化必须有记录：

- 投寄已有记录：收寄、封发。
- 自动到达新增记录：`一九六〇年五月三十日，清波门投递。`
- 拆阅新增记录：`一九六〇年五月三十日，阿周拆阅。`

记录 id 必须稳定，避免重复追加：

- 到达记录：`${letter.id}-postal-arrive`
- 拆阅记录：`${letter.id}-postal-open`

如果状态已经推进或记录已经存在，重复执行推进服务不能追加重复记录。

### 到达前不可拆

拆阅必须走服务层：

- 信件不存在：失败，不改状态。
- 当前用户不是收件人：失败，不改状态。
- 状态不是 `arrived`：失败，不改状态。
- 状态是 `arrived` 且当前用户是收件人：推进为 `opened` 并追加拆阅记录。

UI 的按钮禁用只能作为体验提示，不能作为唯一保护。

### 到达前不泄露正文

对当前用户收进但尚未可拆的信：

- “路上信札”只显示寄出日期、邮路、状态、预计窗口、最后邮政记录。
- 不展示 `excerpt` 和 `body`。
- “旧信匣 / 邮政档案”中，未可拆的收进信也不展示正文摘要。

寄出信件是用户自己写出的，可以继续显示摘要。

## 技术设计

### 领域层扩展

修改 `src/domain/postal.ts`，新增纯函数：

```ts
export interface DeliveryDueRange {
  earliestArrivalAt: Date;
  latestArrivalAt: Date;
  window: DeliveryWindow;
}

export function estimateDeliveryDueRange(sentAt: Date, distanceKm: number): DeliveryDueRange;

export function canArriveBy(sentAt: Date, distanceKm: number, now: Date): boolean;
```

规则：

- `estimateDeliveryDueRange` 调用现有 `estimateDeliveryWindow(distanceKm)`。
- `earliestArrivalAt = sentAt + minDays * 24 * 60 * 60 * 1000`。
- `latestArrivalAt = sentAt + maxDays * 24 * 60 * 60 * 1000`。
- `canArriveBy` 判断 `now >= earliestArrivalAt`。

领域层不依赖 `AppState`、成员信息、UI 或浏览器。

### App 层邮政推进服务

新增 `src/app/postal-progress-service.ts`。

接口：

```ts
export interface SettlePostalProgressResult {
  state: AppState;
  changed: boolean;
}

export function settlePostalProgress(
  state: AppState,
  now: Date
): SettlePostalProgressResult;
```

职责：

- 克隆 `AppState`。
- 遍历 `state.letters`。
- 只自动处理 `state === "in_transit"` 的信件。
- 调用 `canArriveBy(new Date(letter.sentAtIso), letter.distanceKm, now)`。
- 如果可到达，用 `nextLetterState(letter.state, "arrive")` 推进。
- 追加稳定 id 的投递记录。
- 重复执行不重复追加记录。

### App 状态结算入口

修改 `src/app/app-state.ts` 的 `settleAppState`：

- 保留钱包自然结算。
- 在钱包结算结果基础上调用 `settlePostalProgress`。
- `changed = walletChanged || postalChanged`。

这样现有入口不变：

- `App.vue` 启动时仍调用 `settleAppState`。
- `buildAppModel()` 默认状态仍会通过 `settleAppState(createDefaultAppState(), now)` 获得已推进状态。

虽然 `settleAppState` 原先偏钱包结算，但它已经是应用启动时的统一结算入口，本阶段直接扩展更少改动。后续云端同步阶段再考虑拆成 `advanceAppState`。

### 拆阅服务

新增 `src/app/mailbox-service.ts`。

接口：

```ts
export type OpenLetterResult =
  | { ok: true; state: AppState; letterId: string }
  | { ok: false; state: AppState; reason: string };

export function openLetter(
  state: AppState,
  letterId: string,
  now: Date
): OpenLetterResult;
```

规则：

- 开头先调用 `settlePostalProgress(state, now)`，确保拆阅前状态已按真实时间推进。
- 找不到信件：`没有找到这封信。`
- 当前用户不是收件人：`这封信不是寄给你的。`
- 信件未到达：`信还没有投递，不能拆阅。`
- 成功时用 `nextLetterState("arrived", "open")`，追加拆阅记录。
- 成功后返回新状态，调用方负责持久化。

### AppModel 扩展

修改 `src/app/app-model.ts`。

`MailboxModel` 调整为：

```ts
export interface MailboxModel {
  arrivedLetters: LetterSummary[];
  pendingIncomingLetters: LetterSummary[];
  waitingText: string;
}
```

`LetterSummary` 增加：

```ts
state: LetterState;
actionText: string;
availabilityText: string;
latestRecordText: string;
recordItems: LetterRecordSummary[];
```

`LetterRecordSummary`：

```ts
export interface LetterRecordSummary {
  atText: string;
  text: string;
}
```

摘要展示规则：

- 当前用户收进且不可拆的信：`excerpt` 返回 `信尚在路上，未到拆阅时。`
- 当前用户收进且可拆或已拆：显示真实摘要。
- 当前用户寄出：显示真实摘要。

计数修正：

- `today.inboxCount` 使用可拆收进信数量。
- `today.inTransitCount` 使用寄出且状态属于 `posted | accepted | in_transit | delayed | misrouted | lost | found` 的信件数量，不再依赖中文状态文案。

排序：

- `archive.letters` 按最后一条邮政记录时间倒序；没有记录时按 `sentAtIso` 倒序。

### UI 调整

修改 `src/app/pages/MailboxArchivePage.vue`：

- 左侧保留“今日信箱”，展示可拆信。
- 左侧下方新增“路上信札”，展示 `model.mailbox.pendingIncomingLetters`。
- 右侧“旧信匣 / 邮政档案”展示全量信件。
- 每封档案卡片展示最后邮政记录。
- 使用 `<details>` 展开完整邮政记录簿。
- `拆阅`按钮只在 `letter.canOpen` 时启用，并发出 `open-letter` 事件。

修改 `src/App.vue`：

- 引入 `openLetter`。
- 进入信箱页时执行一次 `settleAppState` 并保存可能变化的状态。
- 处理 `open-letter` 事件，成功后持久化并提示“信已拆阅，归入旧信匣。”。

## 错误处理

- 自动推进遇到非法旧数据时不应让 App 崩溃。第一版只处理合法的 `in_transit -> arrived`，其他状态跳过。
- 拆阅失败返回中文原因，并保持 `AppState` 不变。
- 重复拆阅已经 `opened` 的信返回失败：`信还没有投递，不能拆阅。` 可以后续细化为 `这封信已经拆过。`
- 邮政记录 id 已存在时不重复追加。

## 测试

新增 / 修改测试：

- `src/domain/postal.test.ts`
  - `estimateDeliveryDueRange` 计算最早 / 最晚到达时间。
  - `canArriveBy` 到达前为 false，到达边界为 true。

- `src/app/postal-progress-service.test.ts`
  - 未到最早时间不改变状态。
  - 到最早时间后 `in_transit -> arrived`。
  - 自动到达会追加投递记录。
  - 重复 settle 不重复追加记录。
  - `opened`、`returned` 等终态不会被自动改动。

- `src/app/mailbox-service.test.ts`
  - 到达前不能拆阅。
  - 非收件人不能拆阅。
  - 到达后可以拆阅并生成拆阅记录。
  - 拆阅前会先执行邮政推进。

- `src/app/app-model.test.ts`
  - 路上来信进入 `pendingIncomingLetters`，不泄露真实摘要。
  - 可拆来信进入 `arrivedLetters`。
  - 档案展示最后邮政记录和完整记录项。
  - `inTransitCount` 不把退回或归档算作在途。

## 验收标准

- 新投寄信件不会立即可拆。
- 到达前服务层和 UI 都不能拆阅。
- 经过真实最短送达时间后，打开 App 或进入信箱会把信推进到可拆。
- 自动到达会生成邮政记录。
- 拆阅会生成邮政记录，并把信件状态改为 `opened`。
- 重复打开 App 不会重复生成同一条投递记录。
- 信箱页能看见可拆信、路上信札和邮政档案。
- 未可拆的收进信不会泄露正文摘要。

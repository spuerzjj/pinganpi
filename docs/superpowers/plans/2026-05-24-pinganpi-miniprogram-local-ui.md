# 小程序本地核心界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking; completed work is marked `[x]`.

**Goal:** 在微信小程序中用本地 mock 数据重建首批核心界面：今日、写信、代笔先生、钱匣、信箱 / 档案。

**Architecture:** 阶段 24 仍不接 CloudBase 主链路，不实现真实登录和真实同步。小程序根内新增 `miniprogram/services/local-model.ts` 作为 mock view-model 聚合层，页面只读取它输出的展示模型；所有时间、钱、代笔先生出勤、邮资、送达窗口和信件状态判断继续调用 `miniprogram/shared/domain/`，不要在页面里重复写规则。写信页新增本地 wizard service，先完成可操作的 `选写法 → 口述 → 起稿 → 校改 → 投寄` mock 流程，投寄只在页面内形成回执，不写云端。

**Tech Stack:** 微信原生小程序 WXML / WXSS / TypeScript、Vitest、`miniprogram/shared/domain`、现有 `npm run miniprogram:check`。

---

## Scope

本计划对应路线图阶段 24：小程序本地核心界面。当前状态：已执行完成；下方 checkbox 是实施记录，不是待执行事项。

本阶段包含：

- 小程序本地 mock 数据和页面 view-model。
- 今日页展示旧历日期、今时对应、钱匣摘要、先生出勤、来信 / 在途提示、邮资摘要。
- 代笔先生页展示当天在场先生、费用和专长。
- 钱匣页展示余额、自然收支、寄信费用说明和账本摘要。
- 信箱页展示到达 / 未到达信件，到达前不可拆阅。
- 档案页展示已拆旧信和邮政记录。
- 写信页展示 5 步 wizard，可口述、起稿、校改、选择普通 / 挂号、看到费用和本地投寄回执。
- 页面结构移动端优先，PC 预览可用；保持克制文字档案风格。

本阶段不包含：

- 不接 CloudBase。
- 不接真实微信登录 / 手机号。
- 不做真实双人同步。
- 不接 AI 起稿。
- 不做小程序订阅消息。
- 不做照片附件上传。
- 不做真实持久化；页面刷新后恢复 seed mock。

## File Structure

Create:

- `miniprogram/services/local-model.ts`
- `miniprogram/services/local-model.test.ts`
- `miniprogram/services/write-flow.ts`
- `miniprogram/services/write-flow.test.ts`

Modify:

- `miniprogram/app.wxss`
- `miniprogram/pages/today/index.ts`
- `miniprogram/pages/today/index.wxml`
- `miniprogram/pages/today/index.wxss`
- `miniprogram/pages/scribes/index.ts`
- `miniprogram/pages/scribes/index.wxml`
- `miniprogram/pages/scribes/index.wxss`
- `miniprogram/pages/wallet/index.ts`
- `miniprogram/pages/wallet/index.wxml`
- `miniprogram/pages/wallet/index.wxss`
- `miniprogram/pages/mailbox/index.ts`
- `miniprogram/pages/mailbox/index.wxml`
- `miniprogram/pages/mailbox/index.wxss`
- `miniprogram/pages/archive/index.ts`
- `miniprogram/pages/archive/index.wxml`
- `miniprogram/pages/archive/index.wxss`
- `miniprogram/pages/write/index.ts`
- `miniprogram/pages/write/index.wxml`
- `miniprogram/pages/write/index.wxss`
- `docs/pinganpi-roadmap.md`
- `docs/pinganpi-roadmap-dashboard.html`
- `AGENTS.md`

## Data Model Notes

Use these stable seed values in `miniprogram/services/local-model.ts`:

- Current member: `阿周`，city `杭州`，post office `清波门邮政代办处`。
- Recipient: `阿兰`，city `西安`，post office `南院门邮政支局`。
- Route: Hangzhou to Xi'an, `distanceKm: 1200`.
- Wallet seed: balance `235` fen, monthly income `1200` fen, daily living cost `5` fen, `lastSettledAtIso: "2026-05-22T00:00:00+08:00"`.
- Scribes:
  - 许鹤年，杭州，`old-scholar`，fee `3` fen，attendanceRate `1`，specialties `["问安", "久别", "家常"]`
  - 钱守明，杭州，`clerk`，fee `4` fen，attendanceRate `1`，specialties `["挂号", "账目", "回信"]`
  - 沈竹庵，杭州，`schoolmaster`，fee `5` fen，attendanceRate `0`，specialties `["道歉", "生日", "夹寄照片"]`
  - 顾砚秋，西安，`street`，fee `2` fen，attendanceRate `1`，specialties `["报平安", "短笺", "问候"]`
- Letters:
  - `letter-from-lan-0520`: from 阿兰 to 阿周, arrived, sent `2026-05-20T09:30:00+08:00`, excerpt `昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。`
  - `letter-to-lan-0521`: from 阿周 to 阿兰, in_transit, important, sent `2026-05-21T16:10:00+08:00`, excerpt `近日都好，只是见天阴久了，心里老记挂你。`
  - `letter-from-lan-0512`: from 阿兰 to 阿周, opened, registered, important, sent `2026-05-12T10:00:00+08:00`, excerpt `前信收到，字迹很稳，像是许先生代的笔。`

## Task 1: 本地 mock view-model

**Files:**
- Create: `miniprogram/services/local-model.ts`
- Create: `miniprogram/services/local-model.test.ts`

- [x] **Step 1: Write local-model tests**

Create `miniprogram/services/local-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createArchivePageModel,
  createLocalMockState,
  createMailboxPageModel,
  createScribesPageModel,
  createTodayPageModel,
  createWalletPageModel,
} from "./local-model.js";

const fixedNow = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

describe("miniprogram local model", () => {
  it("builds today page data from shared domain rules", () => {
    const state = createLocalMockState(fixedNow);
    const today = createTodayPageModel(state, fixedNow);

    expect(today.title).toBe("一九六〇年五月二十三日");
    expect(today.presentDateText).toBe("今时对应：2026 年 5 月 23 日");
    expect(today.walletBalanceText).toBe("2 元 3 角");
    expect(today.availableScribeText).toBe("今日 2 位先生在馆");
    expect(today.inboxText).toBe("1 封到达可拆");
    expect(today.routeText).toBe("杭州 → 西安，约 1200 里程公里");
  });

  it("lists present scribes and keeps absent scribes visible", () => {
    const model = createScribesPageModel(createLocalMockState(fixedNow), fixedNow);

    expect(model.scribes.map((scribe) => `${scribe.name}:${scribe.statusText}`)).toEqual([
      "许鹤年:今日在馆",
      "钱守明:今日在馆",
      "沈竹庵:今日未到",
    ]);
  });

  it("summarizes wallet settlement and mock ledger", () => {
    const model = createWalletPageModel(createLocalMockState(fixedNow), fixedNow);

    expect(model.balanceText).toBe("2 元 3 角");
    expect(model.ledgerRows.at(0)).toEqual({
      label: "饭食杂用一日",
      amountText: "-5 分",
      tone: "debit",
    });
  });

  it("separates mailbox letters from archived letters", () => {
    const state = createLocalMockState(fixedNow);

    expect(createMailboxPageModel(state, fixedNow).letters.map((letter) => letter.id)).toEqual([
      "letter-from-lan-0520",
      "letter-to-lan-0521",
    ]);
    expect(createArchivePageModel(state).letters.map((letter) => letter.id)).toEqual([
      "letter-from-lan-0512",
    ]);
  });
});
```

- [x] **Step 2: Run local-model tests and confirm failure**

Run:

```bash
npm test -- miniprogram/services/local-model.test.ts
```

Expected: FAIL because `miniprogram/services/local-model.ts` does not exist.

- [x] **Step 3: Implement local model**

Create `miniprogram/services/local-model.ts` with:

```ts
import {
  canArriveBy,
  estimateDeliveryDueRange,
  calculatePostage,
  formatEraDate,
  formatFen,
  formatPresentCorrespondence,
  getDailyAttendance,
  settleWallet,
  type Fen,
  type LetterState,
  type Scribe,
} from "../shared/domain/index.js";

export interface MiniMember {
  id: string;
  dailyName: string;
  city: string;
  postOffice: string;
}

export interface MiniWallet {
  balanceFen: Fen;
  monthlyIncomeFen: Fen;
  dailyLivingCostFen: Fen;
  lastSettledAtIso: string;
}

export interface MiniLetter {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  state: LetterState;
  sentAtIso: string;
  distanceKm: number;
  registered: boolean;
  important: boolean;
  excerpt: string;
  body: string;
  records: string[];
}

export interface MiniLocalState {
  currentMemberId: string;
  recipientMemberId: string;
  members: MiniMember[];
  scribes: Scribe[];
  wallet: MiniWallet;
  route: {
    fromCity: string;
    toCity: string;
    distanceKm: number;
  };
  letters: MiniLetter[];
  ledgerRows: LedgerRow[];
}

export interface LedgerRow {
  label: string;
  amountText: string;
  tone: "credit" | "debit";
}

export interface TodayPageModel {
  kicker: string;
  title: string;
  presentDateText: string;
  walletBalanceText: string;
  availableScribeText: string;
  inboxText: string;
  routeText: string;
  postageText: string;
}

export interface ScribeListItem {
  id: string;
  name: string;
  feeText: string;
  styleText: string;
  specialtiesText: string;
  statusText: string;
  statusTone: "present" | "absent";
}

export interface ScribesPageModel {
  kicker: string;
  title: string;
  cityText: string;
  scribes: ScribeListItem[];
}

export interface WalletPageModel {
  kicker: string;
  title: string;
  balanceText: string;
  incomeText: string;
  livingCostText: string;
  ledgerRows: LedgerRow[];
}

export interface MailboxLetterItem {
  id: string;
  subject: string;
  fromText: string;
  stateText: string;
  canOpen: boolean;
  importantText: string;
  excerpt: string;
  dueText: string;
}

export interface MailboxPageModel {
  kicker: string;
  title: string;
  letters: MailboxLetterItem[];
}

export interface ArchiveLetterItem {
  id: string;
  subject: string;
  metaText: string;
  excerpt: string;
  records: string[];
}

export interface ArchivePageModel {
  kicker: string;
  title: string;
  letters: ArchiveLetterItem[];
}

export function createLocalMockState(now: Date): MiniLocalState {
  const settlement = settleWallet({
    balanceFen: 235,
    monthlyIncomeFen: 1200,
    dailyLivingCostFen: 5,
    lastSettledAt: new Date("2026-05-22T00:00:00+08:00"),
    now,
  });

  return {
    currentMemberId: "member-zhou",
    recipientMemberId: "member-lan",
    members: [
      { id: "member-zhou", dailyName: "阿周", city: "杭州", postOffice: "清波门邮政代办处" },
      { id: "member-lan", dailyName: "阿兰", city: "西安", postOffice: "南院门邮政支局" },
    ],
    scribes: [
      {
        id: "scribe-xu",
        name: "许鹤年",
        city: "杭州",
        style: "old-scholar",
        feeFen: 3,
        attendanceRate: 1,
        specialties: ["问安", "久别", "家常"],
      },
      {
        id: "scribe-qian",
        name: "钱守明",
        city: "杭州",
        style: "clerk",
        feeFen: 4,
        attendanceRate: 1,
        specialties: ["挂号", "账目", "回信"],
      },
      {
        id: "scribe-shen",
        name: "沈竹庵",
        city: "杭州",
        style: "schoolmaster",
        feeFen: 5,
        attendanceRate: 0,
        specialties: ["道歉", "生日", "夹寄照片"],
      },
      {
        id: "scribe-gu",
        name: "顾砚秋",
        city: "西安",
        style: "street",
        feeFen: 2,
        attendanceRate: 1,
        specialties: ["报平安", "短笺", "问候"],
      },
    ],
    wallet: {
      balanceFen: settlement.balanceFen,
      monthlyIncomeFen: 1200,
      dailyLivingCostFen: 5,
      lastSettledAtIso: settlement.settledAt.toISOString(),
    },
    route: { fromCity: "杭州", toCity: "西安", distanceKm: 1200 },
    letters: createSeedLetters(),
    ledgerRows: settlement.entries.map((entry) => ({
      label: entry.note,
      amountText: `${entry.amountFen < 0 ? "-" : "+"}${formatFen(Math.abs(entry.amountFen))}`,
      tone: entry.amountFen < 0 ? "debit" : "credit",
    })),
  };
}

export function createTodayPageModel(state: MiniLocalState, now: Date): TodayPageModel {
  const current = getCurrentMember(state);
  const arrivedCount = state.letters.filter(
    (letter) => letter.recipientId === current.id && letter.state === "arrived",
  ).length;
  const presentCount = getPresentScribes(state, now).length;

  return {
    kicker: "平安批 / 今日",
    title: formatEraDate(now),
    presentDateText: formatPresentCorrespondence(now),
    walletBalanceText: formatFen(state.wallet.balanceFen),
    availableScribeText: `今日 ${presentCount} 位先生在馆`,
    inboxText: arrivedCount > 0 ? `${arrivedCount} 封到达可拆` : "今日暂无可拆来信",
    routeText: `${state.route.fromCity} → ${state.route.toCity}，约 ${state.route.distanceKm} 里程公里`,
    postageText: `平信 ${formatFen(calculatePostage({ local: false, registered: false, hasPhoto: false }))}，挂号 ${formatFen(calculatePostage({ local: false, registered: true, hasPhoto: false }))}`,
  };
}

export function createScribesPageModel(state: MiniLocalState, now: Date): ScribesPageModel {
  const current = getCurrentMember(state);
  const presentIds = new Set(getPresentScribes(state, now).map((scribe) => scribe.id));

  return {
    kicker: "平安批 / 代笔先生",
    title: "代笔先生",
    cityText: `${current.city} · ${current.postOffice}`,
    scribes: state.scribes
      .filter((scribe) => scribe.city === current.city)
      .map((scribe) => ({
        id: scribe.id,
        name: scribe.name,
        feeText: `代书费 ${formatFen(scribe.feeFen)}`,
        styleText: formatScribeStyle(scribe.style),
        specialtiesText: scribe.specialties.join("、"),
        statusText: presentIds.has(scribe.id) ? "今日在馆" : "今日未到",
        statusTone: presentIds.has(scribe.id) ? "present" : "absent",
      })),
  };
}

export function createWalletPageModel(state: MiniLocalState, _now: Date): WalletPageModel {
  return {
    kicker: "平安批 / 钱匣",
    title: "钱匣",
    balanceText: formatFen(state.wallet.balanceFen),
    incomeText: `每月余款 ${formatFen(state.wallet.monthlyIncomeFen)}`,
    livingCostText: `饭食杂用每日 ${formatFen(state.wallet.dailyLivingCostFen)}`,
    ledgerRows: state.ledgerRows,
  };
}

export function createMailboxPageModel(state: MiniLocalState, now: Date): MailboxPageModel {
  const current = getCurrentMember(state);
  const memberName = new Map(state.members.map((member) => [member.id, member.dailyName]));

  return {
    kicker: "平安批 / 信箱",
    title: "今日信箱",
    letters: state.letters
      .filter((letter) => letter.state !== "opened" && letter.state !== "archived")
      .map((letter) => {
        const canOpen = letter.recipientId === current.id && letter.state === "arrived";
        return {
          id: letter.id,
          subject: letter.subject,
          fromText: `${memberName.get(letter.senderId) ?? "对方"} 寄`,
          stateText: formatLetterState(letter.state, canArriveBy(new Date(letter.sentAtIso), letter.distanceKm, now)),
          canOpen,
          importantText: letter.important ? "要紧" : "普通",
          excerpt: canOpen ? letter.excerpt : "未到达，不可拆阅正文。",
          dueText: formatDueText(letter),
        };
      }),
  };
}

export function createArchivePageModel(state: MiniLocalState): ArchivePageModel {
  const memberName = new Map(state.members.map((member) => [member.id, member.dailyName]));
  return {
    kicker: "平安批 / 档案",
    title: "旧信档案",
    letters: state.letters
      .filter((letter) => letter.state === "opened" || letter.state === "archived")
      .map((letter) => ({
        id: letter.id,
        subject: letter.subject,
        metaText: `${memberName.get(letter.senderId) ?? "对方"} · ${letter.registered ? "挂号" : "平信"}`,
        excerpt: letter.excerpt,
        records: letter.records,
      })),
  };
}

function createSeedLetters(): MiniLetter[] {
  return [
    {
      id: "letter-from-lan-0520",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "南院门寄来的平安批",
      state: "arrived",
      sentAtIso: new Date("2026-05-20T09:30:00+08:00").toISOString(),
      distanceKm: 1200,
      registered: false,
      important: false,
      excerpt: "昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。",
      body: "明远：昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。此间一切尚安，只是路远信迟，盼你勿急。",
      records: ["一九六〇年五月二十日，南院门支局收寄。", "一九六〇年五月二十三日，清波门投递。"],
    },
    {
      id: "letter-to-lan-0521",
      senderId: "member-zhou",
      recipientId: "member-lan",
      subject: "五月二十一日寄西安",
      state: "in_transit",
      sentAtIso: new Date("2026-05-21T16:10:00+08:00").toISOString(),
      distanceKm: 1200,
      registered: false,
      important: true,
      excerpt: "近日都好，只是见天阴久了，心里老记挂你。",
      body: "兰卿：近日都好，只是见天阴久了，心里老记挂你。前信不知可曾收到，若得空，请托人回一纸。",
      records: ["一九六〇年五月二十一日，清波门邮政代办处开筒。", "一九六〇年五月二十二日，杭州封发。"],
    },
    {
      id: "letter-from-lan-0512",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "挂号回信一封",
      state: "opened",
      sentAtIso: new Date("2026-05-12T10:00:00+08:00").toISOString(),
      distanceKm: 1200,
      registered: true,
      important: true,
      excerpt: "前信收到，字迹很稳，像是许先生代的笔。",
      body: "明远：前信收到，字迹很稳，像是许先生代的笔。挂号回执另存，望安心。",
      records: ["一九六〇年五月十二日，南院门支局挂号收寄。", "一九六〇年五月十八日，清波门投递并签收。"],
    },
  ];
}

function getCurrentMember(state: MiniLocalState): MiniMember {
  const member = state.members.find((item) => item.id === state.currentMemberId);
  if (member === undefined) {
    throw new Error("Missing current member");
  }
  return member;
}

function getPresentScribes(state: MiniLocalState, now: Date): Scribe[] {
  return getDailyAttendance({
    city: getCurrentMember(state).city,
    date: now,
    scribes: state.scribes,
  });
}

function formatScribeStyle(style: Scribe["style"]): string {
  const labels: Record<Scribe["style"], string> = {
    street: "街坊口吻",
    "old-scholar": "旧塾文气",
    schoolmaster: "先生训诂",
    clerk: "邮局书记",
  };
  return labels[style];
}

function formatLetterState(state: LetterState, canArrive: boolean): string {
  if (state === "arrived") {
    return "已到，可拆";
  }
  if (state === "in_transit" && canArrive) {
    return "按程可到，待邮差投递";
  }
  if (state === "in_transit") {
    return "路上";
  }
  if (state === "opened") {
    return "已拆";
  }
  return state;
}

function formatDueText(letter: MiniLetter): string {
  const due = estimateDeliveryDueRange(new Date(letter.sentAtIso), letter.distanceKm);
  return `${formatEraDate(due.earliestArrivalAt)} 至 ${formatEraDate(due.latestArrivalAt)}`;
}
```

- [x] **Step 4: Run local-model tests**

Run:

```bash
npm test -- miniprogram/services/local-model.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit Task 1**

```bash
git add miniprogram/services/local-model.ts miniprogram/services/local-model.test.ts
git commit -m "feat(miniprogram): 添加本地界面模型"
```

## Task 2: 今日、先生、钱匣、信箱、档案页面

**Files:**
- Modify: `miniprogram/app.wxss`
- Modify: `miniprogram/pages/today/index.ts`
- Modify: `miniprogram/pages/today/index.wxml`
- Modify: `miniprogram/pages/today/index.wxss`
- Modify: `miniprogram/pages/scribes/index.ts`
- Modify: `miniprogram/pages/scribes/index.wxml`
- Modify: `miniprogram/pages/scribes/index.wxss`
- Modify: `miniprogram/pages/wallet/index.ts`
- Modify: `miniprogram/pages/wallet/index.wxml`
- Modify: `miniprogram/pages/wallet/index.wxss`
- Modify: `miniprogram/pages/mailbox/index.ts`
- Modify: `miniprogram/pages/mailbox/index.wxml`
- Modify: `miniprogram/pages/mailbox/index.wxss`
- Modify: `miniprogram/pages/archive/index.ts`
- Modify: `miniprogram/pages/archive/index.wxml`
- Modify: `miniprogram/pages/archive/index.wxss`

- [x] **Step 1: Add shared mini program UI classes**

Append to `miniprogram/app.wxss`:

```css
.panel-stack {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.section-panel {
  border: 2rpx solid var(--line);
  background: var(--surface);
  padding: 24rpx;
}

.section-title {
  color: var(--ink);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.4;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}

.stamp {
  border: 1rpx solid var(--line);
  color: var(--muted);
  font-size: 24rpx;
  line-height: 1.5;
  padding: 4rpx 10rpx;
}

.record-list {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.record-row {
  border-top: 1rpx solid var(--line);
  padding-top: 12rpx;
  color: var(--muted);
  font-size: 26rpx;
  line-height: 1.65;
}
```

- [x] **Step 2: Update pages to load models**

For each page `index.ts`, import `createLocalMockState()` and the corresponding page model function. Use `onShow()` and `this.setData(...)` so the date can refresh when the page returns from background.

Example for `miniprogram/pages/today/index.ts`:

```ts
import { createLocalMockState, createTodayPageModel, type TodayPageModel } from "../../services/local-model.js";

Page({
  data: {
    model: null as TodayPageModel | null,
  },
  onShow() {
    const now = new Date();
    const state = createLocalMockState(now);
    this.setData({
      model: createTodayPageModel(state, now),
    });
  },
});
```

Use the same pattern for:

- `createScribesPageModel`
- `createWalletPageModel`
- `createMailboxPageModel`
- `createArchivePageModel`

- [x] **Step 3: Update WXML layouts**

For today page use:

```xml
<view class="page-shell" wx:if="{{model}}">
  <view class="panel-stack">
    <view class="archive-panel">
      <view class="kicker">{{model.kicker}}</view>
      <view class="title">{{model.title}}</view>
      <view class="body-copy">{{model.presentDateText}}</view>
    </view>
    <view class="section-panel">
      <view class="section-title">今日要目</view>
      <view class="record-list">
        <view class="record-row">钱匣余 {{model.walletBalanceText}}</view>
        <view class="record-row">{{model.availableScribeText}}</view>
        <view class="record-row">{{model.inboxText}}</view>
        <view class="record-row">{{model.routeText}}</view>
        <view class="record-row">{{model.postageText}}</view>
      </view>
    </view>
  </view>
</view>
```

For list pages use `wx:for` over `model.scribes`, `model.ledgerRows`, `model.letters`, and render status with `stamp` elements. Use `{{item.id}}` as `wx:key`.

- [x] **Step 4: Run page typecheck**

Run:

```bash
npm run miniprogram:check
```

Expected: PASS.

- [x] **Step 5: Commit Task 2**

```bash
git add miniprogram/app.wxss miniprogram/pages/today miniprogram/pages/scribes miniprogram/pages/wallet miniprogram/pages/mailbox miniprogram/pages/archive
git commit -m "feat(miniprogram): 接入本地核心阅读界面"
```

## Task 3: 写信分步流程

**Files:**
- Create: `miniprogram/services/write-flow.ts`
- Create: `miniprogram/services/write-flow.test.ts`
- Modify: `miniprogram/pages/write/index.ts`
- Modify: `miniprogram/pages/write/index.wxml`
- Modify: `miniprogram/pages/write/index.wxss`

- [x] **Step 1: Write write-flow tests**

Create `miniprogram/services/write-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLocalMockState } from "./local-model.js";
import {
  createWriteFlowModel,
  generateLocalDraft,
  preparePostedReceipt,
  reviseDraft,
  updateOralText,
} from "./write-flow.js";

const fixedNow = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

describe("miniprogram write flow", () => {
  it("calculates draft cost from selected scribe and postage", () => {
    const flow = createWriteFlowModel(createLocalMockState(fixedNow), fixedNow);

    expect(flow.totalCostText).toBe("1 角 1 分");
    expect(flow.canPost).toBe(false);
  });

  it("generates and revises a local mock draft", () => {
    const state = createLocalMockState(fixedNow);
    const oral = updateOralText(createWriteFlowModel(state, fixedNow), "近来天阴，问她可安。");
    const drafted = generateLocalDraft(oral, state, fixedNow);
    const revised = reviseDraft(drafted, "兰卿：近来天阴，望你安好。");

    expect(drafted.draftText).toContain("近来天阴");
    expect(revised.finalText).toBe("兰卿：近来天阴，望你安好。");
    expect(revised.canPost).toBe(true);
  });

  it("prepares a local posted receipt without mutating cloud state", () => {
    const state = createLocalMockState(fixedNow);
    const flow = reviseDraft(generateLocalDraft(updateOralText(createWriteFlowModel(state, fixedNow), "一切平安。"), state, fixedNow), "兰卿：一切平安。");

    expect(preparePostedReceipt(flow, state, fixedNow)).toEqual({
      title: "本地投寄存根",
      costText: "1 角 1 分",
      routeText: "杭州 → 西安",
      dueText: "一九六〇年五月三十日 至 一九六〇年六月四日",
    });
  });
});
```

- [x] **Step 2: Run write-flow tests and confirm failure**

Run:

```bash
npm test -- miniprogram/services/write-flow.test.ts
```

Expected: FAIL because `write-flow.ts` does not exist.

- [x] **Step 3: Implement write-flow service**

Create `miniprogram/services/write-flow.ts` with exported types and functions:

- `WriteStep = "method" | "oral" | "draft" | "revise" | "post"`
- `createWriteFlowModel(state, now)`
- `updateOralText(flow, oralText)`
- `generateLocalDraft(flow, state, now)`
- `reviseDraft(flow, finalText)`
- `setRegistered(flow, registered)`
- `preparePostedReceipt(flow, state, now)`

Implementation requirements:

- Default selected scribe is first present scribe in current city.
- Default registered is `false`.
- Postage uses `calculatePostage({ local: false, registered, hasPhoto: false })`.
- Total cost = selected scribe fee + postage.
- `canPost` is true only when `finalText.trim().length > 0` and `wallet.balanceFen >= totalCostFen`.
- Local draft text may be deterministic template text, but must preserve the oral text and make clear it is先生起稿.

- [x] **Step 4: Update write page TypeScript**

`miniprogram/pages/write/index.ts` should:

- Create state and flow in `onShow()`.
- Provide handlers:
  - `goNext`
  - `goBack`
  - `onOralInput`
  - `onFinalInput`
  - `onGenerateDraft`
  - `onToggleRegistered`
  - `onPostLocal`
- Store `receipt` after local post.

- [x] **Step 5: Update write WXML**

Render:

- Step indicator using five text labels.
- Oral textarea on oral step.
- Draft preview and “请先生起稿” button on draft step.
- Final textarea on revise step.
- Cost, route, due window and “本地投寄” button on post step.
- Receipt panel after local post.

- [x] **Step 6: Run write-flow focused tests and miniprogram check**

Run:

```bash
npm test -- miniprogram/services/write-flow.test.ts
npm run miniprogram:check
```

Expected: PASS.

- [x] **Step 7: Commit Task 3**

```bash
git add miniprogram/services/write-flow.ts miniprogram/services/write-flow.test.ts miniprogram/pages/write
git commit -m "feat(miniprogram): 添加本地写信分步流程"
```

## Task 4: 文档与阶段 24 收口

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [x] **Step 1: Update roadmap**

Change stage 24 row to completed basis:

```markdown
| 24 | 小程序本地核心界面 | 已完成基础 | 今日、写信、先生、钱匣、信箱 / 档案已接入本地 mock view-model；写信页已有本地 5 步流程。 |
```

Change current target to stage 25:

```markdown
**本期目标：** 阶段 24 已完成小程序本地核心界面。下一步进入阶段 25：接入 CloudBase dev 主链路，让账号、绑定、同步和 AI 通过 `wx.cloud.callFunction` 跑通工程通道。
```

- [x] **Step 2: Update dashboard and AGENTS**

Dashboard should show:

- Current baseline: 阶段 24。
- Next recommended: dev 云链路。
- Phase 24 marked done and phase 25 marked next.
- Verification snapshot includes `npm test -- miniprogram/services/local-model.test.ts` and `npm test -- miniprogram/services/write-flow.test.ts`.

AGENTS should record:

- Stage 24 completed basis.
- New files `miniprogram/services/local-model.ts` and `miniprogram/services/write-flow.ts`.
- Next stage is 25.
- Verification baseline after final test count.

- [x] **Step 3: Run final verification**

Run:

```bash
npm run miniprogram:check
npm test
npm run typecheck
git diff --check
```

Expected: PASS.

- [x] **Step 4: Commit docs**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md
git commit -m "docs(miniprogram): 收口本地核心界面"
```

## Execution Notes

- Do not import from `src/app` or `src/domain` in小程序 runtime code.
- Do not import from repository-root `shared/domain` in小程序 runtime code; use `miniprogram/shared/domain`.
- If `shared/domain` changes, run `npm run miniprogram:sync-shared` and `npm run miniprogram:check-shared`.
- Keep page copy restrained; avoid chat bubbles, live map, marketing hero, and decorative animation.
- This stage is local mock only. Do not call `wx.cloud.callFunction`.

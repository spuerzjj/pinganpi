# Pinganpi Mailbox Delivery Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现阶段 9 信箱真实时间送达推进：信件按现实等待时间到达、到达前不可拆、拆阅写入邮政记录，并在信箱 / 档案 UI 中展示邮政记录簿。

**Architecture:** 在领域层增加送达时间纯函数；在 App 层新增 `postal-progress-service.ts` 负责按真实时间推进信件并追加邮政记录，新增 `mailbox-service.ts` 负责拆阅权限和 `arrived -> opened`。`settleAppState` 作为现有应用结算入口整合钱包结算和邮政推进，`AppModel` 负责派生可拆信、路上信札、档案记录簿，Vue 页面只触发服务事件并展示状态。

**Tech Stack:** TypeScript, Vue 3 Composition API, Tailwind CSS, Varlet, Vitest, localStorage AppState.

---

## File Structure And Ownership

- Modify: `src/domain/postal.ts`
  - 增加送达时间窗口和到达判断纯函数。
- Modify: `src/domain/postal.test.ts`
  - 覆盖送达时间窗口和边界判断。
- Create: `src/app/postal-progress-service.ts`
  - 按真实时间推进 `in_transit -> arrived`，追加稳定投递记录。
- Create: `src/app/postal-progress-service.test.ts`
  - 覆盖未到达、到达、幂等、终态不变。
- Create: `src/app/mailbox-service.ts`
  - 拆阅服务，服务层防止到达前拆阅。
- Create: `src/app/mailbox-service.test.ts`
  - 覆盖到达前不可拆、非收件人不可拆、可拆后写记录。
- Modify: `src/app/app-state.ts`
  - `settleAppState` 整合邮政推进。
- Modify: `src/app/app-state.test.ts`
  - 覆盖应用结算会推进信件。
- Modify: `src/app/app-model.ts`
  - 增加 pending incoming letters、记录簿摘要、原始状态、动作文案和摘要隐藏规则。
- Modify: `src/app/app-model.test.ts`
  - 覆盖新 view-model 行为和在途计数修正。
- Modify: `src/App.vue`
  - 进入信箱时结算邮政状态；处理 `open-letter` 事件。
- Modify: `src/app/pages/MailboxArchivePage.vue`
  - 展示今日信箱、路上信札、旧信匣 / 邮政档案，发出拆阅事件。
- Modify: `docs/pinganpi-roadmap.md`
  - 阶段 9 完成后更新。
- Modify: `docs/pinganpi-roadmap-dashboard.html`
  - 阶段 9 完成后更新。

Subagent execution rule:

- Task 1 and Task 2 can run in parallel only if Task 2 uses a local helper stub in its branch; simpler sequencing is Task 1 then Task 2.
- Task 3 depends on Task 2.
- Task 4 depends on Task 2 and Task 3.
- Task 5 depends on Task 4.
- Task 6 runs after implementation and verification.
- Every worker must not revert edits made by others. If files changed while it was running, it must re-read and adapt.

---

### Task 1: Domain Delivery Due Functions

**Worker ownership:**

- Modify: `src/domain/postal.ts`
- Modify: `src/domain/postal.test.ts`
- Do not edit AppState, Vue files, or AppModel.

- [ ] **Step 1: Write failing tests**

Append to `src/domain/postal.test.ts`:

```ts
import {
  canArriveBy,
  estimateDeliveryDueRange
} from "./postal.js";

it("estimates delivery due range from sent time and distance", () => {
  const sentAt = new Date("2026-05-23T02:00:00.000Z");
  const due = estimateDeliveryDueRange(sentAt, 1200);

  expect(due.window).toEqual({ minDays: 7, maxDays: 12, routeClass: "cross-region" });
  expect(due.earliestArrivalAt.toISOString()).toBe("2026-05-30T02:00:00.000Z");
  expect(due.latestArrivalAt.toISOString()).toBe("2026-06-04T02:00:00.000Z");
});

it("checks whether a letter can arrive by the current real time", () => {
  const sentAt = new Date("2026-05-23T02:00:00.000Z");

  expect(canArriveBy(sentAt, 1200, new Date("2026-05-30T01:59:59.999Z"))).toBe(false);
  expect(canArriveBy(sentAt, 1200, new Date("2026-05-30T02:00:00.000Z"))).toBe(true);
});
```

If the existing import list is already multi-line, merge the new functions into that list instead of adding a second import from the same module.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/postal.test.ts
```

Expected: FAIL because `canArriveBy` and `estimateDeliveryDueRange` are not exported.

- [ ] **Step 3: Implement domain functions**

In `src/domain/postal.ts`, add after `DeliveryWindow`:

```ts
export interface DeliveryDueRange {
  earliestArrivalAt: Date;
  latestArrivalAt: Date;
  window: DeliveryWindow;
}
```

Add after `estimateDeliveryWindow`:

```ts
const dayMs = 24 * 60 * 60 * 1000;

export function estimateDeliveryDueRange(sentAt: Date, distanceKm: number): DeliveryDueRange {
  if (Number.isNaN(sentAt.getTime())) {
    throw new Error(`Invalid sent time: ${sentAt.toString()}`);
  }

  const window = estimateDeliveryWindow(distanceKm);

  return {
    earliestArrivalAt: new Date(sentAt.getTime() + window.minDays * dayMs),
    latestArrivalAt: new Date(sentAt.getTime() + window.maxDays * dayMs),
    window
  };
}

export function canArriveBy(sentAt: Date, distanceKm: number, now: Date): boolean {
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid current time: ${now.toString()}`);
  }

  return now.getTime() >= estimateDeliveryDueRange(sentAt, distanceKm).earliestArrivalAt.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/domain/postal.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/postal.ts src/domain/postal.test.ts
git commit -m "feat(domain): 添加信件送达时间判断"
```

---

### Task 2: Postal Progress Service

**Worker ownership:**

- Create: `src/app/postal-progress-service.ts`
- Create: `src/app/postal-progress-service.test.ts`
- Do not edit Vue files or AppModel.

- [ ] **Step 1: Write failing tests**

Create `src/app/postal-progress-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "./app-state.js";
import { settlePostalProgress } from "./postal-progress-service.js";

describe("postal progress service", () => {
  it("keeps an in-transit letter unchanged before the earliest delivery time", () => {
    const state = createDefaultAppState();
    const result = settlePostalProgress(state, new Date("2026-05-27T08:00:00.000Z"));

    expect(result.changed).toBe(false);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("in_transit");
  });

  it("marks an in-transit letter as arrived at the earliest delivery time", () => {
    const state = createDefaultAppState();
    const result = settlePostalProgress(state, new Date("2026-05-28T08:10:00.000Z"));

    expect(result.changed).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
    expect(result.state.postalRecords.find((record) => record.id === "letter-to-lan-0521-postal-arrive")).toMatchObject({
      letterId: "letter-to-lan-0521",
      text: "一九六〇年五月二十八日，南院门投递。"
    });
  });

  it("does not append duplicate arrival records", () => {
    const state = createDefaultAppState();
    const first = settlePostalProgress(state, new Date("2026-05-28T08:10:00.000Z"));
    const second = settlePostalProgress(first.state, new Date("2026-05-29T08:10:00.000Z"));

    expect(second.changed).toBe(false);
    expect(second.state.postalRecords.filter((record) => record.id === "letter-to-lan-0521-postal-arrive")).toHaveLength(1);
  });

  it("leaves opened and returned letters unchanged", () => {
    const state = createDefaultAppState();
    const opened = state.letters.find((letter) => letter.id === "letter-from-lan-0512");
    const inTransit = state.letters.find((letter) => letter.id === "letter-to-lan-0521");

    if (opened === undefined || inTransit === undefined) {
      throw new Error("Missing seed letters");
    }

    inTransit.state = "returned";

    const result = settlePostalProgress(state, new Date("2026-06-10T08:10:00.000Z"));

    expect(result.changed).toBe(false);
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-0512")?.state).toBe("opened");
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("returned");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/postal-progress-service.test.ts
```

Expected: FAIL because `postal-progress-service.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `src/app/postal-progress-service.ts`:

```ts
import { canArriveBy, formatEraDate, nextLetterState } from "../domain/index.js";
import { cloneAppState, type AppState, type PersistedLetter, type PostalRecord } from "./app-state.js";

export interface SettlePostalProgressResult {
  state: AppState;
  changed: boolean;
}

export function settlePostalProgress(state: AppState, now: Date): SettlePostalProgressResult {
  const nextState = cloneAppState(state);
  let changed = false;

  nextState.letters = nextState.letters.map((letter) => {
    if (letter.state !== "in_transit") {
      return letter;
    }

    if (!canArriveBy(new Date(letter.sentAtIso), letter.distanceKm, now)) {
      return letter;
    }

    const arrivedLetter: PersistedLetter = {
      ...letter,
      state: nextLetterState(letter.state, "arrive")
    };

    if (!nextState.postalRecords.some((record) => record.id === arrivalRecordId(letter.id))) {
      nextState.postalRecords.push(createArrivalRecord(nextState, letter, now));
    }

    changed = true;
    return arrivedLetter;
  });

  return {
    state: nextState,
    changed
  };
}

function createArrivalRecord(state: AppState, letter: PersistedLetter, now: Date): PostalRecord {
  const recipient = state.members.find((member) => member.id === letter.recipientId);

  if (recipient === undefined) {
    throw new Error(`Missing recipient member: ${letter.recipientId}`);
  }

  return {
    id: arrivalRecordId(letter.id),
    letterId: letter.id,
    atIso: now.toISOString(),
    text: `${formatEraDate(now)}，${recipient.postOffice}投递。`
  };
}

function arrivalRecordId(letterId: string): string {
  return `${letterId}-postal-arrive`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/postal-progress-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/postal-progress-service.ts src/app/postal-progress-service.test.ts
git commit -m "feat(app): 添加邮政送达推进服务"
```

---

### Task 3: Mailbox Service And App Settlement

**Worker ownership:**

- Create: `src/app/mailbox-service.ts`
- Create: `src/app/mailbox-service.test.ts`
- Modify: `src/app/app-state.ts`
- Modify: `src/app/app-state.test.ts`
- Do not edit Vue files or AppModel.

- [ ] **Step 1: Write failing mailbox service tests**

Create `src/app/mailbox-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "./app-state.js";
import { openLetter } from "./mailbox-service.js";

describe("mailbox service", () => {
  it("blocks opening a letter before it is delivered", () => {
    const state = createDefaultAppState();
    const result = openLetter(state, "letter-to-lan-0521", new Date("2026-05-27T08:00:00.000Z"));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected opening to fail");
    expect(result.reason).toBe("这封信不是寄给你的。");
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("in_transit");
  });

  it("blocks opening an incoming letter that has not arrived", () => {
    const state = createDefaultAppState();
    state.letters.push({
      id: "letter-incoming-waiting",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "路上来信",
      state: "in_transit",
      sentAtIso: "2026-05-23T02:00:00.000Z",
      distanceKm: 1200,
      registered: false,
      hasPhoto: false,
      important: false,
      excerpt: "这句不应提前露出。",
      body: "这封信还在路上。"
    });

    const result = openLetter(state, "letter-incoming-waiting", new Date("2026-05-27T08:00:00.000Z"));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected opening to fail");
    expect(result.reason).toBe("信还没有投递，不能拆阅。");
  });

  it("settles postal progress before opening an arrived-by-time letter", () => {
    const state = createDefaultAppState();
    state.letters.push({
      id: "letter-incoming-ready",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "到达来信",
      state: "in_transit",
      sentAtIso: "2026-05-23T02:00:00.000Z",
      distanceKm: 1200,
      registered: false,
      hasPhoto: false,
      important: false,
      excerpt: "到达后可以看。",
      body: "到达后可以拆阅。"
    });

    const result = openLetter(state, "letter-incoming-ready", new Date("2026-05-30T02:00:00.000Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.letters.find((letter) => letter.id === "letter-incoming-ready")?.state).toBe("opened");
    expect(result.state.postalRecords.find((record) => record.id === "letter-incoming-ready-postal-arrive")).toBeDefined();
    expect(result.state.postalRecords.find((record) => record.id === "letter-incoming-ready-postal-open")).toMatchObject({
      text: "一九六〇年五月三十日，阿周拆阅。"
    });
  });
});
```

- [ ] **Step 2: Write failing app-state settlement test**

Append to `src/app/app-state.test.ts`:

```ts
it("settles postal progress into persistent records", () => {
  const state = createDefaultAppState();

  const result = settleAppState(state, new Date("2026-05-28T08:10:00.000Z"));

  expect(result.changed).toBe(true);
  expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
  expect(result.state.postalRecords.find((record) => record.id === "letter-to-lan-0521-postal-arrive")).toBeDefined();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- src/app/mailbox-service.test.ts src/app/app-state.test.ts
```

Expected: FAIL because mailbox service does not exist and `settleAppState` does not call postal progress.

- [ ] **Step 4: Implement mailbox service**

Create `src/app/mailbox-service.ts`:

```ts
import { formatEraDate, nextLetterState } from "../domain/index.js";
import { cloneAppState, type AppState, type PostalRecord } from "./app-state.js";
import { settlePostalProgress } from "./postal-progress-service.js";

export type OpenLetterResult =
  | { ok: true; state: AppState; letterId: string }
  | { ok: false; state: AppState; reason: string };

export function openLetter(state: AppState, letterId: string, now: Date): OpenLetterResult {
  const settled = settlePostalProgress(state, now);
  const nextState = cloneAppState(settled.state);
  const letterIndex = nextState.letters.findIndex((letter) => letter.id === letterId);
  const letter = nextState.letters[letterIndex];

  if (letter === undefined) {
    return { ok: false, state: nextState, reason: "没有找到这封信。" };
  }

  if (letter.recipientId !== nextState.currentMemberId) {
    return { ok: false, state: nextState, reason: "这封信不是寄给你的。" };
  }

  if (letter.state !== "arrived") {
    return { ok: false, state: nextState, reason: "信还没有投递，不能拆阅。" };
  }

  nextState.letters[letterIndex] = {
    ...letter,
    state: nextLetterState(letter.state, "open")
  };

  if (!nextState.postalRecords.some((record) => record.id === openRecordId(letter.id))) {
    nextState.postalRecords.push(createOpenRecord(nextState, letter.id, now));
  }

  return { ok: true, state: nextState, letterId };
}

function createOpenRecord(state: AppState, letterId: string, now: Date): PostalRecord {
  const currentMember = state.members.find((member) => member.id === state.currentMemberId);

  if (currentMember === undefined) {
    throw new Error(`Missing current member: ${state.currentMemberId}`);
  }

  return {
    id: openRecordId(letterId),
    letterId,
    atIso: now.toISOString(),
    text: `${formatEraDate(now)}，${currentMember.dailyName}拆阅。`
  };
}

function openRecordId(letterId: string): string {
  return `${letterId}-postal-open`;
}
```

- [ ] **Step 5: Integrate postal progress into app state settlement**

Modify `src/app/app-state.ts`:

```ts
import { settlePostalProgress } from "./postal-progress-service.js";
```

Inside `settleAppState`, keep wallet behavior, then apply:

```ts
  const postalSettlement = settlePostalProgress(nextState, now);

  return {
    state: postalSettlement.state,
    changed:
      settlement.balanceFen !== state.wallet.balanceFen ||
      settledAtIso !== state.wallet.lastSettledAtIso ||
      settlement.entries.length > 0 ||
      postalSettlement.changed
  };
```

When `now.getTime() <= lastSettledAt.getTime()`, do not return early before postal progress. Instead clone the state, skip wallet entries, call `settlePostalProgress`, and return its result. This preserves postal advancement even if wallet was already settled.

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
npm test -- src/app/mailbox-service.test.ts src/app/app-state.test.ts src/app/postal-progress-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/mailbox-service.ts src/app/mailbox-service.test.ts src/app/app-state.ts src/app/app-state.test.ts
git commit -m "feat(app): 接入信件送达与拆阅结算"
```

---

### Task 4: AppModel Mailbox And Archive View Model

**Worker ownership:**

- Modify: `src/app/app-model.ts`
- Modify: `src/app/app-model.test.ts`
- Do not edit Vue files.

- [ ] **Step 1: Write failing AppModel tests**

Append tests to `src/app/app-model.test.ts`:

```ts
it("separates pending incoming letters without exposing their contents", () => {
  const state = createDefaultAppState();
  state.letters.push({
    id: "letter-incoming-waiting",
    senderId: "member-lan",
    recipientId: "member-zhou",
    subject: "未到来信",
    state: "in_transit",
    sentAtIso: "2026-05-23T02:00:00.000Z",
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: false,
    excerpt: "这句不应提前露出。",
    body: "正文也不能提前露出。"
  });

  const model = buildAppModel(new Date("2026-05-27T04:00:00.000Z"), state);
  const waiting = model.mailbox.pendingIncomingLetters.find((letter) => letter.id === "letter-incoming-waiting");

  expect(waiting).toMatchObject({
    state: "in_transit",
    excerpt: "信尚在路上，未到拆阅时。",
    actionText: "尚未投递",
    availabilityText: "尚未投递"
  });
});

it("summarizes postal records for the archive", () => {
  const state = createDefaultAppState();
  state.postalRecords.push({
    id: "letter-to-lan-0521-extra",
    letterId: "letter-to-lan-0521",
    atIso: "2026-05-23T05:00:00.000Z",
    text: "一九六〇年五月二十三日，途中经转。"
  });

  const model = buildAppModel(now, state);
  const letter = model.archive.letters.find((candidate) => candidate.id === "letter-to-lan-0521");

  expect(letter?.latestRecordText).toBe("一九六〇年五月二十三日，途中经转。");
  expect(letter?.recordItems.at(-1)).toEqual({
    atText: "一九六〇年五月二十三日",
    text: "一九六〇年五月二十三日，途中经转。"
  });
});

it("does not count returned or archived outgoing letters as in transit", () => {
  const state = createDefaultAppState();
  const outgoing = state.letters.find((letter) => letter.id === "letter-to-lan-0521");

  if (outgoing === undefined) {
    throw new Error("Missing outgoing seed letter");
  }

  outgoing.state = "returned";

  const model = buildAppModel(now, state);

  expect(model.today.inTransitCount).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/app/app-model.test.ts
```

Expected: FAIL because model fields are missing or counts are wrong.

- [ ] **Step 3: Implement AppModel changes**

In `src/app/app-model.ts`:

- Add `state`, `actionText`, `availabilityText`, `latestRecordText`, `recordItems`.
- Add `pendingIncomingLetters` to `MailboxModel`.
- Keep `arrivedLetters` for compatibility.
- Add helper predicates:

```ts
const outgoingInProgressStates = new Set<LetterState>(["posted", "accepted", "in_transit", "delayed", "misrouted", "lost", "found"]);
const incomingPendingStates = new Set<LetterState>(["posted", "accepted", "in_transit", "delayed", "misrouted", "lost", "found"]);

function canExposeLetterExcerpt(letter: PersistedLetter, currentMemberIdValue: string): boolean {
  return letter.senderId === currentMemberIdValue || letter.state === "arrived" || letter.state === "opened" || letter.state === "archived";
}
```

- Derive pending incoming letters:

```ts
const arrivedLetters = letterSummaries.filter((letter) => letter.canOpen);
const pendingIncomingLetters = letterSummaries.filter(
  (letter) => letter.directionText === "收进" && incomingPendingStates.has(letter.state)
);
```

- Sort archive by latest record time:

```ts
const archiveLetters = letterSummaries
  .slice()
  .sort((left, right) => Date.parse(right.latestRecordAtIso) - Date.parse(left.latestRecordAtIso));
```

If adding `latestRecordAtIso` as internal-only is cleaner, keep it off the exported interface by sorting before mapping or include it as a string only if tests use it.

- For action and availability text, implement:

```ts
function formatLetterActionText(state: LetterState, canOpen: boolean): string {
  if (canOpen) return "拆阅";
  if (state === "delayed") return "邮路耽搁，尚不能拆";
  if (state === "misrouted") return "错分改投，尚不能拆";
  if (state === "lost") return "邮局查找中";
  if (state === "found") return "已找回，候送达";
  if (state === "returned") return "已退回，不可拆";
  if (state === "opened") return "已拆";
  return "尚未投递";
}
```

- Build `recordItems` from sorted postal records with `formatEraDate(new Date(record.atIso))`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/app/app-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app-model.ts src/app/app-model.test.ts
git commit -m "feat(app): 扩展信箱档案视图模型"
```

---

### Task 5: Mailbox UI And App Wiring

**Worker ownership:**

- Modify: `src/App.vue`
- Modify: `src/app/pages/MailboxArchivePage.vue`
- Do not edit domain or service files unless a compile error exposes an integration mismatch.

- [ ] **Step 1: Update page events and layout**

Modify `src/app/pages/MailboxArchivePage.vue`:

```ts
const emit = defineEmits<{
  (event: "open-letter", letterId: string): void;
}>();

function openLetter(letterId: string): void {
  emit("open-letter", letterId);
}
```

In template:

- Left column:
  - section “今日信箱” with `model.mailbox.arrivedLetters`.
  - section “路上信札” with `model.mailbox.pendingIncomingLetters`.
- Right column:
  - section “旧信匣 / 邮政档案” with `model.archive.letters`.
  - each card shows `letter.latestRecordText`.
  - `<details>` lists `letter.recordItems`.

Button pattern:

```vue
<var-button
  class="mt-4"
  size="small"
  color="#253b5b"
  text-color="#f7f0df"
  :disabled="!letter.canOpen"
  @click="openLetter(letter.id)"
>
  {{ letter.actionText }}
</var-button>
```

For pending incoming letters, show `letter.availabilityText` and do not show `letter.excerpt`.

- [ ] **Step 2: Wire App.vue**

Modify `src/App.vue` imports:

```ts
import { openLetter } from "./app/mailbox-service.js";
```

Add:

```ts
function settleAndPersist(now = new Date()): void {
  const settlement = settleAppState(appState.value, now);

  if (settlement.changed) {
    persistState(settlement.state);
  }
}

function handleNavClick(key: NavKey): void {
  activeKey.value = key;

  if (key === "mailbox") {
    settleAndPersist();
  }
}

function handleOpenLetter(letterId: string): void {
  const result = openLetter(appState.value, letterId, new Date());

  if (!result.ok) {
    noticeText.value = result.reason;
    return;
  }

  persistState(result.state);
  noticeText.value = "信已拆阅，归入旧信匣。";
}
```

Change nav click:

```vue
@click="handleNavClick(item.key)"
```

Pass event:

```vue
@open-letter="handleOpenLetter"
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test -- src/app/mailbox-service.test.ts src/app/postal-progress-service.test.ts src/app/app-model.test.ts src/app/app-state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/app/pages/MailboxArchivePage.vue
git commit -m "feat(app): 接入信箱拆阅界面"
```

---

### Task 6: Documentation, Dashboard, Verification

**Worker ownership:**

- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Run verification.

- [ ] **Step 1: Update roadmap**

In `docs/pinganpi-roadmap.md`:

- Change current baseline to “已完成阶段 9 信箱真实时间送达推进”。
- Add Stage 9 completed section:

```md
### 阶段 9：信箱与真实时间送达推进

状态：本地真实时间送达闭环已完成。

已实现：

- 基于真实投寄时间和传递窗口推进 `in_transit -> arrived`。
- App 启动、进入信箱和拆阅前会结算邮政状态。
- 到达前服务层拒绝拆阅。
- 拆阅成功后写入邮政记录并进入 `opened`。
- 信箱页区分今日信箱、路上信札和旧信匣 / 邮政档案。
- 未到达收进信件不泄露正文摘要。
```

- Remove Stage 9 items from “尚未完成” and move next recommendation to Stage 10.

- [ ] **Step 2: Update dashboard**

In `docs/pinganpi-roadmap-dashboard.html`:

- Current badge: `当前：阶段 9`
- Baseline: `阶段 9 完成`
- Progress: `9 / 10` and `90%`
- Mark phase 9 as done and phase 10 as next.
- Verification count should match final `npm test` output.
- Next recommendation: `云端同步`

- [ ] **Step 3: Full verification**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

Expected:

- `git diff --check`: no output, exit 0.
- `npm test`: all test files pass.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0; existing Varlet chunk size warning is acceptable.

- [ ] **Step 4: Browser smoke test**

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:<port>/
```

Smoke path:

- Go to `信箱`.
- Confirm “今日信箱”“路上信札”“旧信匣 / 邮政档案” are visible.
- Confirm route records can expand.
- If a ready incoming letter exists, click `拆阅`.
- Confirm notice says `信已拆阅，归入旧信匣。`
- Confirm letter moves from ready state to `已拆`.
- Open `docs/pinganpi-roadmap-dashboard.html`.
- Confirm dashboard says stage 9.

- [ ] **Step 5: Final review**

Dispatch final review subagent with:

```text
Review phase 9 mailbox delivery progress implementation. Check service-layer open restrictions, postal progress idempotency, UI non-disclosure of pending incoming content, AppState settlement integration, docs/dashboard consistency, and tests.
```

Fix any `CHANGES_REQUESTED` findings and re-run relevant verification.

- [ ] **Step 6: Commit docs and final fixes**

```bash
git add docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html
git commit -m "docs: 更新真实送达推进进度"
```

If Task 6 includes code fixes from review, use a `fix(app): ...` commit before the docs commit or include the docs in the same final commit if the fix and documentation are inseparable.

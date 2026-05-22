# Pinganpi Domain Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable TypeScript domain core for 《平安批》: 66-year time display, old-currency money rules, deterministic scribe attendance, wallet settlement, postal delivery estimation, and letter state transitions.

**Architecture:** This first phase deliberately avoids choosing the final mobile app shell. It creates a small TypeScript package with pure domain modules and Vitest coverage so the logic can later be reused from iOS/Android UI, CloudBase functions, or local mock mode. Each module is pure and has no browser, server, or cloud dependency.

**Tech Stack:** TypeScript, Vitest, Node.js ESM, npm scripts.

---

## Scope Check

The full spec covers product UX, mobile app delivery, CloudBase/backend choices, templates, notifications, and archival UI. This plan implements only the reusable domain foundation. Later plans should cover the mobile shell, template content, persistence/cloud integration, and UI flows.

## File Structure

- `package.json`: npm scripts and dev dependencies.
- `tsconfig.json`: strict TypeScript configuration.
- `vitest.config.ts`: Vitest configuration.
- `src/domain/time.ts`: reality time to 66-years-earlier era time helpers.
- `src/domain/money.ts`: fen/yuan-jiao-fen formatting and arithmetic helpers.
- `src/domain/scribes.ts`: scribe model and deterministic daily attendance.
- `src/domain/wallet.ts`: wallet settlement and ledger entries.
- `src/domain/postal.ts`: delivery estimate and letter state transitions.
- `src/domain/index.ts`: public exports.
- `src/domain/*.test.ts`: focused tests for each domain module.

## Task 1: Project Test Harness

**Files:**
- Create: `/Users/zhujunjie/code/pinganpi/package.json`
- Create: `/Users/zhujunjie/code/pinganpi/tsconfig.json`
- Create: `/Users/zhujunjie/code/pinganpi/vitest.config.ts`
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`

- [ ] **Step 1: Create npm package metadata**

Create `/Users/zhujunjie/code/pinganpi/package.json`:

```json
{
  "name": "pinganpi",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `/Users/zhujunjie/code/pinganpi/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create Vitest config**

Create `/Users/zhujunjie/code/pinganpi/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globals: false
  }
});
```

- [ ] **Step 4: Create initial domain barrel**

Create `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`:

```ts
export {};
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 6: Run baseline checks**

Run:

```bash
npm run typecheck
```

Expected: PASS, no TypeScript errors.

Run:

```bash
npm test
```

Expected: PASS with no test files or zero tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/domain/index.ts
git commit -m "chore: initialize TypeScript domain package"
```

## Task 2: Era Time Helpers

**Files:**
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/time.ts`
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/time.test.ts`
- Modify: `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`

- [ ] **Step 1: Write failing tests**

Create `/Users/zhujunjie/code/pinganpi/src/domain/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatEraDate, formatPresentCorrespondence, toEraDate } from "./time.js";

describe("era time helpers", () => {
  it("maps real dates to dates 66 years earlier", () => {
    const realDate = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

    const eraDate = toEraDate(realDate);

    expect(eraDate.getUTCFullYear()).toBe(1960);
    expect(eraDate.getUTCMonth()).toBe(4);
    expect(eraDate.getUTCDate()).toBe(23);
  });

  it("formats the 1960-facing date in Chinese numerals", () => {
    const realDate = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

    expect(formatEraDate(realDate)).toBe("一九六〇年五月二十三日");
  });

  it("formats the hidden real-world correspondence label", () => {
    const realDate = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

    expect(formatPresentCorrespondence(realDate)).toBe("今时对应：2026 年 5 月 23 日");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/time.test.ts
```

Expected: FAIL with an import error for `./time.js`.

- [ ] **Step 3: Implement time helpers**

Create `/Users/zhujunjie/code/pinganpi/src/domain/time.ts`:

```ts
const YEAR_OFFSET = 66;
const YEAR_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const MONTH_NAMES = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月"
] as const;

export function toEraDate(realDate: Date): Date {
  return new Date(Date.UTC(
    realDate.getUTCFullYear() - YEAR_OFFSET,
    realDate.getUTCMonth(),
    realDate.getUTCDate(),
    realDate.getUTCHours(),
    realDate.getUTCMinutes(),
    realDate.getUTCSeconds(),
    realDate.getUTCMilliseconds()
  ));
}

export function formatEraDate(realDate: Date): string {
  const eraDate = toEraDate(realDate);
  const year = String(eraDate.getUTCFullYear())
    .split("")
    .map((digit) => YEAR_DIGITS[Number(digit)])
    .join("");
  const month = MONTH_NAMES[eraDate.getUTCMonth()];

  if (month === undefined) {
    throw new Error(`Invalid month: ${eraDate.getUTCMonth()}`);
  }

  return `${year}年${month}${formatChineseDay(eraDate.getUTCDate())}`;
}

export function formatPresentCorrespondence(realDate: Date): string {
  return `今时对应：${realDate.getUTCFullYear()} 年 ${realDate.getUTCMonth() + 1} 月 ${realDate.getUTCDate()} 日`;
}

function formatChineseDay(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }

  if (day <= 10) {
    return `${YEAR_DIGITS[day]}日`;
  }

  if (day < 20) {
    return `十${YEAR_DIGITS[day - 10]}日`;
  }

  if (day === 20) {
    return "二十日";
  }

  if (day < 30) {
    return `二十${YEAR_DIGITS[day - 20]}日`;
  }

  if (day === 30) {
    return "三十日";
  }

  return "三十一日";
}
```

- [ ] **Step 4: Export time helpers**

Modify `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`:

```ts
export * from "./time.js";
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/domain/time.test.ts
```

Expected: PASS.

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/time.ts src/domain/time.test.ts src/domain/index.ts
git commit -m "feat: add era time helpers"
```

## Task 3: Old Currency Helpers

**Files:**
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/money.ts`
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/money.test.ts`
- Modify: `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`

- [ ] **Step 1: Write failing tests**

Create `/Users/zhujunjie/code/pinganpi/src/domain/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addFen, formatFen, subtractFen } from "./money.js";

describe("old currency helpers", () => {
  it("formats fen as yuan, jiao, and fen", () => {
    expect(formatFen(0)).toBe("0 分");
    expect(formatFen(8)).toBe("8 分");
    expect(formatFen(12)).toBe("1 角 2 分");
    expect(formatFen(120)).toBe("1 元 2 角");
    expect(formatFen(108)).toBe("1 元 8 分");
  });

  it("adds and subtracts fen without allowing negative balances", () => {
    expect(addFen(12, 8)).toBe(20);
    expect(subtractFen(12, 8)).toBe(4);
    expect(() => subtractFen(5, 8)).toThrow("钱匣不足");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/money.test.ts
```

Expected: FAIL with an import error for `./money.js`.

- [ ] **Step 3: Implement money helpers**

Create `/Users/zhujunjie/code/pinganpi/src/domain/money.ts`:

```ts
export type Fen = number;

export function formatFen(totalFen: Fen): string {
  assertFen(totalFen);

  if (totalFen === 0) {
    return "0 分";
  }

  const yuan = Math.floor(totalFen / 100);
  const jiao = Math.floor((totalFen % 100) / 10);
  const fen = totalFen % 10;
  const parts: string[] = [];

  if (yuan > 0) {
    parts.push(`${yuan} 元`);
  }

  if (jiao > 0) {
    parts.push(`${jiao} 角`);
  }

  if (fen > 0) {
    parts.push(`${fen} 分`);
  }

  return parts.join(" ");
}

export function addFen(left: Fen, right: Fen): Fen {
  assertFen(left);
  assertFen(right);
  return left + right;
}

export function subtractFen(balance: Fen, cost: Fen): Fen {
  assertFen(balance);
  assertFen(cost);

  if (balance < cost) {
    throw new Error(`钱匣不足：需 ${formatFen(cost)}，现余 ${formatFen(balance)}`);
  }

  return balance - cost;
}

function assertFen(value: Fen): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid fen amount: ${value}`);
  }
}
```

- [ ] **Step 4: Export money helpers**

Modify `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`:

```ts
export * from "./time.js";
export * from "./money.js";
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/domain/money.test.ts
```

Expected: PASS.

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts src/domain/index.ts
git commit -m "feat: add old currency helpers"
```

## Task 4: Deterministic Scribe Attendance

**Files:**
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/scribes.ts`
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/scribes.test.ts`
- Modify: `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`

- [ ] **Step 1: Write failing tests**

Create `/Users/zhujunjie/code/pinganpi/src/domain/scribes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getDailyAttendance, type Scribe } from "./scribes.js";

const scribes: Scribe[] = [
  {
    id: "xu-guangzhou",
    name: "许先生",
    city: "广州",
    style: "street",
    feeFen: 3,
    attendanceRate: 1,
    specialties: ["daily", "longing"]
  },
  {
    id: "huang-guangzhou",
    name: "黄老先生",
    city: "广州",
    style: "old-scholar",
    feeFen: 8,
    attendanceRate: 0,
    specialties: ["formal"]
  },
  {
    id: "lin-shanghai",
    name: "林先生",
    city: "上海",
    style: "schoolmaster",
    feeFen: 5,
    attendanceRate: 1,
    specialties: ["safe-report"]
  }
];

describe("scribe attendance", () => {
  it("filters by city and attendance rate", () => {
    const today = new Date(Date.UTC(2026, 4, 23));

    const attendance = getDailyAttendance({
      city: "广州",
      date: today,
      scribes
    });

    expect(attendance.map((scribe) => scribe.id)).toEqual(["xu-guangzhou"]);
  });

  it("is deterministic for the same city and date", () => {
    const today = new Date(Date.UTC(2026, 4, 23));

    expect(getDailyAttendance({ city: "上海", date: today, scribes })).toEqual(
      getDailyAttendance({ city: "上海", date: today, scribes })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/scribes.test.ts
```

Expected: FAIL with an import error for `./scribes.js`.

- [ ] **Step 3: Implement scribe attendance**

Create `/Users/zhujunjie/code/pinganpi/src/domain/scribes.ts`:

```ts
import type { Fen } from "./money.js";

export type ScribeStyle = "street" | "old-scholar" | "schoolmaster" | "clerk";

export interface Scribe {
  id: string;
  name: string;
  city: string;
  style: ScribeStyle;
  feeFen: Fen;
  attendanceRate: number;
  specialties: string[];
}

export interface DailyAttendanceInput {
  city: string;
  date: Date;
  scribes: Scribe[];
}

export function getDailyAttendance(input: DailyAttendanceInput): Scribe[] {
  return input.scribes
    .filter((scribe) => scribe.city === input.city)
    .filter((scribe) => isScribePresent(scribe, input.date))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function isScribePresent(scribe: Scribe, date: Date): boolean {
  if (scribe.attendanceRate <= 0) {
    return false;
  }

  if (scribe.attendanceRate >= 1) {
    return true;
  }

  const roll = deterministicRoll(`${scribe.id}:${formatDateKey(date)}`);
  return roll < scribe.attendanceRate;
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

function deterministicRoll(seed: string): number {
  let hash = 2166136261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967296;
}
```

- [ ] **Step 4: Export scribe helpers**

Modify `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`:

```ts
export * from "./time.js";
export * from "./money.js";
export * from "./scribes.js";
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/domain/scribes.test.ts
```

Expected: PASS.

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/scribes.ts src/domain/scribes.test.ts src/domain/index.ts
git commit -m "feat: add deterministic scribe attendance"
```

## Task 5: Wallet Settlement

**Files:**
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/wallet.ts`
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/wallet.test.ts`
- Modify: `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`

- [ ] **Step 1: Write failing tests**

Create `/Users/zhujunjie/code/pinganpi/src/domain/wallet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { settleWallet } from "./wallet.js";

describe("wallet settlement", () => {
  it("adds monthly income and deducts daily living cost", () => {
    const result = settleWallet({
      balanceFen: 20,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 5,
      lastSettledAt: new Date(Date.UTC(2026, 4, 1)),
      now: new Date(Date.UTC(2026, 4, 4))
    });

    expect(result.balanceFen).toBe(125);
    expect(result.entries).toEqual([
      { kind: "income", amountFen: 120, note: "本月余款入账" },
      { kind: "living_cost", amountFen: -15, note: "饭食杂用三日" }
    ]);
  });

  it("does not allow natural settlement to go below zero", () => {
    const result = settleWallet({
      balanceFen: 4,
      monthlyIncomeFen: 0,
      dailyLivingCostFen: 5,
      lastSettledAt: new Date(Date.UTC(2026, 4, 1)),
      now: new Date(Date.UTC(2026, 4, 2))
    });

    expect(result.balanceFen).toBe(0);
    expect(result.entries).toEqual([
      { kind: "living_cost", amountFen: -4, note: "饭食杂用一日" }
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/wallet.test.ts
```

Expected: FAIL with an import error for `./wallet.js`.

- [ ] **Step 3: Implement wallet settlement**

Create `/Users/zhujunjie/code/pinganpi/src/domain/wallet.ts`:

```ts
import type { Fen } from "./money.js";

export type LedgerKind = "income" | "living_cost";

export interface LedgerEntryDraft {
  kind: LedgerKind;
  amountFen: number;
  note: string;
}

export interface WalletSettlementInput {
  balanceFen: Fen;
  monthlyIncomeFen: Fen;
  dailyLivingCostFen: Fen;
  lastSettledAt: Date;
  now: Date;
}

export interface WalletSettlementResult {
  balanceFen: Fen;
  settledAt: Date;
  entries: LedgerEntryDraft[];
}

export function settleWallet(input: WalletSettlementInput): WalletSettlementResult {
  const elapsedDays = fullUtcDaysBetween(input.lastSettledAt, input.now);
  const entries: LedgerEntryDraft[] = [];
  let balanceFen = input.balanceFen;

  if (crossedMonthBoundary(input.lastSettledAt, input.now) && input.monthlyIncomeFen > 0) {
    balanceFen += input.monthlyIncomeFen;
    entries.push({
      kind: "income",
      amountFen: input.monthlyIncomeFen,
      note: "本月余款入账"
    });
  }

  if (elapsedDays > 0 && input.dailyLivingCostFen > 0) {
    const requestedCost = elapsedDays * input.dailyLivingCostFen;
    const actualCost = Math.min(balanceFen, requestedCost);

    if (actualCost > 0) {
      balanceFen -= actualCost;
      entries.push({
        kind: "living_cost",
        amountFen: -actualCost,
        note: `饭食杂用${formatDayCount(elapsedDays)}`
      });
    }
  }

  return {
    balanceFen,
    settledAt: input.now,
    entries
  };
}

function fullUtcDaysBetween(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.floor((endDay - startDay) / 86_400_000));
}

function crossedMonthBoundary(start: Date, end: Date): boolean {
  return start.getUTCFullYear() !== end.getUTCFullYear() || start.getUTCMonth() !== end.getUTCMonth();
}

function formatDayCount(days: number): string {
  if (days === 1) {
    return "一日";
  }

  if (days === 2) {
    return "二日";
  }

  if (days === 3) {
    return "三日";
  }

  return `${days}日`;
}
```

- [ ] **Step 4: Export wallet helpers**

Modify `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`:

```ts
export * from "./time.js";
export * from "./money.js";
export * from "./scribes.js";
export * from "./wallet.js";
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/domain/wallet.test.ts
```

Expected: PASS.

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/wallet.ts src/domain/wallet.test.ts src/domain/index.ts
git commit -m "feat: add wallet settlement"
```

## Task 6: Postal Estimate and Letter States

**Files:**
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/postal.ts`
- Create: `/Users/zhujunjie/code/pinganpi/src/domain/postal.test.ts`
- Modify: `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`

- [ ] **Step 1: Write failing tests**

Create `/Users/zhujunjie/code/pinganpi/src/domain/postal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  calculatePostage,
  estimateDeliveryWindow,
  nextLetterState,
  type LetterState
} from "./postal.js";

describe("postal rules", () => {
  it("calculates plain local and non-local postage", () => {
    expect(calculatePostage({ local: true, registered: false, hasPhoto: false })).toBe(4);
    expect(calculatePostage({ local: false, registered: false, hasPhoto: false })).toBe(8);
  });

  it("adds registered and photo costs", () => {
    expect(calculatePostage({ local: false, registered: true, hasPhoto: true })).toBe(36);
  });

  it("estimates old-post delivery windows from distance", () => {
    expect(estimateDeliveryWindow(10)).toEqual({ minDays: 1, maxDays: 2, routeClass: "local" });
    expect(estimateDeliveryWindow(1500)).toEqual({ minDays: 7, maxDays: 12, routeClass: "cross-region" });
  });

  it("allows only valid letter state transitions", () => {
    const posted: LetterState = nextLetterState("sealed", "post");
    expect(posted).toBe("posted");
    expect(() => nextLetterState("opened", "post")).toThrow("不能从 opened 执行 post");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/domain/postal.test.ts
```

Expected: FAIL with an import error for `./postal.js`.

- [ ] **Step 3: Implement postal rules**

Create `/Users/zhujunjie/code/pinganpi/src/domain/postal.ts`:

```ts
import type { Fen } from "./money.js";

export type RouteClass = "local" | "province" | "railway" | "cross-region" | "remote" | "oversea";

export interface DeliveryWindow {
  minDays: number;
  maxDays: number;
  routeClass: RouteClass;
}

export interface PostageInput {
  local: boolean;
  registered: boolean;
  hasPhoto: boolean;
}

export type LetterState =
  | "draft"
  | "scribed"
  | "revised"
  | "sealed"
  | "posted"
  | "accepted"
  | "in_transit"
  | "delayed"
  | "misrouted"
  | "lost"
  | "found"
  | "returned"
  | "arrived"
  | "opened"
  | "archived";

export type LetterEvent =
  | "scribe"
  | "revise"
  | "seal"
  | "post"
  | "accept"
  | "send"
  | "delay"
  | "misroute"
  | "lose"
  | "find"
  | "return"
  | "arrive"
  | "open"
  | "archive";

const TRANSITIONS: Record<LetterState, Partial<Record<LetterEvent, LetterState>>> = {
  draft: { scribe: "scribed", revise: "revised", seal: "sealed" },
  scribed: { revise: "revised", seal: "sealed" },
  revised: { seal: "sealed" },
  sealed: { post: "posted" },
  posted: { accept: "accepted", return: "returned" },
  accepted: { send: "in_transit", delay: "delayed", return: "returned" },
  in_transit: { delay: "delayed", misroute: "misrouted", lose: "lost", arrive: "arrived" },
  delayed: { send: "in_transit", arrive: "arrived", lose: "lost", return: "returned" },
  misrouted: { send: "in_transit", delay: "delayed", lose: "lost", return: "returned" },
  lost: { find: "found", return: "returned" },
  found: { send: "in_transit", return: "returned", arrive: "arrived" },
  returned: { archive: "archived" },
  arrived: { open: "opened" },
  opened: { archive: "archived" },
  archived: {}
};

export function calculatePostage(input: PostageInput): Fen {
  const base = input.local ? 4 : 8;
  const registeredFee = input.registered ? 8 : 0;
  const photoFee = input.hasPhoto ? 20 : 0;
  return base + registeredFee + photoFee;
}

export function estimateDeliveryWindow(distanceKm: number): DeliveryWindow {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error(`Invalid distance: ${distanceKm}`);
  }

  if (distanceKm <= 30) {
    return { minDays: 1, maxDays: 2, routeClass: "local" };
  }

  if (distanceKm <= 300) {
    return { minDays: 2, maxDays: 4, routeClass: "province" };
  }

  if (distanceKm <= 900) {
    return { minDays: 4, maxDays: 7, routeClass: "railway" };
  }

  if (distanceKm <= 1800) {
    return { minDays: 7, maxDays: 12, routeClass: "cross-region" };
  }

  if (distanceKm <= 3500) {
    return { minDays: 10, maxDays: 20, routeClass: "remote" };
  }

  return { minDays: 20, maxDays: 45, routeClass: "oversea" };
}

export function nextLetterState(current: LetterState, event: LetterEvent): LetterState {
  const next = TRANSITIONS[current][event];

  if (next === undefined) {
    throw new Error(`不能从 ${current} 执行 ${event}`);
  }

  return next;
}
```

- [ ] **Step 4: Export postal helpers**

Modify `/Users/zhujunjie/code/pinganpi/src/domain/index.ts`:

```ts
export * from "./time.js";
export * from "./money.js";
export * from "./scribes.js";
export * from "./wallet.js";
export * from "./postal.js";
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/domain/postal.test.ts
```

Expected: PASS.

Run:

```bash
npm test
```

Expected: PASS for all test files.

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/postal.ts src/domain/postal.test.ts src/domain/index.ts
git commit -m "feat: add postal domain rules"
```

## Self-Review

Spec coverage in this plan:

- 66-year time system: Task 2.
- Old currency and postal cost base: Tasks 3 and 6.
- Daily scribe attendance: Task 4.
- Wallet natural settlement: Task 5.
- Postal delivery windows and letter states: Task 6.

Intentional gaps for later plans:

- Mobile app shell and UI.
- Template content library.
- Persistence and CloudBase/local mock integration.
- Notifications.
- Photo upload and visual aging.
- Full letter creation workflow.

Placeholder scan: no placeholder tasks remain. Every code-writing step includes complete file content for that step.

Type consistency: `Fen`, `Scribe`, `LetterState`, and helper names are introduced before use and exported through `src/domain/index.ts`.


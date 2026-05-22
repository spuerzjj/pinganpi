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
  assertFen(input.balanceFen);
  assertFen(input.monthlyIncomeFen);
  assertFen(input.dailyLivingCostFen);

  const entries: LedgerEntryDraft[] = [];
  let balanceFen = input.balanceFen;
  const startDay = utcDayStart(input.lastSettledAt);
  const endDay = utcDayStart(input.now);
  let contiguousLivingCostDays = 0;

  for (let day = startDay; day < endDay; day += 86_400_000) {
    if (isMonthlyIncomeBoundary(day, input.lastSettledAt) && input.monthlyIncomeFen > 0) {
      balanceFen = addFen(balanceFen, input.monthlyIncomeFen);
      entries.push({
        kind: "income",
        amountFen: input.monthlyIncomeFen,
        note: "本月余款入账"
      });
      contiguousLivingCostDays = 0;
    }

    const deductedFen = deductLivingCost(balanceFen, input.dailyLivingCostFen);

    if (deductedFen > 0) {
      balanceFen -= deductedFen;
      assertFen(balanceFen);
      contiguousLivingCostDays += 1;
      appendLivingCost(entries, deductedFen, contiguousLivingCostDays);
    }
  }

  return {
    balanceFen,
    settledAt: input.now,
    entries
  };
}

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isMonthlyIncomeBoundary(day: number, lastSettledAt: Date): boolean {
  const date = new Date(day);

  if (date.getUTCDate() !== 1) {
    return false;
  }

  return day > lastSettledAt.getTime() || day === lastSettledAt.getTime();
}

function deductLivingCost(balanceFen: Fen, dailyLivingCostFen: Fen): Fen {
  if (dailyLivingCostFen <= 0 || balanceFen <= 0) {
    return 0;
  }

  const actualCost = Math.min(balanceFen, dailyLivingCostFen);
  assertFen(actualCost);
  return actualCost;
}

function appendLivingCost(entries: LedgerEntryDraft[], amountFen: Fen, contiguousDays: number): void {
  const lastEntry = entries.at(-1);

  if (lastEntry?.kind === "living_cost") {
    const nextAmount = Math.abs(lastEntry.amountFen) + amountFen;
    assertFen(nextAmount);
    lastEntry.amountFen = -nextAmount;
    lastEntry.note = `饭食杂用${formatDayCount(contiguousDays)}`;
    return;
  }

  entries.push({
    kind: "living_cost",
    amountFen: -amountFen,
    note: "饭食杂用一日"
  });
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

function addFen(left: Fen, right: Fen): Fen {
  const result = left + right;
  assertFen(result);
  return result;
}

function assertFen(value: number): asserts value is Fen {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid fen amount: ${value}`);
  }
}

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

  const elapsedDays = fullUtcDaysBetween(input.lastSettledAt, input.now);
  const entries: LedgerEntryDraft[] = [];
  let balanceFen = input.balanceFen;

  if (containsMonthlyIncomeBoundary(input.lastSettledAt, input.now) && input.monthlyIncomeFen > 0) {
    balanceFen = addFen(balanceFen, input.monthlyIncomeFen);
    entries.push({
      kind: "income",
      amountFen: input.monthlyIncomeFen,
      note: "本月余款入账"
    });
  }

  if (elapsedDays > 0 && input.dailyLivingCostFen > 0) {
    const requestedCost = multiplyFen(input.dailyLivingCostFen, elapsedDays);
    const actualCost = Math.min(balanceFen, requestedCost);

    if (actualCost > 0) {
      assertFen(actualCost);
      balanceFen -= actualCost;
      assertFen(balanceFen);
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

function containsMonthlyIncomeBoundary(start: Date, end: Date): boolean {
  if (end <= start) {
    return false;
  }

  const firstBoundary = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
  const candidateBoundary =
    start.getTime() <= firstBoundary
      ? firstBoundary
      : Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);

  return start.getTime() <= candidateBoundary && candidateBoundary < end.getTime();
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

function multiplyFen(amountFen: Fen, multiplier: number): Fen {
  const result = amountFen * multiplier;
  assertFen(result);
  return result;
}

function assertFen(value: number): asserts value is Fen {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid fen amount: ${value}`);
  }
}

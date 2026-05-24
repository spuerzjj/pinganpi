import { describe, expect, it } from "vitest";
import { settleWallet } from "./wallet.js";

describe("wallet settlement", () => {
  it("adds monthly income and deducts daily living cost", () => {
    const result = settleWallet({
      balanceFen: 20,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 5,
      lastSettledAt: chinaDate(2026, 4, 30, 23, 59),
      now: chinaDate(2026, 5, 3, 0, 1)
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
      lastSettledAt: chinaDate(2026, 5, 1, 23, 59),
      now: chinaDate(2026, 5, 2, 0, 1)
    });

    expect(result.balanceFen).toBe(0);
    expect(result.entries).toEqual([
      { kind: "living_cost", amountFen: -4, note: "饭食杂用一日" }
    ]);
  });

  it("does not add income for a second settlement within the first day of the month", () => {
    const result = settleWallet({
      balanceFen: 20,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 5,
      lastSettledAt: new Date(Date.UTC(2026, 4, 1, 8)),
      now: new Date(Date.UTC(2026, 4, 1, 12))
    });

    expect(result.balanceFen).toBe(20);
    expect(result.entries).toEqual([]);
  });

  it("does not add income for settlement inside a month after the first day", () => {
    const result = settleWallet({
      balanceFen: 20,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 0,
      lastSettledAt: new Date(Date.UTC(2026, 4, 10)),
      now: new Date(Date.UTC(2026, 4, 12))
    });

    expect(result.balanceFen).toBe(20);
    expect(result.entries).toEqual([]);
  });

  it("adds income once when settlement crosses a China month start", () => {
    const result = settleWallet({
      balanceFen: 20,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 0,
      lastSettledAt: chinaDate(2026, 4, 30, 23, 59),
      now: chinaDate(2026, 5, 1, 0, 1)
    });

    expect(result.balanceFen).toBe(140);
    expect(result.entries).toEqual([
      { kind: "income", amountFen: 120, note: "本月余款入账" }
    ]);
  });

  it("settles month-start income when opened later on the China month-start day", () => {
    const first = settleWallet({
      balanceFen: 20,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 0,
      lastSettledAt: new Date(Date.UTC(2026, 3, 30, 0)),
      now: new Date(Date.UTC(2026, 4, 1, 12))
    });

    expect(first.balanceFen).toBe(140);
    expect(first.entries).toEqual([
      { kind: "income", amountFen: 120, note: "本月余款入账" }
    ]);

    const second = settleWallet({
      balanceFen: first.balanceFen,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 0,
      lastSettledAt: first.settledAt,
      now: new Date(Date.UTC(2026, 4, 2, 0))
    });

    expect(second.balanceFen).toBe(140);
    expect(second.entries).toEqual([]);
  });

  it("settles daily living cost at China local midnight", () => {
    const result = settleWallet({
      balanceFen: 10,
      monthlyIncomeFen: 0,
      dailyLivingCostFen: 5,
      lastSettledAt: new Date(Date.UTC(2026, 4, 22, 15, 30)),
      now: new Date(Date.UTC(2026, 4, 22, 16, 30))
    });

    expect(result.balanceFen).toBe(5);
    expect(result.entries).toEqual([
      { kind: "living_cost", amountFen: -5, note: "饭食杂用一日" }
    ]);
  });

  it("rejects settlement timestamps that move backward", () => {
    expect(() =>
      settleWallet({
        balanceFen: 10,
        monthlyIncomeFen: 0,
        dailyLivingCostFen: 1,
        lastSettledAt: new Date(Date.UTC(2026, 4, 2)),
        now: new Date(Date.UTC(2026, 4, 1))
      })
    ).toThrow("Settlement time cannot move backward");
  });

  it("adds income for each crossed month start", () => {
    const result = settleWallet({
      balanceFen: 0,
      monthlyIncomeFen: 120,
      dailyLivingCostFen: 0,
      lastSettledAt: chinaDate(2026, 4, 30, 23, 59),
      now: chinaDate(2026, 7, 1, 0, 1)
    });

    expect(result.balanceFen).toBe(360);
    expect(result.entries).toEqual([
      { kind: "income", amountFen: 120, note: "本月余款入账" },
      { kind: "income", amountFen: 120, note: "本月余款入账" },
      { kind: "income", amountFen: 120, note: "本月余款入账" }
    ]);
  });

  it("settles living costs and income in calendar order", () => {
    const result = settleWallet({
      balanceFen: 5,
      monthlyIncomeFen: 10,
      dailyLivingCostFen: 8,
      lastSettledAt: chinaDate(2026, 4, 29, 23, 59),
      now: chinaDate(2026, 5, 1, 0, 1)
    });

    expect(result.balanceFen).toBe(2);
    expect(result.entries).toEqual([
      { kind: "living_cost", amountFen: -5, note: "饭食杂用一日" },
      { kind: "income", amountFen: 10, note: "本月余款入账" },
      { kind: "living_cost", amountFen: -8, note: "饭食杂用一日" }
    ]);
  });

  it("rejects unsafe settlement amounts", () => {
    expect(() =>
      settleWallet({
        balanceFen: Number.MAX_SAFE_INTEGER,
        monthlyIncomeFen: 1,
        dailyLivingCostFen: 0,
        lastSettledAt: chinaDate(2026, 4, 30, 23, 59),
        now: chinaDate(2026, 5, 1, 0, 1)
      })
    ).toThrow("Invalid fen amount");
  });
});

function chinaDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
}

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

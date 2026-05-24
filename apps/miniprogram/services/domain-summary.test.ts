import { describe, expect, it } from "vitest";
import { createTodayDomainSummary } from "./domain-summary.js";

describe("miniprogram domain summary", () => {
  it("summarizes shared era date and postage rules for today", () => {
    const summary = createTodayDomainSummary(new Date(Date.UTC(2026, 4, 23, 12, 0, 0)));

    expect(summary).toEqual({
      eraDateText: "一九六〇年五月二十三日",
      presentDateText: "今时对应：2026 年 5 月 23 日",
      localPostageText: "4 分",
      registeredPostageText: "1 角 2 分",
    });
  });
});

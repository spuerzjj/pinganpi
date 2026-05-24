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

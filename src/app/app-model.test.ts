import { describe, expect, it } from "vitest";
import { buildAppModel } from "./app-model.js";

describe("app model", () => {
  const now = new Date("2026-05-23T04:00:00.000Z");

  it("builds the 1960-facing today snapshot from domain time helpers", () => {
    const model = buildAppModel(now);

    expect(model.today.eraDateText).toBe("一九六〇年五月二十三日");
    expect(model.today.presentCorrespondenceText).toBe("今时对应：2026 年 5 月 23 日");
    expect(model.today.inboxCount).toBe(1);
  });

  it("separates present and absent local scribes for the same China-local day", () => {
    const model = buildAppModel(now);

    expect(model.scribeDesk.presentScribes.map((scribe) => scribe.name)).toEqual(["钱守明", "许鹤年"]);
    expect(model.scribeDesk.absentScribes.map((scribe) => scribe.name)).toEqual(["沈竹庵"]);
    expect(model.scribeDesk.preferredScribeStatus).toBe("今日在摊");
  });

  it("settles the wallet and formats the first local writing costs", () => {
    const model = buildAppModel(now);

    expect(model.wallet.balanceText).toBe("2 元 3 角");
    expect(model.wallet.ledgerPreview).toEqual([
      {
        amountText: "-5 分",
        note: "饭食杂用一日"
      }
    ]);
    expect(model.writeLetter.plainPostageText).toBe("8 分");
    expect(model.writeLetter.registeredPostageText).toBe("1 角 6 分");
    expect(model.writeLetter.deliveryWindowText).toBe("约 7 至 12 日");
  });

  it("summarizes letter states without exposing realtime tracking", () => {
    const model = buildAppModel(now);

    expect(model.mailbox.arrivedLetters.map((letter) => letter.id)).toEqual(["letter-from-lan-0520"]);
    expect(model.archive.letters.find((letter) => letter.id === "letter-to-lan-0521")?.statusText).toBe("路上");
    expect(model.archive.letters.find((letter) => letter.id === "letter-from-lan-0512")?.postageText).toBe(
      "1 角 6 分"
    );
  });
});

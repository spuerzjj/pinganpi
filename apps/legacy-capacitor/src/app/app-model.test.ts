import { describe, expect, it } from "vitest";
import { createDefaultAppState, settleAppState } from "./app-state.js";
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

  it("offers handwritten and present scribe choices for writing", () => {
    const model = buildAppModel(now);

    expect(model.writeLetter.defaultScribeId).toBe("scribe-xu");
    expect(model.writeLetter.scribeOptions.map((option) => option.name)).toEqual(["亲笔", "钱守明", "许鹤年"]);
    expect(model.writeLetter.sampleDraftText).toContain("兰卿");
  });

  it("summarizes letter states without exposing realtime tracking", () => {
    const model = buildAppModel(now);

    expect(model.mailbox.arrivedLetters.map((letter) => letter.id)).toEqual(["letter-from-lan-0520"]);
    expect(model.archive.letters.find((letter) => letter.id === "letter-to-lan-0521")?.statusText).toBe("路上");
    expect(model.archive.letters.find((letter) => letter.id === "letter-from-lan-0512")?.postageText).toBe(
      "1 角 6 分"
    );
  });

  it("separates pending incoming letters without exposing their contents", () => {
    const state = createDefaultAppState();
    state.letters.push({
      id: "letter-from-lan-0524",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "五月二十四日来信",
      state: "in_transit",
      sentAtIso: "2026-05-24T02:00:00.000Z",
      distanceKm: 1200,
      registered: false,
      hasPhoto: false,
      important: false,
      excerpt: "这段摘要还不该被看到。",
      body: "这封信还在路上，未到拆阅时。"
    });

    const model = buildAppModel(new Date("2026-05-27T04:00:00.000Z"), state);
    const pendingLetter = model.mailbox.pendingIncomingLetters.find(
      (letter) => letter.id === "letter-from-lan-0524"
    );

    expect(pendingLetter).toMatchObject({
      state: "in_transit",
      excerpt: "信尚在路上，未到拆阅时。",
      actionText: "尚未投递",
      availabilityText: "尚未投递"
    });
  });

  it("summarizes postal records for the archive", () => {
    const state = createDefaultAppState();
    state.postalRecords.push({
      id: "letter-to-lan-0521-record-latest",
      letterId: "letter-to-lan-0521",
      atIso: "2026-05-25T04:00:00.000Z",
      text: "一九六〇年五月二十五日，西安局分拣。"
    });

    const model = buildAppModel(now, state);
    const letter = model.archive.letters.find((summary) => summary.id === "letter-to-lan-0521");

    expect(letter?.latestRecordText).toBe("一九六〇年五月二十五日，西安局分拣。");
    expect(letter?.recordItems.at(-1)).toEqual({
      atText: "一九六〇年五月二十五日",
      text: "一九六〇年五月二十五日，西安局分拣。"
    });
  });

  it("does not count returned or archived outgoing letters as in transit", () => {
    const state = createDefaultAppState();
    const outgoingLetter = state.letters.find((letter) => letter.id === "letter-to-lan-0521");

    if (outgoingLetter === undefined) {
      throw new Error("Missing default outgoing letter");
    }

    outgoingLetter.state = "returned";

    const model = buildAppModel(now, state);

    expect(model.today.inTransitCount).toBe(0);
  });

  it("sorts archive letters by newest postal record first", () => {
    const state = createDefaultAppState();
    state.postalRecords.push({
      id: "letter-from-lan-0512-record-latest",
      letterId: "letter-from-lan-0512",
      atIso: "2026-05-26T04:00:00.000Z",
      text: "一九六〇年五月二十六日，旧档复核。"
    });

    const model = buildAppModel(now, state);

    expect(model.archive.letters.map((letter) => letter.id).at(0)).toBe("letter-from-lan-0512");
  });

  it("builds the UI model from a persisted app state", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    state.wallet.balanceFen = 88;
    state.ledgerEntries.push({
      id: "ledger-test",
      atIso: "2026-05-23T04:00:00.000Z",
      kind: "postage",
      amountFen: -8,
      note: "平信邮票"
    });

    const model = buildAppModel(now, state);

    expect(model.wallet.balanceText).toBe("8 角 8 分");
    expect(model.wallet.ledgerPreview[0]).toEqual({
      amountText: "-8 分",
      note: "平信邮票"
    });
  });

  it("summarizes draft papers newest first", () => {
    const state = createDefaultAppState();
    state.draftPapers.push(
      {
        id: "draft-old",
        authorMemberId: "member-zhou",
        recipientMemberId: "member-lan",
        createdAtIso: "2026-05-23T02:00:00.000Z",
        updatedAtIso: "2026-05-23T02:30:00.000Z",
        oralText: "旧草稿口述",
        scribeId: null,
        scribeDraft: "旧草稿正文",
        finalText: "旧草稿正文",
        status: "draft"
      },
      {
        id: "draft-new",
        authorMemberId: "member-zhou",
        recipientMemberId: "member-lan",
        createdAtIso: "2026-05-23T03:00:00.000Z",
        updatedAtIso: "2026-05-23T03:30:00.000Z",
        oralText: "新草稿口述",
        scribeId: "scribe-xu",
        scribeDraft: "新草稿初稿",
        finalText: "新草稿正文",
        status: "revised"
      }
    );

    const model = buildAppModel(now, state);

    expect(model.writeLetter.drafts.map((draft) => draft.id)).toEqual(["draft-new", "draft-old"]);
    expect(model.writeLetter.drafts[0]).toMatchObject({
      recipientName: "阿兰",
      writingMethodText: "许鹤年代笔",
      statusText: "已校改",
      excerpt: "新草稿正文"
    });
    expect(model.writeLetter.drafts[1]).toMatchObject({
      writingMethodText: "亲笔",
      statusText: "草稿"
    });
  });
});

import { describe, expect, it } from "vitest";
import { createDefaultAppState, settleAppState } from "./app-state.js";
import { postLetter, saveDraftPaper } from "./write-letter-service.js";

describe("write letter service", () => {
  const now = new Date("2026-05-23T04:00:00.000Z");

  it("saves an oral draft with a scribe draft and final text", () => {
    const state = settleAppState(createDefaultAppState(), now).state;

    const result = saveDraftPaper(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);

    expect(result.state.draftPapers).toHaveLength(1);
    expect(result.state.draftPapers[0]).toMatchObject({
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      status: "revised"
    });
    expect(result.state.draftPapers[0]?.scribeDraft).toContain("兰卿");
    expect(result.state.draftPapers[0]?.draftSource).toBe("template");
    expect(result.state.draftPapers[0]?.generationMeta).toMatchObject({
      engine: "local-template-v1",
      scribeId: "scribe-xu"
    });
  });

  it("saves a draft with provided AI scribe result", () => {
    const state = settleAppState(createDefaultAppState(), now).state;

    const result = saveDraftPaper(
      state,
      {
        oralText: "请替我问她近来安好。",
        scribeId: "scribe-xu",
        scribeDraft: "兰卿：见字如晤。近来安好否。",
        readAloudText: "兰卿：见字如晤。近来安好否。",
        draftSource: "ai",
        generationMeta: {
          engine: "ai-scribe-v1",
          provider: "xiaomi-mimo",
          model: "mimo-v2.5",
          promptVersion: "ai-scribe-prompt-v1",
          scribeId: "scribe-xu",
          sceneTags: ["问安"],
          letterType: "ordinary",
          senderCity: "杭州",
          recipientCity: "西安",
          latencyMs: 1200
        },
        finalText: "兰卿：见字如晤。近来安好否。",
        registered: false
      },
      now
    );

    expect(result.state.draftPapers[0]).toMatchObject({
      oralText: "请替我问她近来安好。",
      scribeDraft: "兰卿：见字如晤。近来安好否。",
      finalText: "兰卿：见字如晤。近来安好否。",
      readAloudText: "兰卿：见字如晤。近来安好否。",
      draftSource: "ai",
      status: "scribed"
    });
    expect(result.state.draftPapers[0]?.generationMeta).toMatchObject({
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      scribeId: "scribe-xu"
    });
  });

  it("does not persist registered posting choice into a draft paper", () => {
    const state = settleAppState(createDefaultAppState(), now).state;

    const result = saveDraftPaper(
      state,
      {
        oralText: "今日雨停，心里记挂你。",
        scribeId: "scribe-xu",
        finalText: "兰卿：今日雨停，心里记挂你。",
        registered: true
      },
      now
    );

    expect(result.state.draftPapers[0]?.generationMeta?.letterType).toBe("ordinary");
  });

  it("posts a local letter, deducts costs, and records the post office events", () => {
    const state = settleAppState(createDefaultAppState(), now).state;

    const result = postLetter(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.reason);
    }

    const postedLetter = result.state.letters.find((letter) => letter.id === result.letterId);

    expect(postedLetter).toMatchObject({
      senderId: "member-zhou",
      recipientId: "member-lan",
      state: "in_transit",
      registered: false,
      hasPhoto: false,
      important: false,
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      draftSource: "template"
    });
    expect(postedLetter?.generationMeta).toMatchObject({
      engine: "local-template-v1",
      scribeId: "scribe-xu"
    });
    expect(result.state.wallet.balanceFen).toBe(219);
    expect(result.state.ledgerEntries.slice(-2)).toEqual([
      expect.objectContaining({
        kind: "scribe_fee",
        amountFen: -3,
        note: "许鹤年代书费"
      }),
      expect.objectContaining({
        kind: "postage",
        amountFen: -8,
        note: "平信邮票"
      })
    ]);
    expect(result.state.postalRecords.filter((record) => record.letterId === result.letterId).map((record) => record.text)).toEqual([
      "一九六〇年五月二十三日，清波门邮政代办处收寄。",
      "一九六〇年五月二十三日，杭州封发，寄往西安。"
    ]);
  });

  it("posts a letter with provided AI scribe result", () => {
    const state = settleAppState(createDefaultAppState(), now).state;

    const result = postLetter(
      state,
      {
        oralText: "请替我问她近来安好。",
        scribeId: "scribe-xu",
        scribeDraft: "兰卿：见字如晤。近来安好否。",
        readAloudText: "兰卿：见字如晤。近来安好否。",
        draftSource: "ai",
        generationMeta: {
          engine: "ai-scribe-v1",
          provider: "xiaomi-mimo",
          model: "mimo-v2.5",
          promptVersion: "ai-scribe-prompt-v1",
          scribeId: "scribe-xu",
          sceneTags: ["问安"],
          letterType: "ordinary",
          senderCity: "杭州",
          recipientCity: "西安",
          latencyMs: 1200
        },
        finalText: "兰卿：见字如晤。近来安好否。",
        registered: false
      },
      now
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.state.letters.find((letter) => letter.id === result.letterId)).toMatchObject({
      oralText: "请替我问她近来安好。",
      scribeDraft: "兰卿：见字如晤。近来安好否。",
      finalText: "兰卿：见字如晤。近来安好否。",
      readAloudText: "兰卿：见字如晤。近来安好否。",
      draftSource: "ai"
    });
    expect(result.state.letters.find((letter) => letter.id === result.letterId)?.generationMeta).toMatchObject({
      engine: "ai-scribe-v1",
      provider: "xiaomi-mimo",
      scribeId: "scribe-xu"
    });
  });

  it("blocks posting when the wallet cannot cover the costs", () => {
    const state = settleAppState(createDefaultAppState(), now).state;
    state.wallet.balanceFen = 5;

    const result = postLetter(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-xu",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected posting to be blocked");
    }
    expect(result.reason).toBe("钱匣余额不足，不能赊账。");
    expect(result.state.wallet.balanceFen).toBe(5);
    expect(result.state.letters).toHaveLength(state.letters.length);
  });

  it("blocks posting with an absent scribe", () => {
    const state = settleAppState(createDefaultAppState(), now).state;

    const result = postLetter(state, {
      oralText: "今日雨停，心里记挂你。",
      scribeId: "scribe-shen",
      finalText: "兰卿：今日雨停，心里记挂你。",
      registered: false
    }, now);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected absent scribe to be blocked");
    }
    expect(result.reason).toBe("这位先生今日未在摊，不能请他代笔。");
  });
});

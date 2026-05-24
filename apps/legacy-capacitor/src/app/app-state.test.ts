import { describe, expect, it } from "vitest";
import { createDefaultAppState, parseAppState, serializeAppState, settleAppState } from "./app-state.js";
import { createAppStateStore, createMemoryKeyValueStorage } from "./app-state-storage.js";

describe("app state", () => {
  it("creates the first local state from seed data", () => {
    const state = createDefaultAppState();

    expect(state.schemaVersion).toBe(1);
    expect(state.currentMemberId).toBe("member-zhou");
    expect(state.recipientMemberId).toBe("member-lan");
    expect(state.members).toHaveLength(2);
    expect(state.wallet.balanceFen).toBe(235);
    expect(state.draftPapers).toEqual([]);
    expect(state.letters.map((letter) => letter.id)).toContain("letter-from-lan-0520");
    expect(state.postalRecords.some((record) => record.letterId === "letter-from-lan-0520")).toBe(true);
  });

  it("serializes and parses app state without losing drafts or letters", () => {
    const state = createDefaultAppState();
    state.draftPapers.push({
      id: "draft-1",
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      createdAtIso: "2026-05-23T10:00:00.000+08:00",
      updatedAtIso: "2026-05-23T10:30:00.000+08:00",
      oralText: "今日先存一纸。",
      scribeId: "scribe-xu",
      scribeDraft: "兰卿：今日先存一纸。",
      finalText: "兰卿：今日先存一纸。",
      status: "draft"
    });

    const parsed = parseAppState(serializeAppState(state));

    expect(parsed?.draftPapers[0]?.oralText).toBe("今日先存一纸。");
    expect(parsed?.letters).toHaveLength(state.letters.length);
  });

  it("serializes and parses AI scribe generation metadata", () => {
    const state = createDefaultAppState();
    state.draftPapers.push({
      id: "draft-ai-1",
      authorMemberId: "member-zhou",
      recipientMemberId: "member-lan",
      createdAtIso: "2026-05-23T10:00:00.000+08:00",
      updatedAtIso: "2026-05-23T10:30:00.000+08:00",
      oralText: "请替我问她近来安好。",
      scribeId: "scribe-xu",
      scribeDraft: "兰卿：见字如晤。近来安好否。",
      finalText: "兰卿：见字如晤。近来安好否。",
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
      status: "scribed"
    });

    const parsed = parseAppState(serializeAppState(state));

    expect(parsed).not.toBeNull();
    expect(parsed?.draftPapers[0]?.generationMeta).toEqual({
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
    });
  });

  it("returns null for corrupt or invalid stored state", () => {
    expect(parseAppState("{bad json")).toBeNull();
    expect(parseAppState(JSON.stringify({ schemaVersion: 1, wallet: null }))).toBeNull();
  });

  it("loads defaults, saves state, and reloads saved state", () => {
    const storage = createMemoryKeyValueStorage();
    const store = createAppStateStore(storage);

    const firstLoad = store.load();
    firstLoad.wallet.balanceFen = 199;
    store.save(firstLoad);

    const secondLoad = store.load();

    expect(secondLoad.wallet.balanceFen).toBe(199);
  });

  it("falls back to defaults when stored data is corrupt", () => {
    const storage = createMemoryKeyValueStorage();
    storage.setItem("pinganpi.app-state.v1", "{bad json");

    const store = createAppStateStore(storage);

    expect(store.load().wallet.balanceFen).toBe(235);
  });

  it("settles wallet into persistent ledger entries", () => {
    const state = createDefaultAppState();

    const result = settleAppState(state, new Date("2026-05-23T04:00:00.000Z"));

    expect(result.changed).toBe(true);
    expect(result.state.wallet.balanceFen).toBe(230);
    expect(result.state.wallet.lastSettledAtIso).toBe("2026-05-23T04:00:00.000Z");
    expect(result.state.ledgerEntries.at(-1)).toMatchObject({
      kind: "living_cost",
      amountFen: -5,
      note: "饭食杂用一日"
    });
  });

  it("settles postal progress into persistent records", () => {
    const state = createDefaultAppState();

    const result = settleAppState(state, new Date("2026-05-28T08:10:00.000Z"));

    expect(result.changed).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
    expect(result.state.postalRecords.find((record) => record.id === "letter-to-lan-0521-postal-arrive")).toMatchObject({
      letterId: "letter-to-lan-0521",
      atIso: "2026-05-28T08:10:00.000Z",
      text: "一九六〇年五月二十八日，南院门邮政支局投递。"
    });
  });

  it("settles postal progress even when wallet does not advance", () => {
    const state = createDefaultAppState();
    state.wallet.lastSettledAtIso = "2026-06-01T00:00:00.000Z";

    const result = settleAppState(state, new Date("2026-05-28T08:10:00.000Z"));

    expect(result.changed).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
    expect(result.state.postalRecords.some((record) => record.id === "letter-to-lan-0521-postal-arrive")).toBe(true);
    expect(result.state.ledgerEntries).toHaveLength(0);
  });
});

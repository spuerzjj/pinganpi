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
});

import { describe, expect, it } from "vitest";
import { createDefaultAppState, type PersistedLetter } from "./app-state.js";
import { openLetter } from "./mailbox-service.js";

describe("mailbox service", () => {
  it("blocks opening an outgoing in-transit letter", () => {
    const state = createDefaultAppState();

    const result = openLetter(state, "letter-to-lan-0521", new Date("2026-05-27T08:00:00.000Z"));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected opening to fail");
    }
    expect(result.reason).toBe("这封信不是寄给你的。");
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("in_transit");
  });

  it("blocks opening an incoming letter that has not arrived", () => {
    const state = createDefaultAppState();
    state.letters.push(createIncomingInTransitLetter("letter-from-lan-late"));

    const result = openLetter(state, "letter-from-lan-late", new Date("2026-05-27T08:00:00.000Z"));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected opening to fail");
    }
    expect(result.reason).toBe("信还没有投递，不能拆阅。");
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-late")?.state).toBe("in_transit");
  });

  it("does not mutate input state when opening fails", () => {
    const state = createDefaultAppState();
    state.letters.push(createIncomingInTransitLetter("letter-from-lan-late"));

    const result = openLetter(state, "letter-from-lan-late", new Date("2026-05-27T08:00:00.000Z"));

    expect(result.ok).toBe(false);
    expect(state.letters.find((letter) => letter.id === "letter-from-lan-late")?.state).toBe("in_transit");
    expect(state.postalRecords.some((record) => record.letterId === "letter-from-lan-late")).toBe(false);
  });

  it("settles postal progress before opening an arrived-by-time letter", () => {
    const state = createDefaultAppState();
    state.letters.push(createIncomingInTransitLetter("letter-from-lan-late"));

    const result = openLetter(state, "letter-from-lan-late", new Date("2026-05-30T02:00:00.000Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(result.letterId).toBe("letter-from-lan-late");
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-late")?.state).toBe("opened");
    expect(result.state.postalRecords.find((record) => record.id === "letter-from-lan-late-postal-arrive")).toBeDefined();
    expect(result.state.postalRecords.find((record) => record.id === "letter-from-lan-late-postal-open")).toMatchObject({
      letterId: "letter-from-lan-late",
      atIso: "2026-05-30T02:00:00.000Z",
      text: "一九六〇年五月三十日，阿周拆阅。"
    });
  });

  it("does not mutate input state when opening succeeds", () => {
    const state = createDefaultAppState();

    const result = openLetter(state, "letter-from-lan-0520", new Date("2026-05-30T02:00:00.000Z"));

    expect(result.ok).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-0520")?.state).toBe("opened");
    expect(state.letters.find((letter) => letter.id === "letter-from-lan-0520")?.state).toBe("arrived");
    expect(state.postalRecords.some((record) => record.id === "letter-from-lan-0520-postal-open")).toBe(false);
  });

  it("returns settled postal progress when the letter is missing", () => {
    const state = createDefaultAppState();

    const result = openLetter(state, "missing-letter", new Date("2026-05-28T08:10:00.000Z"));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected opening to fail");
    }
    expect(result.reason).toBe("没有找到这封信。");
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
    expect(result.state.postalRecords.find((record) => record.id === "letter-to-lan-0521-postal-arrive")).toMatchObject({
      letterId: "letter-to-lan-0521",
      atIso: "2026-05-28T08:10:00.000Z",
      text: "一九六〇年五月二十八日，南院门邮政支局投递。"
    });
  });

  it("does not append duplicate open records", () => {
    const state = createDefaultAppState();
    const first = openLetter(state, "letter-from-lan-0520", new Date("2026-05-30T02:00:00.000Z"));

    if (!first.ok) {
      throw new Error(first.reason);
    }

    const second = openLetter(first.state, "letter-from-lan-0520", new Date("2026-05-30T03:00:00.000Z"));

    expect(second.ok).toBe(false);
    if (second.ok) {
      throw new Error("Expected opening to fail");
    }
    expect(second.reason).toBe("这封信已经拆过。");
    expect(second.state.postalRecords.filter((record) => record.id === "letter-from-lan-0520-postal-open")).toHaveLength(1);
  });

  it("opens an arrived letter that already has an open record without duplicating it", () => {
    const state = createDefaultAppState();
    state.postalRecords.push({
      id: "letter-from-lan-0520-postal-open",
      letterId: "letter-from-lan-0520",
      atIso: "2026-05-29T02:00:00.000Z",
      text: "既有拆阅记录。"
    });

    const result = openLetter(state, "letter-from-lan-0520", new Date("2026-05-30T02:00:00.000Z"));

    expect(result.ok).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-0520")?.state).toBe("opened");
    expect(result.state.postalRecords.filter((record) => record.id === "letter-from-lan-0520-postal-open")).toHaveLength(1);
    expect(result.state.postalRecords.find((record) => record.id === "letter-from-lan-0520-postal-open")?.text).toBe(
      "既有拆阅记录。"
    );
  });
});

function createIncomingInTransitLetter(id: string): PersistedLetter {
  return {
    id,
    senderId: "member-lan",
    recipientId: "member-zhou",
    subject: "南院门来信",
    state: "in_transit",
    sentAtIso: "2026-05-23T02:00:00.000Z",
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: false,
    excerpt: "一切尚安。",
    body: "明远：一切尚安。"
  };
}

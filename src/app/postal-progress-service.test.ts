import { describe, expect, it } from "vitest";
import { createDefaultAppState } from "./app-state.js";
import { settlePostalProgress } from "./postal-progress-service.js";

describe("postal progress service", () => {
  it("keeps an in-transit letter unchanged before the earliest delivery time", () => {
    const state = createDefaultAppState();
    const result = settlePostalProgress(state, new Date("2026-05-28T08:09:59.999Z"));

    expect(result.changed).toBe(false);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("in_transit");
    expect(result.state.postalRecords.some((record) => record.id === "letter-to-lan-0521-postal-arrive")).toBe(false);
  });

  it("marks an in-transit letter as arrived at the earliest delivery time", () => {
    const state = createDefaultAppState();
    const result = settlePostalProgress(state, new Date("2026-05-28T08:10:00.000Z"));

    expect(result.changed).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
    expect(result.state.postalRecords.find((record) => record.id === "letter-to-lan-0521-postal-arrive")).toMatchObject({
      letterId: "letter-to-lan-0521",
      atIso: "2026-05-28T08:10:00.000Z",
      text: "一九六〇年五月二十八日，南院门邮政支局投递。"
    });
  });

  it("does not append duplicate arrival records", () => {
    const state = createDefaultAppState();
    const first = settlePostalProgress(state, new Date("2026-05-28T08:10:00.000Z"));
    const second = settlePostalProgress(first.state, new Date("2026-05-29T08:10:00.000Z"));

    expect(second.changed).toBe(false);
    expect(second.state.postalRecords.filter((record) => record.id === "letter-to-lan-0521-postal-arrive")).toHaveLength(1);
  });

  it("advances a letter that already has an arrival record without duplicating it", () => {
    const state = createDefaultAppState();
    state.postalRecords.push({
      id: "letter-to-lan-0521-postal-arrive",
      letterId: "letter-to-lan-0521",
      atIso: "2026-05-28T07:00:00.000Z",
      text: "既有投递记录。"
    });

    const result = settlePostalProgress(state, new Date("2026-05-28T08:10:00.000Z"));

    expect(result.changed).toBe(true);
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("arrived");
    expect(result.state.postalRecords.filter((record) => record.id === "letter-to-lan-0521-postal-arrive")).toHaveLength(1);
    expect(result.state.postalRecords.find((record) => record.id === "letter-to-lan-0521-postal-arrive")?.text).toBe(
      "既有投递记录。"
    );
  });

  it("leaves arrived, opened, and returned letters unchanged", () => {
    const state = createDefaultAppState();
    const arrived = state.letters.find((letter) => letter.id === "letter-from-lan-0520");
    const opened = state.letters.find((letter) => letter.id === "letter-from-lan-0512");
    const inTransit = state.letters.find((letter) => letter.id === "letter-to-lan-0521");

    if (arrived === undefined || opened === undefined || inTransit === undefined) {
      throw new Error("Missing seed letters");
    }

    inTransit.state = "returned";

    const result = settlePostalProgress(state, new Date("2026-06-10T08:10:00.000Z"));

    expect(result.changed).toBe(false);
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-0520")?.state).toBe("arrived");
    expect(result.state.letters.find((letter) => letter.id === "letter-from-lan-0512")?.state).toBe("opened");
    expect(result.state.letters.find((letter) => letter.id === "letter-to-lan-0521")?.state).toBe("returned");
  });
});

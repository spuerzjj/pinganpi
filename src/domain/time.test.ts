import { describe, expect, it } from "vitest";
import { formatEraDate, formatPresentCorrespondence, toEraDate } from "./time.js";

describe("era time helpers", () => {
  it("maps real dates to dates 66 years earlier", () => {
    const realDate = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

    const eraDate = toEraDate(realDate);

    expect(eraDate.getUTCFullYear()).toBe(1960);
    expect(eraDate.getUTCMonth()).toBe(4);
    expect(eraDate.getUTCDate()).toBe(23);
  });

  it("formats the 1960-facing date in Chinese numerals", () => {
    const realDate = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

    expect(formatEraDate(realDate)).toBe("一九六〇年五月二十三日");
  });

  it("formats the hidden real-world correspondence label", () => {
    const realDate = new Date(Date.UTC(2026, 4, 23, 12, 0, 0));

    expect(formatPresentCorrespondence(realDate)).toBe("今时对应：2026 年 5 月 23 日");
  });
});

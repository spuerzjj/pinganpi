import { describe, expect, it } from "vitest";
import { addFen, formatFen, subtractFen } from "./money.js";

describe("old currency helpers", () => {
  it("formats fen as yuan, jiao, and fen", () => {
    expect(formatFen(0)).toBe("0 分");
    expect(formatFen(8)).toBe("8 分");
    expect(formatFen(12)).toBe("1 角 2 分");
    expect(formatFen(120)).toBe("1 元 2 角");
    expect(formatFen(108)).toBe("1 元 8 分");
  });

  it("adds and subtracts fen without allowing negative balances", () => {
    expect(addFen(12, 8)).toBe(20);
    expect(subtractFen(12, 8)).toBe(4);
    expect(() => subtractFen(5, 8)).toThrow("钱匣不足");
  });

  it("rejects invalid and unsafe fen amounts", () => {
    expect(() => formatFen(Number.MAX_SAFE_INTEGER + 1)).toThrow("Invalid fen amount");
    expect(() => addFen(Number.MAX_SAFE_INTEGER, 1)).toThrow("Invalid fen amount");
    expect(() => formatFen(-1)).toThrow("Invalid fen amount");
    expect(() => formatFen(1.5)).toThrow("Invalid fen amount");
  });
});

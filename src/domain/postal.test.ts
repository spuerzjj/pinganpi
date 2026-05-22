import { describe, expect, it } from "vitest";
import {
  calculatePostage,
  estimateDeliveryWindow,
  nextLetterState,
  type LetterState
} from "./postal.js";

describe("postal rules", () => {
  it("calculates plain local and non-local postage", () => {
    expect(calculatePostage({ local: true, registered: false, hasPhoto: false })).toBe(4);
    expect(calculatePostage({ local: false, registered: false, hasPhoto: false })).toBe(8);
  });

  it("adds registered and photo costs", () => {
    expect(calculatePostage({ local: false, registered: true, hasPhoto: true })).toBe(36);
  });

  it("estimates old-post delivery windows from distance", () => {
    expect(estimateDeliveryWindow(10)).toEqual({ minDays: 1, maxDays: 2, routeClass: "local" });
    expect(estimateDeliveryWindow(1500)).toEqual({ minDays: 7, maxDays: 12, routeClass: "cross-region" });
  });

  it("allows only valid letter state transitions", () => {
    const posted: LetterState = nextLetterState("sealed", "post");
    expect(posted).toBe("posted");
    expect(() => nextLetterState("opened", "post")).toThrow("不能从 opened 执行 post");
  });
});

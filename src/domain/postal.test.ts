import { describe, expect, it } from "vitest";
import {
  calculatePostage,
  estimateDeliveryWindow,
  nextLetterState
} from "./postal.js";

describe("postal rules", () => {
  it("calculates plain local and non-local postage", () => {
    expect(calculatePostage({ local: true, registered: false, hasPhoto: false })).toBe(4);
    expect(calculatePostage({ local: false, registered: false, hasPhoto: false })).toBe(8);
  });

  it("adds registered and photo costs", () => {
    expect(calculatePostage({ local: false, registered: true, hasPhoto: true })).toBe(36);
  });

  it.each([
    [0, { minDays: 1, maxDays: 2, routeClass: "local" }],
    [30, { minDays: 1, maxDays: 2, routeClass: "local" }],
    [31, { minDays: 2, maxDays: 4, routeClass: "province" }],
    [300, { minDays: 2, maxDays: 4, routeClass: "province" }],
    [301, { minDays: 4, maxDays: 7, routeClass: "railway" }],
    [900, { minDays: 4, maxDays: 7, routeClass: "railway" }],
    [901, { minDays: 7, maxDays: 12, routeClass: "cross-region" }],
    [1800, { minDays: 7, maxDays: 12, routeClass: "cross-region" }],
    [1801, { minDays: 10, maxDays: 20, routeClass: "remote" }],
    [3500, { minDays: 10, maxDays: 20, routeClass: "remote" }],
    [3501, { minDays: 20, maxDays: 45, routeClass: "oversea" }]
  ] as const)("estimates %i km delivery windows", (distanceKm, expected) => {
    expect(estimateDeliveryWindow(distanceKm)).toEqual(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid distance %s", (distanceKm) => {
    expect(() => estimateDeliveryWindow(distanceKm)).toThrow("Invalid distance");
  });

  it.each([
    ["draft", "scribe", "scribed"],
    ["draft", "revise", "revised"],
    ["draft", "seal", "sealed"],
    ["scribed", "revise", "revised"],
    ["scribed", "seal", "sealed"],
    ["revised", "seal", "sealed"],
    ["sealed", "post", "posted"],
    ["posted", "accept", "accepted"],
    ["posted", "return", "returned"],
    ["accepted", "send", "in_transit"],
    ["accepted", "delay", "delayed"],
    ["accepted", "return", "returned"],
    ["in_transit", "delay", "delayed"],
    ["in_transit", "misroute", "misrouted"],
    ["in_transit", "lose", "lost"],
    ["in_transit", "arrive", "arrived"],
    ["delayed", "send", "in_transit"],
    ["delayed", "arrive", "arrived"],
    ["delayed", "lose", "lost"],
    ["delayed", "return", "returned"],
    ["misrouted", "send", "in_transit"],
    ["misrouted", "delay", "delayed"],
    ["misrouted", "lose", "lost"],
    ["misrouted", "return", "returned"],
    ["lost", "find", "found"],
    ["lost", "return", "returned"],
    ["found", "send", "in_transit"],
    ["found", "return", "returned"],
    ["found", "arrive", "arrived"],
    ["returned", "archive", "archived"],
    ["arrived", "open", "opened"],
    ["opened", "archive", "archived"]
  ] as const)("allows %s -> %s -> %s", (current, event, expected) => {
    expect(nextLetterState(current, event)).toBe(expected);
  });

  it.each([
    ["opened", "post"],
    ["draft", "post"],
    ["sealed", "accept"],
    ["posted", "open"],
    ["arrived", "send"],
    ["archived", "scribe"],
    ["archived", "archive"]
  ] as const)("rejects invalid %s -> %s transitions", (current, event) => {
    expect(() => nextLetterState(current, event)).toThrow(`不能从 ${current} 执行 ${event}`);
  });
});

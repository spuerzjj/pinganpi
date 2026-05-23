import type { Fen } from "./money.js";

export type RouteClass = "local" | "province" | "railway" | "cross-region" | "remote" | "oversea";

export interface DeliveryWindow {
  minDays: number;
  maxDays: number;
  routeClass: RouteClass;
}

export interface DeliveryDueRange {
  earliestArrivalAt: Date;
  latestArrivalAt: Date;
  window: DeliveryWindow;
}

export interface PostageInput {
  local: boolean;
  registered: boolean;
  hasPhoto: boolean;
}

export type LetterState =
  | "draft"
  | "scribed"
  | "revised"
  | "sealed"
  | "posted"
  | "accepted"
  | "in_transit"
  | "delayed"
  | "misrouted"
  | "lost"
  | "found"
  | "returned"
  | "arrived"
  | "opened"
  | "archived";

export type LetterEvent =
  | "scribe"
  | "revise"
  | "seal"
  | "post"
  | "accept"
  | "send"
  | "delay"
  | "misroute"
  | "lose"
  | "find"
  | "return"
  | "arrive"
  | "open"
  | "archive";

const TRANSITIONS: Record<LetterState, Partial<Record<LetterEvent, LetterState>>> = {
  draft: { scribe: "scribed", revise: "revised", seal: "sealed" },
  scribed: { revise: "revised", seal: "sealed" },
  revised: { seal: "sealed" },
  sealed: { post: "posted" },
  posted: { accept: "accepted", return: "returned" },
  accepted: { send: "in_transit", delay: "delayed", return: "returned" },
  in_transit: { delay: "delayed", misroute: "misrouted", lose: "lost", arrive: "arrived" },
  delayed: { send: "in_transit", arrive: "arrived", lose: "lost", return: "returned" },
  misrouted: { send: "in_transit", delay: "delayed", lose: "lost", return: "returned" },
  lost: { find: "found", return: "returned" },
  found: { send: "in_transit", return: "returned", arrive: "arrived" },
  returned: { archive: "archived" },
  arrived: { open: "opened" },
  opened: { archive: "archived" },
  archived: {}
};

export function calculatePostage(input: PostageInput): Fen {
  const base = input.local ? 4 : 8;
  const registeredFee = input.registered ? 8 : 0;
  const photoFee = input.hasPhoto ? 20 : 0;
  return base + registeredFee + photoFee;
}

export function estimateDeliveryWindow(distanceKm: number): DeliveryWindow {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error(`Invalid distance: ${distanceKm}`);
  }

  if (distanceKm <= 30) {
    return { minDays: 1, maxDays: 2, routeClass: "local" };
  }

  if (distanceKm <= 300) {
    return { minDays: 2, maxDays: 4, routeClass: "province" };
  }

  if (distanceKm <= 900) {
    return { minDays: 4, maxDays: 7, routeClass: "railway" };
  }

  if (distanceKm <= 1800) {
    return { minDays: 7, maxDays: 12, routeClass: "cross-region" };
  }

  if (distanceKm <= 3500) {
    return { minDays: 10, maxDays: 20, routeClass: "remote" };
  }

  return { minDays: 20, maxDays: 45, routeClass: "oversea" };
}

const dayMs = 24 * 60 * 60 * 1000;

export function estimateDeliveryDueRange(sentAt: Date, distanceKm: number): DeliveryDueRange {
  if (Number.isNaN(sentAt.getTime())) {
    throw new Error(`Invalid sent time: ${sentAt.toString()}`);
  }

  const window = estimateDeliveryWindow(distanceKm);

  return {
    earliestArrivalAt: new Date(sentAt.getTime() + window.minDays * dayMs),
    latestArrivalAt: new Date(sentAt.getTime() + window.maxDays * dayMs),
    window
  };
}

export function canArriveBy(sentAt: Date, distanceKm: number, now: Date): boolean {
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid current time: ${now.toString()}`);
  }

  return now.getTime() >= estimateDeliveryDueRange(sentAt, distanceKm).earliestArrivalAt.getTime();
}

export function nextLetterState(current: LetterState, event: LetterEvent): LetterState {
  const next = TRANSITIONS[current][event];

  if (next === undefined) {
    throw new Error(`不能从 ${current} 执行 ${event}`);
  }

  return next;
}

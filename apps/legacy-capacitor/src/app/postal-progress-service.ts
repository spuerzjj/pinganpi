import { canArriveBy, formatEraDate, nextLetterState } from "../domain/index.js";
import type { AppState, PostalRecord } from "./app-state.js";

export interface SettlePostalProgressResult {
  state: AppState;
  changed: boolean;
}

export function settlePostalProgress(state: AppState, now: Date): SettlePostalProgressResult {
  const nextState = cloneAppState(state);
  let changed = false;

  nextState.letters = nextState.letters.map((letter) => {
    if (letter.state !== "in_transit") {
      return letter;
    }

    if (!canArriveBy(new Date(letter.sentAtIso), letter.distanceKm, now)) {
      return letter;
    }

    const arrivalRecord = createArrivalRecord(nextState, letter.id, letter.recipientId, now);

    if (!nextState.postalRecords.some((record) => record.id === arrivalRecord.id)) {
      nextState.postalRecords.push(arrivalRecord);
    }

    changed = true;

    return {
      ...letter,
      state: nextLetterState(letter.state, "arrive")
    };
  });

  return {
    state: nextState,
    changed
  };
}

function cloneAppState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function createArrivalRecord(state: AppState, letterId: string, recipientId: string, now: Date): PostalRecord {
  const recipient = findMember(state, recipientId);

  return {
    id: `${letterId}-postal-arrive`,
    letterId,
    atIso: now.toISOString(),
    text: `${formatEraDate(now)}，${recipient.postOffice}投递。`
  };
}

function findMember(state: AppState, memberId: string): AppState["members"][number] {
  const member = state.members.find((item) => item.id === memberId);

  if (member === undefined) {
    throw new Error(`Missing member: ${memberId}`);
  }

  return member;
}

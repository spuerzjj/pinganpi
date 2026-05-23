import { formatEraDate, nextLetterState } from "../domain/index.js";
import { cloneAppState, type AppState, type PostalRecord } from "./app-state.js";
import { settlePostalProgress } from "./postal-progress-service.js";

export type OpenLetterResult =
  | {
      ok: true;
      state: AppState;
      letterId: string;
    }
  | {
      ok: false;
      state: AppState;
      reason: string;
    };

export function openLetter(state: AppState, letterId: string, now: Date): OpenLetterResult {
  const settled = settlePostalProgress(state, now);
  const settledLetter = settled.state.letters.find((letter) => letter.id === letterId);

  if (settledLetter === undefined) {
    return {
      ok: false,
      state: settled.state,
      reason: "没有找到这封信。"
    };
  }

  if (settledLetter.recipientId !== settled.state.currentMemberId) {
    return {
      ok: false,
      state: settled.state,
      reason: "这封信不是寄给你的。"
    };
  }

  if (settledLetter.state === "opened") {
    return {
      ok: false,
      state: settled.state,
      reason: "这封信已经拆过。"
    };
  }

  if (settledLetter.state !== "arrived") {
    return {
      ok: false,
      state: settled.state,
      reason: "信还没有投递，不能拆阅。"
    };
  }

  const nextState = cloneAppState(settled.state);
  const letter = nextState.letters.find((candidate) => candidate.id === letterId);

  if (letter === undefined) {
    throw new Error(`Missing letter after clone: ${letterId}`);
  }

  letter.state = nextLetterState(letter.state, "open");

  const openRecord = createOpenRecord(nextState, letterId, now);

  if (!nextState.postalRecords.some((record) => record.id === openRecord.id)) {
    nextState.postalRecords.push(openRecord);
  }

  return {
    ok: true,
    state: nextState,
    letterId
  };
}

function createOpenRecord(state: AppState, letterId: string, now: Date): PostalRecord {
  const currentMember = state.members.find((member) => member.id === state.currentMemberId);

  if (currentMember === undefined) {
    throw new Error(`Missing member: ${state.currentMemberId}`);
  }

  return {
    id: `${letterId}-postal-open`,
    letterId,
    atIso: now.toISOString(),
    text: `${formatEraDate(now)}，${currentMember.dailyName}拆阅。`
  };
}

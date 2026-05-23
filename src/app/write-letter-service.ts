import {
  calculatePostage,
  formatEraDate,
  getDailyAttendance,
  nextLetterState,
  type Fen,
  type LetterState,
  type Scribe
} from "../domain/index.js";
import { cloneAppState, type AppState, type DraftPaper, type LedgerEntry, type PersistedLetter, type PostalRecord } from "./app-state.js";
import { generateScribeDraft, type ScribeDraftResult } from "./scribe-template-engine.js";

export interface WriteLetterInput {
  oralText: string;
  scribeId: string | null;
  finalText: string;
  registered: boolean;
}

export interface SaveDraftResult {
  state: AppState;
  draftId: string;
}

export interface WriteLetterCost {
  scribeFeeFen: Fen;
  postageFen: Fen;
  totalFen: Fen;
}

export type PostLetterResult =
  | {
      ok: true;
      state: AppState;
      letterId: string;
      totalCostFen: Fen;
    }
  | {
      ok: false;
      state: AppState;
      reason: string;
    };

export function saveDraftPaper(state: AppState, input: WriteLetterInput, now: Date): SaveDraftResult {
  const nextState = cloneAppState(state);
  const draftId = `draft-${now.getTime()}-${nextState.draftPapers.length + 1}`;
  const draftResult = createDraftResult(nextState, {
    ...input,
    registered: false
  });
  const finalText = normalizeText(input.finalText) || draftResult.scribeDraft;
  const draft: DraftPaper = {
    id: draftId,
    authorMemberId: nextState.currentMemberId,
    recipientMemberId: nextState.recipientMemberId,
    createdAtIso: now.toISOString(),
    updatedAtIso: now.toISOString(),
    oralText: draftResult.oralText,
    scribeId: input.scribeId,
    scribeDraft: draftResult.scribeDraft,
    finalText,
    readAloudText: draftResult.readAloudText,
    draftSource: draftResult.draftSource,
    generationMeta: draftResult.generationMeta,
    status: finalText === draftResult.scribeDraft ? (input.scribeId === null ? "draft" : "scribed") : "revised"
  };

  nextState.draftPapers.push(draft);

  return {
    state: nextState,
    draftId
  };
}

export function postLetter(state: AppState, input: WriteLetterInput, now: Date): PostLetterResult {
  const nextState = cloneAppState(state);
  const scribe = findScribe(nextState, input.scribeId);

  if (scribe !== null && !isScribePresent(nextState, scribe, now)) {
    return {
      ok: false,
      state: nextState,
      reason: "这位先生今日未在摊，不能请他代笔。"
    };
  }

  const cost = calculateWriteLetterCost(nextState, input);

  if (nextState.wallet.balanceFen < cost.totalFen) {
    return {
      ok: false,
      state: nextState,
      reason: "钱匣余额不足，不能赊账。"
    };
  }

  const sender = findMember(nextState, nextState.currentMemberId);
  const recipient = findMember(nextState, nextState.recipientMemberId);
  const draftResult = createDraftResult(nextState, input);
  const finalText = normalizeText(input.finalText) || draftResult.scribeDraft;
  const letterId = `letter-${now.getTime()}-${nextState.letters.length + 1}`;
  const postedState = advanceLetterState(["scribe", "revise", "seal", "post", "accept", "send"]);
  const letter: PersistedLetter = {
    id: letterId,
    senderId: sender.id,
    recipientId: recipient.id,
    subject: `${formatEraDate(now)}寄${recipient.city}`,
    state: postedState,
    sentAtIso: now.toISOString(),
    distanceKm: nextState.writingRoute.distanceKm,
    registered: input.registered,
    hasPhoto: false,
    important: input.registered,
    excerpt: makeExcerpt(finalText),
    body: finalText,
    oralText: draftResult.oralText,
    scribeId: input.scribeId,
    scribeDraft: draftResult.scribeDraft,
    finalText,
    readAloudText: draftResult.readAloudText,
    draftSource: draftResult.draftSource,
    generationMeta: draftResult.generationMeta
  };
  const ledgerEntries = createPostingLedgerEntries(nextState, letterId, scribe, cost, now);
  const postalRecords = createPostingRecords(nextState, letterId, now);

  nextState.wallet.balanceFen = subtractFen(nextState.wallet.balanceFen, cost.totalFen);
  nextState.ledgerEntries.push(...ledgerEntries);
  nextState.letters.push(letter);
  nextState.postalRecords.push(...postalRecords);

  return {
    ok: true,
    state: nextState,
    letterId,
    totalCostFen: cost.totalFen
  };
}

export function calculateWriteLetterCost(state: AppState, input: Pick<WriteLetterInput, "scribeId" | "registered">): WriteLetterCost {
  const scribe = findScribe(state, input.scribeId);
  const sender = findMember(state, state.currentMemberId);
  const recipient = findMember(state, state.recipientMemberId);
  const postageFen = calculatePostage({
    local: sender.city === recipient.city,
    registered: input.registered,
    hasPhoto: false
  });
  const scribeFeeFen = scribe?.feeFen ?? 0;

  return {
    scribeFeeFen,
    postageFen,
    totalFen: addFen(scribeFeeFen, postageFen)
  };
}

export function createScribeDraft(state: AppState, input: Pick<WriteLetterInput, "oralText" | "scribeId">): string {
  return createDraftResult(state, {
    ...input,
    registered: false
  }).scribeDraft;
}

function createDraftResult(state: AppState, input: Pick<WriteLetterInput, "oralText" | "scribeId" | "registered">): ScribeDraftResult {
  const sender = findMember(state, state.currentMemberId);
  const recipient = findMember(state, state.recipientMemberId);
  const scribe = findScribe(state, input.scribeId);

  return generateScribeDraft({
    oralText: input.oralText,
    scribe,
    sender,
    recipient,
    senderCity: sender.city,
    recipientCity: recipient.city,
    letterType: input.registered ? "registered" : "ordinary",
    replyContext: null,
    emotionTags: []
  });
}

function findMember(state: AppState, memberId: string) {
  const member = state.members.find((candidate) => candidate.id === memberId);

  if (member === undefined) {
    throw new Error(`Missing member: ${memberId}`);
  }

  return member;
}

function findScribe(state: AppState, scribeId: string | null): Scribe | null {
  if (scribeId === null) {
    return null;
  }

  const scribe = state.scribes.find((candidate) => candidate.id === scribeId);

  if (scribe === undefined) {
    throw new Error(`Missing scribe: ${scribeId}`);
  }

  return scribe;
}

function isScribePresent(state: AppState, scribe: Scribe, now: Date): boolean {
  const sender = findMember(state, state.currentMemberId);
  const presentIds = new Set(
    getDailyAttendance({
      city: sender.city,
      date: now,
      scribes: state.scribes
    }).map((presentScribe) => presentScribe.id)
  );

  return presentIds.has(scribe.id);
}

function createPostingLedgerEntries(
  state: AppState,
  letterId: string,
  scribe: Scribe | null,
  cost: WriteLetterCost,
  now: Date
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  if (scribe !== null && cost.scribeFeeFen > 0) {
    entries.push({
      id: `${letterId}-ledger-scribe`,
      atIso: now.toISOString(),
      kind: "scribe_fee",
      amountFen: -cost.scribeFeeFen,
      note: `${scribe.name}代书费`
    });
  }

  entries.push({
    id: `${letterId}-ledger-postage`,
    atIso: now.toISOString(),
    kind: "postage",
    amountFen: -cost.postageFen,
    note: cost.postageFen > calculatePostage({ local: isLocalRoute(state), registered: false, hasPhoto: false }) ? "挂号邮资" : "平信邮票"
  });

  return entries;
}

function createPostingRecords(state: AppState, letterId: string, now: Date): PostalRecord[] {
  const sender = findMember(state, state.currentMemberId);
  const recipient = findMember(state, state.recipientMemberId);
  const eraDate = formatEraDate(now);

  return [
    {
      id: `${letterId}-postal-accept`,
      letterId,
      atIso: now.toISOString(),
      text: `${eraDate}，${sender.postOffice}收寄。`
    },
    {
      id: `${letterId}-postal-send`,
      letterId,
      atIso: new Date(now.getTime() + 60_000).toISOString(),
      text: `${eraDate}，${sender.city}封发，寄往${recipient.city}。`
    }
  ];
}

function isLocalRoute(state: AppState): boolean {
  const sender = findMember(state, state.currentMemberId);
  const recipient = findMember(state, state.recipientMemberId);

  return sender.city === recipient.city;
}

function advanceLetterState(events: Array<"scribe" | "revise" | "seal" | "post" | "accept" | "send">): LetterState {
  return events.reduce<LetterState>((state, event) => nextLetterState(state, event), "draft");
}

function makeExcerpt(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 42);
}

function normalizeText(text: string): string {
  return text.trim();
}

function addFen(left: Fen, right: Fen): Fen {
  const result = left + right;

  assertFen(result);

  return result;
}

function subtractFen(left: Fen, right: Fen): Fen {
  const result = left - right;

  assertFen(result);

  return result;
}

function assertFen(value: number): asserts value is Fen {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid fen amount: ${value}`);
  }
}

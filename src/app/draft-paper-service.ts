import { cloneAppState, type AppState } from "./app-state.js";
import {
  postLetter,
  saveDraftPaper as createDraftPaper,
  type PostLetterResult,
  type WriteLetterInput
} from "./write-letter-service.js";

export interface SaveDraftPaperInput extends WriteLetterInput {
  draftId?: string;
}

export type SaveDraftPaperResult =
  | { ok: true; state: AppState; draftId: string; created: boolean }
  | { ok: false; state: AppState; reason: string };

export type DeleteDraftPaperResult =
  | { ok: true; state: AppState }
  | { ok: false; state: AppState; reason: string };

export type PostDraftPaperResult = PostLetterResult;

const missingDraftReason = "没有找到这张草稿。";

export function saveDraftPaper(state: AppState, input: SaveDraftPaperInput, now: Date): SaveDraftPaperResult {
  if (input.draftId === undefined) {
    const created = createDraftPaper(state, input, now);

    return {
      ok: true,
      state: created.state,
      draftId: created.draftId,
      created: true
    };
  }

  const draftIndex = state.draftPapers.findIndex((draft) => draft.id === input.draftId);
  const existingDraft = state.draftPapers[draftIndex];

  if (existingDraft === undefined) {
    return {
      ok: false,
      state: cloneAppState(state),
      reason: missingDraftReason
    };
  }

  const created = createDraftPaper({ ...state, draftPapers: [] }, input, now);
  const updatedDraft = created.state.draftPapers[0];

  if (updatedDraft === undefined) {
    throw new Error("Cannot update draft paper without a created replacement");
  }

  const nextState = cloneAppState(state);
  nextState.draftPapers[draftIndex] = {
    ...updatedDraft,
    id: existingDraft.id,
    createdAtIso: existingDraft.createdAtIso,
    updatedAtIso: now.toISOString()
  };

  return {
    ok: true,
    state: nextState,
    draftId: existingDraft.id,
    created: false
  };
}

export function deleteDraftPaper(state: AppState, draftId: string): DeleteDraftPaperResult {
  const existingDraft = state.draftPapers.find((draft) => draft.id === draftId);

  if (existingDraft === undefined) {
    return {
      ok: false,
      state: cloneAppState(state),
      reason: missingDraftReason
    };
  }

  const nextState = cloneAppState(state);
  nextState.draftPapers = nextState.draftPapers.filter((draft) => draft.id !== draftId);

  return {
    ok: true,
    state: nextState
  };
}

export function postDraftPaper(state: AppState, draftId: string, input: WriteLetterInput, now: Date): PostDraftPaperResult {
  if (!state.draftPapers.some((draft) => draft.id === draftId)) {
    return {
      ok: false,
      state: cloneAppState(state),
      reason: missingDraftReason
    };
  }

  const posted = postLetter(state, input, now);

  if (!posted.ok) {
    return posted;
  }

  return {
    ...posted,
    state: {
      ...posted.state,
      draftPapers: posted.state.draftPapers.filter((draft) => draft.id !== draftId)
    }
  };
}

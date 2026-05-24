import type { DraftPaper } from "./app-state.js";
import type { DraftSource, ScribeDraftResult, ScribeGenerationMeta } from "./scribe-template-engine.js";

export type WriteLetterStepId = "method" | "oral" | "draft" | "revise" | "post";

export interface WriteLetterStep {
  id: WriteLetterStepId;
  label: string;
  title: string;
  eyebrow: string;
}

export interface WriteLetterWizardState {
  currentStepId: WriteLetterStepId;
  selectedScribeId: string | null;
  oralText: string;
  scribeDraft: string;
  readAloudText: string;
  draftSource: DraftSource | undefined;
  generationMeta: ScribeGenerationMeta | undefined;
  finalText: string;
  registered: boolean;
  draftDirty: boolean;
  finalTextFromDraft: boolean;
}

export interface DraftWizardSyncSnapshot {
  draftId: string | undefined;
  resetKey: number;
  saveKey: number;
}

export type DraftWizardSyncAction = "keep" | "restore" | "reset";

export interface CreateInitialWriteLetterWizardStateInput {
  defaultScribeId: string | null;
  sampleOralText: string;
  sampleDraftText: string;
}

export const writeLetterSteps: WriteLetterStep[] = [
  { id: "method", label: "选写法", title: "先定写法", eyebrow: "第一步" },
  { id: "oral", label: "口述", title: "向先生口述", eyebrow: "第二步" },
  { id: "draft", label: "起稿", title: "先生起稿", eyebrow: "第三步" },
  { id: "revise", label: "校改", title: "亲手校改", eyebrow: "第四步" },
  { id: "post", label: "投寄", title: "算账封缄", eyebrow: "第五步" }
];

const stepOrder = writeLetterSteps.map((step) => step.id);

export function createInitialWriteLetterWizardState(input: CreateInitialWriteLetterWizardStateInput): WriteLetterWizardState {
  return {
    currentStepId: "method",
    selectedScribeId: input.defaultScribeId,
    oralText: input.sampleOralText,
    scribeDraft: input.sampleDraftText,
    readAloudText: input.sampleDraftText,
    draftSource: input.sampleDraftText.trim().length > 0 ? "template" : undefined,
    generationMeta: undefined,
    finalText: input.sampleDraftText,
    registered: false,
    draftDirty: input.sampleOralText.trim().length > 0 && input.sampleDraftText.trim().length === 0,
    finalTextFromDraft: true
  };
}

export function createWriteLetterWizardStateFromDraft(draft: DraftPaper): WriteLetterWizardState {
  const freshDraftAvailable = draft.oralText.trim().length > 0 && draft.scribeDraft.trim().length > 0;
  const finalTextAvailable = draft.finalText.trim().length > 0;

  return {
    currentStepId: freshDraftAvailable && finalTextAvailable ? "revise" : "draft",
    selectedScribeId: draft.scribeId,
    oralText: draft.oralText,
    scribeDraft: draft.scribeDraft,
    readAloudText: draft.readAloudText ?? draft.scribeDraft,
    draftSource: draft.draftSource,
    generationMeta: draft.generationMeta,
    finalText: draft.finalText,
    registered: false,
    draftDirty: false,
    finalTextFromDraft: draft.finalText.trim() === draft.scribeDraft.trim()
  };
}

export function getDraftWizardSyncAction(
  previous: DraftWizardSyncSnapshot | undefined,
  next: DraftWizardSyncSnapshot
): DraftWizardSyncAction {
  if (previous !== undefined && next.resetKey !== previous.resetKey) {
    return "reset";
  }

  if (previous !== undefined && next.saveKey !== previous.saveKey) {
    return "keep";
  }

  if (previous !== undefined && next.draftId === previous.draftId) {
    return "keep";
  }

  if (next.draftId === undefined) {
    return "reset";
  }

  return "restore";
}

export function canSaveDraft(state: WriteLetterWizardState): boolean {
  return state.oralText.trim().length > 0;
}

export function canEnterStep(state: WriteLetterWizardState, stepId: WriteLetterStepId): boolean {
  if (stepId === "method" || stepId === "oral") {
    return true;
  }

  if (stepId === "draft") {
    return state.oralText.trim().length > 0;
  }

  if (stepId === "revise") {
    return hasFreshDraft(state);
  }

  return hasFreshDraft(state) && state.finalText.trim().length > 0;
}

export function canContinueFromStep(state: WriteLetterWizardState, stepId: WriteLetterStepId): boolean {
  if (stepId === "method") {
    return true;
  }

  if (stepId === "oral") {
    return state.oralText.trim().length > 0;
  }

  if (stepId === "draft") {
    return hasFreshDraft(state);
  }

  if (stepId === "revise") {
    return hasFreshDraft(state) && state.finalText.trim().length > 0;
  }

  return hasFreshDraft(state) && state.finalText.trim().length > 0;
}

export function getNextStepId(state: WriteLetterWizardState, currentStepId: WriteLetterStepId): WriteLetterStepId {
  const currentIndex = stepOrder.indexOf(currentStepId);
  const nextStepId = stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)];

  if (nextStepId === undefined || !canEnterStep(state, nextStepId)) {
    return currentStepId;
  }

  return nextStepId;
}

export function getPreviousStepId(currentStepId: WriteLetterStepId): WriteLetterStepId {
  const currentIndex = stepOrder.indexOf(currentStepId);
  return stepOrder[Math.max(currentIndex - 1, 0)] ?? "method";
}

export function markTextBasisChanged(state: WriteLetterWizardState): WriteLetterWizardState {
  const shouldClearFinalText = state.finalTextFromDraft || state.finalText.trim() === state.scribeDraft.trim();

  return {
    ...state,
    scribeDraft: "",
    readAloudText: "",
    draftSource: undefined,
    generationMeta: undefined,
    finalText: shouldClearFinalText ? "" : state.finalText,
    draftDirty: state.oralText.trim().length > 0,
    finalTextFromDraft: shouldClearFinalText || state.finalText.trim().length === 0
  };
}

export function markDraftGenerated(state: WriteLetterWizardState, generatedDraft: string | ScribeDraftResult): WriteLetterWizardState {
  const draftFields = normalizeGeneratedDraft(generatedDraft);
  const shouldReplaceFinalText = state.finalTextFromDraft || state.finalText.trim().length === 0;

  return {
    ...state,
    scribeDraft: draftFields.scribeDraft,
    readAloudText: draftFields.readAloudText,
    draftSource: draftFields.draftSource,
    generationMeta: draftFields.generationMeta,
    finalText: shouldReplaceFinalText ? draftFields.scribeDraft : state.finalText,
    draftDirty: false,
    finalTextFromDraft: shouldReplaceFinalText
  };
}

export function markFinalTextEdited(state: WriteLetterWizardState, finalText: string): WriteLetterWizardState {
  return {
    ...state,
    finalText,
    finalTextFromDraft: finalText.trim() === state.scribeDraft.trim()
  };
}

export function getStepIndex(stepId: WriteLetterStepId): number {
  return stepOrder.indexOf(stepId);
}

function hasFreshDraft(state: WriteLetterWizardState): boolean {
  return state.oralText.trim().length > 0 && state.scribeDraft.trim().length > 0 && !state.draftDirty;
}

function normalizeGeneratedDraft(generatedDraft: string | ScribeDraftResult): {
  scribeDraft: string;
  readAloudText: string;
  draftSource: DraftSource | undefined;
  generationMeta: ScribeGenerationMeta | undefined;
} {
  if (typeof generatedDraft === "string") {
    const scribeDraft = generatedDraft.trim();

    return {
      scribeDraft,
      readAloudText: scribeDraft,
      draftSource: undefined,
      generationMeta: undefined
    };
  }

  const scribeDraft = generatedDraft.scribeDraft.trim();
  const readAloudText = generatedDraft.readAloudText.trim() || scribeDraft;

  return {
    scribeDraft,
    readAloudText,
    draftSource: generatedDraft.draftSource,
    generationMeta: generatedDraft.generationMeta
  };
}

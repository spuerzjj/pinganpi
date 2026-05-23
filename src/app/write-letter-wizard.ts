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
  finalText: string;
  registered: boolean;
  draftDirty: boolean;
  finalTextFromDraft: boolean;
}

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
    finalText: input.sampleDraftText,
    registered: false,
    draftDirty: input.sampleOralText.trim().length > 0 && input.sampleDraftText.trim().length === 0,
    finalTextFromDraft: true
  };
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
  return {
    ...state,
    draftDirty: state.oralText.trim().length > 0,
    finalTextFromDraft: state.finalTextFromDraft || state.finalText.trim().length === 0
  };
}

export function markDraftGenerated(state: WriteLetterWizardState, scribeDraft: string): WriteLetterWizardState {
  const normalizedDraft = scribeDraft.trim();
  const shouldReplaceFinalText = state.finalTextFromDraft || state.finalText.trim().length === 0;

  return {
    ...state,
    scribeDraft: normalizedDraft,
    finalText: shouldReplaceFinalText ? normalizedDraft : state.finalText,
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

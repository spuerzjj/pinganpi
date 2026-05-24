import { createLocalMockState, type MiniLocalState } from "../../services/local-model.js";
import {
  createWriteFlowModel,
  generateLocalDraft,
  preparePostedReceipt,
  reviseDraft,
  setRegistered,
  updateOralText,
  type PostedReceipt,
  type WriteFlowModel,
  type WriteStep,
  type WriteStepItem,
} from "../../services/write-flow.js";

interface WritePageData {
  flow: WriteFlowModel | null;
  receipt: PostedReceipt | null;
  isMethodStep: boolean;
  isOralStep: boolean;
  isDraftStep: boolean;
  isReviseStep: boolean;
  isPostStep: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  nextDisabled: boolean;
}

interface WritePageInstance {
  data: WritePageData;
  setData(data: Partial<WritePageData>): void;
}

interface TextInputEvent {
  detail: {
    value: string;
  };
}

interface SwitchChangeEvent {
  detail: {
    value: boolean;
  };
}

const stepOrder: WriteStep[] = ["method", "oral", "draft", "revise", "post"];
const stepLabels: Record<WriteStep, string> = {
  method: "选写法",
  oral: "口述",
  draft: "起稿",
  revise: "校改",
  post: "投寄",
};

let localState = createLocalMockState(new Date());

Page({
  data: {
    flow: null,
    receipt: null,
    isMethodStep: false,
    isOralStep: false,
    isDraftStep: false,
    isReviseStep: false,
    isPostStep: false,
    canGoBack: false,
    canGoNext: false,
    nextDisabled: false,
  },
  onShow(this: WritePageInstance) {
    const now = new Date();
    localState = createLocalMockState(now);
    setFlow(this, createWriteFlowModel(localState, now), null);
  },
  goNext(this: WritePageInstance) {
    const flow = this.data.flow;

    if (flow === null || isNextDisabled(flow)) {
      return;
    }

    const nextStep = getAdjacentStep(flow.step, 1);
    setFlow(this, assignStep(flow, nextStep));
  },
  goBack(this: WritePageInstance) {
    const flow = this.data.flow;

    if (flow === null || flow.step === "method") {
      return;
    }

    const previousStep = getAdjacentStep(flow.step, -1);
    setFlow(this, assignStep(flow, previousStep), null);
  },
  onOralInput(this: WritePageInstance, event: TextInputEvent) {
    const flow = this.data.flow;

    if (flow === null) {
      return;
    }

    setFlow(this, updateOralText(assignStep(flow, "oral"), event.detail.value), null);
  },
  onFinalInput(this: WritePageInstance, event: TextInputEvent) {
    const flow = this.data.flow;

    if (flow === null) {
      return;
    }

    setFlow(this, reviseDraft(flow, event.detail.value), null);
  },
  onGenerateDraft(this: WritePageInstance) {
    const flow = this.data.flow;

    if (flow === null || !flow.canGenerate) {
      return;
    }

    setFlow(this, generateLocalDraft(flow, localState, new Date()), null);
  },
  onToggleRegistered(this: WritePageInstance, event: SwitchChangeEvent) {
    const flow = this.data.flow;

    if (flow === null) {
      return;
    }

    setFlow(this, setRegistered(flow, event.detail.value), null);
  },
  onPostLocal(this: WritePageInstance) {
    const flow = this.data.flow;

    if (flow === null || !flow.canPost) {
      return;
    }

    const receipt = preparePostedReceipt(flow, localState, new Date());
    setFlow(this, flow, receipt);
  },
});

function setFlow(page: WritePageInstance, flow: WriteFlowModel, receipt?: PostedReceipt | null): void {
  const data: Partial<WritePageData> = {
    flow,
    isMethodStep: flow.step === "method",
    isOralStep: flow.step === "oral",
    isDraftStep: flow.step === "draft",
    isReviseStep: flow.step === "revise",
    isPostStep: flow.step === "post",
    canGoBack: flow.step !== "method",
    canGoNext: flow.step !== "post",
    nextDisabled: isNextDisabled(flow),
  };

  if (receipt !== undefined) {
    data.receipt = receipt;
  }

  page.setData(data);
}

function assignStep(flow: WriteFlowModel, step: WriteStep): WriteFlowModel {
  return {
    ...flow,
    step,
    steps: createStepItems(step),
  };
}

function createStepItems(currentStep: WriteStep): WriteStepItem[] {
  const currentIndex = stepOrder.indexOf(currentStep);

  return stepOrder.map((step, index) => ({
    id: step,
    label: stepLabels[step],
    status: index < currentIndex ? "done" : index === currentIndex ? "active" : "todo",
  }));
}

function getAdjacentStep(currentStep: WriteStep, offset: number): WriteStep {
  const currentIndex = stepOrder.indexOf(currentStep);
  const nextIndex = Math.min(Math.max(currentIndex + offset, 0), stepOrder.length - 1);
  const nextStep = stepOrder[nextIndex];

  if (nextStep === undefined) {
    return currentStep;
  }

  return nextStep;
}

function isNextDisabled(flow: WriteFlowModel): boolean {
  if (flow.step === "oral") {
    return flow.oralText.trim().length === 0;
  }

  if (flow.step === "draft") {
    return flow.draftText.trim().length === 0;
  }

  if (flow.step === "revise") {
    return flow.finalText.trim().length === 0;
  }

  return flow.step === "post";
}

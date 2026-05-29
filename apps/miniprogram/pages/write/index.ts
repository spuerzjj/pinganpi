import {
  AI_SCRIBE_DRAFT_FAILURE_TEXT,
  generateAiScribeDraft,
  type MiniProgramAiScribeDraftInput,
} from "../../services/ai-scribe-cloud.js";
import { createLocalMockState, type MiniLocalState, type MiniMember } from "../../services/local-model.js";
import {
  applyAiDraft,
  beginDraftGeneration,
  canNavigateBack,
  createWriteFlowModel,
  failDraftGeneration,
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
let draftRequestSerial = 0;

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
  onLoad(this: WritePageInstance) {
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

    if (flow === null || !canNavigateBack(flow)) {
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
  async onGenerateDraft(this: WritePageInstance) {
    const flow = this.data.flow;

    if (flow === null || !flow.canGenerate) {
      return;
    }

    const oralSnapshot = flow.oralText.trim();
    const requestSerial = ++draftRequestSerial;
    const pendingFlow = beginDraftGeneration(flow);
    setFlow(this, pendingFlow, null);

    try {
      const draft = await generateAiScribeDraft(createAiDraftInput(pendingFlow, localState));
      const latestFlow = this.data.flow;

      if (!shouldApplyDraftResult(latestFlow, requestSerial, oralSnapshot)) {
        return;
      }

      setFlow(this, applyAiDraft(latestFlow, draft), null);
    } catch {
      const latestFlow = this.data.flow;

      if (!shouldApplyDraftResult(latestFlow, requestSerial, oralSnapshot)) {
        return;
      }

      setFlow(this, failDraftGeneration(latestFlow, AI_SCRIBE_DRAFT_FAILURE_TEXT), null);
    }
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
    canGoBack: canNavigateBack(flow),
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
    return flow.draftStatus === "pending" || flow.draftText.trim().length === 0;
  }

  if (flow.step === "revise") {
    return flow.finalText.trim().length === 0;
  }

  return flow.step === "post";
}

function shouldApplyDraftResult(
  flow: WriteFlowModel | null,
  requestSerial: number,
  oralSnapshot: string,
): flow is WriteFlowModel {
  return (
    flow !== null &&
    draftRequestSerial === requestSerial &&
    flow.draftStatus === "pending" &&
    flow.oralText.trim() === oralSnapshot
  );
}

function createAiDraftInput(flow: WriteFlowModel, state: MiniLocalState): MiniProgramAiScribeDraftInput {
  const current = getMember(state, state.currentMemberId);
  const recipient = getMember(state, state.recipientMemberId);
  const scribe = state.scribes.find((item) => item.id === flow.selectedScribeId);

  return {
    oralText: flow.oralText,
    scribeName: flow.selectedScribeName,
    scribeStyle: formatScribeStyle(scribe?.style),
    senderGreeting: recipient.dailyName,
    senderSignature: current.dailyName,
    senderCity: state.route.fromCity,
    recipientCity: state.route.toCity,
    letterType: flow.registered ? "registered" : "ordinary",
  };
}

function getMember(state: MiniLocalState, memberId: string): MiniMember {
  const member = state.members.find((item) => item.id === memberId);

  if (member === undefined) {
    throw new Error(`Missing member: ${memberId}`);
  }

  return member;
}

function formatScribeStyle(style: MiniLocalState["scribes"][number]["style"] | undefined): string {
  if (style === "street") {
    return "街坊口吻";
  }

  if (style === "old-scholar") {
    return "旧塾文气";
  }

  if (style === "schoolmaster") {
    return "先生训诂";
  }

  if (style === "clerk") {
    return "邮局书记";
  }

  return "旧时代代书口吻";
}

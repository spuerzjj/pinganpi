import {
  calculatePostage,
  estimateDeliveryDueRange,
  formatEraDate,
  formatFen,
  getDailyAttendance,
  type Fen,
  type Scribe,
} from "../shared/domain/index.js";
import type { MiniLocalState, MiniMember } from "./local-model.js";

export type WriteStep = "method" | "oral" | "draft" | "revise" | "post";

export interface WriteStepItem {
  id: WriteStep;
  label: string;
  status: "done" | "active" | "todo";
}

export interface WriteFlowModel {
  kicker: string;
  title: string;
  step: WriteStep;
  steps: WriteStepItem[];
  methodText: string;
  oralText: string;
  draftText: string;
  finalText: string;
  registered: boolean;
  selectedScribeId: string;
  selectedScribeName: string;
  selectedScribeFeeFen: Fen;
  selectedScribeFeeText: string;
  fromText: string;
  toText: string;
  routeText: string;
  distanceText: string;
  dueText: string;
  postageFen: Fen;
  postageText: string;
  totalCostFen: Fen;
  totalCostText: string;
  walletBalanceFen: Fen;
  walletBalanceText: string;
  canGenerate: boolean;
  canPost: boolean;
  postBlockReason: string;
}

export interface PostedReceipt {
  title: string;
  costText: string;
  routeText: string;
  dueText: string;
}

const writeSteps: Array<{ id: WriteStep; label: string }> = [
  { id: "method", label: "选写法" },
  { id: "oral", label: "口述" },
  { id: "draft", label: "起稿" },
  { id: "revise", label: "校改" },
  { id: "post", label: "投寄" },
];

export function createWriteFlowModel(state: MiniLocalState, now: Date): WriteFlowModel {
  const current = getMember(state, state.currentMemberId);
  const recipient = getMember(state, state.recipientMemberId);
  const selectedScribe = getDefaultScribe(state, current.city, now);
  const selectedScribeFeeFen = selectedScribe?.feeFen ?? 0;

  return withComputedFields({
    kicker: "平安批 / 写信",
    title: "写信",
    step: "method",
    steps: createStepItems("method"),
    methodText: "代笔先生按口述起稿，寄出前仍可亲自校改。",
    oralText: "",
    draftText: "",
    finalText: "",
    registered: false,
    selectedScribeId: selectedScribe?.id ?? "",
    selectedScribeName: selectedScribe?.name ?? "今日暂无先生在馆",
    selectedScribeFeeFen,
    selectedScribeFeeText: `代书费 ${formatFen(selectedScribeFeeFen)}`,
    fromText: `${current.dailyName} · ${current.city} ${current.postOffice}`,
    toText: `${recipient.dailyName} · ${recipient.city} ${recipient.postOffice}`,
    routeText: `${state.route.fromCity} → ${state.route.toCity}`,
    distanceText: `约 ${state.route.distanceKm} 里程公里`,
    dueText: formatDueText(now, state.route.distanceKm),
    postageFen: 0,
    postageText: "",
    totalCostFen: 0,
    totalCostText: "",
    walletBalanceFen: state.wallet.balanceFen,
    walletBalanceText: formatFen(state.wallet.balanceFen),
    canGenerate: false,
    canPost: false,
    postBlockReason: "",
  });
}

export function updateOralText(flow: WriteFlowModel, oralText: string): WriteFlowModel {
  return withComputedFields({
    ...flow,
    oralText,
    step: flow.step === "method" ? "oral" : flow.step,
  });
}

export function generateLocalDraft(flow: WriteFlowModel, state: MiniLocalState, now: Date): WriteFlowModel {
  const current = getMember(state, state.currentMemberId);
  const recipient = getMember(state, state.recipientMemberId);
  const selectedScribe = state.scribes.find((scribe) => scribe.id === flow.selectedScribeId);
  const scribeName = selectedScribe?.name ?? flow.selectedScribeName;
  const oralText = flow.oralText.trim();
  const draftText =
    oralText.length > 0
      ? [
          `${scribeName}先生代拟：`,
          `${recipient.dailyName}见字如晤。${current.dailyName}在${current.city}${current.postOffice}托我写下：${oralText}`,
          `此信拟由${state.route.fromCity}寄往${state.route.toCity}，路远信迟，惟愿收信安心。`,
        ].join("\n\n")
      : "";

  return withComputedFields({
    ...flow,
    step: "revise",
    steps: createStepItems("revise"),
    draftText,
    finalText: draftText,
    dueText: formatDueText(now, state.route.distanceKm),
  });
}

export function reviseDraft(flow: WriteFlowModel, finalText: string): WriteFlowModel {
  return withComputedFields({
    ...flow,
    finalText,
  });
}

export function setRegistered(flow: WriteFlowModel, registered: boolean): WriteFlowModel {
  return withComputedFields({
    ...flow,
    registered,
  });
}

export function preparePostedReceipt(flow: WriteFlowModel, state: MiniLocalState, now: Date): PostedReceipt {
  if (!flow.canPost) {
    throw new Error(flow.postBlockReason);
  }

  return {
    title: "本地投寄存根",
    costText: flow.totalCostText,
    routeText: `${state.route.fromCity} → ${state.route.toCity}`,
    dueText: formatDueText(now, state.route.distanceKm),
  };
}

function withComputedFields(flow: WriteFlowModel): WriteFlowModel {
  const postageFen = calculatePostage({
    local: false,
    registered: flow.registered,
    hasPhoto: false,
  });
  const totalCostFen = flow.selectedScribeFeeFen + postageFen;
  const hasFinalText = flow.finalText.trim().length > 0;
  const hasScribe = flow.selectedScribeId.length > 0;
  const hasEnoughBalance = flow.walletBalanceFen >= totalCostFen;

  return {
    ...flow,
    steps: createStepItems(flow.step),
    postageFen,
    postageText: formatFen(postageFen),
    totalCostFen,
    totalCostText: formatFen(totalCostFen),
    canGenerate: flow.oralText.trim().length > 0 && hasScribe,
    canPost: hasFinalText && hasScribe && hasEnoughBalance,
    postBlockReason: createPostBlockReason(hasFinalText, hasScribe, hasEnoughBalance),
  };
}

function createPostBlockReason(hasFinalText: boolean, hasScribe: boolean, hasEnoughBalance: boolean): string {
  if (!hasScribe) {
    return "今日暂无先生在馆，暂不能投寄。";
  }

  if (!hasFinalText) {
    return "校改未完成，不能投寄。";
  }

  if (!hasEnoughBalance) {
    return "钱匣余额不足，不能投寄。";
  }

  return "";
}

function createStepItems(currentStep: WriteStep): WriteStepItem[] {
  const currentIndex = writeSteps.findIndex((step) => step.id === currentStep);

  return writeSteps.map((step, index) => ({
    ...step,
    status: index < currentIndex ? "done" : index === currentIndex ? "active" : "todo",
  }));
}

function getDefaultScribe(state: MiniLocalState, city: string, now: Date): Scribe | undefined {
  const presentIds = new Set(
    getDailyAttendance({
      city,
      date: now,
      scribes: state.scribes,
    }).map((scribe) => scribe.id),
  );

  return state.scribes.find((scribe) => scribe.city === city && presentIds.has(scribe.id));
}

function getMember(state: MiniLocalState, memberId: string): MiniMember {
  const member = state.members.find((item) => item.id === memberId);

  if (member === undefined) {
    throw new Error(`Missing member: ${memberId}`);
  }

  return member;
}

function formatDueText(sentAt: Date, distanceKm: number): string {
  const due = estimateDeliveryDueRange(sentAt, distanceKm);

  return `${formatEraDate(due.earliestArrivalAt)} 至 ${formatEraDate(due.latestArrivalAt)}`;
}

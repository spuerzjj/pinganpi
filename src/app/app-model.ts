import {
  calculatePostage,
  estimateDeliveryWindow,
  formatEraDate,
  formatFen,
  formatPresentCorrespondence,
  getDailyAttendance,
  type DeliveryWindow,
  type Fen,
  type LetterState,
  type RouteClass,
  type Scribe
} from "../domain/index.js";
import { createDefaultAppState, settleAppState, type AppState, type DraftPaper, type PersistedLetter } from "./app-state.js";
import { type MemberProfile } from "./mock-data.js";
import { createScribeDraft } from "./write-letter-service.js";

export interface AppModel {
  today: TodaySnapshot;
  writeLetter: WriteLetterModel;
  scribeDesk: ScribeDeskModel;
  wallet: WalletModel;
  mailbox: MailboxModel;
  archive: ArchiveModel;
}

export interface TodaySnapshot {
  eraDateText: string;
  presentCorrespondenceText: string;
  currentMember: MemberProfile;
  recipientMember: MemberProfile;
  inboxCount: number;
  inTransitCount: number;
  nextIncomingLetter: LetterSummary | null;
}

export interface WriteLetterModel {
  fromCity: string;
  toCity: string;
  recipientGreeting: string;
  preferredScribeName: string;
  defaultScribeId: string | null;
  scribeOptions: WriteLetterScribeOption[];
  plainPostageText: string;
  registeredPostageText: string;
  photoPostageText: string;
  deliveryWindowText: string;
  routeClassText: string;
  sampleOralText: string;
  sampleDraftText: string;
  drafts: WriteLetterDraftSummary[];
}

export interface WriteLetterScribeOption {
  id: string | null;
  name: string;
  feeText: string;
  styleText: string;
}

export interface WriteLetterDraftSummary {
  id: string;
  updatedAtText: string;
  recipientName: string;
  writingMethodText: string;
  statusText: string;
  excerpt: string;
}

export interface ScribeDeskModel {
  city: string;
  preferredScribeStatus: string;
  presentScribes: ScribeSummary[];
  absentScribes: ScribeSummary[];
}

export interface ScribeSummary {
  id: string;
  name: string;
  styleText: string;
  feeText: string;
  specialtiesText: string;
}

export interface WalletModel {
  balanceText: string;
  ledgerPreview: LedgerPreviewEntry[];
  canAffordPlainLetter: boolean;
  plainLetterCostText: string;
}

export interface LedgerPreviewEntry {
  note: string;
  amountText: string;
}

export interface MailboxModel {
  arrivedLetters: LetterSummary[];
  waitingText: string;
}

export interface ArchiveModel {
  letters: LetterSummary[];
}

export interface LetterSummary {
  id: string;
  subject: string;
  directionText: string;
  statusText: string;
  sentDateText: string;
  routeText: string;
  postageText: string;
  deliveryWindowText: string;
  excerpt: string;
  records: string[];
  canOpen: boolean;
  important: boolean;
}

const routeClassText: Record<RouteClass, string> = {
  local: "本埠",
  province: "省内",
  railway: "铁路干线",
  "cross-region": "跨大区",
  remote: "边远",
  oversea: "跨海"
};

const stateText: Record<LetterState, string> = {
  draft: "草稿",
  scribed: "先生初稿",
  revised: "已校改",
  sealed: "已封缄",
  posted: "已投寄",
  accepted: "邮局收寄",
  in_transit: "路上",
  delayed: "延误",
  misrouted: "错分",
  lost: "查找中",
  found: "已找回",
  returned: "退回",
  arrived: "可拆",
  opened: "已拆",
  archived: "归档"
};

const draftStatusText: Record<DraftPaper["status"], string> = {
  draft: "草稿",
  scribed: "先生初稿",
  revised: "已校改",
  sealed: "已封缄"
};

const scribeStyleText: Record<Scribe["style"], string> = {
  street: "街口代书",
  "old-scholar": "老先生",
  schoolmaster: "乡塾先生",
  clerk: "账房文书"
};

export function buildAppModel(
  now = new Date(),
  state: AppState = settleAppState(createDefaultAppState(), now).state
): AppModel {
  const currentMember = findMember(state, state.currentMemberId);
  const recipientMember = findMember(state, state.recipientMemberId);
  const dailyPresentScribes = getDailyAttendance({
    city: currentMember.city,
    date: now,
    scribes: state.scribes
  });
  const presentIds = new Set(dailyPresentScribes.map((scribe) => scribe.id));
  const localScribes = state.scribes.filter((scribe) => scribe.city === currentMember.city);
  const deliveryWindow = estimateDeliveryWindow(state.writingRoute.distanceKm);
  const isLocalPost = currentMember.city === recipientMember.city;
  const plainPostageFen = calculatePostage({ local: isLocalPost, registered: false, hasPhoto: false });
  const registeredPostageFen = calculatePostage({ local: isLocalPost, registered: true, hasPhoto: false });
  const photoPostageFen = calculatePostage({ local: isLocalPost, registered: false, hasPhoto: true });
  const letterSummaries = state.letters.map((letter) => summarizeLetter(letter, currentMember.id, state));
  const arrivedLetters = letterSummaries.filter((letter) => letter.canOpen);
  const outgoingInTransitCount = letterSummaries.filter(
    (letter) => letter.directionText === "寄出" && letter.statusText !== "已拆" && letter.statusText !== "可拆"
  ).length;
  const preferredScribe = localScribes.find((scribe) => scribe.id === currentMember.preferredScribeId);

  if (preferredScribe === undefined) {
    throw new Error(`Missing preferred scribe: ${currentMember.preferredScribeId}`);
  }

  const defaultScribeId = presentIds.has(preferredScribe.id) ? preferredScribe.id : (dailyPresentScribes[0]?.id ?? null);
  const sampleOralText = "近日都好，只是见天阴久了，心里老记挂你。";

  return {
    today: {
      eraDateText: formatEraDate(now),
      presentCorrespondenceText: formatPresentCorrespondence(now),
      currentMember,
      recipientMember,
      inboxCount: arrivedLetters.length,
      inTransitCount: outgoingInTransitCount,
      nextIncomingLetter: arrivedLetters[0] ?? null
    },
    writeLetter: {
      fromCity: currentMember.city,
      toCity: recipientMember.city,
      recipientGreeting: currentMember.letterGreeting,
      preferredScribeName: preferredScribe.name,
      defaultScribeId,
      scribeOptions: [
        {
          id: null,
          name: "亲笔",
          feeText: "免代书费",
          styleText: "自己落笔"
        },
        ...dailyPresentScribes.map((scribe) => ({
          id: scribe.id,
          name: scribe.name,
          feeText: formatFen(scribe.feeFen),
          styleText: scribeStyleText[scribe.style]
        }))
      ],
      plainPostageText: formatFen(plainPostageFen),
      registeredPostageText: formatFen(registeredPostageFen),
      photoPostageText: formatFen(photoPostageFen),
      deliveryWindowText: formatDeliveryWindow(deliveryWindow),
      routeClassText: routeClassText[deliveryWindow.routeClass],
      sampleOralText,
      sampleDraftText: createScribeDraft(state, {
        oralText: sampleOralText,
        scribeId: defaultScribeId
      }),
      drafts: state.draftPapers
        .slice()
        .sort((left, right) => Date.parse(right.updatedAtIso) - Date.parse(left.updatedAtIso))
        .map((draft) => summarizeDraftPaper(draft, state))
    },
    scribeDesk: {
      city: currentMember.city,
      preferredScribeStatus: presentIds.has(currentMember.preferredScribeId) ? "今日在摊" : "今日未到",
      presentScribes: dailyPresentScribes.map(summarizeScribe),
      absentScribes: localScribes.filter((scribe) => !presentIds.has(scribe.id)).map(summarizeScribe)
    },
    wallet: {
      balanceText: formatFen(state.wallet.balanceFen),
      ledgerPreview: state.ledgerEntries.slice(-6).reverse().map((entry) => ({
        note: entry.note,
        amountText: formatSignedFen(entry.amountFen)
      })),
      canAffordPlainLetter: state.wallet.balanceFen >= plainPostageFen,
      plainLetterCostText: formatFen(plainPostageFen)
    },
    mailbox: {
      arrivedLetters,
      waitingText: arrivedLetters.length === 0 ? "今日无信" : "今日有信可拆"
    },
    archive: {
      letters: letterSummaries
    }
  };
}

function findMember(state: AppState, memberId: string): MemberProfile {
  const member = state.members.find((candidate) => candidate.id === memberId);

  if (member === undefined) {
    throw new Error(`Missing member: ${memberId}`);
  }

  return member;
}

function summarizeScribe(scribe: Scribe): ScribeSummary {
  return {
    id: scribe.id,
    name: scribe.name,
    styleText: scribeStyleText[scribe.style],
    feeText: formatFen(scribe.feeFen),
    specialtiesText: scribe.specialties.join("、")
  };
}

function summarizeDraftPaper(draft: DraftPaper, state: AppState): WriteLetterDraftSummary {
  const recipient = findMember(state, draft.recipientMemberId);
  const scribe = draft.scribeId === null ? null : state.scribes.find((candidate) => candidate.id === draft.scribeId);

  return {
    id: draft.id,
    updatedAtText: formatEraDate(new Date(draft.updatedAtIso)),
    recipientName: recipient.dailyName,
    writingMethodText: scribe === null ? "亲笔" : `${scribe?.name ?? "代笔先生"}代笔`,
    statusText: draftStatusText[draft.status],
    excerpt: makeTextExcerpt(draft.finalText || draft.scribeDraft || draft.oralText)
  };
}

function summarizeLetter(letter: PersistedLetter, currentMemberIdValue: string, state: AppState): LetterSummary {
  const deliveryWindow = estimateDeliveryWindow(letter.distanceKm);
  const sender = findMember(state, letter.senderId);
  const recipient = findMember(state, letter.recipientId);
  const isLocalPost = sender.city === recipient.city;
  const postageFen = calculatePostage({
    local: isLocalPost,
    registered: letter.registered,
    hasPhoto: letter.hasPhoto
  });

  return {
    id: letter.id,
    subject: letter.subject,
    directionText: letter.senderId === currentMemberIdValue ? "寄出" : "收进",
    statusText: stateText[letter.state],
    sentDateText: formatEraDate(new Date(letter.sentAtIso)),
    routeText: `${sender.city}至${recipient.city}`,
    postageText: formatFen(postageFen),
    deliveryWindowText: formatDeliveryWindow(deliveryWindow),
    excerpt: letter.excerpt,
    records: state.postalRecords
      .filter((record) => record.letterId === letter.id)
      .sort((left, right) => Date.parse(left.atIso) - Date.parse(right.atIso))
      .map((record) => record.text),
    canOpen: letter.recipientId === currentMemberIdValue && letter.state === "arrived",
    important: letter.important
  };
}

function formatDeliveryWindow(deliveryWindow: DeliveryWindow): string {
  return `约 ${deliveryWindow.minDays} 至 ${deliveryWindow.maxDays} 日`;
}

function formatSignedFen(amountFen: Fen): string {
  if (amountFen < 0) {
    return `-${formatFen(Math.abs(amountFen))}`;
  }

  return `+${formatFen(amountFen)}`;
}

function makeTextExcerpt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}

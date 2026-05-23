import {
  calculatePostage,
  estimateDeliveryWindow,
  formatEraDate,
  formatFen,
  formatPresentCorrespondence,
  getDailyAttendance,
  settleWallet,
  type DeliveryWindow,
  type Fen,
  type LetterState,
  type RouteClass,
  type Scribe
} from "../domain/index.js";
import {
  currentMemberId,
  letters,
  members,
  recipientMemberId,
  scribes,
  walletSeed,
  writingRoute,
  type MemberProfile,
  type MockLetter
} from "./mock-data.js";

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
  plainPostageText: string;
  registeredPostageText: string;
  photoPostageText: string;
  deliveryWindowText: string;
  routeClassText: string;
  sampleOralText: string;
  sampleDraftText: string;
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

const scribeStyleText: Record<Scribe["style"], string> = {
  street: "街口代书",
  "old-scholar": "老先生",
  schoolmaster: "乡塾先生",
  clerk: "账房文书"
};

export function buildAppModel(now = new Date()): AppModel {
  const currentMember = findMember(currentMemberId);
  const recipientMember = findMember(recipientMemberId);
  const dailyPresentScribes = getDailyAttendance({
    city: currentMember.city,
    date: now,
    scribes
  });
  const presentIds = new Set(dailyPresentScribes.map((scribe) => scribe.id));
  const localScribes = scribes.filter((scribe) => scribe.city === currentMember.city);
  const deliveryWindow = estimateDeliveryWindow(writingRoute.distanceKm);
  const isLocalPost = currentMember.city === recipientMember.city;
  const plainPostageFen = calculatePostage({ local: isLocalPost, registered: false, hasPhoto: false });
  const registeredPostageFen = calculatePostage({ local: isLocalPost, registered: true, hasPhoto: false });
  const photoPostageFen = calculatePostage({ local: isLocalPost, registered: false, hasPhoto: true });
  const settlement = settleWallet({
    balanceFen: walletSeed.balanceFen,
    monthlyIncomeFen: walletSeed.monthlyIncomeFen,
    dailyLivingCostFen: walletSeed.dailyLivingCostFen,
    lastSettledAt: walletSeed.lastSettledAt,
    now
  });
  const letterSummaries = letters.map((letter) => summarizeLetter(letter, currentMember.id));
  const arrivedLetters = letterSummaries.filter((letter) => letter.canOpen);
  const outgoingInTransitCount = letterSummaries.filter(
    (letter) => letter.directionText === "寄出" && letter.statusText !== "已拆" && letter.statusText !== "可拆"
  ).length;
  const preferredScribe = localScribes.find((scribe) => scribe.id === currentMember.preferredScribeId);

  if (preferredScribe === undefined) {
    throw new Error(`Missing preferred scribe: ${currentMember.preferredScribeId}`);
  }

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
      plainPostageText: formatFen(plainPostageFen),
      registeredPostageText: formatFen(registeredPostageFen),
      photoPostageText: formatFen(photoPostageFen),
      deliveryWindowText: formatDeliveryWindow(deliveryWindow),
      routeClassText: routeClassText[deliveryWindow.routeClass],
      sampleOralText: "近日都好，只是见天阴久了，心里老记挂你。",
      sampleDraftText: "兰卿：近日都好，只是见天阴久了，心里老记挂你。前信不知可曾收到，若得空，请托人回一纸。"
    },
    scribeDesk: {
      city: currentMember.city,
      preferredScribeStatus: presentIds.has(currentMember.preferredScribeId) ? "今日在摊" : "今日未到",
      presentScribes: dailyPresentScribes.map(summarizeScribe),
      absentScribes: localScribes.filter((scribe) => !presentIds.has(scribe.id)).map(summarizeScribe)
    },
    wallet: {
      balanceText: formatFen(settlement.balanceFen),
      ledgerPreview: settlement.entries.map((entry) => ({
        note: entry.note,
        amountText: formatSignedFen(entry.amountFen)
      })),
      canAffordPlainLetter: settlement.balanceFen >= plainPostageFen,
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

function findMember(memberId: string): MemberProfile {
  const member = members.find((candidate) => candidate.id === memberId);

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

function summarizeLetter(letter: MockLetter, currentMemberIdValue: string): LetterSummary {
  const deliveryWindow = estimateDeliveryWindow(letter.distanceKm);
  const sender = findMember(letter.senderId);
  const recipient = findMember(letter.recipientId);
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
    sentDateText: formatEraDate(letter.sentAt),
    routeText: `${sender.city}至${recipient.city}`,
    postageText: formatFen(postageFen),
    deliveryWindowText: formatDeliveryWindow(deliveryWindow),
    excerpt: letter.excerpt,
    records: letter.records,
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

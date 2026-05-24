import {
  calculatePostage,
  canArriveBy,
  estimateDeliveryDueRange,
  formatEraDate,
  formatFen,
  formatPresentCorrespondence,
  getDailyAttendance,
  settleWallet,
  type Fen,
  type LetterState,
  type Scribe,
} from "../shared/domain/index.js";

export interface MiniMember {
  id: string;
  dailyName: string;
  city: string;
  postOffice: string;
}

export interface MiniWallet {
  balanceFen: Fen;
  monthlyIncomeFen: Fen;
  dailyLivingCostFen: Fen;
  lastSettledAtIso: string;
}

export interface MiniLetter {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  state: LetterState;
  sentAtIso: string;
  distanceKm: number;
  registered: boolean;
  important: boolean;
  excerpt: string;
  body: string;
  records: string[];
}

export interface LedgerRow {
  label: string;
  amountText: string;
  tone: "credit" | "debit";
}

export interface MiniLocalState {
  currentMemberId: string;
  recipientMemberId: string;
  members: MiniMember[];
  scribes: Scribe[];
  wallet: MiniWallet;
  route: {
    fromCity: string;
    toCity: string;
    distanceKm: number;
  };
  letters: MiniLetter[];
  ledgerRows: LedgerRow[];
}

export interface TodayPageModel {
  kicker: string;
  title: string;
  presentDateText: string;
  walletBalanceText: string;
  availableScribeText: string;
  inboxText: string;
  routeText: string;
  postageText: string;
}

export interface ScribeListItem {
  id: string;
  name: string;
  feeText: string;
  styleText: string;
  specialtiesText: string;
  statusText: string;
  statusTone: "present" | "absent";
}

export interface ScribesPageModel {
  kicker: string;
  title: string;
  cityText: string;
  scribes: ScribeListItem[];
}

export interface WalletPageModel {
  kicker: string;
  title: string;
  balanceText: string;
  incomeText: string;
  livingCostText: string;
  ledgerRows: LedgerRow[];
}

export interface MailboxLetterItem {
  id: string;
  subject: string;
  fromText: string;
  stateText: string;
  canOpen: boolean;
  importantText: string;
  excerpt: string;
  dueText: string;
}

export interface MailboxPageModel {
  kicker: string;
  title: string;
  letters: MailboxLetterItem[];
}

export interface ArchiveLetterItem {
  id: string;
  subject: string;
  metaText: string;
  excerpt: string;
  records: string[];
}

export interface ArchivePageModel {
  kicker: string;
  title: string;
  letters: ArchiveLetterItem[];
}

export function createLocalMockState(now: Date): MiniLocalState {
  const settlement = settleWallet({
    balanceFen: 235,
    monthlyIncomeFen: 1200,
    dailyLivingCostFen: 5,
    lastSettledAt: new Date("2026-05-22T00:00:00+08:00"),
    now,
  });

  return {
    currentMemberId: "member-zhou",
    recipientMemberId: "member-lan",
    members: [
      { id: "member-zhou", dailyName: "阿周", city: "杭州", postOffice: "清波门邮政代办处" },
      { id: "member-lan", dailyName: "阿兰", city: "西安", postOffice: "南院门邮政支局" },
    ],
    scribes: [
      {
        id: "scribe-xu",
        name: "许鹤年",
        city: "杭州",
        style: "old-scholar",
        feeFen: 3,
        attendanceRate: 1,
        specialties: ["问安", "久别", "家常"],
      },
      {
        id: "scribe-qian",
        name: "钱守明",
        city: "杭州",
        style: "clerk",
        feeFen: 4,
        attendanceRate: 1,
        specialties: ["挂号", "账目", "回信"],
      },
      {
        id: "scribe-shen",
        name: "沈竹庵",
        city: "杭州",
        style: "schoolmaster",
        feeFen: 5,
        attendanceRate: 0,
        specialties: ["道歉", "生日", "夹寄照片"],
      },
      {
        id: "scribe-gu",
        name: "顾砚秋",
        city: "西安",
        style: "street",
        feeFen: 2,
        attendanceRate: 1,
        specialties: ["报平安", "短笺", "问候"],
      },
    ],
    wallet: {
      balanceFen: settlement.balanceFen,
      monthlyIncomeFen: 1200,
      dailyLivingCostFen: 5,
      lastSettledAtIso: settlement.settledAt.toISOString(),
    },
    route: { fromCity: "杭州", toCity: "西安", distanceKm: 1200 },
    letters: createSeedLetters(),
    ledgerRows: settlement.entries.map((entry) => ({
      label: entry.note,
      amountText: `${entry.amountFen < 0 ? "-" : "+"}${formatFen(Math.abs(entry.amountFen))}`,
      tone: entry.amountFen < 0 ? "debit" : "credit",
    })),
  };
}

export function createTodayPageModel(state: MiniLocalState, now: Date): TodayPageModel {
  const current = getCurrentMember(state);
  const arrivedCount = state.letters.filter(
    (letter) => letter.recipientId === current.id && letter.state === "arrived",
  ).length;
  const presentCount = getPresentScribes(state, now).length;

  return {
    kicker: "平安批 / 今日",
    title: formatEraDate(now),
    presentDateText: formatPresentCorrespondence(now),
    walletBalanceText: formatFen(state.wallet.balanceFen),
    availableScribeText: `今日 ${presentCount} 位先生在馆`,
    inboxText: arrivedCount > 0 ? `${arrivedCount} 封到达可拆` : "今日暂无可拆来信",
    routeText: `${state.route.fromCity} → ${state.route.toCity}，约 ${state.route.distanceKm} 里程公里`,
    postageText: `平信 ${formatFen(calculatePostage({ local: false, registered: false, hasPhoto: false }))}，挂号 ${formatFen(calculatePostage({ local: false, registered: true, hasPhoto: false }))}`,
  };
}

export function createScribesPageModel(state: MiniLocalState, now: Date): ScribesPageModel {
  const current = getCurrentMember(state);
  const presentIds = new Set(getPresentScribes(state, now).map((scribe) => scribe.id));

  return {
    kicker: "平安批 / 代笔先生",
    title: "代笔先生",
    cityText: `${current.city} · ${current.postOffice}`,
    scribes: state.scribes
      .filter((scribe) => scribe.city === current.city)
      .map((scribe) => {
        const isPresent = presentIds.has(scribe.id);

        return {
          id: scribe.id,
          name: scribe.name,
          feeText: `代书费 ${formatFen(scribe.feeFen)}`,
          styleText: formatScribeStyle(scribe.style),
          specialtiesText: scribe.specialties.join("、"),
          statusText: isPresent ? "今日在馆" : "今日未到",
          statusTone: isPresent ? "present" : "absent",
        };
      }),
  };
}

export function createWalletPageModel(state: MiniLocalState, _now: Date): WalletPageModel {
  return {
    kicker: "平安批 / 钱匣",
    title: "钱匣",
    balanceText: formatFen(state.wallet.balanceFen),
    incomeText: `每月余款 ${formatFen(state.wallet.monthlyIncomeFen)}`,
    livingCostText: `饭食杂用每日 ${formatFen(state.wallet.dailyLivingCostFen)}`,
    ledgerRows: state.ledgerRows,
  };
}

export function createMailboxPageModel(state: MiniLocalState, now: Date): MailboxPageModel {
  const current = getCurrentMember(state);
  const memberName = new Map(state.members.map((member) => [member.id, member.dailyName]));

  return {
    kicker: "平安批 / 信箱",
    title: "今日信箱",
    letters: state.letters
      .filter((letter) => letter.state !== "opened" && letter.state !== "archived")
      .map((letter) => {
        const canOpen = letter.recipientId === current.id && letter.state === "arrived";

        return {
          id: letter.id,
          subject: letter.subject,
          fromText: `${memberName.get(letter.senderId) ?? "对方"} 寄`,
          stateText: formatLetterState(letter.state, canArriveBy(new Date(letter.sentAtIso), letter.distanceKm, now)),
          canOpen,
          importantText: letter.important ? "要紧" : "普通",
          excerpt: canOpen ? letter.excerpt : "未到达，不可拆阅正文。",
          dueText: formatDueText(letter),
        };
      }),
  };
}

export function createArchivePageModel(state: MiniLocalState): ArchivePageModel {
  const memberName = new Map(state.members.map((member) => [member.id, member.dailyName]));

  return {
    kicker: "平安批 / 档案",
    title: "旧信档案",
    letters: state.letters
      .filter((letter) => letter.state === "opened" || letter.state === "archived")
      .map((letter) => ({
        id: letter.id,
        subject: letter.subject,
        metaText: `${memberName.get(letter.senderId) ?? "对方"} · ${letter.registered ? "挂号" : "平信"}`,
        excerpt: letter.excerpt,
        records: letter.records,
      })),
  };
}

function createSeedLetters(): MiniLetter[] {
  return [
    {
      id: "letter-from-lan-0520",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "南院门寄来的平安批",
      state: "arrived",
      sentAtIso: new Date("2026-05-20T09:30:00+08:00").toISOString(),
      distanceKm: 1200,
      registered: false,
      important: false,
      excerpt: "昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。",
      body: "明远：昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。此间一切尚安，只是路远信迟，盼你勿急。",
      records: ["一九六〇年五月二十日，南院门支局收寄。", "一九六〇年五月二十三日，清波门投递。"],
    },
    {
      id: "letter-to-lan-0521",
      senderId: "member-zhou",
      recipientId: "member-lan",
      subject: "五月二十一日寄西安",
      state: "in_transit",
      sentAtIso: new Date("2026-05-21T16:10:00+08:00").toISOString(),
      distanceKm: 1200,
      registered: false,
      important: true,
      excerpt: "近日都好，只是见天阴久了，心里老记挂你。",
      body: "兰卿：近日都好，只是见天阴久了，心里老记挂你。前信不知可曾收到，若得空，请托人回一纸。",
      records: ["一九六〇年五月二十一日，清波门邮政代办处开筒。", "一九六〇年五月二十二日，杭州封发。"],
    },
    {
      id: "letter-from-lan-0512",
      senderId: "member-lan",
      recipientId: "member-zhou",
      subject: "挂号回信一封",
      state: "opened",
      sentAtIso: new Date("2026-05-12T10:00:00+08:00").toISOString(),
      distanceKm: 1200,
      registered: true,
      important: true,
      excerpt: "前信收到，字迹很稳，像是许先生代的笔。",
      body: "明远：前信收到，字迹很稳，像是许先生代的笔。挂号回执另存，望安心。",
      records: ["一九六〇年五月十二日，南院门支局挂号收寄。", "一九六〇年五月十八日，清波门投递并签收。"],
    },
  ];
}

function getCurrentMember(state: MiniLocalState): MiniMember {
  const member = state.members.find((item) => item.id === state.currentMemberId);

  if (member === undefined) {
    throw new Error("Missing current member");
  }

  return member;
}

function getPresentScribes(state: MiniLocalState, now: Date): Scribe[] {
  return getDailyAttendance({
    city: getCurrentMember(state).city,
    date: now,
    scribes: state.scribes,
  });
}

function formatScribeStyle(style: Scribe["style"]): string {
  const labels: Record<Scribe["style"], string> = {
    street: "街坊口吻",
    "old-scholar": "旧塾文气",
    schoolmaster: "先生训诂",
    clerk: "邮局书记",
  };

  return labels[style];
}

function formatLetterState(state: LetterState, canArrive: boolean): string {
  if (state === "arrived") {
    return "已到，可拆";
  }

  if (state === "in_transit" && canArrive) {
    return "按程可到，待邮差投递";
  }

  if (state === "in_transit") {
    return "路上";
  }

  if (state === "opened") {
    return "已拆";
  }

  return state;
}

function formatDueText(letter: MiniLetter): string {
  const due = estimateDeliveryDueRange(new Date(letter.sentAtIso), letter.distanceKm);

  return `${formatEraDate(due.earliestArrivalAt)} 至 ${formatEraDate(due.latestArrivalAt)}`;
}

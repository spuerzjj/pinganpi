import type { Fen, LetterState, Scribe } from "../domain/index.js";

export interface MemberProfile {
  id: string;
  dailyName: string;
  envelopeName: string;
  letterGreeting: string;
  signatureName: string;
  city: string;
  district: string;
  postOffice: string;
  preferredScribeId: string;
}

export interface MockWalletSeed {
  balanceFen: Fen;
  monthlyIncomeFen: Fen;
  dailyLivingCostFen: Fen;
  lastSettledAt: Date;
}

export interface MockLetter {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  state: LetterState;
  sentAt: Date;
  distanceKm: number;
  registered: boolean;
  hasPhoto: boolean;
  important: boolean;
  excerpt: string;
  body: string;
  records: string[];
}

export const currentMemberId = "member-zhou";
export const recipientMemberId = "member-lan";

export const members: MemberProfile[] = [
  {
    id: currentMemberId,
    dailyName: "阿周",
    envelopeName: "周明远同志收",
    letterGreeting: "兰卿",
    signatureName: "明远",
    city: "杭州",
    district: "上城",
    postOffice: "清波门邮政代办处",
    preferredScribeId: "scribe-xu"
  },
  {
    id: recipientMemberId,
    dailyName: "阿兰",
    envelopeName: "林静兰同志亲启",
    letterGreeting: "明远",
    signatureName: "静兰",
    city: "西安",
    district: "碑林",
    postOffice: "南院门邮政支局",
    preferredScribeId: "scribe-gu"
  }
];

export const scribes: Scribe[] = [
  {
    id: "scribe-xu",
    name: "许鹤年",
    city: "杭州",
    style: "old-scholar",
    feeFen: 3,
    attendanceRate: 1,
    specialties: ["问安", "久别", "家常"]
  },
  {
    id: "scribe-qian",
    name: "钱守明",
    city: "杭州",
    style: "clerk",
    feeFen: 4,
    attendanceRate: 1,
    specialties: ["挂号", "账目", "回信"]
  },
  {
    id: "scribe-shen",
    name: "沈竹庵",
    city: "杭州",
    style: "schoolmaster",
    feeFen: 5,
    attendanceRate: 0,
    specialties: ["道歉", "生日", "夹寄照片"]
  },
  {
    id: "scribe-gu",
    name: "顾砚秋",
    city: "西安",
    style: "street",
    feeFen: 2,
    attendanceRate: 1,
    specialties: ["报平安", "短笺", "问候"]
  }
];

export const walletSeed: MockWalletSeed = {
  balanceFen: 235,
  monthlyIncomeFen: 1200,
  dailyLivingCostFen: 5,
  lastSettledAt: new Date("2026-05-22T00:00:00+08:00")
};

export const writingRoute = {
  fromCity: "杭州",
  toCity: "西安",
  distanceKm: 1200
} as const;

export const letters: MockLetter[] = [
  {
    id: "letter-from-lan-0520",
    senderId: recipientMemberId,
    recipientId: currentMemberId,
    subject: "南院门寄来的平安批",
    state: "arrived",
    sentAt: new Date("2026-05-20T09:30:00+08:00"),
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: false,
    excerpt: "昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。",
    body: "明远：昨夜院中风紧，想你那里梅雨将至，衣裳须早些收起。此间一切尚安，只是路远信迟，盼你勿急。",
    records: ["一九六〇年五月二十日，南院门支局收寄。", "一九六〇年五月二十三日，清波门投递。"]
  },
  {
    id: "letter-to-lan-0521",
    senderId: currentMemberId,
    recipientId: recipientMemberId,
    subject: "五月二十一日寄西安",
    state: "in_transit",
    sentAt: new Date("2026-05-21T16:10:00+08:00"),
    distanceKm: 1200,
    registered: false,
    hasPhoto: false,
    important: true,
    excerpt: "近日都好，只是见天阴久了，心里老记挂你。",
    body: "兰卿：近日都好，只是见天阴久了，心里老记挂你。前信不知可曾收到，若得空，请托人回一纸。",
    records: ["一九六〇年五月二十一日，清波门邮政代办处开筒。", "一九六〇年五月二十二日，杭州封发。"]
  },
  {
    id: "letter-from-lan-0512",
    senderId: recipientMemberId,
    recipientId: currentMemberId,
    subject: "挂号回信一封",
    state: "opened",
    sentAt: new Date("2026-05-12T10:00:00+08:00"),
    distanceKm: 1200,
    registered: true,
    hasPhoto: false,
    important: true,
    excerpt: "前信收到，字迹很稳，像是许先生代的笔。",
    body: "明远：前信收到，字迹很稳，像是许先生代的笔。挂号回执另存，望安心。",
    records: ["一九六〇年五月十二日，南院门支局挂号收寄。", "一九六〇年五月十八日，清波门投递并签收。"]
  }
];

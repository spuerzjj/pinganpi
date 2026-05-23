import { settleWallet, type Fen, type LetterState, type Scribe } from "../domain/index.js";
import {
  currentMemberId,
  letters,
  members,
  recipientMemberId,
  scribes,
  walletSeed,
  writingRoute,
  type MemberProfile
} from "./mock-data.js";
import type { DraftSource, ScribeGenerationMeta } from "./scribe-template-engine.js";

export const APP_STATE_SCHEMA_VERSION = 1;

export interface AppState {
  schemaVersion: typeof APP_STATE_SCHEMA_VERSION;
  currentMemberId: string;
  recipientMemberId: string;
  members: MemberProfile[];
  scribes: Scribe[];
  writingRoute: WritingRouteState;
  wallet: WalletState;
  ledgerEntries: LedgerEntry[];
  draftPapers: DraftPaper[];
  letters: PersistedLetter[];
  postalRecords: PostalRecord[];
}

export interface WritingRouteState {
  fromCity: string;
  toCity: string;
  distanceKm: number;
}

export interface WalletState {
  ownerMemberId: string;
  balanceFen: Fen;
  monthlyIncomeFen: Fen;
  dailyLivingCostFen: Fen;
  lastSettledAtIso: string;
}

export type LedgerEntryKind = "income" | "living_cost" | "postage" | "scribe_fee" | "adjustment";

export interface LedgerEntry {
  id: string;
  atIso: string;
  kind: LedgerEntryKind;
  amountFen: number;
  note: string;
}

export interface DraftPaper {
  id: string;
  authorMemberId: string;
  recipientMemberId: string;
  createdAtIso: string;
  updatedAtIso: string;
  oralText: string;
  scribeId: string | null;
  scribeDraft: string;
  finalText: string;
  readAloudText?: string;
  draftSource?: DraftSource;
  generationMeta?: ScribeGenerationMeta;
  status: "draft" | "scribed" | "revised" | "sealed";
}

export interface PersistedLetter {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  state: LetterState;
  sentAtIso: string;
  distanceKm: number;
  registered: boolean;
  hasPhoto: boolean;
  important: boolean;
  excerpt: string;
  body: string;
  oralText?: string;
  scribeId?: string | null;
  scribeDraft?: string;
  finalText?: string;
  readAloudText?: string;
  draftSource?: DraftSource;
  generationMeta?: ScribeGenerationMeta;
}

export interface PostalRecord {
  id: string;
  letterId: string;
  atIso: string;
  text: string;
}

export interface AppStateSettlementResult {
  state: AppState;
  changed: boolean;
}

export function createDefaultAppState(): AppState {
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    currentMemberId,
    recipientMemberId,
    members: members.map((member) => ({ ...member })),
    scribes: scribes.map((scribe) => ({
      ...scribe,
      specialties: [...scribe.specialties]
    })),
    writingRoute: { ...writingRoute },
    wallet: {
      ownerMemberId: currentMemberId,
      balanceFen: walletSeed.balanceFen,
      monthlyIncomeFen: walletSeed.monthlyIncomeFen,
      dailyLivingCostFen: walletSeed.dailyLivingCostFen,
      lastSettledAtIso: walletSeed.lastSettledAt.toISOString()
    },
    ledgerEntries: [],
    draftPapers: [],
    letters: letters.map((letter) => ({
      id: letter.id,
      senderId: letter.senderId,
      recipientId: letter.recipientId,
      subject: letter.subject,
      state: letter.state,
      sentAtIso: letter.sentAt.toISOString(),
      distanceKm: letter.distanceKm,
      registered: letter.registered,
      hasPhoto: letter.hasPhoto,
      important: letter.important,
      excerpt: letter.excerpt,
      body: letter.body
    })),
    postalRecords: letters.flatMap((letter) =>
      letter.records.map((record, index) => ({
        id: `${letter.id}-record-${index + 1}`,
        letterId: letter.id,
        atIso: new Date(letter.sentAt.getTime() + index * 60_000).toISOString(),
        text: record
      }))
    )
  };
}

export function serializeAppState(state: AppState): string {
  return JSON.stringify(state);
}

export function parseAppState(raw: string): AppState | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isAppState(value) ? value : null;
  } catch {
    return null;
  }
}

export function settleAppState(state: AppState, now: Date): AppStateSettlementResult {
  const lastSettledAt = new Date(state.wallet.lastSettledAtIso);

  if (now.getTime() <= lastSettledAt.getTime()) {
    return {
      state: cloneAppState(state),
      changed: false
    };
  }

  const settlement = settleWallet({
    balanceFen: state.wallet.balanceFen,
    monthlyIncomeFen: state.wallet.monthlyIncomeFen,
    dailyLivingCostFen: state.wallet.dailyLivingCostFen,
    lastSettledAt,
    now
  });
  const nextState = cloneAppState(state);
  const settledAtIso = settlement.settledAt.toISOString();

  nextState.wallet = {
    ...nextState.wallet,
    balanceFen: settlement.balanceFen,
    lastSettledAtIso: settledAtIso
  };
  nextState.ledgerEntries.push(
    ...settlement.entries.map((entry, index) => ({
      id: `ledger-${now.getTime()}-${state.ledgerEntries.length + index + 1}`,
      atIso: settledAtIso,
      kind: entry.kind,
      amountFen: entry.amountFen,
      note: entry.note
    }))
  );

  return {
    state: nextState,
    changed:
      settlement.balanceFen !== state.wallet.balanceFen ||
      settledAtIso !== state.wallet.lastSettledAtIso ||
      settlement.entries.length > 0
  };
}

export function cloneAppState(state: AppState): AppState {
  const parsed = parseAppState(serializeAppState(state));

  if (parsed === null) {
    throw new Error("Cannot clone invalid app state");
  }

  return parsed;
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === APP_STATE_SCHEMA_VERSION &&
    isString(value.currentMemberId) &&
    isString(value.recipientMemberId) &&
    isArrayOf(value.members, isMemberProfile) &&
    isArrayOf(value.scribes, isScribe) &&
    isWritingRouteState(value.writingRoute) &&
    isWalletState(value.wallet) &&
    isArrayOf(value.ledgerEntries, isLedgerEntry) &&
    isArrayOf(value.draftPapers, isDraftPaper) &&
    isArrayOf(value.letters, isPersistedLetter) &&
    isArrayOf(value.postalRecords, isPostalRecord)
  );
}

function isMemberProfile(value: unknown): value is MemberProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.dailyName) &&
    isString(value.envelopeName) &&
    isString(value.letterGreeting) &&
    isString(value.signatureName) &&
    isString(value.city) &&
    isString(value.district) &&
    isString(value.postOffice) &&
    isString(value.preferredScribeId)
  );
}

function isScribe(value: unknown): value is Scribe {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.city) &&
    isScribeStyle(value.style) &&
    isFen(value.feeFen) &&
    typeof value.attendanceRate === "number" &&
    value.attendanceRate >= 0 &&
    value.attendanceRate <= 1 &&
    isArrayOf(value.specialties, isString)
  );
}

function isWritingRouteState(value: unknown): value is WritingRouteState {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.fromCity) && isString(value.toCity) && isFiniteNonNegativeNumber(value.distanceKm);
}

function isWalletState(value: unknown): value is WalletState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.ownerMemberId) &&
    isFen(value.balanceFen) &&
    isFen(value.monthlyIncomeFen) &&
    isFen(value.dailyLivingCostFen) &&
    isIsoDateString(value.lastSettledAtIso)
  );
}

function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isIsoDateString(value.atIso) &&
    isLedgerEntryKind(value.kind) &&
    Number.isSafeInteger(value.amountFen) &&
    isString(value.note)
  );
}

function isDraftPaper(value: unknown): value is DraftPaper {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.authorMemberId) &&
    isString(value.recipientMemberId) &&
    isIsoDateString(value.createdAtIso) &&
    isIsoDateString(value.updatedAtIso) &&
    isString(value.oralText) &&
    (value.scribeId === null || isString(value.scribeId)) &&
    isString(value.scribeDraft) &&
    isString(value.finalText) &&
    isOptionalString(value.readAloudText) &&
    isOptionalDraftSource(value.draftSource) &&
    isOptionalGenerationMeta(value.generationMeta) &&
    isDraftPaperStatus(value.status)
  );
}

function isPersistedLetter(value: unknown): value is PersistedLetter {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.senderId) &&
    isString(value.recipientId) &&
    isString(value.subject) &&
    isLetterState(value.state) &&
    isIsoDateString(value.sentAtIso) &&
    isFiniteNonNegativeNumber(value.distanceKm) &&
    typeof value.registered === "boolean" &&
    typeof value.hasPhoto === "boolean" &&
    typeof value.important === "boolean" &&
    isString(value.excerpt) &&
    isString(value.body) &&
    isOptionalString(value.oralText) &&
    (value.scribeId === undefined || value.scribeId === null || isString(value.scribeId)) &&
    isOptionalString(value.scribeDraft) &&
    isOptionalString(value.finalText) &&
    isOptionalString(value.readAloudText) &&
    isOptionalDraftSource(value.draftSource) &&
    isOptionalGenerationMeta(value.generationMeta)
  );
}

function isPostalRecord(value: unknown): value is PostalRecord {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.id) && isString(value.letterId) && isIsoDateString(value.atIso) && isString(value.text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isFen(value: unknown): value is Fen {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIsoDateString(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value));
}

function isScribeStyle(value: unknown): value is Scribe["style"] {
  return value === "street" || value === "old-scholar" || value === "schoolmaster" || value === "clerk";
}

function isLedgerEntryKind(value: unknown): value is LedgerEntryKind {
  return (
    value === "income" ||
    value === "living_cost" ||
    value === "postage" ||
    value === "scribe_fee" ||
    value === "adjustment"
  );
}

function isDraftPaperStatus(value: unknown): value is DraftPaper["status"] {
  return value === "draft" || value === "scribed" || value === "revised" || value === "sealed";
}

function isOptionalDraftSource(value: unknown): value is DraftSource | undefined {
  return value === undefined || value === "template" || value === "handwritten" || value === "ai";
}

function isOptionalGenerationMeta(value: unknown): value is ScribeGenerationMeta | undefined {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    value.engine === "local-template-v1" &&
    isString(value.templateId) &&
    (value.scribeId === null || isString(value.scribeId)) &&
    isArrayOf(value.sceneTags, isString) &&
    (value.letterType === "ordinary" || value.letterType === "registered") &&
    isString(value.senderCity) &&
    isString(value.recipientCity)
  );
}

function isLetterState(value: unknown): value is LetterState {
  return (
    value === "draft" ||
    value === "scribed" ||
    value === "revised" ||
    value === "sealed" ||
    value === "posted" ||
    value === "accepted" ||
    value === "in_transit" ||
    value === "delayed" ||
    value === "misrouted" ||
    value === "lost" ||
    value === "found" ||
    value === "returned" ||
    value === "arrived" ||
    value === "opened" ||
    value === "archived"
  );
}

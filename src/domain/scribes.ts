import type { Fen } from "./money.js";

export type ScribeStyle = "street" | "old-scholar" | "schoolmaster" | "clerk";

export interface Scribe {
  id: string;
  name: string;
  city: string;
  style: ScribeStyle;
  feeFen: Fen;
  attendanceRate: number;
  specialties: string[];
}

export interface DailyAttendanceInput {
  city: string;
  date: Date;
  scribes: Scribe[];
}

export function getDailyAttendance(input: DailyAttendanceInput): Scribe[] {
  return input.scribes
    .filter((scribe) => scribe.city === input.city)
    .filter((scribe) => isScribePresent(scribe, input.date))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function isScribePresent(scribe: Scribe, date: Date): boolean {
  if (scribe.attendanceRate <= 0) {
    return false;
  }

  if (scribe.attendanceRate >= 1) {
    return true;
  }

  const roll = deterministicRoll(`${scribe.id}:${formatDateKey(date)}`);
  return roll < scribe.attendanceRate;
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

function deterministicRoll(seed: string): number {
  let hash = 2166136261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967296;
}

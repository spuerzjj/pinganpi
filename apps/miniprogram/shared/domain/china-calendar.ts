export const CHINA_TIME_ZONE = "Asia/Shanghai";

const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface ChinaLocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export function getChinaLocalDateParts(date: Date): ChinaLocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CHINA_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
    hour: readDatePart(parts, "hour"),
    minute: readDatePart(parts, "minute"),
    second: readDatePart(parts, "second"),
    millisecond: date.getUTCMilliseconds()
  };
}

export function formatChinaDateKey(date: Date): string {
  const localDate = getChinaLocalDateParts(date);

  return `${localDate.year}-${localDate.month}-${localDate.day}`;
}

export function getChinaLocalDayStartMs(date: Date): number {
  const localDate = getChinaLocalDateParts(date);

  return chinaLocalDateStartMs(localDate.year, localDate.month, localDate.day);
}

export function addChinaLocalDays(dayStartMs: number, days: number): number {
  const localDate = getChinaLocalDateParts(new Date(dayStartMs));

  return chinaLocalDateStartMs(localDate.year, localDate.month, localDate.day + days);
}

function chinaLocalDateStartMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - CHINA_UTC_OFFSET_MS;
}

function readDatePart(parts: Record<string, number>, part: string): number {
  const value = parts[part];

  if (value === undefined || !Number.isInteger(value)) {
    throw new Error(`Invalid ${part} part for ${CHINA_TIME_ZONE}`);
  }

  return value;
}

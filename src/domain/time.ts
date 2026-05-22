const YEAR_OFFSET = 66;
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const YEAR_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const MONTH_NAMES = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
] as const;

export function toEraDate(realDate: Date): Date {
  const localDate = getLocalDateParts(realDate);

  return new Date(
    Date.UTC(
      localDate.year - YEAR_OFFSET,
      localDate.month - 1,
      localDate.day,
      localDate.hour,
      localDate.minute,
      localDate.second,
      localDate.millisecond,
    ),
  );
}

export function formatEraDate(realDate: Date): string {
  const eraDate = toEraDate(realDate);
  const year = String(eraDate.getUTCFullYear())
    .split("")
    .map((digit) => YEAR_DIGITS[Number(digit)])
    .join("");
  const month = MONTH_NAMES[eraDate.getUTCMonth()];

  if (month === undefined) {
    throw new Error(`Invalid month: ${eraDate.getUTCMonth()}`);
  }

  return `${year}年${month}${formatChineseDay(eraDate.getUTCDate())}`;
}

export function formatPresentCorrespondence(realDate: Date): string {
  const localDate = getLocalDateParts(realDate);

  return `今时对应：${localDate.year} 年 ${localDate.month} 月 ${localDate.day} 日`;
}

function getLocalDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
    hour: readDatePart(parts, "hour"),
    minute: readDatePart(parts, "minute"),
    second: readDatePart(parts, "second"),
    millisecond: date.getUTCMilliseconds(),
  };
}

function readDatePart(parts: Record<string, number>, part: string): number {
  const value = parts[part];

  if (value === undefined || !Number.isInteger(value)) {
    throw new Error(`Invalid ${part} part for ${DEFAULT_TIME_ZONE}`);
  }

  return value;
}

function formatChineseDay(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }

  if (day < 10) {
    return `${YEAR_DIGITS[day]}日`;
  }

  if (day === 10) {
    return "十日";
  }

  if (day < 20) {
    return `十${YEAR_DIGITS[day - 10]}日`;
  }

  if (day === 20) {
    return "二十日";
  }

  if (day < 30) {
    return `二十${YEAR_DIGITS[day - 20]}日`;
  }

  if (day === 30) {
    return "三十日";
  }

  return "三十一日";
}

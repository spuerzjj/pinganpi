const YEAR_OFFSET = 66;
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
  return new Date(
    Date.UTC(
      realDate.getUTCFullYear() - YEAR_OFFSET,
      realDate.getUTCMonth(),
      realDate.getUTCDate(),
      realDate.getUTCHours(),
      realDate.getUTCMinutes(),
      realDate.getUTCSeconds(),
      realDate.getUTCMilliseconds(),
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
  return `今时对应：${realDate.getUTCFullYear()} 年 ${realDate.getUTCMonth() + 1} 月 ${realDate.getUTCDate()} 日`;
}

function formatChineseDay(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }

  if (day <= 10) {
    return `${YEAR_DIGITS[day]}日`;
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

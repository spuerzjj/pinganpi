export type Fen = number;

export function formatFen(totalFen: Fen): string {
  assertFen(totalFen);

  if (totalFen === 0) {
    return "0 分";
  }

  const yuan = Math.floor(totalFen / 100);
  const jiao = Math.floor((totalFen % 100) / 10);
  const fen = totalFen % 10;
  const parts: string[] = [];

  if (yuan > 0) {
    parts.push(`${yuan} 元`);
  }

  if (jiao > 0) {
    parts.push(`${jiao} 角`);
  }

  if (fen > 0) {
    parts.push(`${fen} 分`);
  }

  return parts.join(" ");
}

export function addFen(left: Fen, right: Fen): Fen {
  assertFen(left);
  assertFen(right);
  const sum = left + right;
  assertFen(sum);
  return sum;
}

export function subtractFen(balance: Fen, cost: Fen): Fen {
  assertFen(balance);
  assertFen(cost);

  if (balance < cost) {
    throw new Error(`钱匣不足：需 ${formatFen(cost)}，现余 ${formatFen(balance)}`);
  }

  return balance - cost;
}

function assertFen(value: Fen): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid fen amount: ${value}`);
  }
}

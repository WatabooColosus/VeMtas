export type MoneyMinor = bigint;
export function lineTotal(quantity: number, unitPriceMinor: bigint): bigint {
  if (!Number.isInteger(quantity) || quantity <= 0 || unitPriceMinor <= 0n)
    throw new Error("INVALID_LINE");
  return BigInt(quantity) * unitPriceMinor;
}
export function saleTotal(
  lines: Array<{ quantity: number; unitPriceMinor: bigint }>,
): bigint {
  return lines.reduce(
    (sum, line) => sum + lineTotal(line.quantity, line.unitPriceMinor),
    0n,
  );
}

export type LedgerLine = { direction: "DEBIT" | "CREDIT"; amountMinor: bigint };

export function assertBalanced(lines: LedgerLine[]): bigint {
  if (!lines.length) throw new Error("EMPTY_LEDGER");
  const debit = lines
    .filter((line) => line.direction === "DEBIT")
    .reduce((sum, line) => sum + line.amountMinor, 0n);
  const credit = lines
    .filter((line) => line.direction === "CREDIT")
    .reduce((sum, line) => sum + line.amountMinor, 0n);
  if (
    debit <= 0n ||
    debit !== credit ||
    lines.some((line) => line.amountMinor <= 0n)
  )
    throw new Error("UNBALANCED_LEDGER");
  return debit;
}

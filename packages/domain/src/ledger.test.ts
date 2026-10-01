import { describe, expect, it } from "vitest";
import { assertBalanced } from "./ledger.js";

describe("append-only ledger", () => {
  it("accepts balanced debit and credit", () =>
    expect(
      assertBalanced([
        { direction: "DEBIT", amountMinor: 100n },
        { direction: "CREDIT", amountMinor: 100n },
      ]),
    ).toBe(100n));
  it("rejects imbalance", () =>
    expect(() =>
      assertBalanced([
        { direction: "DEBIT", amountMinor: 100n },
        { direction: "CREDIT", amountMinor: 99n },
      ]),
    ).toThrow("UNBALANCED_LEDGER"));
});

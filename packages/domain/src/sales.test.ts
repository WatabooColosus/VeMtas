import { describe, expect, it } from "vitest";
import { lineTotal, saleTotal } from "./sales.js";
describe("cash sales", () => {
  it("calculates integer minor units", () =>
    expect(lineTotal(2, 1500n)).toBe(3000n));
  it("rejects zero quantity", () => expect(() => lineTotal(0, 100n)).toThrow());
  it("sums lines", () =>
    expect(
      saleTotal([
        { quantity: 1, unitPriceMinor: 100n },
        { quantity: 2, unitPriceMinor: 50n },
      ]),
    ).toBe(200n));
});

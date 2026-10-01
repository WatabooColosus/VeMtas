import { describe, expect, it } from "vitest";
import { claimOne } from "./outbox.js";
describe("worker outbox contract", () => {
  it("exports a transactional claim function", () =>
    expect(typeof claimOne).toBe("function"));
});

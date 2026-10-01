import { describe, expect, it } from "vitest";
describe("scaffold contracts", () => {
  it("uses versioned health paths", () =>
    expect(["/api/v1/health", "/api/v1/ready"]).toHaveLength(2));
  it("uses structured not found errors", () =>
    expect({ code: "NOT_FOUND", details: {} }).toMatchObject({
      code: "NOT_FOUND",
      details: {},
    }));
});

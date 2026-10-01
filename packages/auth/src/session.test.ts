import { describe, expect, it } from "vitest";
import { createSessionToken, hashSessionToken } from "./session.js";
describe("sessions", () =>
  it("stores only a one-way token hash", () => {
    const s = createSessionToken();
    expect(s.token).not.toBe(s.hash);
    expect(hashSessionToken(s.token)).toBe(s.hash);
  }));

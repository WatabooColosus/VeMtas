import { describe, expect, it } from "vitest";
import { transition } from "./state-machines.js";
describe("state machines", () => {
  it("activates pending credential", () =>
    expect(transition("credential", "PENDING", "ACTIVE")).toBe("ACTIVE"));
  it("rejects direct revoked credential", () =>
    expect(() => transition("credential", "PENDING", "REVOKED")).toThrow(
      "INVALID_CREDENTIAL_TRANSITION",
    ));
  it("suspends active terminal", () =>
    expect(transition("terminal", "ACTIVE", "SUSPENDED")).toBe("SUSPENDED"));
  it("rejects business skipping review", () =>
    expect(() => transition("business", "DRAFT", "ACTIVE")).toThrow());
  it("requires provider confirmation before posting a top up", () => {
    expect(transition("topup", "CREATED", "PROVIDER_PENDING")).toBe(
      "PROVIDER_PENDING",
    );
    expect(() => transition("topup", "CREATED", "POSTED")).toThrow(
      "INVALID_TOPUP_TRANSITION",
    );
  });
  it("requires validation before posting a refund", () => {
    expect(transition("refund", "REQUESTED", "VALIDATED")).toBe("VALIDATED");
    expect(() => transition("refund", "REQUESTED", "POSTED")).toThrow(
      "INVALID_REFUND_TRANSITION",
    );
  });
});

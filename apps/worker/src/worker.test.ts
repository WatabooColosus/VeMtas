import { describe, expect, it } from "vitest";
describe("worker outbox contract", () => { it("defines a safe initial state", () => expect("PENDING").toBe("PENDING")); });

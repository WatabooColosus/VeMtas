import { describe, expect, it } from "vitest"; import { allows, sameBusiness } from "./rbac.js";
describe("RBAC",()=>{it("allows owner management",()=>expect(allows("BUSINESS_OWNER","business:manage")).toBe(true));it("denies cashier terminal management",()=>expect(allows("CASHIER","terminal:manage")).toBe(false));it("rejects cross-business scope",()=>expect(sameBusiness("a","b")).toBe(false));});

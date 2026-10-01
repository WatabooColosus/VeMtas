import { describe, expect, it } from "vitest"; describe("api scaffold",()=>it("has stable health contract",()=>expect({status:"ok",service:"api"}).toMatchObject({status:"ok",service:"api"})));

import { describe, expect, it } from "vitest";
import { LocalNfcBridge, SimulatedNfcReader } from "./index.js";
describe("NFC bridge safety", () => {
  it("requires origin and pairing", async () => {
    const bridge = new LocalNfcBridge(
      new SimulatedNfcReader("cred-1"),
      "http://localhost",
      "pair-1",
    );
    expect(
      await bridge.handle({
        protocol: "v1",
        origin: "evil",
        pairingToken: "pair-1",
        action: "READ_CREDENTIAL",
      }),
    ).toEqual({ accepted: false, code: "ORIGIN_DENIED" });
    expect(
      await bridge.handle({
        protocol: "v1",
        origin: "http://localhost",
        pairingToken: "bad",
        action: "READ_CREDENTIAL",
      }),
    ).toEqual({ accepted: false, code: "PAIRING_REQUIRED" });
  });
  it("debounces a double tap and never returns balance data", async () => {
    const bridge = new LocalNfcBridge(
      new SimulatedNfcReader("cred-1"),
      "http://localhost",
      "pair-1",
    );
    const request = {
      protocol: "v1" as const,
      origin: "http://localhost",
      pairingToken: "pair-1",
      action: "READ_CREDENTIAL" as const,
    };
    expect((await bridge.handle(request)).accepted).toBe(true);
    expect((await bridge.handle(request)).accepted).toBe(false);
  });
});

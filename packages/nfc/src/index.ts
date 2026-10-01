export type NfcCredentialRead = {
  publicReference: string;
  readerId: string;
  readAt: string;
};
export type NfcReader = {
  read(signal?: AbortSignal): Promise<NfcCredentialRead>;
  close(): Promise<void>;
};
export type BridgeRequest = {
  protocol: "v1";
  origin: string;
  pairingToken: string;
  action: "READ_CREDENTIAL";
};
export type BridgeResponse =
  | { accepted: true; credential: NfcCredentialRead }
  | {
      accepted: false;
      code: "PAIRING_REQUIRED" | "ORIGIN_DENIED" | "NO_READER" | "ABORTED";
    };
export class SimulatedNfcReader implements NfcReader {
  private closed = false;
  private lastRead = "";
  constructor(
    private readonly credential: string,
    private readonly readerId = "simulated-reader",
  ) {}
  async read(signal?: AbortSignal): Promise<NfcCredentialRead> {
    if (this.closed || signal?.aborted) throw new Error("ABORTED");
    const now = new Date().toISOString();
    if (this.lastRead && Date.now() - Date.parse(this.lastRead) < 800)
      throw new Error("DOUBLE_TAP");
    this.lastRead = now;
    return {
      publicReference: this.credential,
      readerId: this.readerId,
      readAt: now,
    };
  }
  async close() {
    this.closed = true;
  }
}
export class LocalNfcBridge {
  constructor(
    private readonly reader: NfcReader | null,
    private readonly allowedOrigin: string,
    private readonly pairingToken: string,
  ) {}
  async handle(
    request: BridgeRequest,
    signal?: AbortSignal,
  ): Promise<BridgeResponse> {
    if (request.origin !== this.allowedOrigin)
      return { accepted: false, code: "ORIGIN_DENIED" };
    if (request.pairingToken !== this.pairingToken)
      return { accepted: false, code: "PAIRING_REQUIRED" };
    if (!this.reader) return { accepted: false, code: "NO_READER" };
    try {
      return { accepted: true, credential: await this.reader.read(signal) };
    } catch (error) {
      return {
        accepted: false,
        code:
          error instanceof Error && error.message === "ABORTED"
            ? "ABORTED"
            : "NO_READER",
      };
    }
  }
}

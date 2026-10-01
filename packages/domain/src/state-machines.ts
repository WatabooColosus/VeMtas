export type CredentialStatus =
  | "PENDING"
  | "ACTIVE"
  | "BLOCKED"
  | "REPLACED"
  | "REVOKED";
export type TerminalStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REVOKED";
export type BusinessStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED";
export type TopUpStatus =
  | "CREATED"
  | "PROVIDER_PENDING"
  | "CONFIRMED"
  | "POSTED"
  | "FAILED"
  | "EXPIRED";
export type RefundStatus =
  | "REQUESTED"
  | "VALIDATED"
  | "POSTED"
  | "COMPLETED"
  | "REJECTED";
const transitions: Record<string, Record<string, string[]>> = {
  credential: {
    PENDING: ["ACTIVE"],
    ACTIVE: ["BLOCKED", "REPLACED", "REVOKED"],
    BLOCKED: ["REPLACED", "REVOKED"],
  },
  terminal: {
    PENDING: ["AUTHORIZED"],
    AUTHORIZED: ["ACTIVE", "SUSPENDED", "REVOKED"],
    ACTIVE: ["SUSPENDED", "REVOKED"],
    SUSPENDED: ["ACTIVE", "REVOKED"],
  },
  business: {
    DRAFT: ["PENDING_VERIFICATION"],
    PENDING_VERIFICATION: ["UNDER_REVIEW", "REJECTED"],
    UNDER_REVIEW: ["VERIFIED", "REJECTED"],
    VERIFIED: ["ACTIVE"],
    ACTIVE: ["SUSPENDED"],
    SUSPENDED: ["ACTIVE"],
  },
  topup: {
    CREATED: ["PROVIDER_PENDING", "FAILED", "EXPIRED"],
    PROVIDER_PENDING: ["CONFIRMED", "FAILED", "EXPIRED"],
    CONFIRMED: ["POSTED"],
  },
  refund: {
    REQUESTED: ["VALIDATED", "REJECTED"],
    VALIDATED: ["POSTED", "REJECTED"],
    POSTED: ["COMPLETED"],
  },
};
export function transition(
  kind: "credential" | "terminal" | "business" | "topup" | "refund",
  from: string,
  to: string,
): string {
  if (!transitions[kind]?.[from]?.includes(to))
    throw new Error(`INVALID_${kind.toUpperCase()}_TRANSITION`);
  return to;
}

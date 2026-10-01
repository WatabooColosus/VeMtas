# PHASE-04 runtime evidence

Branch: `phase-03-commerce` (money sandbox work in progress).

Implemented:

- PostgreSQL schema for financial accounts, append-only ledger transactions/entries, mock topups and refunds.
- Ledger domain invariant requiring positive, balanced debit/credit entries.
- Mock top-up endpoint with idempotency key handling and no external provider.
- Refund endpoint with idempotency, captured-payment bounds and balanced compensating ledger entries.

Current verification:

- Money sandbox migration from empty PostgreSQL: PASS.
- Domain ledger unit tests: PASS.
- Monorepo lint/typecheck/integration: PASS.
- PostgreSQL concurrency harness: two serializable top-up attempts with the same idempotency key produce one committed row, and posted ledger entries remain balanced: PASS.
- Webhook deduplication harness: concurrent duplicate provider event inserts produce one persisted event: PASS.
- Failure injection harness: an injected exception rolls back top-up and ledger transaction state completely: PASS.

## Gate correction

Status: `IN_PROGRESS`. The previous PASS declaration exceeded the available evidence and is withdrawn.

The concurrency harness tests duplicate top-up inserts, not competing spends against one funded account. It bypasses the HTTP handlers. The injected exception tests explicit SQL rollback, not process crash recovery. Webhook tests prove inbox uniqueness, not payment processing exactly once. Migration runs were against an existing database; they do not independently prove an empty checkout/database gate.

Missing deliverables include PaymentIntent, wallet Payment, balance projection, financial receipts and reconciliation. F06/F07/F08 and the full MONEY suite are not demonstrated.

The first money slice now includes `payment_intents`, `payments`, idempotent intent creation, serialized balance checks and `GET /me/balance` as a ledger-derived projection. Capture creates a balanced debit from the user's account and credit to merchant payable. Full HTTP authorization and end-to-end capture tests remain pending.

Financial receipts (`RC`) are created transactionally during balance capture, exposed through `GET /receipts/:id`, and migration `0009` adds reconciliation records. Provider reconciliation execution remains pending.

The integration harness now verifies ledger-derived balance projection: a 1,000 COP credit projects 1,000 COP and a balanced 400 COP debit projects 600 COP without editing any balance column.

`POST /control/reconciliations` now records matched or mismatched periods with difference and audit event; it does not mutate ledger history.

Manual local runtime evidence: API `/ready` returned HTTP 200; unauthenticated reconciliation returned HTTP 403; authenticated platform reconciliation returned HTTP 201 with `MATCHED` and zero difference. The experimental child-process HTTP harness is retained for repair but is not part of the green integration command because Windows process-tree cleanup is not yet deterministic.

Code inspection also identifies unresolved security/correctness issues: caller-supplied actor headers are trusted; refund handlers do not verify merchant permission; replay checks do not compare actor and payload; cash refunds credit a wallet without an original wallet debit; ledger immutability and balance are not enforced by database constraints. These require correction and production-path tests before PASS.

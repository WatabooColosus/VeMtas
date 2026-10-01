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

The first money slice now includes `payment_intents`, `payments`, idempotent intent creation and `GET /me/balance` as a ledger-derived projection. Payment capture and debit authorization are still pending.

Code inspection also identifies unresolved security/correctness issues: caller-supplied actor headers are trusted; refund handlers do not verify merchant permission; replay checks do not compare actor and payload; cash refunds credit a wallet without an original wallet debit; ledger immutability and balance are not enforced by database constraints. These require correction and production-path tests before PASS.

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

PHASE-04 remains `IN_PROGRESS`: concurrent double-spend, webhook duplicate handling, refund API and crash/failure injection evidence remain before PASS.

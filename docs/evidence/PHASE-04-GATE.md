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

The reproducible HTTP harness starts the API directly with Node/tsx and verifies `/ready` HTTP 200, unauthenticated reconciliation HTTP 403 and authenticated platform reconciliation HTTP 201 with `MATCHED` and zero difference.

Latest runtime evidence (2026-09-30):

- `pnpm lint` — PASS across 16 packages.
- `pnpm typecheck` — PASS across 16 packages.
- `pnpm test` — PASS across 16 packages (unit suites green).
- `pnpm build` — PASS across 16 packages, including all four Next applications.
- `pnpm test:integration` — PASS against local PostgreSQL, including HTTP capture, idempotency collisions, rollback, webhook authentication, receipt authorization and two competing captures (one `201`, one `409`, final balance `100`).
- Clean database proof — PASS: new `vemtas_clean` database, `pnpm migration-from-zero`, ten migrations applied and 35 public tables created.
- Cash refund correction — PASS by inspection and regression suite: cash refunds no longer mint wallet credit.
- Persisted session path — PASS for registration-issued bearer sessions on balance, payment intents, top-ups, captures, receipts and refunds; each route checks hash, expiry, revocation and active user before resolving the actor.
- Session lifecycle HTTP proof — PASS: registration issues a bearer token, revocation persists `revoked_at`, and a subsequent balance request returns `401`.

The phase remains `IN_PROGRESS`; these results strengthen runtime evidence but do not prove real authentication, provider reconciliation processing, crash recovery or production readiness.

Remaining security/correctness issues include legacy caller-supplied actor-header compatibility on routes not yet migrated to bearer sessions; replay and provider processing semantics are not fully verified; and crash recovery/provider reconciliation remain unproven. Merchant scope checks are enforced on the refund path, and cash refunds no longer mint wallet credit. Ledger immutability constraints and balance checks are covered for the implemented money slice, but full production-path verification remains required before PASS.

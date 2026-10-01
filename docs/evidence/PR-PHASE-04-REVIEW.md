# PHASE-04 review package

Branch: `phase-03-commerce`
Status: `IN_PROGRESS`

## Implemented

- PostgreSQL money sandbox with append-only ledger transactions and entries.
- Idempotent mock top-ups and payment intents.
- Serialized wallet capture with ledger-derived balance.
- Financial receipts linked to wallet payments.
- Cash refund path that does not mint wallet credit.
- Persisted bearer sessions: issuance, identity lookup and revocation.
- Session support on balance, intents, top-ups, captures, receipts and refunds.
- Health/readiness endpoints and HTTP integration harness.
- Ledger-derived reconciliation mode when `observed_minor` is omitted, with safe-integer overflow protection.

## Evidence commands

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:integration
pnpm migration-from-zero
```

All commands pass on the local checkout with PostgreSQL Docker services running. The clean database check creates a new database, applies ten migrations and verifies 35 public tables.

## HTTP evidence

- Session registration, `/auth/me`, revocation and post-revocation `401`.
- Health/readiness and platform authorization.
- Idempotency payload/actor collision rejection.
- Wallet capture projection and two competing captures: one `201`, one `409`, final balance preserved.
- Unauthorized webhook and receipt scope rejection.
- Reconciliation accepts explicit mock observations for compatibility and can derive the observed value from posted ledger entries.

## Not yet PASS

Real provider reconciliation and webhook processing, crash recovery, complete migration of legacy actor-header routes, and human review of the branch remain open. No production money or provider credentials are connected.

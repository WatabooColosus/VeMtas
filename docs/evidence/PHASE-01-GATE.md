# PHASE-01 gate evidence

Branch: `phase-01-rebuild`

Verified locally with Docker Desktop and PostgreSQL 16:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm migration-from-zero`
- `pnpm test:integration`
- API `/health` and `/ready` against PostgreSQL

Scope is limited to scaffold, runtime, migration infrastructure, outbox foundation, shells and CI. Product identity, wallet, payments, promotions, Discovery and physical NFC remain outside PHASE-01.

# PHASE-02 runtime evidence

Branch: `phase-02-identity-organizations`

Verified against local PostgreSQL and API runtime:

- `pnpm migration-from-zero` — PASS
- `pnpm test:integration` — PASS
- `pnpm typecheck` — PASS
- `pnpm lint` — PASS
- `POST /api/v1/auth/register` — HTTP 201
- duplicate registration — HTTP 409
- credential block without actor — HTTP 401
- SQL integration: user/profile, business scope, audit, credential block, terminal suspension — PASS

PHASE-02 remains IN_PROGRESS until the full F01–F04 integration suite and human gate review are complete.

HTTP F03/F04 runtime matrix: register=201, business=201, submit=PENDING_VERIFICATION, branch=201, terminal=201, authorize=AUTHORIZED, suspend=SUSPENDED, resume=ACTIVE, cross-scope=403.

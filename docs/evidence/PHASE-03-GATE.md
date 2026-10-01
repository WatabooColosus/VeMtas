# PHASE-03 runtime evidence

Branch: `phase-03-commerce`

Implemented and verified locally:

- `0005_commerce.sql` adds catalog, variants, prices, sales, sale lines, receipts and captured cash payments.
- `POST /api/v1/sales` validates active business, branch, authorized terminal, cashier scope and active prices, then commits sale, cash payment and receipt snapshot in one transaction.
- Historical receipt snapshot remains unchanged when the current price changes.
- Invalid actor/scope/terminal and missing active price are rejected before completion.
- No VeMtas balance or ledger tables are touched by the cash sale flow.
- `pnpm migration-from-zero` — PASS on dev and test PostgreSQL.
- `pnpm test:integration` — PASS (PostgreSQL reachability, PHASE-02 regression, cash sale snapshot/payment invariants).
- `pnpm lint` — PASS (16 packages).
- `pnpm typecheck` — PASS (16 packages).
- `pnpm test` — PASS (16 packages).
- `pnpm build` — PASS (16 packages; four Next.js shells built).
- API runtime: `/health` HTTP 200 and `/ready` HTTP 200 with database check `ok`.

PHASE-03 remains `IN_PROGRESS`: catalog management endpoints, basic inventory operations and review eligibility still require implementation before the phase gate can be marked PASS.

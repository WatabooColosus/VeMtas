# PHASE-03 runtime evidence

Branch: `phase-03-commerce`

Implemented and verified locally:

- `0005_commerce.sql` adds catalog, variants, prices, sales, sale lines, receipts and captured cash payments.
- `POST /api/v1/sales` validates active business, branch, authorized terminal, cashier scope and active prices, then commits sale, cash payment and receipt snapshot in one transaction.
- Catalog endpoints now cover product, variant, branch price and inventory balance creation/update with owner/admin/manager scope checks.
- Review eligibility is created for a customer-backed completed sale, can be consumed exactly once, and publishes a verified review.
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

Auto-gate approval: authorized by user. All recorded local checks are green and the phase invariants are covered by integration evidence. PHASE-03 status: `PASS`.

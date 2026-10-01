# PHASE-01 — Scaffold

Status: PASS

## Entregables

- monorepo/workspace;
- apps consumer, business, control, web-terminal;
- backend modular;
- packages contracts/config/testing;
- PostgreSQL dev/test;
- migraciones;
- lint;
- typecheck;
- unit test runner;
- integration test harness;
- CI;
- health/readiness endpoints;
- .env.example sin secretos.

## Gate

- checkout limpio instala reproduciblemente;
- build PASS;
- lint PASS;
- typecheck PASS;
- tests PASS;
- DB vacía migra a latest;
- health endpoint responde;
- CI reproduce lo anterior.

## Prohibido

No implementar todavía wallet, pagos reales, promociones o hardware NFC real.

# ADR-017 — CI GitHub Actions

Status: ACCEPTED

## Decisión

GitHub Actions es el gate inicial del repositorio.

## Checks mínimos

- dependency install frozen;
- formatting/lint;
- typecheck;
- unit;
- integration con PostgreSQL;
- migration-from-zero;
- build;
- secret scan/dependency/security checks razonables.

Los gates financieros se añaden desde PHASE-04 y no pueden convertirse en optional.

# PHASE-00 — Technical Decisions

Status: PASS

## Objetivo

Eliminar decisiones estructurales que Codex no debe improvisar.

## Decisiones aceptadas

- TypeScript.
- Next.js App Router para superficies web/PWA.
- PostgreSQL.
- monolito modular.
- API /api/v1.
- adaptadores hardware/proveedores.
- pnpm workspaces + Turborepo — ADR-005.
- Drizzle ORM/Kit — ADR-006.
- identidad VeMtas + auth basada en estándares — ADR-007.
- Transactional Outbox + worker — ADR-008.
- MapLibre + geografía propia/PostGIS — ADR-009.
- NotificationService + adapters — ADR-010.
- ObjectStorage S3-compatible — ADR-011.
- Docker Compose local + runtime Node portable — ADR-012.
- OpenTelemetry — ADR-013.
- Android NFC nativo detrás de adapter — ADR-014.
- USB NFC mediante bridge PC/SC — ADR-015.
- estructura de apps/packages — ADR-016.
- GitHub Actions CI — ADR-017.

## Evidencia

ADRs ACCEPTED versionados en docs/decisions/.

## Gate

PASS.

La siguiente fase permitida es PHASE-01 — Scaffold.

# ADR-005 — Workspace y tooling

Status: ACCEPTED

## Decisión

Usar pnpm workspaces + Turborepo.

## Razón

VeMtas tendrá varias apps y paquetes TypeScript compartidos. pnpm reduce duplicación y Turborepo permite ejecutar build/test/lint por grafo sin convertir la arquitectura en microservicios.

## Regla

Un único lockfile versionado. CI usa instalación frozen.

# PHASE-00 — Technical Decisions

Status: IN_PROGRESS

## Objetivo

Eliminar decisiones estructurales que Codex no debe improvisar.

## Ya aceptado

- TypeScript como lenguaje principal.
- Next.js App Router para superficies web/PWA.
- PostgreSQL como base transaccional.
- monolito modular.
- API /api/v1.
- adaptadores para hardware/proveedores.

## Por cerrar mediante ADR

- package manager/workspace;
- ORM/migrations;
- auth;
- background jobs;
- maps;
- push notifications;
- object storage;
- local environment;
- hosting;
- observability;
- Android NFC;
- USB PC/SC.

## Gate

PASS cuando:
- cada decisión obligatoria tiene ADR ACCEPTED;
- no quedan decisiones de scaffold estructurales sin dueño;
- documentos no se contradicen.

# ADR-008 — Jobs con Outbox primero

Status: ACCEPTED

## Decisión

Usar Transactional Outbox en PostgreSQL para efectos asíncronos críticos. Worker TypeScript procesa jobs idempotentes.

Redis/cola dedicada no es requisito de MVP.

## Razón

Evita el fallo DB-commit / message-not-sent y reduce infraestructura inicial.

## Regla

Notificaciones, indexación, beneficios derivados y webhooks salientes pueden usar outbox. Movimiento de ledger no depende de una cola.

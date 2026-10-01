# ADR-010 — Notificaciones

Status: ACCEPTED

## Decisión

Crear NotificationService interno y persistir preferencias/entregas.

Push móvil/web se implementará mediante adaptadores. FCM/Web Push son opciones iniciales, no dominio.

## Reglas

- transacción no depende de que llegue notificación;
- retries idempotentes;
- preferencias y quiet/rate limits;
- mensajes financieros no contienen secretos.

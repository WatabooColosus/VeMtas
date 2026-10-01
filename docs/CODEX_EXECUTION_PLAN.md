# Plan de ejecución para Codex

## Regla operacional

Codex trabaja una fase por vez.

Para cada fase:

1. leer MASTER_SPEC, ENGINEERING_BLUEPRINT, INVARIANTS y ADRs;
2. crear/actualizar issue de implementación;
3. implementar únicamente el alcance;
4. ejecutar migraciones desde base vacía;
5. ejecutar tests;
6. ejecutar E2E del gate;
7. documentar evidencia;
8. abrir PR;
9. no iniciar la siguiente fase hasta integrar la anterior.

## Fase 0 — Scaffold

Entregables:
- workspace;
- apps consumer/business/control/web-terminal como shells;
- backend modular;
- packages contracts/config/testing;
- PostgreSQL dev/test;
- migrations;
- lint/typecheck/test;
- CI.

Gate:
- instalación limpia;
- build verde;
- DB migra desde cero;
- health endpoint;
- CI verde.

## Fase 1 — Identity + Organizations + Audit

Entregables:
- User/Profile;
- auth abstraction;
- Business/Branch;
- Membership/RBAC;
- Register/Terminal;
- Credential;
- AuditEvent.

Gate:
- F01, F02, F03, F04;
- RBAC negative tests;
- bloqueo NFC.

## Fase 2 — Catalog + Sales Cash

Entregables:
- catálogo;
- variantes/precios;
- Sale/SaleLine;
- venta cash;
- receipt;
- review eligibility básica.

Gate:
- F05;
- snapshot de precios;
- negocio/terminal inválido rechazado.

## Fase 3 — Money Sandbox

Entregables:
- FinancialAccount;
- LedgerTransaction/Entry;
- balance projection;
- PaymentIntent;
- TopUp mock;
- Payment saldo;
- Refund;
- comprobantes financieros.

Gate:
- F06/F07/F08;
- toda suite MONEY;
- concurrencia real contra PostgreSQL.

## Fase 4 — NFC Hardware Pilot

Entregables:
- AndroidNfcAdapter;
- UsbPcscAdapter/bridge;
- pairing terminal;
- flujo presencial.

Gate:
- NFC físico de extremo a extremo;
- doble tap;
- tarjeta bloqueada;
- terminal suspendido;
- pérdida de conexión.

## Fase 5 — Growth

Entregables:
- promociones;
- funding source;
- loyalty;
- benefits;
- campaign safety.

Gate:
- presupuesto/límites;
- no doble redemption;
- pruebas de abuso básicas.

## Fase 6 — Discovery

Entregables:
- ubicación de sucursales;
- nearby;
- search;
- favoritos;
- perfiles públicos;
- preferencias de notificación.

Gate:
- consultas geográficas;
- privacidad;
- patrocinado diferenciado de orgánico.

## Fase 7 — Experiences + Reputation

Entregables:
- routes/checkpoints/progress;
- events;
- reviews verificadas.

Gate:
- F10/F11;
- recompensa única;
- review única por elegibilidad.

## Fase 8 — Provider Sandbox

Implementar primero UN PaymentProvider real en sandbox, no cinco simultáneamente.

Luego:
- webhook verification;
- reconciliation;
- outage simulation.

FinancingProvider se implementa separado y nunca inventa elegibilidad.

Gate:
- proveedor duplicado;
- timeout;
- callback tardío;
- conciliación.

## Fase 9 — Pilot Readiness

- observabilidad;
- backups/restores probados;
- incident runbooks;
- rate limiting;
- security review;
- load test;
- accessibility;
- privacy review;
- data retention;
- operational dashboards.

## Prohibiciones para Codex

No:
- inventar reglas de dinero;
- introducir microservicios sin ADR;
- conectar producción por conveniencia;
- guardar secretos;
- editar saldo directamente;
- usar floats para dinero;
- saltar permisos en UI;
- tratar NFC UID como autorización suficiente;
- continuar fase con gate rojo.

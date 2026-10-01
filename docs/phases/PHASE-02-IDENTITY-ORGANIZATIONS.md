# PHASE-02 — Identity + Organizations + Audit

Status: PASS

## Entregables

User/Profile/Auth abstraction/Session/Device/Credential.
Business/Branch/Membership/RBAC/Register/Terminal.
AuditEvent.

## Procesos

F01 registro usuario.
F02 afiliación NFC lógica.
F03 alta negocio.
F04 terminal.

## Gate

- permisos positivos y negativos;
- cross-business access rechazado;
- credential unique/active rules;
- bloqueo/reemplazo;
- terminal suspendido;
- audit obligatorio;
- integration tests con PostgreSQL.

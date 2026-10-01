# ADR-007 — Autenticación propia basada en estándares

Status: ACCEPTED

## Decisión

El dominio de identidad pertenece a VeMtas. Implementar autenticación mediante librería estándar/auditada compatible con sesiones server-side, credenciales/passkeys y OAuth cuando se habilite; no acoplar User a un SaaS de identidad.

## Primera implementación

Email/teléfono verificado + sesión segura. Passkeys/WebAuthn se incorpora como mecanismo fuerte.

## Reglas

- passwords, si existen, solo hash resistente y parámetros actuales;
- session tokens opacos/hash en persistencia;
- rotación/revocación;
- MFA/challenge para acciones sensibles;
- proveedor social es AuthIdentity, no User;
- nunca construir criptografía casera.

La librería concreta puede actualizarse sin alterar el modelo de dominio.

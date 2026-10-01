# ADR-006 — PostgreSQL + Drizzle

Status: ACCEPTED

## Decisión

PostgreSQL es la fuente transaccional y Drizzle ORM/Drizzle Kit será la capa TypeScript de esquema/migraciones.

## Razón

Se necesita control SQL visible, constraints reales, transacciones y pruebas de concurrencia. El ledger no debe ocultarse detrás de abstracciones mágicas.

## Reglas

- migraciones SQL/versionadas;
- constraints en DB además de validación app;
- transacciones financieras explícitas;
- tests de concurrencia contra PostgreSQL real;
- dinero bigint/integer de unidad menor según rango, nunca float;
- PostGIS podrá añadirse por migración cuando Discovery lo requiera.

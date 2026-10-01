# ADR-013 — Observabilidad OpenTelemetry

Status: ACCEPTED

## Decisión

Instrumentación basada en OpenTelemetry para traces/metrics y logging estructurado.

## Reglas

- correlation_id desde borde hasta efectos;
- no PII/secrets/NFC material en logs;
- errores financieros incluyen referencia segura;
- exporter configurable por entorno;
- health/readiness separados.

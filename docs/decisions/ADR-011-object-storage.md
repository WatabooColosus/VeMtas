# ADR-011 — Object Storage S3-compatible

Status: ACCEPTED

## Decisión

Usar contrato ObjectStorage con API S3-compatible.

Local: MinIO o equivalente en contenedor.
Producción: proveedor S3-compatible seleccionado por entorno.

## Uso

Fotos, documentos, exports y artefactos grandes. Ledger y metadatos críticos permanecen en PostgreSQL.

## Regla

DB almacena referencia, hash/metadata y ownership; no URLs temporales como identidad permanente.

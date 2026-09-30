# ADR-003 — Monolito modular inicial

## Estado

Aceptado.

## Decisión

VeMtas comenzará como un monolito modular con límites de dominio claros.

## Motivo

El proyecto todavía está en fase inicial. Introducir múltiples microservicios aumentaría despliegues, contratos, observabilidad y fallos distribuidos sin beneficio suficiente.

## Evolución

Un módulo podrá extraerse a servicio independiente cuando exista evidencia operacional que lo justifique.

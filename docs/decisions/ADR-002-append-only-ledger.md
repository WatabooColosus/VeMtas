# ADR-002 — Ledger append-only

## Estado

Aceptado.

## Decisión

Las operaciones financieras confirmadas no se modifican ni eliminan. Los errores se corrigen mediante reversos, reembolsos o ajustes compensatorios.

## Consecuencias

- auditoría reproducible;
- balances derivados de movimientos;
- prohibición de edición manual directa del saldo;
- conciliación y reconstrucción histórica.

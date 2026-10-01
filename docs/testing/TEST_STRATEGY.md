# Estrategia de pruebas

## Pirámide

### Unit
Reglas de dominio, state machines, promociones, permisos y cálculos.

### Integration
PostgreSQL real de test, repositorios, transacciones, constraints, ledger.

### Contract
Adapters de proveedores y contratos API.

### E2E
Flujos críticos completos.

## Suite obligatoria MONEY

- ledger balancea débitos/créditos;
- monto cero/negativo rechazado donde no corresponda;
- moneda incompatible rechazada;
- double spend concurrente;
- webhook duplicado;
- idempotency key repetida;
- idempotency key reutilizada con payload distinto;
- refund parcial;
- refund excesivo;
- reverso no borra original;
- caída simulada antes/después de post;
- settlement suma exactamente sus items.

## Suite obligatoria NFC

- credencial activa;
- bloqueada;
- reemplazada;
- desconocida;
- doble lectura;
- terminal suspendido;
- credential replay sobre intent expirado.

## Suite obligatoria RBAC

Para cada endpoint sensible:
- rol permitido = éxito;
- rol no permitido = 403;
- mismo rol en otro business = 403;
- branch fuera de scope = 403.

## Suite obligatoria Growth

- límites por usuario;
- límites globales;
- presupuesto;
- fechas;
- compra mínima;
- idempotencia redemption;
- funding source.

## E2E MVP

E2E-01 usuario → NFC → efectivo → receipt.
E2E-02 topup sandbox → saldo.
E2E-03 usuario → NFC → saldo → receipt.
E2E-04 compra concurrente con fondos insuficientes para ambas.
E2E-05 bloqueo NFC → rechazo → reemplazo → compra.
E2E-06 refund → ledger compensatorio.
E2E-07 promoción → beneficio.
E2E-08 ruta → checkpoint → recompensa única.
E2E-09 review verificada.
E2E-10 proveedor webhook duplicado.

## Gate

No se avanza de fase con tests críticos rojos.

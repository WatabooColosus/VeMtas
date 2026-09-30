# VeMtas — Threat Model v0.1

## Activos críticos

- identidad de usuario;
- credenciales NFC;
- saldo y ledger;
- cuentas de negocios;
- terminales;
- comprobantes;
- promociones;
- integraciones;
- auditoría.

## Amenazas prioritarias

- tarjeta NFC clonada o robada;
- doble lectura;
- doble gasto;
- webhooks duplicados o falsos;
- comercio falso;
- empleado fraudulento;
- administrador abusivo;
- recargas inexistentes;
- devolución fraudulenta;
- promoción mal configurada;
- colusión negocio/usuario;
- ruta explotada sin compra;
- robo de sesión;
- lector/terminal no autorizado;
- caída de proveedor;
- caída del Core durante una compra.

## Controles iniciales

- credenciales revocables;
- idempotencia;
- operaciones atómicas;
- RBAC;
- terminales autorizados;
- riesgo por transacción;
- aprobación de comercios;
- logs de auditoría;
- comprobantes inmutables;
- kill switches;
- límites de campaña;
- verificación de webhooks;
- recuperación por estados transaccionales.

## Pagos offline

No permitidos para saldo VeMtas en MVP.

El sistema podrá registrar operaciones no financieras pendientes de sincronización si se diseña un mecanismo separado y seguro.

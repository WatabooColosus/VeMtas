# Arquitectura VeMtas — Overview

## Principio

VeMtas Core es la fuente de verdad de identidad, estado transaccional y reglas del ecosistema.

Los proveedores externos son adaptadores, no el centro del dominio.

## Módulos

### Core

Identidad, usuarios, roles, credenciales, sesiones y reglas comunes.

### Commerce

Negocios, sucursales, empleados, cajas, terminales, catálogos, productos, servicios e inventario.

### Money

Payment intents, wallet abstractions, ledger, recargas, pagos, reembolsos, liquidaciones y conciliación.

### Guardian

Autenticación reforzada, permisos, fraude, riesgo, abuso promocional, confianza de dispositivos, auditoría y kill switches.

### Discovery

Mapa, búsqueda, cercanía, filtros y descubrimiento.

### Growth

Promociones, descuentos, fidelización, recompensas y campañas.

### Experiences

Rutas, checkpoints, eventos y festivales.

### Connect

Adaptadores a pasarelas, financiación, POS/ERP, facturación y APIs de terceros.

### Control

Backoffice, aprobación de negocios, finanzas operativas, configuración y gobierno.

## Aplicaciones

- consumer
- business
- web-terminal
- admin/control

Todas consumen contratos versionados del mismo backend.

## Terminal

Jerarquía lógica:

Negocio → sucursal → caja → terminal → empleado/sesión.

## NFC

El lector entrega una credencial; el servidor resuelve identidad y autorización.

El hardware se abstrae mediante adaptadores, por ejemplo:

- AndroidNfcAdapter
- UsbPcscAdapter
- FutureHardwareAdapter

## Proveedores

Definir interfaces abstractas antes de implementar un proveedor específico:

- PaymentProvider
- FinancingProvider
- FiscalProvider
- PosConnector
- NotificationProvider

## Persistencia

PostgreSQL es la opción inicial recomendada.

El ledger debe ser transaccional, append-only y protegido contra doble gasto.

## Integración

Las integraciones externas deben usar:

- idempotency keys;
- webhooks verificados;
- estados explícitos;
- auditoría;
- reintentos seguros.

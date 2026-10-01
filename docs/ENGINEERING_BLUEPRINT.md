# VeMtas Engineering Blueprint — v1

## Objetivo

Este documento convierte la especificación de producto en un contrato ejecutable para Codex.

Codex implementa; no redefine producto, dinero, permisos ni seguridad sin ADR.

## Stack de referencia

- TypeScript como lenguaje principal.
- Next.js App Router para superficies web/PWA.
- PostgreSQL como base transaccional.
- API versionada bajo /api/v1.
- Validación de entrada/salida mediante esquemas compartidos.
- Migraciones versionadas.
- Jobs/colas para efectos asíncronos.
- Android NFC mediante adaptador nativo cuando el navegador no pueda cumplir el flujo requerido.
- USB NFC mediante PC/SC o bridge local, detrás de contrato NfcReader.
- Proveedores externos detrás de interfaces internas.

La elección de ORM, proveedor de auth, cola, hosting, mapas y notificaciones se cerrará por ADR antes de implementación productiva.

## Reglas de implementación

1. IDs internos opacos y no secuenciales expuestos externamente.
2. Montos monetarios como enteros en unidad menor; nunca float.
3. Moneda explícita ISO-4217, inicialmente COP.
4. Fechas persistidas en UTC; zona local solo en presentación/reglas explícitas.
5. Toda escritura crítica requiere actor y correlation_id.
6. Toda operación reintentable debe ser idempotente.
7. Ledger append-only.
8. Balances son proyecciones derivadas/verificables.
9. Webhooks se autentican/verifican y deduplican.
10. Ningún secreto en repo.
11. RBAC y scope de organización/sucursal se validan en backend.
12. El frontend nunca decide autorización financiera.
13. Estados se modifican mediante transiciones permitidas, no strings arbitrarios.
14. Cambios de arquitectura requieren ADR.

## Contextos de dominio

### Identity
User, Profile, AuthIdentity, Session, Credential, Device.

### Organizations
Business, Branch, Membership, Role, Permission, Register, Terminal.

### Catalog
Category, Product, Variant, Price, InventoryItem.

### Sales
Cart/Sale, SaleLine, PaymentIntent, Payment, Receipt.

### Money
FinancialAccount, LedgerTransaction, LedgerEntry, TopUp, Refund, Settlement, Reconciliation.

### Growth
Promotion, PromotionRule, Benefit, LoyaltyProgram, LoyaltyAccount.

### Discovery
PlaceProjection, Favorite, SearchIndexProjection.

### Experiences
Route, RouteCheckpoint, UserRouteProgress, Event.

### Reputation
Review, ReviewEligibility.

### Guardian
RiskAssessment, SecurityChallenge, AuditEvent, Incident, KillSwitch.

### Connect
ProviderConnection, ExternalReference, WebhookEvent.

## Patrón de módulos

Cada módulo debe separar como mínimo:

- domain: reglas puras;
- application: casos de uso;
- infrastructure: DB/proveedores;
- interface: API/handlers.

Un módulo no lee tablas privadas de otro módulo para saltarse sus casos de uso.

## Eventos de dominio iniciales

- UserRegistered
- CredentialLinked
- CredentialBlocked
- BusinessSubmitted
- BusinessApproved
- TerminalAuthorized
- SaleCreated
- PaymentIntentCreated
- PaymentAuthorized
- PaymentCompleted
- PaymentFailed
- CashSaleRecorded
- TopUpConfirmed
- LedgerTransactionPosted
- ReceiptIssued
- RefundPosted
- SettlementPosted
- BenefitGranted
- PromotionApplied
- RouteCheckpointCompleted
- ReviewSubmitted
- RiskChallengeRequired

Los eventos internos no sustituyen transacciones de base de datos; coordinan efectos secundarios.

## Definition of Done global

Una tarea no está terminada hasta que:

- compila;
- lint/typecheck pasa;
- unit tests pasan;
- integration tests pasan cuando toca DB;
- migraciones aplican desde cero;
- permisos negativos están probados;
- idempotencia está probada si aplica;
- documentación/API se actualiza;
- no aparecen secretos;
- logs contienen correlation_id;
- invariantes afectadas continúan verdes.

# API Contract v1 — mapa

Base: /api/v1

No es OpenAPI final; define recursos y ownership.

## Auth / Me

- POST /auth/register
- POST /auth/verify
- POST /auth/session
- DELETE /auth/session/:id
- GET /me
- PATCH /me
- GET /me/devices
- GET /me/credentials
- POST /me/credentials/:id/block

## Businesses

- POST /businesses
- GET /businesses/:id
- POST /businesses/:id/submit
- POST /businesses/:id/approve [platform]
- POST /businesses/:id/suspend [platform/risk]
- GET/POST /businesses/:id/branches
- GET/POST /businesses/:id/memberships
- GET/POST /branches/:id/registers
- GET/POST /branches/:id/terminals

## Catalog

- GET/POST /businesses/:id/products
- GET/PATCH /products/:id
- GET/POST /products/:id/variants
- GET/POST /variants/:id/prices

## Sales

- POST /sales
- POST /sales/:id/lines
- POST /sales/:id/ready
- GET /sales/:id
- POST /sales/:id/cancel

## Payment intents

- POST /sales/:id/payment-intents
- POST /payment-intents/:id/present-credential
- POST /payment-intents/:id/authorize
- GET /payment-intents/:id

## Topups

- POST /me/topups
- GET /me/topups/:id
- POST /webhooks/payments/:provider

## Money

- GET /me/balance
- GET /me/movements
- GET /businesses/:id/payables
- GET /businesses/:id/settlements
- POST /payments/:id/refunds
- GET /receipts/:id

## Growth

- GET/POST /businesses/:id/promotions
- GET /me/benefits
- GET /me/loyalty

## Discovery

- GET /discovery/nearby
- GET /discovery/search
- GET /places/:id
- POST/DELETE /me/favorites/:businessId

## Routes/events

- GET /routes
- GET /routes/:id
- GET /me/routes
- GET /events

## Reviews

- POST /review-eligibilities/:id/review
- GET /businesses/:id/reviews

## Control

- GET /control/audit
- GET /control/incidents
- POST /control/kill-switches
- GET /control/reconciliations

## Error envelope

Toda API devuelve errores estructurados:

{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "…",
    "correlation_id": "…",
    "details": {}
  }
}

Los códigos son estables; los mensajes pueden localizarse.

## Idempotencia

Endpoints financieros de creación aceptan Idempotency-Key.

La misma clave + mismo actor + mismo endpoint + mismo payload devuelve el resultado original.

La misma clave con payload diferente se rechaza.

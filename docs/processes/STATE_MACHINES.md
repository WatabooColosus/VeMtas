# Máquinas de estado

## Business

DRAFT → PENDING_VERIFICATION → UNDER_REVIEW → VERIFIED → ACTIVE.

ACTIVE ↔ SUSPENDED según control.

PENDING/UNDER_REVIEW pueden terminar REJECTED.

## Credential

PENDING → ACTIVE → BLOCKED.

ACTIVE/BLOCKED → REPLACED cuando se emite sustituta.

ACTIVE/BLOCKED → REVOKED para cierre definitivo.

## Terminal

PENDING → AUTHORIZED → ACTIVE.

ACTIVE → SUSPENDED → ACTIVE con autorización.

Cualquier terminal comprometido puede terminar REVOKED.

## Sale

DRAFT → READY_FOR_PAYMENT → PAYMENT_PENDING → COMPLETED.

Alternativas: CANCELLED, EXPIRED.

Una venta COMPLETED no vuelve a DRAFT.

## Payment Intent

CREATED → CREDENTIAL_PRESENTED → RISK_EVALUATED.

Desde RISK_EVALUATED:
- AUTH_REQUIRED → AUTHORIZED;
- AUTHORIZED;
- REJECTED.

AUTHORIZED → PROCESSING → COMPLETED.

PROCESSING puede terminar FAILED o UNKNOWN_PENDING_RECONCILIATION.

CREATED/AUTH_REQUIRED pueden EXPIRE.

## TopUp

CREATED → PROVIDER_PENDING → CONFIRMED → POSTED.

También: FAILED, EXPIRED.

Solo POSTED aumenta disponibilidad contable.

## Refund

REQUESTED → VALIDATED → POSTED → COMPLETED.

Puede REJECTED.

Nunca borra Payment/Sale original.

## Settlement

DRAFT → CALCULATED → APPROVED → SENT → CONFIRMED.

SENT puede quedar RECONCILIATION_REQUIRED.

## Promotion

DRAFT → SCHEDULED → ACTIVE → ENDED.

ACTIVE puede PAUSED.

Budget agotado produce PAUSED/ENDED según regla.

## Route

DRAFT → PUBLISHED → ACTIVE → COMPLETED.

ACTIVE puede PAUSED/CANCELLED.

## Incident

OPEN → INVESTIGATING → MITIGATED → RESOLVED → CLOSED.

## Regla

Toda transición inválida debe producir error de dominio y no modificar persistencia.

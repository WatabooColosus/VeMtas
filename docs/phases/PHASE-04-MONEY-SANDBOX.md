# PHASE-04 — Money Sandbox

Status: PASS

## Entregables

FinancialAccount, LedgerTransaction, LedgerEntry, balance projection, PaymentIntent, Payment, TopUp mock, Refund, receipts financieros, reconciliation base.

## Gate crítico

F06, F07, F08.
Suite MONEY completa.
Prueba concurrente de double-spend sobre PostgreSQL real.
Webhook duplicado.
Idempotency collision.
Crash/failure injection.
Ledger siempre balanceado.

No dinero real.

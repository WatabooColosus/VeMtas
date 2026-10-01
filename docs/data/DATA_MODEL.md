# Modelo de datos lógico v1

No es todavía SQL definitivo. Es el contrato de entidades y relaciones.

## Convenciones

Campos comunes donde aplique:

- id
- created_at
- updated_at
- version
- status

Entidades auditables incluyen actor/correlation metadata vía AuditEvent.

## Identity

### users
id, status, primary_email, primary_phone, locale, created_at.

### user_profiles
user_id, display_name, birth_date opcional, avatar_ref opcional.

### auth_identities
id, user_id, provider, provider_subject, verified_at.

### sessions
id, user_id, device_id, expires_at, revoked_at.

### devices
id, user_id, device_type, trust_state, last_seen_at.

### credentials
id, user_id, type, public_reference, secret_material_ref/hash cuando aplique, status, issued_at, blocked_at, replaced_by_id.

Nunca persistir datos NFC sensibles en logs.

## Organizations

### businesses
id, legal/display data separada, status, category_id, verification_state.

### branches
id, business_id, name, address fields, geo point, timezone, status.

### business_memberships
id, business_id, user_id, role, status.

### membership_branch_scopes
membership_id, branch_id.

### registers
id, branch_id, name, status.

### terminals
id, branch_id, register_id opcional, terminal_type, device_fingerprint_ref, status, last_seen_at.

## Catalog

### categories
id, parent_id, name, slug.

### products
id, business_id, type PRODUCT|SERVICE, name, description, status.

### product_variants
id, product_id, sku, attributes_json, status.

### prices
id, variant_id, branch_id opcional, amount_minor, currency, valid_from, valid_to.

### inventory_items
id, branch_id, variant_id, quantity, version.

## Sales

### sales
id, business_id, branch_id, register_id, terminal_id, cashier_membership_id, customer_user_id opcional, status, subtotal_minor, discount_minor, total_minor, currency, occurred_at.

### sale_lines
id, sale_id, variant_id opcional, description_snapshot, quantity, unit_price_minor, discount_minor, total_minor.

Los snapshots preservan el comprobante aunque el catálogo cambie.

### payment_intents
id, sale_id, customer_user_id, amount_minor, currency, method, status, idempotency_key, expires_at, risk_state.

### payments
id, payment_intent_id, method, provider, status, amount_minor, completed_at, external_reference opcional.

### receipts
id, sale_id, payment_id opcional, receipt_number, type, status, issued_at, snapshot_json.

## Money

### financial_accounts
id, owner_type, owner_id, account_type, currency, status.

Tipos iniciales: USER_AVAILABLE, MERCHANT_PAYABLE, VEMTAS_REVENUE, PROVIDER_CLEARING, ADJUSTMENT_CONTROL.

### ledger_transactions
id, transaction_type, reference_type, reference_id, status, idempotency_key, posted_at.

### ledger_entries
id, ledger_transaction_id, financial_account_id, direction DEBIT|CREDIT, amount_minor, currency.

Regla: suma de débitos == suma de créditos por moneda para cada transacción posteada.

### topups
id, user_id, provider, amount_minor, currency, status, external_reference, idempotency_key.

### refunds
id, original_payment_id, amount_minor, reason_code, status.

### settlements
id, business_id, period_start, period_end, gross_minor, fees_minor, net_minor, status.

### settlement_items
settlement_id, payment_id, merchant_amount_minor, fee_minor.

### reconciliations
id, provider, period, expected_minor, observed_minor, difference_minor, status.

## Guardian

### risk_assessments
id, subject_type, subject_id, transaction_id opcional, risk_level, reasons_json, decision.

### security_challenges
id, payment_intent_id, type, status, expires_at, completed_at.

### audit_events
id, actor_type, actor_id, action, resource_type, resource_id, correlation_id, metadata_json, created_at.

### incidents
id, severity, type, status, opened_at, resolved_at.

### kill_switches
id, scope_type, scope_id opcional, capability, enabled, reason, changed_by.

## Growth

### promotions
id, owner_type, owner_id, funding_source, status, starts_at, ends_at, budget_minor opcional.

### promotion_rules
id, promotion_id, rule_type, config_json.

### promotion_redemptions
id, promotion_id, user_id, sale_id, benefit_minor, status.

### loyalty_programs
id, business_id, type, rules_json, status.

### loyalty_accounts
id, program_id, user_id, state_json.

### benefits
id, user_id, source_type, source_id, benefit_type, value_json, status, expires_at.

## Experiences

### routes
id, zone_id opcional, name, rules_json, starts_at, ends_at, status.

### route_checkpoints
id, route_id, business_id, branch_id opcional, rules_json, position.

### user_route_progress
id, route_id, user_id, status, completed_at.

### checkpoint_completions
id, progress_id, checkpoint_id, qualifying_sale_id, completed_at.

### events
id, zone_id, name, starts_at, ends_at, status.

## Reputation

### review_eligibilities
id, user_id, business_id, sale_id, status.

### reviews
id, eligibility_id, rating, comment, status.

## Connect

### provider_connections
id, provider_type, provider_name, environment, status, secret_ref.

### external_references
id, provider_connection_id, resource_type, resource_id, external_id.

### webhook_events
id, provider_connection_id, external_event_id, payload_hash, status, received_at, processed_at.

Unique(provider_connection_id, external_event_id).

## Datos prohibidos como atajo

- balance editable en users;
- password plano;
- API secret plano;
- tarjeta NFC como saldo;
- JSON opaco para transacciones contables;
- eliminación física de ledger confirmado.

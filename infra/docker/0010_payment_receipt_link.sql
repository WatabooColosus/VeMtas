ALTER TABLE receipts ALTER COLUMN sale_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS receipts_payment_id_unique ON receipts(payment_id) WHERE payment_id IS NOT NULL;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_source_required;
ALTER TABLE receipts ADD CONSTRAINT receipts_source_required CHECK (sale_id IS NOT NULL OR payment_id IS NOT NULL);

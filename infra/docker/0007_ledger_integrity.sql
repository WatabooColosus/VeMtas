CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger history is immutable' USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
DROP TRIGGER IF EXISTS ledger_transactions_immutable ON ledger_transactions;
CREATE TRIGGER ledger_transactions_immutable BEFORE UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE OR REPLACE FUNCTION validate_ledger_entry_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE transaction_xid xid; account_currency char(3);
BEGIN
  SELECT xmin INTO transaction_xid FROM ledger_transactions WHERE id = NEW.ledger_transaction_id;
  IF transaction_xid::text <> pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'Cannot append entries to committed ledger transaction' USING ERRCODE = '23514';
  END IF;
  SELECT currency INTO account_currency FROM financial_accounts WHERE id = NEW.financial_account_id;
  IF account_currency <> NEW.currency THEN
    RAISE EXCEPTION 'Ledger entry currency differs from account' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ledger_entry_insert_guard ON ledger_entries;
CREATE TRIGGER ledger_entry_insert_guard BEFORE INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION validate_ledger_entry_insert();

CREATE OR REPLACE FUNCTION validate_posted_ledger_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'POSTED' AND (
    NOT EXISTS (SELECT 1 FROM ledger_entries WHERE ledger_transaction_id = NEW.id)
    OR EXISTS (
      SELECT currency FROM ledger_entries WHERE ledger_transaction_id = NEW.id
      GROUP BY currency HAVING sum(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE -amount_minor END) <> 0
    )
  ) THEN
    RAISE EXCEPTION 'Posted ledger transaction must balance per currency' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS posted_ledger_balance ON ledger_transactions;
CREATE CONSTRAINT TRIGGER posted_ledger_balance AFTER INSERT ON ledger_transactions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_posted_ledger_balance();

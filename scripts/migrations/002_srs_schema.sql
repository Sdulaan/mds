-- Migration 002: schema for the SRS documents.
--   * users: roles (ADMIN / STANDARD), full name, active flag
--   * entities (customers + creditors): contact details, credit terms, opening balance, active flag, audit columns
--   * transactions (cheques): bank name, entry date, status dates, status derived from those dates, audit columns
--       Customer cheques (CREDIT):  IN_HAND -> DEPOSITED -> CREDITED | RETURNED
--       Creditor cheques (DEBIT):   PENDING -> CLEARED | CANCELLED
--   * purchases: GRN purchases from creditors (for the monthly payables report)
--   * audit_log: who changed what, and when

-- ── Users ───────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'STANDARD'
  CHECK (role IN ('ADMIN', 'STANDARD'));
ALTER TABLE users ADD COLUMN full_name VARCHAR(120);
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
-- Accounts that existed before roles were introduced become administrators.
UPDATE users SET role = 'ADMIN';

-- ── Entities (customers / creditors) ───────────────────────────────────────
ALTER TABLE entities
  ADD COLUMN address         TEXT,
  ADD COLUMN contact_number  VARCHAR(50),
  ADD COLUMN email           VARCHAR(255),
  ADD COLUMN credit_terms    VARCHAR(100),
  ADD COLUMN opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN remarks         TEXT,
  ADD COLUMN is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN created_by      UUID REFERENCES users(id),
  ADD COLUMN updated_at      TIMESTAMPTZ,
  ADD COLUMN updated_by      UUID REFERENCES users(id);
ALTER TABLE entities ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE entities ALTER COLUMN created_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(type, LOWER(name));

-- ── Cheques ─────────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN bank_name      VARCHAR(100),
  ADD COLUMN entry_date     DATE,
  ADD COLUMN deposited_date DATE,
  ADD COLUMN cleared_date   DATE,   -- "Credited" for customer cheques, "Cleared" for creditor cheques
  ADD COLUMN returned_date  DATE,
  ADD COLUMN cancelled_date DATE,
  ADD COLUMN created_by     UUID REFERENCES users(id),
  ADD COLUMN updated_at     TIMESTAMPTZ,
  ADD COLUMN updated_by     UUID REFERENCES users(id);

ALTER TABLE transactions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE transactions ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(14, 2);

UPDATE transactions SET entry_date = (created_at AT TIME ZONE 'Asia/Colombo')::date;
ALTER TABLE transactions ALTER COLUMN entry_date SET DEFAULT ((NOW() AT TIME ZONE 'Asia/Colombo')::date);
ALTER TABLE transactions ALTER COLUMN entry_date SET NOT NULL;

-- Carry over old statuses into the new date columns.
UPDATE transactions
SET cleared_date   = COALESCE((cleared_at AT TIME ZONE 'Asia/Colombo')::date, cheque_date),
    deposited_date = CASE WHEN transaction_type = 'CREDIT'
                          THEN COALESCE((cleared_at AT TIME ZONE 'Asia/Colombo')::date, cheque_date) END
WHERE status = 'CLEARED';
UPDATE transactions SET returned_date  = cheque_date, deposited_date = cheque_date
WHERE status = 'BOUNCED' AND transaction_type = 'CREDIT';
UPDATE transactions SET cancelled_date = cheque_date
WHERE status = 'BOUNCED' AND transaction_type = 'DEBIT';

DROP INDEX IF EXISTS idx_transactions_status;
DROP INDEX IF EXISTS idx_transactions_cleared_at;
ALTER TABLE transactions DROP COLUMN status;
ALTER TABLE transactions DROP COLUMN cleared_at;

-- Status is always derived from the dates, so the two can never disagree.
ALTER TABLE transactions ADD COLUMN status VARCHAR(20) GENERATED ALWAYS AS (
  CASE
    WHEN transaction_type = 'CREDIT' THEN
      CASE
        WHEN returned_date  IS NOT NULL THEN 'RETURNED'
        WHEN cleared_date   IS NOT NULL THEN 'CREDITED'
        WHEN deposited_date IS NOT NULL THEN 'DEPOSITED'
        ELSE 'IN_HAND'
      END
    ELSE
      CASE
        WHEN cancelled_date IS NOT NULL THEN 'CANCELLED'
        WHEN cleared_date   IS NOT NULL THEN 'CLEARED'
        ELSE 'PENDING'
      END
  END
) STORED;

-- Customer cheques never have a cancelled date; creditor cheques never have deposited/returned dates.
ALTER TABLE transactions ADD CONSTRAINT transactions_status_dates_by_type CHECK (
  (transaction_type = 'CREDIT' AND cancelled_date IS NULL)
  OR (transaction_type = 'DEBIT' AND deposited_date IS NULL AND returned_date IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(transaction_type, status);
CREATE INDEX IF NOT EXISTS idx_transactions_cleared     ON transactions(cleared_date);
CREATE INDEX IF NOT EXISTS idx_transactions_cheque_no   ON transactions(cheque_number);
CREATE INDEX IF NOT EXISTS idx_transactions_grn         ON transactions(grn_number);

-- ── Purchases (GRNs from creditors) ─────────────────────────────────────────
CREATE TABLE purchases (
  id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id      UUID           NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  grn_number     VARCHAR(100),
  invoice_number VARCHAR(100),
  purchase_date  DATE           NOT NULL,
  amount         NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  remarks        TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by     UUID           REFERENCES users(id),
  updated_at     TIMESTAMPTZ,
  updated_by     UUID           REFERENCES users(id)
);
CREATE INDEX idx_purchases_entity ON purchases(entity_id);
CREATE INDEX idx_purchases_date   ON purchases(purchase_date);
CREATE INDEX idx_purchases_grn    ON purchases(grn_number);

-- ── Audit log ───────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id           BIGSERIAL   PRIMARY KEY,
  entity_table VARCHAR(30) NOT NULL,   -- 'transactions', 'entities', 'purchases', 'users', 'system'
  record_id    UUID,
  action       VARCHAR(30) NOT NULL,   -- CREATE, UPDATE, DELETE, STATUS, LOGIN, IMPORT, RESTORE, ...
  summary      TEXT        NOT NULL,
  changes      JSONB,
  user_id      UUID,
  username     VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_record  ON audit_log(entity_table, record_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_user    ON audit_log(user_id);

-- MDS Pharmacy Cheque Management System
-- Run this once in the Neon DB SQL editor to initialize tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================
-- Table: entities (Vendors & Customers)
-- ======================================
CREATE TABLE IF NOT EXISTS entities (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('VENDOR', 'CUSTOMER')),
  created_at TIMESTAMP   DEFAULT NOW()
);

-- ======================================
-- Table: transactions (Cheque Ledger)
-- ======================================
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_type VARCHAR(10)    NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT')),
  entity_id        UUID           NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  cheque_number    VARCHAR(100)   NOT NULL,
  cheque_date      DATE           NOT NULL,
  amount           DECIMAL(10, 2) NOT NULL,
  status           VARCHAR(20)    NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLEARED', 'BOUNCED')),
  grn_number       VARCHAR(100),
  remarks          TEXT,
  created_at       TIMESTAMP      DEFAULT NOW()
);

-- Indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_transactions_status   ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(cheque_date);
CREATE INDEX IF NOT EXISTS idx_transactions_entity   ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_month    ON transactions(DATE_TRUNC('month', cheque_date));

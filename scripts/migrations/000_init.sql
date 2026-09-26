-- MDS Pharmaceutical Cheque Management System — base schema.
-- Applied by scripts/migrate.mjs (run: node --env-file=.env.local scripts/migrate.mjs)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================
-- Table: users (Login accounts)
-- ======================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

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
  cleared_at       TIMESTAMPTZ,   -- set when status becomes CLEARED
  created_at       TIMESTAMP      DEFAULT NOW()
);

-- Indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_transactions_status     ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type       ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(cheque_date);
CREATE INDEX IF NOT EXISTS idx_transactions_entity     ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cleared_at ON transactions(cleared_at);

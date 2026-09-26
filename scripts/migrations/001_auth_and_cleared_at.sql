-- Migration 001: login accounts + track when cheques actually clear.
-- Run once in the Neon SQL editor against an existing database. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

-- Best-effort backfill for cheques already marked CLEARED: we don't know the real
-- clearance date, so use the cheque date.
UPDATE transactions
SET cleared_at = cheque_date::timestamp AT TIME ZONE 'Asia/Colombo'
WHERE status = 'CLEARED' AND cleared_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_cleared_at ON transactions(cleared_at);

-- Unused: queries now filter cheque_date by range, which uses idx_transactions_date.
DROP INDEX IF EXISTS idx_transactions_month;

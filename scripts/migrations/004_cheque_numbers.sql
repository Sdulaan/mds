-- Migration 004: cheque number pool and blank-cheque register.
--   * cheque_numbers holds every cheque number registered ahead of time (bulk-generated from the
--     bank's cheque books, or recorded one by one). Each number is unique.
--   * entity_id is set when the cheque was handed to a creditor as a blank cheque (date and amount
--     not known yet). A number counts as "assigned" once a creditor cheque with that number exists in
--     transactions, so it then drops out of the blank-cheque register and the available list.

CREATE TABLE cheque_numbers (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  cheque_number VARCHAR(100) NOT NULL UNIQUE,
  bank_name     VARCHAR(100),
  entity_id     UUID         REFERENCES entities(id) ON DELETE SET NULL,
  issued_date   DATE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by    UUID         REFERENCES users(id)
);
CREATE INDEX idx_cheque_numbers_entity ON cheque_numbers(entity_id) WHERE entity_id IS NOT NULL;

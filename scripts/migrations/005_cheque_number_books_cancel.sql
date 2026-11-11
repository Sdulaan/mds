-- Migration 005: cheque books of 50 and cancelled / edited cheque numbers.
--   * book_start groups numbers into cheque books (50 cheques each), so consecutive books such as
--     008681–008730 and 008731–008780 stay separate instead of merging into one range.
--   * cancelled_at / cancelled_by / cancel_reason mark an unused or invalid number as cancelled
--     (it leaves the available pool and can no longer be given to a creditor).
--   * updated_at / updated_by record the last edit (full history is in audit_log).

ALTER TABLE cheque_numbers
  ADD COLUMN book_start    VARCHAR(100),
  ADD COLUMN cancelled_at  TIMESTAMPTZ,
  ADD COLUMN cancelled_by  UUID REFERENCES users(id),
  ADD COLUMN cancel_reason VARCHAR(500),
  ADD COLUMN updated_at    TIMESTAMPTZ,
  ADD COLUMN updated_by    UUID REFERENCES users(id);

-- Backfill existing numbers: each unbroken run of the same width is cut into books of 50.
WITH n AS (
  SELECT id, cheque_number, LENGTH(cheque_number) AS w, cheque_number::numeric AS v
  FROM cheque_numbers WHERE cheque_number ~ '^[0-9]{1,18}$'
), isl AS (
  SELECT *, v - ROW_NUMBER() OVER (PARTITION BY w ORDER BY v) AS island FROM n
), bk AS (
  SELECT *, (ROW_NUMBER() OVER (PARTITION BY w, island ORDER BY v) - 1) / 50 AS book FROM isl
), starts AS (
  SELECT id, MIN(cheque_number) OVER (PARTITION BY w, island, book) AS book_start FROM bk
)
UPDATE cheque_numbers c SET book_start = s.book_start FROM starts s WHERE s.id = c.id;

CREATE INDEX idx_cheque_numbers_book ON cheque_numbers(book_start);

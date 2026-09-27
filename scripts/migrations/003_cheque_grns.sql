-- Migration 003: creditor cheques pay one or more GRNs (purchases).
--   * cheque_grns links a creditor cheque to the purchases it pays, with the amount applied to each.
--     A GRN can be part-paid by several cheques; allocations of cancelled cheques don't count.
--   * transactions.grn_number stays as the display/search text ("11492, 11493").
--   * Existing creditor cheques are linked to their GRN's purchase; where the GRN isn't in
--     purchases yet, a purchase is created from the cheque (amount and date).

CREATE TABLE cheque_grns (
  transaction_id UUID           NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  purchase_id    UUID           NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  amount         NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (transaction_id, purchase_id)
);
CREATE INDEX idx_cheque_grns_purchase ON cheque_grns(purchase_id);

-- Link existing creditor cheques (same SQL as LINK_UNLINKED_CHEQUES in lib/grns.ts).
WITH unlinked AS (
  SELECT t.id, t.entity_id, TRIM(t.grn_number) AS grn, t.cheque_date, t.amount, t.status, t.created_by
  FROM transactions t
  WHERE t.transaction_type = 'DEBIT' AND NULLIF(TRIM(t.grn_number), '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM cheque_grns g WHERE g.transaction_id = t.id)
),
missing AS (
  SELECT u.entity_id, MIN(u.grn) AS grn, MIN(u.cheque_date) AS purchase_date,
         COALESCE(NULLIF(SUM(u.amount) FILTER (WHERE u.status <> 'CANCELLED'), 0), SUM(u.amount)) AS amount,
         (ARRAY_AGG(u.created_by ORDER BY u.cheque_date))[1] AS created_by
  FROM unlinked u
  WHERE NOT EXISTS (
    SELECT 1 FROM purchases p WHERE p.entity_id = u.entity_id AND LOWER(TRIM(p.grn_number)) = LOWER(u.grn)
  )
  GROUP BY u.entity_id, LOWER(u.grn)
),
created AS (
  INSERT INTO purchases (entity_id, grn_number, purchase_date, amount, remarks, created_by)
  SELECT entity_id, grn, purchase_date, amount, 'Created automatically from creditor cheque', created_by FROM missing
  RETURNING id, entity_id, grn_number
)
INSERT INTO cheque_grns (transaction_id, purchase_id, amount)
SELECT u.id,
       COALESCE(
         c.id,
         (SELECT p.id FROM purchases p
          WHERE p.entity_id = u.entity_id AND LOWER(TRIM(p.grn_number)) = LOWER(u.grn)
          ORDER BY p.purchase_date, p.created_at LIMIT 1)
       ),
       u.amount
FROM unlinked u
LEFT JOIN created c ON c.entity_id = u.entity_id AND LOWER(c.grn_number) = LOWER(u.grn);

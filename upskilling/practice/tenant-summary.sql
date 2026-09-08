-- A read-only worksheet. First predict the result for Acme without running it.
-- Replace the final SELECT to count ONLY Acme's rejected rows (expected: 1).
WITH practice_rows (organization_id, outcome) AS (
  VALUES ('acme', 'rejected'), ('acme', 'imported'), ('northstar', 'rejected')
)
SELECT * FROM practice_rows;

# 03 — Make ambiguity visible

Learning placement: guided. Prerequisite materials: relay-lab-01. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: `worker/ContactRules.cs`, `worker.tests/RulesTests.cs`, mapping/correction handlers.

Predict: should 03/04/2025 mean March 4 or April 3? If both Name and Full Name appear, should the mapper choose one?

Explore: upload missing names, uppercase padded emails, repeated emails, quoted commas/newlines and ambiguous dates. Separate syntax errors from valid CSV records that fail business validation.

Build: add a field-specific validation rule and a clear remediation message. Include a positive, negative and boundary case. Do not silently “repair” an uncertain value.

Debug: correct a rejected row so that it duplicates an earlier row. Revalidate. Then change the earlier row’s email and verify that the later row is no longer incorrectly classified from stale state.

Explain: why do corrections increment mapping_version? Why are raw bytes immutable while staging can change? Why do we accept year-first dates but abstain on ambiguous local formats?

Assess: show before/after row outcomes and explain all changed counts. Record a hypothesis before each correction.

## Code anchors (verified against this repository)

- `worker/ContactRules.cs:23-49` — `Normalize`: values are trimmed (`:25`), email lower-cased (`:27`), required name (`:39`), length caps (`:40-42`), email shape (`:41`, regex at `:51`), and dates accepted **only** as `yyyy-MM-dd` or `yyyy/MM/dd` (`:43-47`). `03/04/2025` produces "Signup date is ambiguous or invalid. Use YYYY-MM-DD." rather than a guess.
- Schema 2 adds an E.164 phone rule (`:34-38`); optional transforms (`collapse_spaces`, `strip_phone_formatting`) only run when the reviewer chose them (`:32-33`, `:36`).
- `worker.tests/RulesTests.cs` — the unit tests for these rules.
- Corrections: `src/app/api/[...path]/route.ts:144-147` merges the corrected cells into `import_rows.raw`; `:149` bumps `mapping_version`, clears the approval and restarts validation.

## Checks

**Goal:** see abstention, not repair. **Check:** a row with `Signup Date = 03/04/2025` ends with disposition `invalid` and the exact message above; the same row with `2025-03-04` is valid and its normalized `joined_at` is `2025-03-04`.

**Goal:** prove corrections invalidate approval. **Check:** approve a job, then (before the worker commits — stop it first) correct a row: `approved_hash` becomes `NULL`, `mapping_version` increases by 1, and status returns to `validating`. Existing evidence: `scripts/e2e.mjs:58`.

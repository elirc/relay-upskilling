# Verification record

Local verification used Windows, Node.js 24.19.0, .NET SDK 10.0.400 and PostgreSQL 18.4. Individual machine evidence files retain their execution timestamps. Final packaging and full production-browser verification passed; see [final-checks.json](final-checks.json).

## Executed checks
- TypeScript route generation/typecheck and Next.js standalone production build; artifact check excludes environment files, model caches, uploads, tooling and learning sources.
- 2 TypeScript mapping/CSV export tests and 17 C# normalization, versioning, logical CSV resume, fingerprint and Excel-formula tests.
- 11 core acceptance groups, including the real 100k after-commit crash with two restarted workers.
- 14 advanced acceptance groups, most recently run against the standalone production server: CSV/XLSX, legacy/v2 approvals, actual AI integration, tenant fairness, supported-schema gating, pre-commit rollback, external 429/response loss/replay/cancellation/retry, traces and account lifecycle.
- Existing-account invitation protection: wrong current password rejected, correct existing password required, no password reset through an invitation.
- Chromium login, keyboard dialog dismissal, schema v2, AI proposal/draft application, correction, approval, completion, report, operational/team navigation, learning persistence and mobile overflow check.
- Fresh database migrations, repeat migration idempotency, immutable contract registration and non-demo administrator bootstrap in a separate temporary database.
- Real pg_dump/pg_restore using a shared exported snapshot, restoration into a distinct temporary database, table-count checks, completed-job accounting and 56 copied original-file hash checks. The rehearsal database was removed; the source was retained.
- Stable machine-readable project/material IDs, prerequisite links, evidence paths, learner references and single-project relationship graph.

## Central result
The real worker exited with code 73 immediately after committing checkpoint 50,000. Two restarted workers finished the same job:

| Outcome | Rows |
| --- | ---: |
| Imported | 97,600 |
| Rejected | 1,600 |
| Duplicate | 800 |
| Total with a committed outcome | 100,000 |

The final CSV report contains 100,001 lines including its header. [acceptance.json](acceptance.json) identifies the job and executed checks. [performance.json](performance.json) records phase timings and sampled RSS: the maximum sample was 79,982,592 bytes. This is a local synthetic observation, not a throughput SLA. The crash can omit a post-commit metrics sample; the row ledger remains the accounting authority.

## External recovery
The test destination committed seven records and durable receipts, then dropped its response. The worker persisted uncertainty and exited with code 75 while its local committed checkpoint remained zero. Restart queried receipts and accounted for all seven without duplicate remote contacts. Separate tests cover a 409 for changed payload under the same key, tenant-scoped receipts, preservation of later remote edits, and receipt-only reconciliation after cancellation. See [advanced.json](advanced.json).

## AI evaluation
The pinned MiniLM model is real local neural inference. Initial evaluation produced a Mailing address → email false positive at similarity 0.7637. That result remains in [ai-baseline.json](ai-baseline.json). After a conservative exclusion, those cases became regression data; the final fresh held-out set produced 15/15 correct proposals over 15 labeled possible mappings. Calibration/regression/held-out data and model revision are in [ai-evaluation.json](ai-evaluation.json).

The benchmark is small, English-focused and uncalibrated. It supports the recorded examples, not a general correctness claim. UI approval and abstention remain required controls.

## What has not been observed
- Public deployment: no user hosting target/domain was supplied.
- Hosted CI: the workflow is authored; no repository remote was supplied for execution.
- Docker runtime: definitions are authored; Docker is not installed on this machine.
- Independent review or another person's handover: contracts/runbook/rubric are ready, but no independent participant has supplied results.
- Learner mastery or a complete screen-reader accessibility audit: automated checks do not establish either.

Raw synthetic CSVs, logs, screenshots, backups and local binaries remain in ignored test-results/, .data/, .cache/ and .tools/. Committed evidence contains summaries and synthetic identifiers, not customer rows or credentials.

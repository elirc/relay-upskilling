# Relay
Relay is a learning-first customer data import platform built with Next.js/TypeScript, PostgreSQL and a separate C#/.NET 10 worker.

Upload CSV or Excel, review column mappings and cleanup rules, correct validation errors, approve a specific version, and follow a resumable import into local contacts or an external test API. Original files remain separate from staged rows and destination records.

## Start learning
Your current goal is novice/junior-to-independent engineering practice. Start with [one small function](upskilling/FIRST_SESSION.md), then follow the [skills roadmap](upskilling/ROADMAP.md). The first exercises need only Node; the full platform is a later learning resource.

## Run locally
Requires Node.js 24+, .NET 10, and PostgreSQL 18. This workspace also includes project-local tooling under ignored `.tools/` and `.cache/` directories.

1. `npm install`
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL: `npm run db:local` (or provide your own PostgreSQL URL).
4. `npm run db:migrate` and `npm run seed`.
5. `dotnet build worker/Relay.Worker.csproj` (here: `.tools/dotnet/dotnet.exe build worker/Relay.Worker.csproj`).
6. In separate terminals: `npm run worker`, `npm run connector`, `npm run ai`, and `npm run dev`.
7. Open **http://127.0.0.1:4317**.

PowerShell users can use `npm.cmd` when execution policy blocks npm.ps1. Local demo users: `alex@relay.local` (reviewer), `sam@relay.local` (operator), and `jules@relay.local` (another tenant), with the configured `DEMO_PASSWORD`. The example password is `relay-local-only`.

The AI service downloads a pinned public MiniLM embedding model on first use. Inference runs locally and receives column names only. Manual mapping works without this service. The external test API runs at port 4321, the private mapping service at 4319; only the application is a user-facing endpoint.

Docker definitions are also provided: `docker compose up --build`. Container execution and public deployment are not verified on this machine. See [deployment instructions](deploy/README.md).

## What is implemented
- Streaming uploads and C# CSV/XLSX parsing; bounded batches, per-tenant scheduling and durable checkpoints.
- Organization membership, operator/reviewer permissions, invitations, password changes and administrative recovery links.
- Immutable contact schema v1 and v2 (optional phone), shared contract fingerprints, reviewed mappings and bounded cleanup rules.
- Paginated validation/correction tables, stale-review rejection, pause/cancel/retry and streamed correction/final reports.
- Insert-only reconciliation that preserves later destination edits and accounts for duplicates, rejected rows, existing records and conflicts.
- Real local AI mapping proposals with explanations, abstention, labeled evaluation, and explicit human application/approval.
- Durable external outbox, stable idempotency keys, receipt reconciliation, throttling, and recovery when a destination commits but its response is lost.
- Operational metrics, worker compatibility/health, trace correlation, backup/restore rehearsal and source-linked learning labs.

The central 100,000-row test terminates the real worker at checkpoint 50,000 and restarts two workers: **97,600 imported + 1,600 rejected + 800 duplicates = 100,000 accounted rows**. See [verification](upskilling/evidence/verification.md) for executed checks and limitations.

## Product boundaries
CSV is UTF-8. XLSX accepts one worksheet and values only; export formulas as values first. Limits are 32 MB compressed upload, 200,000 records, 100 columns, 16,000 characters per field, 256 MB expanded workbook, and 16 MB shared-string/style parts. Native spreadsheet dates become year-first dates; ambiguous text dates require correction.

A cancelled import retains committed contacts. External requests already authorized for sending may finish after pause/cancel; Relay reconciles their receipts and displays uncertainty. Failed partial parses report staged rows only; the complete original file remains stored.

The included external connector is a controlled test service, not a CRM integration. Its idempotency and strongly consistent receipt API are part of its contract. AI evaluation is a small English-header benchmark, not a general accuracy guarantee. The supplied deployment uses one host with a shared durable upload volume; cross-host object storage is a future extension.

## Verify and learn
```sh
npm run typecheck
npm test
dotnet test worker.tests/Relay.Worker.Tests.csproj
npm run test:e2e
npm run test:advanced
npm run test:ai
npm run test:browser
npm run test:restore
npm run build
npm run check:knowledge
```
Start the database, web, AI and connector first. Acceptance/browser suites start their own worker processes; stop a manually running worker and run these suites sequentially. For 100,000 rows, set `RELAY_LARGE_TEST=true` before `npm run test:e2e`. Restore verification needs PostgreSQL 18 client tools on PATH or `PG_BIN`.

Start learning at [upskilling/README.md](upskilling/README.md). The [curriculum](upskilling/ROADMAP.md), [machine-readable project catalog](upskilling/project-catalog.json), [state](upskilling/project-state.json), and [handoff](upskilling/HANDOFF.md) distinguish implemented behavior, test evidence, and your own learning assessment.

## References
Workflow inspiration: [Flatfile](https://flatfile.com/docs/getting-started/quickstart/first-project). Background processing: [Microsoft Worker Services](https://learn.microsoft.com/en-us/dotnet/core/extensions/workers). Spreadsheet reader: [ExcelDataReader](https://github.com/ExcelDataReader/ExcelDataReader). Local model runtime: [Transformers.js](https://huggingface.co/docs/transformers.js/en/pipelines).
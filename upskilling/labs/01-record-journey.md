# 01 — Follow one record

Learning placement: guided. Prerequisite materials: relay-foundations. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: locate only the upload POST branch in `src/app/api/[...path]/route.ts`, then the worker method for the observed job phase and the matching table definition in `db/001_init.sql`. Start with five rows. Read more only to answer your current question.

Predict: after upload returns HTTP 201, has a contact been created? Which processes can stop without losing the file?

Explore: locate the generated file key, SHA-256 fingerprint, job status and staged raw row. Follow a valid row through normalized data, reviewer approval and a destination contact. Record the exact SQL rows before and after approval.

Build: add one focused test for a single observed boundary. Adding a field across the schema, UI, normalizer and report is deferred to independent feature work.

Debug: start with the worker stopped. Upload succeeds but the job remains parsing. Diagnose using the UI, rather than assuming the HTTP request failed.

Explain without AI: what has been persisted when upload returns, and which process does the next step? Later extensions: streaming, backpressure, and orphan-file cleanup.

Assess: diagram the row’s journey from memory and identify every durable write. Evidence must distinguish “uploaded”, “staged” and “imported”.

## Code anchors (verified against this repository)

| Boundary | Where |
| --- | --- |
| Upload branch: file name, format, schema and destination headers | `src/app/api/[...path]/route.ts:58-64` |
| Bytes streamed to disk with a 32 MB cap and a SHA-256 computed on the way | `src/app/api/[...path]/route.ts:67-72` |
| Job row + `uploaded` event in one transaction; file removed if that fails | `src/app/api/[...path]/route.ts:74-78` |
| `201 { id }` — no contact exists yet | `src/app/api/[...path]/route.ts:79` |
| Job table (`file_key`, `file_hash` …) and the `(org_id,id)` key children reference | `db/001_init.sql:16`, `:26` |
| Staged rows and contacts | `db/001_init.sql:34`, `:42` |
| Worker loop picks up the job | `worker/ImportWorker.cs:45` (`ExecuteAsync`), phases dispatched around `:73-86` |

## Checks

**Goal:** prove what "uploaded" means. **Check:** with the worker stopped, upload a five-row CSV; the response is 201, `SELECT status, file_hash FROM jobs WHERE id = '<id>'` shows `parsing` and a 64-hex hash, `SELECT count(*) FROM import_rows WHERE job_id = '<id>'` is 0, and a file named `<id>.csv` exists under `UPLOAD_DIR` (default `.data/uploads`).

**Goal:** find the orphan-file window. **Check:** you can point at the gap between the stream finishing (`src/app/api/[...path]/route.ts:72`) and the transaction committing (`src/app/api/[...path]/route.ts:74-77`) and explain that a process crash there leaves a file with no job row — the `catch` at `:78` only runs for thrown errors, not for a killed process.

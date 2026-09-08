# 01 — Follow one record

Learning placement: guided. Prerequisite materials: relay-foundations. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: locate only the upload POST branch in `src/app/api/[...path]/route.ts`, then the worker method for the observed job phase and the matching table definition in `db/001_init.sql`. Start with five rows. Read more only to answer your current question.

Predict: after upload returns HTTP 201, has a contact been created? Which processes can stop without losing the file?

Explore: locate the generated file key, SHA-256 fingerprint, job status and staged raw row. Follow a valid row through normalized data, reviewer approval and a destination contact. Record the exact SQL rows before and after approval.

Build: add one focused test for a single observed boundary. Adding a field across the schema, UI, normalizer and report is deferred to independent feature work.

Debug: start with the worker stopped. Upload succeeds but the job remains parsing. Diagnose using the UI, rather than assuming the HTTP request failed.

Explain without AI: what has been persisted when upload returns, and which process does the next step? Later extensions: streaming, backpressure, and orphan-file cleanup.

Assess: diagram the row’s journey from memory and identify every durable write. Evidence must distinguish “uploaded”, “staged” and “imported”.

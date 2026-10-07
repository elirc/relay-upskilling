# 05 — Review a version, reconcile current state

Learning placement: independent. Prerequisite materials: relay-lab-02. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: approval handler, approval fingerprint, correction version increment and Commit reconciliation.

Predict: a reviewer opens version 1, an operator corrects a row to create version 2, and the reviewer submits version 1. What must the server do?

Explore: record the mapping version; correct and revalidate; send approval with the old version. Expect 409. Then approve the current version. Verify that attempts to remap a running/completed import fail.

Debug: insert or edit a destination contact after preview but before execution. The import must preserve the destination and classify a conflict. Re-upload the same file and verify repeated effects are suppressed.

Build: propose an explicit update-existing policy. Do not implement a blind upsert. Define expected destination version checks, conflict handling, human preview and preservation of later edits first.

Explain: the approval hash is a fingerprint, not a secret or signature. Identify where authorization comes from. Explain how the first valid record wins among intra-file duplicates and why conflicts are not silently overwritten.

Assess: reproduce the stale-approval and destination-edit cases without the existing harness; record actual requests and SQL observations.

## Code anchors (verified against this repository)

- Approve: `src/app/api/[...path]/route.ts:151-155` — rejects unless status is `review` **and** the submitted `version` equals `mapping_version` (409 "The preview has changed"), then stores `approved_hash`.
- Fingerprint, TypeScript side: `route.ts:17` — SHA-256 of `file_hash:mapping_version:schema_version` plus `:schema_hash:destination` for approval format 2.
- Fingerprint, C# side: `worker/ImportWorker.cs:24` — the same string, recomputed; `Commit` throws if it differs (`:227-228`).
- Resume and retry re-check the fingerprint: `route.ts:158`, `:173`.

## Checks

**Goal:** reproduce the stale-approval race. **Check:** reviewer reads version N, operator corrects a row (version N+1), reviewer submits `{"version": N}` → **409** and `approved_hash` stays `NULL`.

**Goal:** find the cross-language coupling. **Check:** you can name both definitions of the fingerprint (`route.ts:17`, `ImportWorker.cs:24`) and predict what happens if only one changes (every approved job fails in `Commit` with "Approval does not match the current file and mapping."). No test pins the two implementations to each other; propose one (e.g. a fixture job whose expected hash is asserted in both `tests/contracts.test.ts` and `worker.tests`).

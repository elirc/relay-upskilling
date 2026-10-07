# 02 — An ID is not permission

Learning placement: guided. Prerequisite materials: relay-lab-03. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: the membership helper in `src/lib/auth.ts` and one report route branch in `src/app/api/[...path]/route.ts`. Follow its query's organisation filter. Inspect a composite foreign key in `db/001_init.sql` only after you can explain that request.

Predict: if Jules knows an Acme job UUID, can Jules download its correction report? Does changing x-relay-org grant membership?

Explore: create a job as Alex. Try its detail, rows, report and mutation endpoints as Jules. Record status codes. Try approval as Sam. Explain 401, 403 and 404.

Build: add one negative access test for a foreign job or a disallowed action. A new viewer role is a later optional feature, after independent ownership.

Debug: intentionally remove the membership check in an isolated copy and show which acceptance test detects the regression. Restore it before completing the exercise.

Explain: why is a hidden UI button not authorization? What does the organisation filter protect? Later extension: explain how a composite foreign key complements the request check; designing database RLS belongs after the core task.

Assess: independently identify one endpoint not covered by an isolation test and add a meaningful test for it.

## Code anchors (verified against this repository)

- `src/lib/auth.ts:19-27` — `authorize`: session cookie → user (`authenticate`, `:12-18`); `x-relay-org` must look like a UUID (else 400); a `memberships` row for (user, org) must exist (else 403); approve/retry/reconcile additionally require role `reviewer` (`src/app/api/[...path]/route.ts:48`).
- `src/app/api/[...path]/route.ts:82-84` — every job route re-reads the job with `WHERE id=$1 AND org_id=$2`; a foreign job is **404**, not 403, so existence is not leaked.
- `src/app/api/[...path]/route.ts:129-131` — mutations re-check the same filter under `FOR UPDATE`.
- `db/001_init.sql:26`, `:34`, `:42`, `:48` — composite `(org_id, job_id)` foreign keys, so a child row cannot point at another organisation's job even if application code forgot the filter.

## Checks

**Goal:** separate 400 / 401 / 403 / 404. **Check:** for one Acme job, record: no cookie → 401; Jules's cookie with a non-UUID `x-relay-org` → 400; Jules's cookie with Acme's org id → 403; Jules's cookie with Jules's own org id and the Acme job id → 404. Existing evidence for the 404 case: `scripts/e2e.mjs:53`.

**Goal:** find an endpoint without an isolation test. **Check:** list every `parts[2]` branch in `src/app/api/[...path]/route.ts` (`suggest`, `rows`, `report`, `mapping`, `correct`, `approve`, `retry`, `reconcile`, `pause`, `resume`, `cancel`) and mark which ones `scripts/e2e.mjs` and `scripts/advanced-e2e.mjs` call as a foreign user; each unmarked branch is a candidate for your test.

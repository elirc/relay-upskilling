# External delivery: a timeout is not a failed write

Learning placement: elective_after_reliability. Prerequisite materials: relay-lab-04, relay-lab-09. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.


Use templates/experiment.md; write your prediction before running the exercise.


Predict the local checkpoint, remote contact count and outbox states when a destination commits seven contacts then closes its connection before responding.

1. Read worker/ExternalDelivery.cs and scripts/test-destination.mjs. Draw the two transaction boundaries and mark the network call between them. Identify when a send becomes authorized and when it becomes uncertain.
2. Run npm run test:advanced with no manual worker running. Find the exit-75 rehearsal in evidence/advanced.json and correlate its job with local rows, outbox entries and test_destination_receipts.
3. Replay a receipt key with the same payload, then a changed payload. Explain the unchanged effect and 409 response. Confirm a different tenant cannot read that receipt through the tenant parameter.
4. Trace the cancellation test: remote effects already exist, local checkpoint is zero, then the operator cancels. Explain why receipt-only reconciliation may advance accounting while status remains cancelled.
5. Change the test API to delay receipt visibility in an isolated experiment. Predict which current assumption breaks. Do not call an absent eventually consistent receipt proof of failure. Record the additional destination contract or reconciliation process needed.

Pass when your explanation accounts for every side of the commit/response-loss window, distinguishes attempted delivery from confirmed effects, and explains the limits of idempotency. Include a timeline, a SQL outcome count and one counterexample to naive retry.

Stretch: add a bounded circuit-breaker experiment and compare recovery latency against the current five-attempt policy without dropping uncertain outcomes.

## Code anchors (verified against this repository)

- `worker/ExternalDelivery.cs:22`, `:26` — HTTP 429 becomes a typed `Throttled` exception carrying `Retry-After`.
- `:91` — progress, status and back-off are written together; `:96-108` — any other error marks the batch uncertain and backs off.
- `:109` — with `Relay:CrashOnUncertain=true` the worker exits 75 after an uncertain outcome (rehearsal hook).
- `:112-119` — receipts are read strictly; unknown or invalid receipts are rejected.
- Scheduler arm that keeps reconciling paused/cancelled jobs with uncertain outbox rows: `worker/ImportWorker.cs:57-58`.
- Rehearsals: `scripts/advanced-e2e.mjs:37` (throttle), `:38` (lost response), `:42-44` (key replay, changed payload → 409, cross-tenant receipt lookup returns nothing), `:48-49` (cancel while uncertain).

## Checks

**Goal:** observe "uncertain", not "failed". **Check:** with the `lose-response-once` fault armed, the job's `delivery_counts` shows `uncertain` rows while the destination already holds the contacts; after a fresh worker runs, `delivered` equals the row count and the destination still holds exactly that many contacts.

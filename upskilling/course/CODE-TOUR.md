# Code tour: one promise, across two languages

This tour follows a single promise through every layer of Relay:

> **Only the exact version a reviewer approved reaches the destination, and a
> worker crash at any point — before a batch commits, after it commits, or
> after the destination commits but before the response arrives — never
> creates a duplicate contact when the import resumes.**

Line numbers were verified against the repository at the commit this tour was
written; if they drift, search for the quoted code. The format follows the
three-rebuild course's GitJira code tour: at each step, predict before moving
on.

## 0. The two halves of the promise

Relay has two destinations, and the promise is kept by two different
mechanisms:

- `local` — contacts land in the **same PostgreSQL database** as the job
  ledger. One transaction can hold the inserts and the checkpoint.
- `test-api` — contacts land in a **separate service with its own
  transactions** (`scripts/test-destination.mjs`). No shared transaction
  exists, so a new artifact appears: the delivery outbox, and with it the word
  *uncertain*.

Keep that split in mind; steps 5 and 6 are the payoff.

## 1. Upload: the original is pinned before anything else

- `src/app/api/[...path]/route.ts:70` — the upload streams through a
  `Transform` that enforces the 32 MB cap and feeds a SHA-256 hash *while
  writing*, so the stored file and the recorded `file_hash` are the same
  bytes.
- `route.ts:75` — the `jobs` row is created with `file_hash`, the schema's
  `digest` (fetched at `route.ts:64`), `approval_format` 2 and the
  `destination`. Everything a later approval will bind to is fixed here.
- `route.ts:78` — if the insert fails, the file is unlinked. But file write
  and database insert are **not** a distributed transaction: a process loss
  between them leaves an unreferenced original on disk.
  [../ARCHITECTURE.md](../ARCHITECTURE.md) ("Trust boundaries") admits this
  openly — the honest framing is "do not delete files referenced by any
  retained job," not "this cannot happen."
- `worker/SourceCursor.cs:23` — every time a worker opens the file it rehashes
  it and refuses on mismatch, pinned by
  `worker.tests/PlatformTests.cs:17` (`SourceMutationIsDetected`).

Predict: the worker dies after staging 1,200 of 5,000 rows. Where does the
next worker start reading the CSV, and why can it not simply seek by bytes?

## 2. Parsing resumes by logical rows, not bytes

- `worker/ImportWorker.cs:170` — each parse batch commits the staged rows
  *and* `parse_checkpoint` in one transaction (`SaveParsed`,
  `ImportWorker.cs:158-172`), with `ON CONFLICT DO NOTHING` on
  `import_rows` (`ImportWorker.cs:166`) so a replayed batch is harmless.
- `worker/SourceCursor.cs:45` — a reopened cursor *reads and discards* `skip`
  records. A byte offset would break on quoted newlines; the durable position
  is a logical record count.
  `worker.tests/PlatformTests.cs:14`
  (`LogicalCsvResumeHandlesQuotedNewlines`) pins exactly this: a value
  containing `\r\n` inside quotes, resume at record 1, next record is Grace.
- `worker/ImportWorker.cs:139` — a cached cursor whose position disagrees with
  the database checkpoint is dropped: another worker may have advanced the
  job. PostgreSQL, not worker memory, owns progress.

## 3. Versioning: every edit un-approves

- `route.ts:149` — saving a mapping or correcting a row sets
  `mapping_version=mapping_version+1`, `validation_checkpoint=0` and
  `approved_hash=NULL` in the same UPDATE. There is no path that changes
  what will be imported while an approval stays attached.
- `route.ts:17` — the approval hash:
  `sha256(file_hash:mapping_version:schema_version:schema_hash:destination)`.
  Note what is in it — the bytes, the mapping generation, the destination
  contract — and what is not (it is a version binding, not a signature;
  reviewer permission is checked separately at `route.ts:48`).
- `route.ts:153` — approving requires `status='review'` **and** the version
  the reviewer looked at; a stale approval gets 409. Pinned by
  `scripts/e2e.mjs:58-60` ("Correction invalidates approval; stale review is
  rejected").

## 4. The same hash, recomputed in C#

- `worker/ImportWorker.cs:24` — `Approval(Job)` rebuilds the identical string
  and hash in C#. This is the cross-language contract of the whole system:
  two implementations of one fingerprint, and nothing checks they agree
  except the end-to-end suites. (Tier 1 exercise: break one side and see
  which test speaks.)
- `worker/ImportWorker.cs:227-228` (local) and
  `worker/ExternalDelivery.cs:34` (external) — the worker re-verifies the
  approval *inside every batch transaction*, after `SELECT ... FOR UPDATE`
  (`ImportWorker.cs:128`). A mapping edit racing the import cannot slip
  between check and effect.
- `route.ts:173` — Resume re-checks the hash too: a paused job whose
  fingerprint no longer matches cannot be resumed.

## 5. Local commit: effects and checkpoint in one transaction

The scheduler (`ImportWorker.cs:54-62`) picks the oldest eligible job per
tenant; session advisory locks (`ImportWorker.cs:70-71`) admit one batch per
tenant/job across workers, and PostgreSQL releases them when a crashed worker
disconnects (comment at `ImportWorker.cs:69`).

`Commit` (`ImportWorker.cs:220-269`) is the heart:

1. `ImportWorker.cs:224-226` — begin transaction, reload the job
   `FOR UPDATE`, re-check status and approval.
2. `ImportWorker.cs:232-241` — one CTE inserts only missing contacts:
   `ON CONFLICT(org_id,email) DO NOTHING ... RETURNING source_row_no`, and
   marks exactly the returned rows `imported`. The comment above it names the
   principle: *"Destination uniqueness is the final arbiter, even if another
   job committed after preview."* The constraint is
   `db/001_init.sql:42` (`UNIQUE (org_id,email)`).
3. `ImportWorker.cs:243-253` — rows that lost the insert are re-classified
   `existing` or `conflict` under `FOR SHARE` locks, so a concurrent edit
   cannot change the answer mid-read. Existing data is never overwritten.
4. `ImportWorker.cs:262` — `commit_checkpoint` advances **in the same
   transaction**. The unit of progress is a row-number watermark; "done" is
   `checkpoint >= total_rows`.

Because effects and checkpoint commit together, the two crash windows are
symmetric and both rehearsed with a real process exit:

- **Before commit** (exit 74, `ImportWorker.cs:265`): everything rolls back;
  the batch reruns identically. Pinned by `scripts/advanced-e2e.mjs:36` —
  checkpoint 100, exactly 100 contacts, then completion.
- **After commit** (exit 73, `ImportWorker.cs:268`): the committed prefix is
  permanent; the next worker starts at the checkpoint. Pinned by
  `scripts/e2e.mjs:82-96` — the 100,000-row run (`RELAY_LARGE_TEST=true`)
  kills the worker at checkpoint 50,000, restarts two workers, and asserts
  97,600 imported + 1,600 rejected + 800 duplicates = 100,000 accounted rows
  and `count(*) == count(DISTINCT email)` at the destination.

Predict before reading on: why can none of this work for the external
destination, even though the code could reuse the same checkpoint?

## 6. External delivery: the window one database cannot see

`Deliver` (`worker/ExternalDelivery.cs:27-111`) runs where no shared
transaction exists. Watch the order:

1. **Outbox first.** `ExternalDelivery.cs:37-42` — rows for this batch are
   copied into `delivery_outbox` with the stable key
   `job_id:mapping_version:row_no`, committed before any network I/O. The
   table (`db/002_platform.sql:12-17`) allows states
   `pending → uncertain → delivered | abandoned`.
2. **Ask before sending.** `ExternalDelivery.cs:57` — the worker first asks
   the destination for receipts for all keys in the batch. The comment says
   why: *"Receipt lookup also recovers the commit/response-loss window after
   a real process restart."*
3. **Mark uncertainty before the attempt.** `ExternalDelivery.cs:61-66` — in
   a short transaction the worker re-checks that the job is still active
   (serializing the permission-to-send with pause/cancel) and flips the
   missing keys to `uncertain`. Only then (`ExternalDelivery.cs:69`) does it
   POST the batch. If it dies mid-flight, the database already says "I may
   have sent this."
4. **The destination keeps the other half.**
   `scripts/test-destination.mjs:37-42` — receipts are primary-keyed
   `(org_id,key)` (`db/002_platform.sql:41-44`); a replayed key returns the
   *original* outcome; a replayed key with a **changed payload** is a 409
   (`test-destination.mjs:38`), so the key cannot be silently reused; the
   contact insert is `ON CONFLICT DO NOTHING` against
   `(org_id,email)`. Receipt and contact commit in one transaction on the
   destination's side.
5. **Reconcile.** `ExternalDelivery.cs:73-94` — confirmed outcomes mark
   outbox rows `delivered` and ledger rows committed; the checkpoint is then
   *derived* as `first uncommitted row − 1` (`ExternalDelivery.cs:87-88`),
   and an unresolved count keeps the job's `last_error` honest:
   `"Some destination outcomes remain uncertain; receipt reconciliation is
   pending."` (`ExternalDelivery.cs:91`).

The rehearsal that pins the whole window is
`scripts/advanced-e2e.mjs:38`: the fault `lose-response-once` makes the
destination commit seven contacts then destroy the socket
(`test-destination.mjs:44-47` — note the destroy happens **after** `COMMIT`);
the worker, started with `Relay__CrashOnUncertain=true`, exits 75
(`ExternalDelivery.cs:109`) with checkpoint 0 and seven `uncertain` outbox
rows while the destination already holds seven contacts. A fresh worker then
completes the job to `delivered=7, imported=7` with exactly seven receipts —
by lookup, not by resend. `scripts/advanced-e2e.mjs:40-47` additionally
replays a key directly (same outcome back), changes its payload (409), and
proves another tenant cannot read the receipt.

Failure modes of the destination are typed, not guessed:
429 becomes a `Throttled` exception carrying `Retry-After`
(`ExternalDelivery.cs:22,26`), rehearsed at `scripts/advanced-e2e.mjs:37`;
any other error marks the batch uncertain and backs off
(`ExternalDelivery.cs:96-108`); an invalid or unknown receipt is rejected
outright (`ExternalDelivery.cs:112-119`). Five failed attempts stop the job
for a reviewer (`ImportWorker.cs:99-104`, `route.ts:156-162` for the gated
retry).

## 7. What the operator can honestly be told

Putting the two halves together, the honest status vocabulary is:

- local, crash before commit: "nothing from the interrupted batch happened."
- local, crash after commit: "progress to row N is permanent; resume
  continues at N+1; re-running cannot duplicate because the destination's
  uniqueness constraint is the final arbiter."
- external, response lost: "these rows are **uncertain** — possibly
  delivered; we will not claim success or failure without a receipt." Pause
  and cancel stop *new* authorizations; an already-authorized in-flight send
  may still land (README "Product boundaries"), and receipt-only
  reconciliation (`route.ts:162-167`, `ImportWorker.cs:58` including
  paused/cancelled jobs with uncertain outbox rows) later converts
  uncertainty into outcomes without resuming the import — pinned by
  `scripts/advanced-e2e.mjs:48-49`.

## 8. Where the promise stops

Report of what is there, not what should be:

- **The external guarantee is the test API's contract, not a law of
  nature.** Unique `(tenant,key)` receipts, payload-hash checking and
  strongly consistent receipt lookup are explicit prerequisites
  ([../ARCHITECTURE.md](../ARCHITECTURE.md), "External uncertainty"). Against
  a real CRM that offers none of these, this entire mechanism degrades to
  at-least-once. Tier 3 exercise 3.1 lives in that gap.
- **The upload window is unguarded.** A process loss between file write and
  job insert leaves an orphaned original (`route.ts:72-78`); nothing scans
  for or reports such files.
- **Crash rehearsals are point injections.** Exits 73/74/75 are real process
  deaths, but at chosen rows and chosen fault modes. They prove the designed
  windows behave as designed; they do not prove every window was found.
- **The pause guarantee is time-boxed evidence.** `scripts/e2e.mjs:74-77`
  asserts the checkpoint is unchanged 200 ms after pause — a correctness
  smoke check, not a proof that no batch was in flight.
- **Tenant isolation is API-level.** Membership checks plus composite foreign
  keys; no PostgreSQL row-level security is claimed
  ([../ARCHITECTURE.md](../ARCHITECTURE.md), "Trust boundaries"). Tier 3
  exercise 3.3 turns that claim into an adversarial proof.

When you can explain why the local path needs no outbox, why the external
path cannot be fixed by any amount of local transaction work, and why the
receipt lookup must happen *before* resending rather than after — you
understand this system's answer to the central question.

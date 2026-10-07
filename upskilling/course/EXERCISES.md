# Exercises: break, extend, and move the resumable-import boundary

Three tiers, in the three-rebuild course's discipline: write your prediction
down before every run, let a real test tell you what happened, and revert
cleanly. Everything here is **proposed work** — none of it exists in the code
until you build it.

Baseline commands (see [VERIFICATION-GAP.md](VERIFICATION-GAP.md) for what
each one needs and what ran when this course was written):

```powershell
npm test                                        # DB-free TS unit tests
dotnet test worker.tests/Relay.Worker.Tests.csproj   # C# unit tests (requires .NET 10)
npm run test:e2e                                # needs DB + web + built worker
npm run test:advanced                           # needs DB + web + connector + built worker
```

Whichever of these your exercise names as its detector must be green before
you break anything and green again after you revert.

---

## Tier 1 — Break and observe (an hour or two each)

Use the test suite as the instrument. Predict the exact failing assertion,
apply the smallest possible break, run, compare, revert with
`git checkout -- <file>`.

**1.1 Break the CSV formula neutralization (pure TS).** In
`src/lib/contracts.ts`, make `csvCell` return
`'"'+s.replaceAll('"','""')+'"'` without the leading-character guard.
*Predict first:* which of the two tests in `tests/contracts.test.ts` fails,
on which input, and what a spreadsheet would do with the exported report if
this shipped?
*Done when:* `npm test` shows exactly the predicted failure
([worked-examples/break-the-formula-guard.md](worked-examples/break-the-formula-guard.md)
is a completed model run — do yours before reading it), and you can say which
layer owns this guarantee (the *export*, not storage — the raw cell is stored
verbatim on purpose; `scripts/e2e.mjs:67` checks the neutralized form appears
in the report).

**1.2 Break the duplicate-mapping refusal (pure TS).** In
`src/lib/contracts.ts`, remove the `.refine(...)` from `mappingSchema`.
*Predict first:* which assertion in `tests/contracts.test.ts` fails — and
what would actually go wrong downstream if two schema fields mapped to the
same source column? Trace your answer into `ContactRules.Normalize` before
running.
*Done when:* the predicted test fails, and you can explain why the server
validates this even though the UI never offers a duplicate choice.

**1.3 Break the cross-language approval fingerprint (C# — requires .NET 10
locally).** In `worker/ImportWorker.cs:24`, swap `{j.Hash}:{j.Version}` to
`{j.Version}:{j.Hash}` in the format-2 branch.
*Predict first:* `dotnet test` stays green — why? Which e2e check is the
first to fail, and with what visible symptom (hint: `Commit` throws at
`ImportWorker.cs:228`, which path does that error take through
`ImportWorker.cs:94-107`)?
*Done when:* you can name the failing suite without running it on a machine
that cannot, or you ran `npm run test:e2e` and watched every import stall to
`failed` after five attempts. The lesson: the two hash implementations
(`route.ts:17`, `ImportWorker.cs:24`) are pinned only end to end — no unit
test spans the language boundary. Write the missing fixture test as a
follow-up.

**1.4 Break logical resume (C# — requires .NET 10 locally).** In
`worker/SourceCursor.cs:45`, change the skip loop to skip `skip-1` records.
*Predict first:* which assertion in
`worker.tests/PlatformTests.cs:14` (`LogicalCsvResumeHandlesQuotedNewlines`)
fails, and what would the *production* symptom be — duplicate contacts,
missing contacts, or neither, given `ON CONFLICT DO NOTHING` at
`ImportWorker.cs:166`? (Work it through: the re-staged row hits the same
`(job_id,row_no)` primary key but carries a *different* row's data.)
*Done when:* the unit test fails as predicted and you can explain why the
database's conflict handling hides this bug instead of catching it — a
constraint absorbs the replay but cannot notice the content is wrong.

**1.5 Trace a second promise.** Write a half-page tour, in
[CODE-TOUR.md](CODE-TOUR.md)'s format, for **"pause stops new external
authorizations but never lies about in-flight ones"**: `route.ts:167-171` →
the status re-check inside `ExternalDelivery.cs:61-66` → the
paused/cancelled arm of the scheduler query (`ImportWorker.cs:57-59`) →
`scripts/advanced-e2e.mjs:48-49`.
*Done when:* your tour names the one transaction that serializes the
permission-to-send decision with pause, and where its guarantee ends.

## Tier 2 — Extend inside the boundaries (1–3 days each)

Write the failing test first, in the style the repo already uses: unit tests
where the logic is pure, an e2e check where the promise spans processes.

**2.1 A new cleanup rule, end to end.** Add `lowercase_domain` for `email`
(lowercases only the part after `@`, which matters once you notice
`Normalize` already lowercases the whole email — so pick a rule with real
content instead: `trim_trailing_punctuation` for `name` and `company`).
Touch every layer the existing `collapse_spaces` touches:
`transformsSchema` (`src/lib/contracts.ts:9`), `ContactRules.Normalize`
(`worker/ContactRules.cs:32-33`), the mapping UI, and the AI proposal
whitelist (`route.ts:98`).
*Done when:* a new `RulesTests` case pins the C# behavior, a new
`tests/contracts.test.ts` case pins the schema, changing the transform bumps
`mapping_version` and clears approval (prove it with an e2e-style assertion,
not by reading the code), and the worked rule round-trips in the preview.

**2.2 Per-row delivery evidence export.** The corrections report
(`route.ts:110-126`) covers validation errors. Add a delivery report for
external jobs: one CSV row per outbox entry with `row_no`,
`idempotency_key`, `state`, `outcome`, `attempts`, `last_error`.
*Done when:* the stream pages like the existing report (keyset on `row_no`,
never offset), formulas are neutralized through `csvCell`, a tenant that does
not own the job gets 404 (mirror `scripts/e2e.mjs:53`), and a job with
uncertain rows exports them as `uncertain` rather than omitting or resolving
them — the export must be exactly as honest as the ledger.

**2.3 Import progress honesty in the UI.** The job header shows checkpoint
counts; uncertainty is only a `last_error` string
(`ExternalDelivery.cs:91`). Surface the outbox state counts
(`delivery_counts` already arrives at `route.ts:88-89`) as a first-class
progress element: delivered / uncertain / pending, with "uncertain" worded as
*possibly delivered, awaiting receipts* — never as failure.
*Done when:* during a `lose-response-once` rehearsal the UI shows 7 uncertain
without claiming failure, after reconciliation it shows 7 delivered, and a
paused job states that in-flight sends may still land (the README's
"Product boundaries" wording is the source of truth).

## Tier 3 — Move a boundary (1–2 weeks each; one page of design first)

For each: write two alternatives, your choice, and what evidence would make
you revisit — before building. Update [../ARCHITECTURE.md](../ARCHITECTURE.md)
as if the next learner inherits your version.

**3.1 Exactly-once vs at-least-once, made explicit.** Today the external path
is exactly-once *effect* delivery only because the test API promises unique
`(tenant,key)` receipts, payload-hash replay detection and strongly
consistent lookup (`scripts/test-destination.mjs:37-42`). Build a second
destination mode that withholds those promises — receipts become eventually
visible (lab 08's step 5 names this experiment; here you build it) — and make
Relay honest about the downgrade: at-least-once delivery with a dedupe key
the *destination* may or may not honor, surfaced to the reviewer before
approval. This is exactly relay-rebuild's provider-receipt lesson (its
worked example `duplicate-effect.md`: checkpoint fencing protects the app
store; only a cooperating provider keyed by a stable identity can recognize a
retry) — now with the provider contract as a per-destination variable instead
of a given.
*Done when:* a rehearsal in the `advanced-e2e.mjs` style shows the same
lose-response fault producing `uncertain → delivered` under the strong
contract and `uncertain → delivered-at-least-once` (your new terminal state,
with a visible duplicate possibility) under the weak one, and the approval
screen names which contract the destination offers.

**3.2 Poison-row quarantine.** Today five batch failures fail the whole job
(`ImportWorker.cs:99-104`) — one row whose payload the destination rejects
with a 400 can strand 49,999 good rows. Design a per-row quarantine: after N
attempts isolate the row (new disposition or outbox state), continue the
batch, and report quarantined rows in the Tier 2.2 export.
*Done when:* a fault mode you add to `test-destination.mjs` (reject one
specific key with 400) leaves the job `completed` with one quarantined row —
every other row delivered, the quarantined row never silently dropped, and
the accounting invariant (every staged row has a final outcome) still holds;
state your new invariant in the lab-04 style: counts that must sum to
`total_rows`.

**3.3 Tenant isolation, proven adversarially.** Stockade's course proved
isolation by attack, not by reading the code. Do the same here: a test suite
in which tenant B, with a valid session, attempts every cross-tenant read and
write you can construct — jobs, rows, reports, receipts via the connector's
`tenantId` parameter (`test-destination.mjs:17`), ops metrics, the advisory
lock keyspace (`ImportWorker.cs:70-71` hashes `"tenant:"+org` — can a crafted
org collide?), and `account_tokens` reuse across orgs.
*Done when:* every attempt is asserted to fail with 403/404/empty — and each
*gap you find* is reported as a finding with a concrete reproduction, not
silently fixed; the existing partial evidence (`scripts/e2e.mjs:53-56`,
`scripts/advanced-e2e.mjs:44`) becomes a subset of your suite.

---

## Calibration

You are working at the level this course targets when you can state, without
notes: which guarantees live in a uniqueness constraint, which in a
transaction boundary, which in an idempotency key held by *another* system —
and for each test you cite, what it actually proves versus what it merely
rehearses.

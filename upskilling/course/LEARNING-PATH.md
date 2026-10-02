# Relay senior course: the resumable-import path

Central question: **when a 50,000-row file half-imports and the worker process
dies, what can the operator honestly be told — and what must be true so that
pressing Resume never creates a duplicate contact?**

Everything in this course hangs off that question, because Relay answers it
twice, with two different mechanisms:

- **Local destination** (`contacts` table): one database, so one transaction
  can hold the row effects *and* the checkpoint. Resume safety is a uniqueness
  constraint plus atomic progress.
- **External destination** (the test API): two databases that cannot share a
  transaction. Resume safety becomes a stable idempotency key, an outbox that
  records *uncertainty* before the network call, and a receipt lookup that can
  tell "committed but the response was lost" apart from "never happened."

The gap between those two answers — and the crash window that forces the
second one — is the subject of [CODE-TOUR.md](CODE-TOUR.md).

## Who this is for

The existing track in this repository
([upskilling/README.md](../README.md), [FIRST_SESSION.md](../FIRST_SESSION.md),
[ROADMAP.md](../ROADMAP.md)) takes a novice/junior learner to independent
feature ownership through foundations, guided labs and assessed features. This
course is the senior end of the same repository: it assumes you can already
read both languages, write tests, and run the platform, and it concentrates on
the one path where Relay's engineering is densest. It extends — and leans on —
labs [04 (crash recovery)](../labs/04-recovery.md) and
[08 (external delivery)](../labs/08-external-delivery.md) rather than
replacing them.

It also pairs with the three-rebuild course (GitJira → Stockade → Relay
rebuild) in the sibling `astrafinalorganize` workspace: relay-rebuild is this
course's closest sibling — the same identity/idempotency question, and Relay
pushes it one process boundary wider, across a TypeScript↔C# split with
PostgreSQL in the middle.

## Sequence

1. **Foundations check.** If any step of
   [FIRST_SESSION.md](../FIRST_SESSION.md) or stage 1–3 of
   [ROADMAP.md](../ROADMAP.md) is not comfortable, do that track first. This
   course does not re-teach it.
2. **Lab 0 — a verified environment.** Node 24+, .NET 10, PostgreSQL 18, then
   every suite in the README's "Verify and learn" list green locally. See
   [VERIFICATION-GAP.md](VERIFICATION-GAP.md) for exactly which of these ran
   when this course was written, and which did not and why. Done when: all
   suites pass on your machine, and you have the evidence files to show it.
3. **Architecture reading.** [../ARCHITECTURE.md](../ARCHITECTURE.md) end to
   end, especially "Local atomicity" and "External uncertainty." Before
   reading the code, write down your prediction: where does the checkpoint
   live, and what happens to a batch the worker had sent but not recorded?
4. **The code tour.** [CODE-TOUR.md](CODE-TOUR.md) traces one promise from
   upload to destination, across both languages, with the tests that pin each
   step. Keep the files open; the tour is useless read cold.
5. **Break it.** [EXERCISES.md](EXERCISES.md) Tier 1 — small deliberate breaks,
   predicted first, observed through real test failures, then reverted.
6. **Extend it.** Tier 2 — changes that stay inside the current boundaries.
7. **Move a boundary.** Tier 3 — the exactly-once/at-least-once decision, a
   poison-row policy, a tenant-isolation proof. One at a time, design note
   first.

## Rules of the house

Carried over from the three-rebuild course, because they are what make the
material trustworthy:

- **Predict first.** Write down what you expect before every run. The learning
  is the delta between prediction and observation.
- **Evidence at its actual strength.** "The e2e suite passed once on one
  machine" is not "resume is safe." Say which test proves which claim, and
  what it cannot prove (a crash *rehearsal* at a chosen row is not a fault
  injection at every row).
- **Never fabricate output.** Every quoted result in these documents comes
  from a run that actually happened; where a run was blocked, the block is
  reported verbatim instead.
- **Exercises are proposals.** Anything labeled "exercise" does not exist in
  the code yet. Do not let a confident description of future work read like a
  description of the repository.

# Assess ownership, one piece of evidence at a time

Use the gates in the roadmap. Keep code, failing and passing checks, the task brief, your explanation, and help used in `submissions/`. Choose one weakness for the next session. Do not award yourself a level from a total checkbox count.

## Feedback rubric

Score each dimension separately: **0** no attempt/evidence; **1** follows a walkthrough or needs step-by-step help; **2** handles a bounded task independently and explains it; **3** handles a changed constraint, catches a new failure, and justifies tradeoffs. Documentation is allowed. A solution supplied by an assistant is assisted evidence until you solve a different case yourself.

| Dimension | Evidence for independent work (2) | Changed constraint (3) |
| --- | --- | --- |
| Problem framing | Behaviour, examples, non-goals and acceptance cases before coding | Clarify an ambiguous request; reject unnecessary scope |
| Implementation | Small understandable diff, correct boundaries, explain every changed line | Adapt a new requirement without copying the old solution |
| Debugging | Reproduce, form a hypothesis, isolate a cause, verify the fix | Diagnose a different failure with incomplete information |
| Testing | Positive, negative and boundary cases that catch an actual defect | Find a missing case or race and demonstrate why it matters |
| Data and security | Tenant/role checks, validation, constraints and safe error handling | Explain concurrent access and migration consequences |
| Interface | Loading/empty/error states and keyboard interaction | Handle stale responses or changed data without losing user intent |
| Delivery | Reviewable description, appropriate checks, rollout and rollback plan | Follow a release/incident outcome and improve the process |
| Communication | Explain uncertainty and respond to review feedback | Help another person make progress; document a tradeoff they can challenge |

The reviewer identifies the most important gap, cites the code or observation, and gives one follow-up task. Mark self-review, AI review, and human review separately. A fresh AI session can find gaps; it is not evidence of collaboration with a teammate.

Repeat an exit task in a later session with different inputs and no previous solution open. For the independent-delivery gate, complete **two different small features** over separate work cycles, with score 2 or better in each relevant dimension and at least one transfer task at 3. This is a local curriculum gate, not an industry certification or a senior-title threshold.

## Feature brief A: a useful rejection summary

After guided changes, own this small vertical slice. First inspect whether an equivalent feature already exists. If it does, agree on a missing user behaviour or a different brief; rebuilding existing behaviour is not independent delivery.

**User need:** an operator reviewing an import wants the most common validation messages and affected-row counts before opening individual rows.

**Initial scope:** a read-only summary for one job, grouped by the worker's existing exact error messages, in the existing review screen. Clarify ordering, whether multiple errors count one row in multiple groups, and what an empty result means. Do not invent stable error codes if the current contract uses strings. Restrict the query to the authenticated organisation and selected job. Keep the response bounded; do not download every row into the browser.

**Acceptance:** correct grouping on a tiny known fixture; explicit multi-error-row semantics; empty/loading/error states; no cross-tenant results; viewer/operator/reviewer access matches the actual current role policy; stale responses cannot replace the summary for a newly selected job. Report the query's cost using a representative dataset only after correctness works. Produce a small diff, focused checks, a review description, and a rollback plan. Existing approval and import effects should retain their contract.

**Changed requirement:** the operator wants to filter to one message while pagination is active. Identify which interface/API contract needs changing and which tests protect it. Negotiate a separate task if this exceeds the original scope.

## Feature brief B: write a bounded CRUD service yourself

Build a small practice “import notes” service under `upskilling/practice/notes/`, with its own disposable dataset. A note belongs to an organisation and an import. This exercise must include a read, create, update, and delete path; API validation; parameterized SQL; controlled form state; loading/empty/error handling; and a lost-update decision. Reuse concepts, but write the behaviour yourself.

Before coding, specify the fields, length limit, membership/role policy, delete semantics, and what two people editing the same note should see. Start with one endpoint and a tiny fixture. Keep it outside the live Relay workflow until reviewed. You may use an isolated practice app or an isolated checkout; do not copy `.env`, uploads, caches, or customer data.

**Acceptance:** one full create/read/update/delete journey; another tenant cannot read or mutate the note; invalid input has a useful error; a stale update behaves according to the written decision; persistence survives restarting the practice app; targeted tests exercise behaviour rather than implementation shape. Demonstrate a defect found by review and your response. This task may span several sessions.

**Transfer:** add an optional field without losing existing notes. Explain the migration and backwards-compatibility plan before implementing it.

## Reliability and senior judgment

For the later reliability gate, trace transaction boundaries on 10 rows before scaling. Demonstrate a crash before and after commit, account for every outcome, and explain why a constraint and a checkpoint solve different problems. Measure a bottleneck before changing performance code. Write a recovery note another person can follow.

For senior practice, take an ambiguous request such as “imports are too slow.” Establish the user-visible target, collect evidence, compare at least two approaches including leaving the architecture alone, and propose a staged change with an operational owner and rollback trigger. Seek a real review, observe a real handover, and improve the result from feedback. Repeat this in a team or maintained shared project. Solo simulations are useful preparation; mark the real collaboration gate pending until observed.

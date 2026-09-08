# From guided practice to engineering ownership

Use the default foundations placement until your own work supports skipping ahead. Move by demonstrated skills, not weeks or number of features in Relay. An experienced learner can attempt a gate directly; an unfamiliar idea gets a smaller worked example and another practice task.

| Stage | Learn and practise | Exit evidence |
| --- | --- | --- |
| 1. Foundations | Functions/types, tests, debugging, Git, HTTP/async, SQL, C# tests, React state | The seven small exit tasks in [Foundations](FOUNDATIONS.md), including a later changed case |
| 2. Guided changes | Trace a request, validate one field, enforce membership, handle UI state | Two small reviewed changes with your tests, failure traces and explanations |
| 3. Independent feature ownership | Clarify a brief; deliver API, persistence and UI; review and support it | Two different feature cycles from [Assessment](ASSESSMENT.md); independent work and transfer across the rubric |
| 4. Reliability and operations | Transactions, concurrency, compatibility, measured performance, release/rollback and recovery | Explain and reproduce a small crash case, account for outcomes, measure one change and write an actionable recovery note |
| 5. Senior judgment practice | Ambiguous requirements, tradeoffs, prioritisation, review, mentoring and operational follow-through | Repeated decisions and feedback in a shared project; another person's review and handover observations |

Stage 3 is the main mid-level preparation target. Stage 5 is continuing practice, not a promise of seniority from completing a repository. The [review](REVIEW.md) explains the career calibration and its limits.

## Stage 1: one concept at a time

Start at [First session](FIRST_SESSION.md), then [Foundations](FOUNDATIONS.md) F2–F7. The first two tasks run on Node alone. Introduce C# by testing familiar normalisation logic after TypeScript; introduce SQL and React with tiny datasets and one interaction. Keep an unfamiliar framework from hiding a basic programming gap.

## Stage 2: small changes with feedback

Use this order, rather than numerical lab order:

1. [Lab 01](labs/01-record-journey.md): trace five rows. Explain the request/worker boundary; add one focused test. Adding a field across the stack is deferred.
2. [Lab 03](labs/03-validation.md): one validation boundary, positive/negative/boundary tests, and one useful error message. Predict before running existing tests.
3. [Lab 02](labs/02-tenancy.md): trace one membership check and write one negative access test. A new role is an optional later feature.
4. [Lab 12](labs/12-frontend.md): one keyboard or state issue. Show its before/after behaviour. Large-file profiling is optional until stage 4.

For each task, read the named function or route branch rather than the whole file. Submit a small diff with problem, resulting behaviour, tests, and one uncertainty. A reviewer returns one priority issue for you to fix. Follow the rubric in Assessment. Use a changed input next session to test independence.

## Stage 3: own a feature

Take feature briefs A and B in [Assessment](ASSESSMENT.md), one at a time. The second includes CRUD and a migration so you practise writing a service as well as reading the finished platform. Split each into small slices. Before implementation, write examples, API/data contracts, failure behaviour and non-goals. After implementation, explain the diff, incorporate review, and practise a new requirement without copying a solution.

Use [Lab 05](labs/05-approval.md) to reason about stale versions, and [Lab 06](labs/06-fresh-session.md) to hand off your own bounded change. An assistant can review or research a specific question; record its contribution and retain ownership of the decision and code explanation.

## Stage 4: make failure understandable

Use [Lab 11](labs/11-schema-excel.md) for compatibility, [Lab 04](labs/04-recovery.md) for transaction/checkpoint boundaries, and [Lab 09](labs/09-operations.md) for measured performance and recovery. Split the operations lab: measurement, backup restore, and rollout are separate sessions. First use about 10 rows; reach 100k only after explaining the small case.

Inspect the existing CI definition and identify which checks protect your change; practise the local equivalents. Explain configuration, secrets, process startup, health checks, deploy order and rollback before choosing a hosting provider. Hosted CI/deployment still need a real target and their own observations. Avoid adding infrastructure merely to cover a topic.

## Stage 5: use judgment with other people

Use [Lab 10](labs/10-handover.md) and the senior brief in Assessment. Clarify a vague need, compare options, choose a bounded experiment, and explain what would change your decision. Ask another person to operate or review your work, observe their difficulty, then improve the interface or explanation. Keep a decision's consequences in view across multiple sessions or releases. Solo or AI-only exercises keep the human collaboration gate pending.

After stage 4, [Lab 08](labs/08-external-delivery.md) is an optional distributed-systems extension and [Lab 07](labs/07-ai-mapping.md) is an optional evaluation extension. Neither is required to demonstrate the core mid-level feature-ownership gate.

## A sustainable learning loop

A possible week is three 45–60 minute sessions: read/predict and modify a tiny example; solve a task and debug a failure; review, explain and try a changed example from memory. Use more sessions for a feature. Reserve time for feedback and revisits instead of continuously adding topics. After 10 minutes stuck, ask for a hint with your exact attempt and error.

Store your evidence in `submissions/` using [the session template](templates/session.md). Track stage gates and lab attempts in [learner-progress.json](learner-progress.json); structured ordering lives in [learning-path.json](learning-path.json). Machine checks validate the curriculum's structure, not your ability.
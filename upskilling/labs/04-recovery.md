# 04 — Crash the worker, keep the promise

Learning placement: reliability. Prerequisite materials: relay-assessment, relay-lab-05. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: `ImportWorker.Commit`, `Load`, advisory-lock acquisition and `scripts/e2e.mjs`.

Predict BEFORE the test:
- Crash before commit: which contacts, row outcomes and checkpoint survive?
- Crash after commit: which rows run again?
- Two workers: what stops the same job from advancing concurrently?
- Pause during a transaction: when can the UI promise that progress has stopped?

Run: stop manual workers. Start the database and web app. Build the worker. Set RELAY_LARGE_TEST=true and run npm run test:e2e. Inspect test-results/e2e.json and worker logs.

The 100k fixture should produce 97,600 imported, 1,600 rejected and 800 duplicate rows in a clean namespace. It contains missing required values, ambiguous dates, normalized dates and repeated identities. The injected worker exits with code 73 at committed checkpoint 50,000; restarted workers must finish at 100,000 with no repeated contact effects.

Before-commit rehearsal: scripts/advanced-e2e.mjs uses Relay__CrashBeforeRows and expects exit 74. Verify the checkpoint and destination effects roll back together, then compare with the after-commit exit-73 experiment. Neither process-loss test alone proves resilience to every storage or network failure.

Bounded experiment: change batch size from 500 to 100 and 2,000. Measure elapsed time, database round trips, responsiveness to pause and peak worker memory. Keep dataset and environment fixed. Stop after three runs.

Explain: why is checkpoint-before-effects unsafe? Why is effects-before-checkpoint unsafe without a shared transaction? Why does local transactional idempotency not solve a remote destination’s uncertain outcome?

Assess: make a precise invariant assertion: committed ledger rows, checkpoint, total rows and unique destination emails. Explain why imported count alone is insufficient.

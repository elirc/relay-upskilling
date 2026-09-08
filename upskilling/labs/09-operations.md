# Operate the pipeline and test its limits

Learning placement: reliability. Prerequisite materials: relay-lab-04. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.


Use templates/experiment.md; write your prediction before running the exercise.


Predict whether a five-row Northstar upload can reach mapping before a 4,000-row Acme upload finishes parsing. Predict what happens to a v2 job when only a worker advertising v1 runs.

1. Read the candidate-selection query, tenant/job advisory locks and SourceCursor cache. Identify the batching boundary and what work still occurs when opening a file.
2. Run the fairness and compatibility cases in npm run test:advanced. Record actual batch ordering; do not equate one passing scenario with a tenant latency SLA.
3. Inspect Operations as a reviewer and attempt access as an operator. Trace one external receipt back to a batch trace ID. Explain how rows per active second differs from wall-clock throughput.
4. Run the 100k rehearsal with RELAY_LARGE_TEST=true. Record dataset size, batch size, elapsed phases, peak RSS, outcome counts and restart checkpoint. Compare against evidence/performance.json where available.
5. Run npm run test:restore. Inspect the exported snapshot, archive hash, copied originals and restored table counts. Explain why a database dump alone is insufficient for this product and why the restore uses a separate database.
6. Read deploy/README.md. Write a rollback plan for a release that accepts a new schema. Name the exact compatibility gate before returning traffic to an older web build.

Pass when you can diagnose a missing worker, an unsupported contract, a retrying destination and a malformed file from the interface/runbook without resetting state. Deliver metrics with their measurement boundaries and a restore result.

Stretch: compare two batch sizes with the same frozen dataset and workload. Set a time and memory budget in advance; preserve inconclusive observations.

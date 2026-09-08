# 05 — Review a version, reconcile current state

Learning placement: independent. Prerequisite materials: relay-lab-02. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: approval handler, approval fingerprint, correction version increment and Commit reconciliation.

Predict: a reviewer opens version 1, an operator corrects a row to create version 2, and the reviewer submits version 1. What must the server do?

Explore: record the mapping version; correct and revalidate; send approval with the old version. Expect 409. Then approve the current version. Verify that attempts to remap a running/completed import fail.

Debug: insert or edit a destination contact after preview but before execution. The import must preserve the destination and classify a conflict. Re-upload the same file and verify repeated effects are suppressed.

Build: propose an explicit update-existing policy. Do not implement a blind upsert. Define expected destination version checks, conflict handling, human preview and preservation of later edits first.

Explain: the approval hash is a fingerprint, not a secret or signature. Identify where authorization comes from. Explain how the first valid record wins among intra-file duplicates and why conflicts are not silently overwritten.

Assess: reproduce the stale-approval and destination-edit cases without the existing harness; record actual requests and SQL observations.

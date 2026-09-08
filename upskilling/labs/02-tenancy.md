# 02 — An ID is not permission

Learning placement: guided. Prerequisite materials: relay-lab-03. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: the membership helper in `src/lib/auth.ts` and one report route branch in `src/app/api/[...path]/route.ts`. Follow its query's organisation filter. Inspect a composite foreign key in `db/001_init.sql` only after you can explain that request.

Predict: if Jules knows an Acme job UUID, can Jules download its correction report? Does changing x-relay-org grant membership?

Explore: create a job as Alex. Try its detail, rows, report and mutation endpoints as Jules. Record status codes. Try approval as Sam. Explain 401, 403 and 404.

Build: add one negative access test for a foreign job or a disallowed action. A new viewer role is a later optional feature, after independent ownership.

Debug: intentionally remove the membership check in an isolated copy and show which acceptance test detects the regression. Restore it before completing the exercise.

Explain: why is a hidden UI button not authorization? What does the organisation filter protect? Later extension: explain how a composite foreign key complements the request check; designing database RLS belongs after the core task.

Assess: independently identify one endpoint not covered by an isolation test and add a meaningful test for it.

# Independent review contract
Review one invariant: local checkpoint atomicity, tenant authorization, exact-version approval, external receipt reconciliation, or preservation of later destination edits.

Reviewer inputs: relevant source, schema, acceptance requirements and test harness. Initially hide the implementer's conclusions and expected finding list. Ask the reviewer to trace a normal path and two failure/concurrency paths.

Deliver: source locations, a concrete trigger for each finding, expected versus actual behavior, severity justified by impact, a minimal reproduction or reason the concern is unresolved, and the tests needed to close it. No speculative feature wishlist.

Completion: reconcile disagreements, make justified fixes, rerun only affected checks, and record the reviewer's identity/session and timestamp. Same-session self-inspection does not satisfy independence. No independent review has yet been observed for this build.

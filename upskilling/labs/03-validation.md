# 03 — Make ambiguity visible

Learning placement: guided. Prerequisite materials: relay-lab-01. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read: `worker/ContactRules.cs`, `worker.tests/RulesTests.cs`, mapping/correction handlers.

Predict: should 03/04/2025 mean March 4 or April 3? If both Name and Full Name appear, should the mapper choose one?

Explore: upload missing names, uppercase padded emails, repeated emails, quoted commas/newlines and ambiguous dates. Separate syntax errors from valid CSV records that fail business validation.

Build: add a field-specific validation rule and a clear remediation message. Include a positive, negative and boundary case. Do not silently “repair” an uncertain value.

Debug: correct a rejected row so that it duplicates an earlier row. Revalidate. Then change the earlier row’s email and verify that the later row is no longer incorrectly classified from stale state.

Explain: why do corrections increment mapping_version? Why are raw bytes immutable while staging can change? Why do we accept year-first dates but abstain on ambiguous local formats?

Assess: show before/after row outcomes and explain all changed counts. Record a hypothesis before each correction.

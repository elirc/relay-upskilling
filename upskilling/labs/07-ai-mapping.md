# AI mapping: measure mistakes before trusting proposals

Learning placement: elective_after_reliability. Prerequisite materials: relay-lab-09. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.


Use templates/experiment.md; write your prediction before running the exercise.


Predict whether Mailing address, Electronic mail, Name + Full name, and an instruction-like header should produce suggestions. Write the expected mapping before invoking the model.

1. Inspect services/mapping-engine.mjs and the suggest branch of the request API. Identify the pinned model revision, score threshold, separation threshold, duplicate-claim handling and exclusions.
2. Run npm run test:ai. Compare evidence/ai-baseline.json to evidence/ai-evaluation.json. Locate the mailing-address false positive and explain why a high similarity score is not a probability of correctness.
3. In the UI, request AI suggestions and inspect the proposal before applying it. Confirm the saved mapping_version is unchanged. Apply to draft, review cleanup rules, validate, and observe that approval is still a separate reviewer action.
4. Create a new untouched evaluation set with at least 20 realistic headers, including non-English or domain-specific inputs. Freeze its labels before running a model. Report precision, coverage and incorrect proposals; do not silently convert failures into new labels.
5. In a bounded experiment, change one policy threshold using a calibration set. Keep the fresh test set separate. Record the precision/coverage tradeoff and revert or justify the change.

Pass when you can explain where the actual neural model participates, how deterministic aliases differ, why instructions inside headers cannot authorize actions, and why 15 correct held-out proposals do not prove general reliability. Deliver your labels, exact model revision, command output, one failure analysis and your decision.

Stretch: compare a structured-output LLM against this local model using the same frozen labels. Treat it as a new experiment; do not relabel the existing embedding implementation as an LLM.

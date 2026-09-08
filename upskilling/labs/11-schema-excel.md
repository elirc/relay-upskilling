# Evolve contracts without changing old imports

Learning placement: reliability. Prerequisite materials: relay-assessment. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.


Use templates/experiment.md; write your prediction before running the exercise.


Predict whether a v1 import should conflict merely because an existing contact has a v2 phone field. Predict what approving a mapping before changing its phone cleanup would authorize.

1. Compare v1 and v2 in contracts/contact-schemas.json. Trace the manifest into migration fingerprints, API upload metadata, worker verification and report columns.
2. Run the v1/v2 tests. Confirm v1 output has no phone column, v2 international phones validate, and local numbers without a country code are rejected rather than guessed.
3. Upload test-results/contacts.xlsx from the advanced fixture. Inspect the same staged row before and after reviewed whitespace/phone cleanup. Explain which values are original and which are corrected/normalized.
4. Try formulas, two worksheets, duplicate headers and a quoted-newline CSV. Locate the exact supported-input rule. Explain the difference between streaming row iteration and buffering a workbook shared-string table.
5. Design v3 with a new optional field in a task contract before editing. Define old-job execution, approval binding, field comparison, UI behavior, export shape and mixed-version deployment acceptance criteria.

Pass when you can explain why editing an existing schema definition is unsafe, why a logical CSV checkpoint is not a physical line number, and what is required to reproduce a transformation months later. Deliver a v3 design and at least one failing compatibility test before implementing it.

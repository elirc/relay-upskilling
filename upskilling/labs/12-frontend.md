# Keep a large import usable and accessible

Learning placement: guided. Prerequisite materials: relay-lab-03. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.


Use templates/experiment.md; write your prediction before running the exercise.


Predict how much row data the browser loads for a 100k import and which interactions can race with worker updates.

1. Follow ImportDetail's keyset pagination and filtering into the row API. Verify at most 50 rows are rendered per page and the response has a bounded extra row for hasMore.
2. Use only a keyboard to open an upload dialog, choose mappings, edit a rejected row, dismiss a dialog and return focus. Run npm run test:browser and inspect its mobile screenshots; then try a screen reader manually.
3. Change a mapping from two browser sessions. Explain how the submitted mapping version and job state prevent a stale draft from authorizing the wrong review.
4. Inspect a live import while polling updates. Identify which UI state should reset on a version change and which state is only a local draft. Verify an AI response cannot save or approve itself.
5. Profile one expensive interaction with browser tooling. Write a performance hypothesis before changing code, then compare measured results using the same dataset and viewport.

Pass when you can explain the pagination tradeoff, demonstrate keyboard operation, identify a real interaction bottleneck or justify that none is material, and separate automated browser checks from a full accessibility audit.

Stretch: add a targeted accessibility test for a discovered defect. Avoid tests that simply copy component markup or assert CSS class names.

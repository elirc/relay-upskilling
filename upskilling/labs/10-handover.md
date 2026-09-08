# Have someone else operate and diagnose Relay

Learning placement: judgment. Prerequisite materials: relay-lab-09, relay-lab-06. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.


Use templates/experiment.md; write your prediction before running the exercise.


This exercise requires another person or an independently briefed session. It is prepared, not marked completed by the build agent.

Before the exercise, predict where your operator will hesitate and which evidence they will need. Prepare a synthetic CSV with one ambiguous date, a duplicate and an existing-contact conflict. Keep the expected outcomes separate from the operator instructions.

Give the operator only README.md, RUNBOOK.md, a non-production account and this task: import the supplied contacts, correct a validation problem, obtain reviewer approval, recover an interrupted execution, and explain the final row counts. During one run, stop the worker or inject a lost external response. Do not tell them the diagnosis.

Record: time to first successful import; whether they discover the role boundary; whether they find the failed dependency; whether they use retry/reconcile appropriately; whether they reconcile every row; and where the runbook misleads them. Ask them to explain the incident in their own words before showing expected results.

Then ask an independent reviewer to inspect one invariant using contracts/review-task.md. Record disagreements and changed conclusions. A second pass by the same agent with the same conclusions visible is self-review, not independent review.

Pass when the operator can complete and diagnose the scenario using the product/runbook, and you address their concrete findings with a focused change plus evidence. Do not score success because documentation exists. Save an anonymized observation record and leave learner-progress.json unassessed until the exercise occurs.

# 06 — Recover the engineering context

Learning placement: independent. Prerequisite materials: relay-assessment. Follow [the skills roadmap](../ROADMAP.md), rather than lab numbering.
Read your own feature brief, latest session note, and diff first. Use `project-state.json` and `HANDOFF.md` only for the system facts your change depends on.

Predict: which facts can a new session trust, and which require fresh verification?

Build: write a bounded task contract naming the allowed files, behavior, invariant, acceptance commands and stop condition. Use the headings from `contracts/next-task.md`, but write the behaviour and checks for your own feature; the default contract is a beginner exercise.

Experiment: open a fresh session with that contract and the handoff. Ask it to explain current behavior and the next step before edits. Compare its understanding against implementation evidence. Record missing information and improve the handoff.

Independent review: ask another person or separate session to challenge the invariants after implementation, without your conclusions. Record who reviewed, what they inspected, their findings and which were reproduced. This build does not claim that an independent review already occurred.

Assess: a fresh session can name your change, its tested behaviour, the remaining uncertainty and one correct next step from your handoff. You reproduce its check and correct one missing fact. Human operator handover is a separate stage-5 exercise in lab 10.

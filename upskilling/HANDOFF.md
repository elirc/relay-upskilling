# Fresh-session handoff
Read project-state.json, evidence/verification.md and the relevant lab before exploring more code. Scope is Relay and its learning material only; no unrelated Desktop inventory.

## Current learning priority
The user requested a learning-only review for novice/junior progression. Start at FIRST_SESSION.md and learner-progress.json. Foundations-first placement is an assumption until the learner submits a diagnostic. The curriculum and reference harness are authored work, not learner mastery. Use BUILD_PROMPT.md for tutoring; preserve starter attempts and old lab IDs. See REVIEW.md and learning-path.json for the revised order. Product expansion and public deployment are not the current next task. Curriculum reference checks, 40 document links, TypeScript, production build and the updated Learning screen passed; see evidence/learning-review.json. The standalone demo on 4318 was rebuilt and restarted.

## Current application
Native development app: http://127.0.0.1:4317. The verified standalone production demo is also running at http://127.0.0.1:4318; stop that process before replacing .next/standalone on Windows. PostgreSQL: localhost:54329. AI service: private localhost:4319. Test destination: private localhost:4321. Port 3000 belongs to another project; leave it alone. Local .NET executable is .tools/dotnet/dotnet.exe when dotnet is absent from PATH.

The core and extensions are implemented. The 100k test again produced 97,600 imported + 1,600 rejected + 800 duplicate outcomes after a real exit at checkpoint 50,000 and two-worker recovery. Advanced tests cover before-commit rollback, Excel/v1-v2, fairness, actual AI proposals, external 429/response loss/replay/cancel, traces and accounts. Real backup restoration is recorded in evidence/backup-restore.json.

## Run and verify
Use README.md commands. Set DOTNET_CLI_HOME=.cache/dotnet and NUGET_PACKAGES=.cache/nuget when using the bundled SDK. On Windows use npm.cmd. Test harnesses start their own workers: stop a manual worker first and run core, advanced and browser suites sequentially. Their synthetic data and evidence remain in the database; do not reset checkpoints to clean the dashboard.

The build is standalone. scripts/package-artifact.mjs removes traced environment files and checks local tooling/uploads/learning data are excluded. Stop a running standalone server before replacing its directory on Windows. Private model inference uses a pinned cache under .cache/models.

## Recovery details worth preserving
- CSV checkpoints count logical records, not physical lines. SourceCursor caches at most eight readers and rescans the prefix after interruption.
- Local effects/checkpoint share one transaction. INSERT RETURNING, not provenance equality, distinguishes new inserts.
- New approvals bind contract hash and destination; legacy approval format is retained.
- A remote timeout is uncertain. Do not retry with a new key; look up durable receipts first. Cancelled jobs may reconcile receipts without resuming sends.
- Existing contacts are never overwritten by an import, including remote repeated imports.
- The AI mailing-address false positive is preserved in ai-baseline.json. Its former held-out set became regression data after the fix; fresh labels are separate.

## Honest remaining gates
The private repository is https://github.com/elirc/relay-upskilling on main. No public hosting target was supplied. A public production Compose override and CI workflow are prepared; no public deployment or hosted workflow run is claimed. Docker execution is unverified because Docker is not installed here. Independent review, another person's handover, and learner mastery require their own observed evidence.

Next learner contract: contracts/next-task.md. Independent review contract: contracts/review-task.md. Update structured state after new evidence rather than inferring behavior from documentation.

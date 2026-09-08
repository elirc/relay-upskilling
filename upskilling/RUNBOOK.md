# Operate and recover Relay

## Start and import
Start database, migrate, and provision accounts. Start web, worker, AI and connector. Sign in, select CSV/XLSX, destination and schema. Confirm suggested columns, review cleanup rules, validate, inspect errors, correct cells and revalidate. A reviewer approves the exact current version. Download the final report after completion.

## Diagnose an interruption
1. Record import ID, status, destination, all three checkpoints, retry count and the latest event. In Operations, check worker heartbeat and supported schema versions.
2. If no worker is visible, check its process, database connection and upload mount. If its schema capabilities omit this job, start a compatible worker.
3. Correlate the import ID and recent trace ID with logs. Customer cells and credentials do not belong in logs.
4. Restore the dependency or restart the worker. Never reset checkpoints, row outcomes or contact identities.
5. A failed job needs reviewer **Retry from checkpoint** after its cause is corrected. The saved phase and existing approval are checked.
6. Completion requires commit_checkpoint = total_rows and every ledger row processed. Sum all outcomes, including rejected, duplicate, existing and conflicting rows.

## Crash rehearsals
- After commit: Relay__CrashAfterRows=50000; exit 73 occurs after the transaction and persisted marker. Restarted workers do not inject it again for that job.
- Before commit: Relay__CrashBeforeRows=200; exit 74 occurs after effect statements but before commit. A separate marker prevents repeated injection; the effect transaction rolls back.
- After an uncertain remote response: Relay__CrashOnUncertain=true; exit 75 occurs after the uncertainty record is persisted. Restart with this option false; receipt lookup reconciles committed remote effects.

These switches are off by default. The acceptance harness owns its worker processes; stop a manual worker before running it, or the manual worker might consume the job before the fault injector.

## External destination
Check delivery counts: pending means prepared; uncertain means an attempted outcome is not confirmed; delivered means a durable receipt was applied. Inspect throttled/uncertain events and next_attempt_at. A 429 response uses Retry-After, bounded to 1–60 seconds. Five consecutive failures require reviewer intervention.

The test service's private POST /admin/fault accepts tenantId and mode none, throttle-once, or lose-response-once with its service key. The latter commits contacts/receipts then closes the connection. Use only synthetic datasets. The test suite exercises both modes.

Pause/cancel does not retract a request already authorized for sending. Inactive jobs check receipts without sending new records. After bounded lookups, an unresolved outcome remains visible; **Reconcile receipts** requests another bounded, read-only reconciliation. A cancellation stays cancelled even if late receipts account for more rows. Do not upload a fresh file solely to clear uncertainty.

## Validation and malformed files
Ambiguous text dates require a year-first correction. Phone cleanup removes permitted punctuation but never invents a country code. XLSX requires one worksheet and values only; flatten formulas or export a CSV. A malformed source can fail after staging a prefix. Its report covers that staged prefix; the original file is retained, and the interface does not claim unknown unstaged rows were accounted for.

Parser failures use five exponential retries. For a permanently malformed source, cancel and upload the repaired original. For a temporary storage/dependency issue, restore it and use reviewer retry. Mapping and correction controls are available only at a stable mapping/review state.

## Accounts
A reviewer creates a seven-day single-use invitation under Team & account. Share the link with its intended recipient; Relay does not claim to send email. Existing users must supply their current password before joining another organization. An invitation never resets an existing password.

Password changes require the current password and revoke all sessions. Administrative recovery: run scripts/account-admin.mjs reset email with database-admin credentials. It emits a 30-minute single-use recovery link. After reset all sessions and outstanding reset links for that account are revoked. Bootstrap creates a new reviewer/workspace using RELAY_INITIAL_PASSWORD; it does not silently overwrite existing users.

## Backup and restore
Run npm run backup with PostgreSQL 18 client tools on PATH or PG_BIN. Output is under ignored .data/backups. The manifest includes archive hash, file hashes/counts and snapshot counts. The script copies originals after the database snapshot because originals are immutable.

Run npm run test:restore for a real pg_restore rehearsal. It creates and drops only its random relay_restore_* database, compares core table counts and checks completed-job accounting. It never restores over the running database. See evidence/backup-restore.json. A production restore should target a clean database and isolated upload directory first; verify hashes and start a compatible worker before switching application traffic.

Backups contain customer data, credentials and session state. Store encrypted copies off-host with restricted access. For an actual incident restore, revoke restored sessions/account links before reopening access. Schedule npm run ops:prune to remove expired authentication records and metrics older than 30 days; it retains jobs, original files, contact effects, receipts and audit events.

## SQL diagnostics
Bind parameters on an administrative connection:
```sql
SELECT id,status,destination,schema_version,total_rows,parse_checkpoint,
       validation_checkpoint,commit_checkpoint,attempts,last_error,next_attempt_at
FROM jobs WHERE id=$1 AND org_id=$2;
SELECT disposition,committed,count(*) FROM import_rows
WHERE job_id=$1 AND org_id=$2 GROUP BY disposition,committed;
SELECT state,count(*),max(attempts) FROM delivery_outbox
WHERE job_id=$1 AND org_id=$2 GROUP BY state;
SELECT phase,checkpoint,duration_ms,trace_id FROM batch_metrics
WHERE job_id=$1 AND org_id=$2 ORDER BY id DESC LIMIT 20;
```

For deployment, mixed-version rollout, TLS and private services, see ../deploy/README.md. The private source repository is https://github.com/elirc/relay-upskilling. A public hosting target is still required; supplied files are not evidence of a deployment.

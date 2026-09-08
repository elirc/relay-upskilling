# Observed implementation experiments
These are retrospective engineering observations from the build, not predictions written by the learner before their own exercises.

## Neural mapping false positive
Initial policy used known aliases or embedding similarity >= 0.60 with separation >= 0.12. The first labeled evaluation proposed Mailing address as email at similarity 0.7637: 24 correct / 25 proposed in its held-out set. See ai-baseline.json.

A conservative exclusion for physical-address and birth-date terminology fixed that observed case. The old held-out set became a regression set; a new six-case set was labeled before its next run. The resulting policy produced 15/15 correct proposals on that small fresh set and 24/24 on regression cases. See ai-evaluation.json. This is evidence for these examples, not calibrated confidence or broad multilingual accuracy.

## Excel startup failure
The streaming reader initially failed with NotSupportedException because the legacy encoding provider was not registered. The fix registers CodePagesEncodingProvider before creating the XLSX reader. The advanced test then imported a real generated workbook and verified normalized name, phone and date values.

## External commit with local receipt failure
The test destination successfully committed its rows and durable receipts while the initial local receipt writer failed because it combined positional-parameter SQL statements in one Npgsql command. Splitting them into separate commands inside the same transaction fixed persistence. The pre-existing remote receipts made the failure recoverable; no destination rollback or checkpoint reset was used. Advanced acceptance now verifies the intentional response-loss window as well as replay, payload mismatch, later edits and cancellation.

## Fairness and recovery
A small second tenant reached mapping before the large tenant finished parsing. The revised worker yields after each batch and filters unsupported schema versions before selecting a tenant's next job. Real exit-74 and exit-73 rehearsals verified both transaction windows; the 100k result remains 97,600 imported, 1,600 rejected and 800 duplicate outcomes.

## Restore
The real pg_dump/pg_restore rehearsal restored a consistent snapshot into a distinct random database, verified eight core table counts and completed-job accounting, and verified original-file hashes. See backup-restore.json. The temporary database was removed without replacing the source database.

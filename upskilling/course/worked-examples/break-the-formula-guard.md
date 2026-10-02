# Worked example: break the CSV formula guard

This is a completed run of [EXERCISES.md](../EXERCISES.md) exercise 1.1, kept
as a model of the loop — predict, break, observe, revert — in the same format
as the three-rebuild course's worked examples. If you are doing the exercise,
run your own before reading past "Predict first"; the point is your
prediction, not this transcript.

Environment for this run: Windows 11, Node v22.16.0 (the README asks for
Node 24+; `npm test` ran anyway, with only an `ExperimentalWarning: Type
Stripping` — see [../VERIFICATION-GAP.md](../VERIFICATION-GAP.md)).

Baseline on a clean tree:

```
npm test
# tests 2 / pass 2 / fail 0   (tests/contracts.test.ts, ~7-40s per run)
```

## Predict first

`csvCell` in `src/lib/contracts.ts:17` does two jobs: CSV quoting
(`"` → `""`, wrap in quotes) and spreadsheet-formula neutralization (prefix
`'` when the cell starts with `=`, `+`, `-`, `@` or leading whitespace/tab/CR
before one). The break removes only the second job.

Prediction written before running:

- Test 1 ("mapping refuses duplicate source columns...") stays green — it
  never touches `csvCell`.
- Test 2 ("CSV exports escape quotes, multiline values and spreadsheet
  formulas") fails on exactly one of its four assertions: the
  `'=HYPERLINK("evil")'` case, expecting a leading `'` that is no longer
  added. The quote-escaping assertions still pass, because escaping was left
  intact.
- Production symptom if this shipped: the row report at
  `src/app/api/[...path]/route.ts:110-126` funnels every exported value
  through `csvCell`, so a contact whose *name column in the uploaded file*
  was `=HYPERLINK(...)` — stored verbatim, by design — would reach a
  reviewer's spreadsheet as a live formula. The storage layer is not the bug;
  the export boundary is where this guarantee lives.

## The break

The one-line edit (recorded exactly, from `git diff`):

```diff
-export function csvCell(value:unknown){let s=value==null?'':String(value);if(/^[\s]*[=+\-@]|^[\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
+export function csvCell(value:unknown){let s=value==null?'':String(value);return '"'+s.replaceAll('"','""')+'"';}
```

## What actually happened

`npm test` with the break in. Trimmed real output:

```
# Subtest: CSV exports escape quotes, multiline values and spreadsheet formulas
not ok 2 - CSV exports escape quotes, multiline values and spreadsheet formulas
  error: |-
    Expected values to be strictly equal:
    + actual - expected

    + '"=HYPERLINK(""evil"")"'
    - `"'=HYPERLINK(""evil"")"`
  operator: 'strictEqual'
    TestContext.<anonymous> (...tests/contracts.test.ts:12:9)
1..2
# tests 2
# pass 1
# fail 1
```

As predicted: one failure, at `tests/contracts.test.ts:12`, and the
quote-escaping is untouched in the actual value — the two jobs of `csvCell`
really are separable, which is exactly why deleting one of them is a quiet
bug and not a crash.

Note the strength of this evidence honestly: the unit test pins the
*function*. That the report endpoint actually routes every cell through it is
pinned separately — `scripts/e2e.mjs:67` asserts the exported report contains
`'=SUM(1+1)` (neutralized) — and that check did **not** run in this
environment (no PostgreSQL; see the verification gap). On a full
environment, expect that e2e check to fail too with this break in.

## Restore and confirm

```
git checkout -- src/lib/contracts.ts
npm test              # tests 2 / pass 2 / fail 0
git status --short    # no change under src/
```

## Doing this yourself

1. Clean tree; baseline `npm test` green.
2. Write your prediction down first — which test, which assertion, what a
   spreadsheet user would experience.
3. Apply the one-line break to `src/lib/contracts.ts` only.
4. Run `npm test`; compare against your prediction, not against this file.
5. Revert, rerun, confirm green and a clean `git status`.

Never leave the break in, never commit it, and never "fix" the red test by
updating its expected string — the expectation *is* the counterexample
detector.

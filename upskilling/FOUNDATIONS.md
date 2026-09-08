# Foundations: small enough to understand

Work through these in order, one task per session. A session is roughly 30–60 minutes; repeat it when needed. Ask for a worked example of unfamiliar syntax before the independent task. Each exit task requires your code or explanation and a changed example, not just a command that passes.

## F1: functions, types, and tests

Do [the first session](FIRST_SESSION.md). Learn inputs, return values, strings, `null`, type checks, and assertions. An assertion compares an actual result with an expected result and fails when they differ.

**Exit:** implement `cleanName`, write an extra test, and explain all branches. Later change its non-string behaviour without reading the reference. **Relay connection:** compare just the `Get` helper and name checks in [ContactRules.cs](../worker/ContactRules.cs); understanding the entire worker can wait.

## F2: debug a count

Prerequisite: F1. Open [count.ts](practice/count.ts). An array is an ordered collection; the `for...of` loop visits each value. `count += 1` increases a counter. A condition decides whether that increase happens.

The requirement is to count **only** `rejected` outcomes. Duplicates and conflicts have their own meanings. Predict the output for `['rejected', 'duplicate', 'conflict', 'imported']`. Trace the value of `count` after each iteration on paper.

1. Write `upskilling/practice/count.test.ts` using the test syntax from `your-tests.ts`. Import `countRejected` from `./count.ts` and assert your expected result. Run `node --test upskilling/practice/count.test.ts` and keep its failure.
2. State one explanation for the discrepancy. Edit only `count.ts` and rerun your test.
3. Run `node upskilling/practice/check.mjs debug`. Add empty-array and repeated-rejection cases to your own tests. Explain why a set of unique outcomes would lose information.

**Exit:** show the failure, smallest fix, and a new case. Explain the loop's work as the number of rows grows. **Transfer:** in a new file, count each outcome separately and prove that the counts sum to the array length. **Hint:** which condition is broader than the requirement? Reference only after an attempt: `practice/reference.ts`.

## F3: changes you can inspect and undo

Prerequisite: F2. Learn file paths, terminal working directory, exit codes, a diff, and a commit. A diff shows changed lines; a commit records a reviewed snapshot in a Git repository. This workspace now has its own Git repository. Keep undo/commit drills in the separate practice folder below.

Practise in a new folder under `upskilling/submissions/git-practice/`: copy your two small exercise files and their test files there, initialise Git in that folder if available, add those explicit files, and make a first local commit. Configure repository-local identity if Git asks. Make one behaviour change, inspect `git diff`, run `node --test` against the copied test files from that folder, and make a second commit. View the two commits and use `git revert --no-edit HEAD` to undo the second in this disposable practice repository. Inspect the result. Do not push or initialise a repository around unrelated files.

If Git is unavailable, compare two saved copies and explain the diff; record the Git exercise as pending. **Exit:** explain what changed, why, what tested it, and how to undo your own change. A reviewer should understand a five-line change from your description.

## F4: requests, responses, and asynchronous work

Prerequisite: F2. An HTTP request asks a server to do something; a response has a status, headers, and often a body. A promise represents a result that will arrive later; `await` waits for that promise inside asynchronous code. Receiving a response does not mean a background import has finished.

Start the local application only now, using the root README. In the browser Network panel, sign in and open the imports list. Record one request's method, path, status, and response shape, without cookies or customer data. Follow only the matching route branch in `src/app/api/[...path]/route.ts`. Write a five-line input → membership check → query → response trace.

Write a small async function in `practice/request.ts` that fetches a public local health endpoint found in the code and handles a non-success status. First predict its behaviour if the server is unavailable; test it against an unused local port. Do not assume every error is a JSON response. Explain where `try/catch` belongs and why network rejection differs from an HTTP error status.

**Exit:** describe success, rejected HTTP status, and unreachable-server cases with actual observations. **Transfer:** explain why closing the browser should not undo a previously accepted import.

## F5: SQL and data ownership

Prerequisite: F4. A table stores rows. `SELECT` chooses values; `WHERE` filters rows; `GROUP BY` combines rows into groups for counting. A unique constraint rejects repeated identities at the database boundary.

Use the [SQL worksheet](practice/tenant-summary.sql). Its `VALUES` expression creates a tiny dataset within one query and does not alter Relay tables. Read the three rows and predict the answer before running the query in a local PostgreSQL client. Replace its placeholder query to count rejected rows for organisation `acme` only. Expected count: **1**, even though the whole dataset has **2** rejected rows. Extend the query to return each of Acme's outcomes and their counts.

In `db/001_init.sql`, locate the contacts unique constraint and one tenant foreign key. Explain why the same email can occur in two organisations. Sketch what happens if two requests both check for an email before either inserts. Which constraint prevents the race? Keep mutation experiments in a temporary practice table and roll them back.

**Exit:** correct tenant-filtered query, explanation of a missing-filter bug, and one constraint-failure example. **Transfer:** add an organisation with zero rejected rows and state whether the report should include a zero or omit it. Make that requirement explicit before writing SQL.

## F6: read and test a little C#

Prerequisite: F1/F2. Introduce C# now by comparing a familiar function, rather than learning a second language and the worker lifecycle together. Read only `ContactRules.Normalize` and `MissingRequiredFieldsProduceSeparateErrors` in `worker.tests/RulesTests.cs`.

Have a tutor explain `Dictionary<string,string>`, `List<string>`, the tuple return, `[Fact]`, and `Assert.Equal` using that small test. Predict one empty-name case and one boundary-length case. Add a focused test for a currently untested boundary; first prove it fails against a deliberate temporary wrong expectation, restore the correct expectation, and run the named test. Record that this checks your test wiring, not that you found a product bug.

Windows bundled-SDK example from the repo root:

```powershell
$env:DOTNET_CLI_HOME = Join-Path (Get-Location) '.cache/dotnet'
$env:NUGET_PACKAGES = Join-Path (Get-Location) '.cache/nuget'
.tools/dotnet/dotnet.exe test worker.tests/Relay.Worker.Tests.csproj --filter FullyQualifiedName~RulesTests
```

**Exit:** explain the test's arrange/action/assert parts and why an absent key differs from a blank value in the input. **Transfer:** predict a second boundary before testing it. Follow the project path in the filesystem if the test project is renamed.

## F7: React state and a small interface

Prerequisite: F4, plus F1/F2. A component renders UI from props and state. Props come from its parent; state belongs to that component; an event handler changes state. Read only `Destination` in `src/components/learning.tsx`: trace the version dropdown into `fieldsFor(version)` and the table.

Predict which rows change when the version changes and verify in the browser. Make a small local change to this component: add an accessible “Show required fields only” checkbox that filters the displayed schema rows. Keep the chosen schema version when toggling. Derive filtered rows during rendering instead of keeping a second copy of them in state. Use the installed Next client-component documentation and existing labelled-input examples.

**Exit:** demonstrate both schema versions with the checkbox on and off, keyboard operation, and an explanation of props versus state. Record the diff and revert it if it is only an experiment. **Transfer:** support a text filter too; explain what should happen when both filters are active. Request a review before adopting a learning experiment into the shared app.

## Foundations gate

Show one independently written function and test, one debug trace, one reviewed diff, one request trace, one tenant-scoped query, one C# test, and one controlled React interaction. Explain a changed input for each. Missing evidence means practise that part again; it does not require restarting everything.

Next: [guided changes](ROADMAP.md). Keep the worker, SQL, and UI source open only as needed for the current task.

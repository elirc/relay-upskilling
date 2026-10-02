# Verification gap — what ran when this course was written, and Lab 0

Every claim in [CODE-TOUR.md](CODE-TOUR.md) and [EXERCISES.md](EXERCISES.md)
is anchored to a file, a line, or a named test. This page records which of
those tests actually executed in the environment where the course was
written, which did not, and why — verbatim. Treat anything in the "not run"
column as *read, not re-verified*: the code and the test source were
inspected, but the execution evidence is the repository's own
[evidence files](../evidence/verification.md), produced on the original
machine, not reproduced here.

## Environment used for this write-up

- Windows 11, Node **v22.16.0** (README asks for Node 24+), npm 10.9.2
- .NET SDK **10.0.302** on PATH (the README's project-local `.tools/dotnet`
  is gitignored and absent from a fresh clone; a system-wide .NET 10 SDK
  stood in for it)
- PostgreSQL: **not running, not started** (deliberate constraint for this
  session — no Docker, no databases)

## What ran, with real results

**`npm ci`** — completed against Node 22.16 without an engines block, exit
code 0, `added 103 packages, and audited 104 packages in 33m` (a slow network
during the run; `package.json` declares no `engines` field, so no
`--ignore-engines` workaround was needed — the README's Node 24+ is a
statement of what the project was built and verified with, not an installed
gate).

**`npm test`** (the only DB-free JS suite; `tests/contracts.test.ts`) — green
on Node 22.16, with one warning worth recording:

```
# (node:27856) ExperimentalWarning: Type Stripping is an experimental feature
# tests 2
# pass 2
# fail 0
```

Node 22 runs `--experimental-strip-types` as experimental; Node 24 runs type
stripping as a stable default. Same tests, different support status.

**`dotnet test worker.tests/Relay.Worker.Tests.csproj`** — green:

```
Passed!  - Failed:     0, Passed:    17, Skipped:     0, Total:    17, Duration: 4 s - Relay.Worker.Tests.dll (net10.0)
```

**Exercise 1.1's worked run** — the formula-guard break produced exactly one
predicted unit-test failure and a clean revert; full transcript in
[worked-examples/break-the-formula-guard.md](worked-examples/break-the-formula-guard.md).

## What did not run, and why

Everything that needs PostgreSQL (and, for some, the web app, connector and
built worker running together):

- `npm run db:migrate`, `npm run seed`
- `npm run test:e2e` — including the 100,000-row exit-73 crash rehearsal that
  CODE-TOUR step 5 cites
- `npm run test:advanced` — including the exit-74 rollback, the 429 throttle
  and the exit-75 lose-response rehearsals that CODE-TOUR step 6 cites
- `npm run test:browser`, `npm run test:ai`, `npm run test:restore`,
  `npm run build`

No PostgreSQL 18 server was available and starting one was out of scope for
this session. Consequence for the reader: every e2e-anchored claim in the
code tour is sourced from the test *code* plus the repository's recorded
evidence (`../evidence/verification.md`, `../evidence/advanced.json`), not
from a fresh run. Nothing in these documents quotes output from a run that
did not happen.

## Lab 0 — your first exercise is the environment

Before Tier 1, make the gap above disappear on your machine. This is not
busywork; the course's method is "let a real test tell you," which requires
the tests to be runnable.

Setup (README "Run locally" is the authority):

1. Node 24+ (removes the type-stripping experimental status).
2. .NET 10 SDK — system-wide or the project-local `.tools/` convention.
3. PostgreSQL 18 — `npm run db:local` uses the embedded-postgres dev
   dependency if you prefer not to install a server.
4. `npm ci`, copy `.env.example` → `.env`, `npm run db:migrate`,
   `npm run seed`, `dotnet build worker/Relay.Worker.csproj`.
5. Services up (`npm run worker`, `npm run connector`, `npm run ai`,
   `npm run dev`), then the suites **sequentially**, with no manually started
   worker left running (the acceptance suites spawn their own workers).

**Done when:** every command in the README's "Verify and learn" block passes
locally — `npm run typecheck`, `npm test`, `dotnet test`, `npm run test:e2e`
(once more with `RELAY_LARGE_TEST=true`), `npm run test:advanced`,
`npm run test:ai`, `npm run test:browser`, `npm run test:restore`,
`npm run build`, `npm run check:knowledge` — and you have your own
`test-results/e2e.json` showing `97,600 imported + 1,600 rejected + 800
duplicates = 100,000`, matching the repository's recorded evidence. Keep your
run's JSON; later exercises compare against it.

# First session: make a name usable

**Outcome:** write and explain one small TypeScript function. **Time:** 30–45 minutes, split if needed. **Tools:** editor, terminal, Node 24+ already used by this repository. No npm installation, server, C#, or database is needed.

## Find your starting point — 5 minutes

Without asking an assistant for the answers, try these. “I don't know yet” is a valid baseline.

1. Predict the result of `'  Ada  '.trim()` and explain what a function returns.
2. Write a function that counts the strings equal to `'rejected'` in an array.
3. Explain how you would investigate a test that expected `2` but got `4`.
4. Explain what an HTTP response and a SQL `WHERE` clause each do.

If 1 or 2 is difficult, start below and continue foundations F1/F2. If you can code but cannot debug, prioritise F2. If 1–3 are comfortable, attempt the first two checks independently and proceed to F3. If all four are comfortable, demonstrate the foundations exit tasks before moving to guided Relay changes. These prompts select a starting point; they are not a hiring assessment.

## Read and predict — 5 minutes

Open [worked-example.ts](practice/worked-example.ts). A function receives an input and returns an output. `: string` describes a TypeScript string; `trim()` returns a new string with whitespace removed from its ends. The input variable still refers to its original value.

Write the three printed values you expect, then run from the Relay root:

```powershell
node upskilling/practice/worked-example.ts
```

Compare character by character. The printed quotes help you see spaces. Explain why internal spaces stay.

## Write your version — 15 minutes

Edit **only** [name.ts](practice/name.ts). Implement `cleanName(value: unknown): string | null` using this contract:

- If the input is not a string, return `null`.
- Remove whitespace from both ends of a string.
- If the remaining string is empty, return `null`.
- Keep letter case and spaces inside a nonempty name unchanged.
- Return the cleaned string; do not print from the function.

`unknown` means the caller could supply any type. `typeof value === 'string'` checks its type before you call a string method. `string | null` means the function can return either a string or the explicit “no usable name” value.

Predict these before checking: `' Ada '`, `'   '`, `null`, `42`, and `'Mary  Jane'`.

```powershell
node upskilling/practice/check.mjs name
```

The starter intentionally fails with “Your implementation goes here.” That is the task, not a broken Relay installation. Read the first failure; make one change; rerun. Do not change the supplied expectations to make them pass.

Write one additional case in [your-tests.ts](practice/your-tests.ts), then run:

```powershell
node --test upskilling/practice/your-tests.ts
```

Use a name with a tab at an edge, or a non-string input not already tested. Explain what defect your extra test could catch.

## Explain and close — 5–10 minutes

Copy [the short session template](templates/session.md) to `upskilling/submissions/first-session.md`. Save your prediction, first failure, final output, your extra test, help used, and a plain-language explanation of every line you wrote. Leave your original prediction intact.

Close the solution. Explain why `0`, `''`, and `'0'` have different types or meanings here. At your next session, change the requirement: non-string input should produce a clear error instead of `null`. Predict which tests must change before touching the code.

You can move on when the checks pass **and** you can explain a fresh case without copying the solution. If you get stuck for 10 minutes, send your code, exact failure, expected result, and one thing you tried. Ask for the first hint.

<details><summary>Hint ladder — open only when you need it</summary>

1. Can you safely call a string method on `null`?
2. Return early for the wrong type. Store the trimmed string in a new variable.
3. Compare that variable's length with zero; choose `null` or the variable as the result.
4. A reference implementation is in `practice/reference.ts`. Reading it is assisted practice. Afterwards close it and solve the changed requirement yourself.

</details>

Next: [F2 debugging](FOUNDATIONS.md#f2-debug-a-count), then the rest of foundations. Do not start the 100k import yet.

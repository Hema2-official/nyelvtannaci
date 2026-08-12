# Tests

```bash
npm test
```

runs everything. That means real requests to helyesiras.mta.hu and real model calls, so a
full run takes a couple of minutes and spends tokens. It needs a working `.env` — the e2e
suite resolves the provider the same way the app does, and fails loudly without a key.

To run one suite, pass its path: `npx vitest run tests/unit`. `npm run bench` is shorthand
for `vitest run tests/e2e`.

## tests/unit — what holds without a network

Input validation for all three tools (every scraper puts the model's argument straight into a
URL, so the guard has to hold before any request goes out), the tool definitions the model
selects on, and the JSON-schema normalisation in `toolSchema.ts` — strict mode closes every
object and lists every key, non-strict drops `additionalProperties` entirely. That last one is
the thing most likely to break when you point the app at a different gateway.

## tests/live — the scrapers, against the real site

Nothing of MTA's is stored in this repo, so this is the only place the parsers meet actual
markup: solutions and their rules, competing readings, absolute reference links, the notice
banner, tips and the `L. még:` → `Lásd még:` rewrite, the refusal message, and the summary
semantics the UI depends on (a suggestion is reported without a verdict; competing readings
get numbered).

It paces itself and leans on the scraper's retry interceptor, because the site answers 500 to
bursts of requests. An occasional flake is the site, not the code — rerun before investigating.

## tests/e2e — the flow, and the benchmark

Each case in `cases.ts` is an input, the corrected text it should produce, and a note saying
why that is the right answer. A run is a full session: the model calls the MTA tools as many
times as it wants, then returns the split result, which is joined back up and compared.

`inPrompt: true` marks the cases whose input already appears in the prompt's own Examples
section. Those measure instruction-following; the `inPrompt: false` ones measure whether the
model can actually do the job. The summary line reports the two separately — a config that
aces the first group and fails the second has memorised the prompt, not learned the task.

### Benchmarking a configuration

The suite reads the same env vars the app does, so a benchmark is the same command against a
different configuration:

```bash
npm run bench
```

PowerShell, overriding the model for one run:

```bash
$env:LLM_MODEL='gpt-5.1'; npm run bench
```

A single case, by name (pass the filter to `vitest` directly — `npm run bench -- -t ...` does
not forward it on Windows):

```bash
npx vitest run tests/e2e -t "kissebb"
```

`npx vitest list tests/e2e` prints the names as the filter sees them. Vitest truncates a long
interpolated title, and matches on the truncated text, which is why case names are kept short.

Run it against a second model now and then, even one you do not intend to use. The prompt
gets tuned against whatever is configured, and a different model walks straight into wording
that the configured one happens to read correctly — "measure the exact form you are going to
write" is circular when the hyphen is the question, and gpt-5.6-luna duly measured the
already-hyphenated form. Two such ambiguities came out of one cross-model run, both of them
bugs in the prompt rather than in the model.

One case, `paragraph, four errors`, fails perhaps one run in five by design; its note carries
the measured rates. Check which error was dropped before assuming a regression.

Useful knobs: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_REASONING_EFFORT`, `LLM_STRUCTURED_OUTPUTS`,
`SESSION_MAX_TURNS`, and `BENCH_REPEATS=3` to run every case N times when you care about
variance rather than a single sample.

Each run writes `bench-results/<provider>_<model>_<effort>_<timestamp>.json` (gitignored)
containing every run's timing, tool-call count, the queries the model sent, and what it
produced — plus a `promptSha`, so a result can be tied to the prompt version it was measured
against. Change the prompt, and the hash tells you the older numbers are not comparable.

Failures print the expected and actual text side by side. A red run is the honest outcome for
a weak configuration: the pass count _is_ the score.

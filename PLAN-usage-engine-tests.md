# PLAN: Lock the usage/cost/5h-block engine with tests

## Rank: 1 of 5 — DO THIS FIRST

**Why #1:** The "Claude Island" usage panel shows real dollar figures, burn rate,
5-hour block consumption and a sparkline. All of it flows through
`custo_estimado`, `extrair_usage`, `serie_de_usage`, `blocos_5h` and `usage()`.
Today **none of these have a single test** (`test/server.test.js` only covers
list/sort/search/scan; `test/parsers.test.js` covers redaction + one Codex meta
case). The math is subtle (cumulative-vs-delta tokens, cached-token
normalization, cache_write×1.25, UTC-hour block rounding, null-not-zero). A future
edit can silently show wrong money with no failing test. This is pure test work:
zero production risk, high safety payoff, unblocks fearless refactor. Low/med effort.

## Goal

Add deterministic unit tests that pin the semantics of the cost/usage engine, and
make the two currently-unexported pure functions testable with a one-line export
each. No behavior change to production paths.

## Exact files to touch

1. `agent-command-center/src/server.js` — add `blocos_5h` to the `export { … }`
   line (currently only `comando_ui, carregar_settings` are exported). One-line change.
2. `agent-command-center/test/usage-engine.test.js` — **new file**. All the tests.
3. (Do NOT touch `parsers.js` or `scanner.js` production code. `custo_estimado`
   is already exported from `scanner.js`; `serie_de_usage` is already exported
   from `parsers.js`; `extrair_usage` is exercised indirectly via `analisar_jsonl`.)

## What each function does (so you test the right thing)

- `custo_estimado(sessao, rates)` (scanner.js:10) → USD number, or `null` if
  `sessao.usage`/`sessao.model` missing or the model prefix has no rate. Formula:
  `(input*r.input + output*r.output + cache_read*r.cache_read + cache_write*r.input*1.25) / 1_000_000`.
  Model match is by **prefix** (`model.startsWith(key)`).
- `extrair_usage(registros)` (parsers.js:154, internal) → summed usage for Claude
  (`message.usage` across all assistant msgs, fields are disjoint so they add);
  for Codex reads the **last** `token_count.info.total_token_usage` (cumulative)
  and **subtracts** `cached_input_tokens` from `input_tokens` so cache isn't
  double-charged. Exposed on `analisar_jsonl(...).usage` and `.tokens`.
- `serie_de_usage(registros)` (parsers.js:183, exported) → per-message time series,
  **Claude only** (needs `message.usage` + per-message `timestamp`).
- `blocos_5h(serie)` (server.js:158, needs export) → groups a series into 5h blocks:
  block start = the entry's ms floored to the **whole UTC hour**; a new block opens
  when `t >= atual.fim` (start + 5h). Entries with unparseable `ts` are dropped.

## Step-by-step implementation order

1. **Export `blocos_5h`.** In `agent-command-center/src/server.js`, change the last
   line from `export { comando_ui, carregar_settings };` to
   `export { comando_ui, carregar_settings, blocos_5h };`. Nothing else in server.js
   changes. (Importing server.js runs module top-level code — `carregar_settings()`
   and `abrir_banco(...)` — but does NOT call `server.listen` in a way that blocks
   tests here; `server.test.js` already spawns the server as a subprocess, so this
   test file must NOT import server.js at top level for the HTTP-y bits. See edge
   case #1: importing server.js opens the real DB. Mitigate by setting
   `process.env.ACC_DATA` to a temp dir BEFORE the import.)
2. **Create `test/usage-engine.test.js`.** Use `node:test` + `node:assert/strict`
   (match the existing test style — ESM, no framework).
3. **Set an isolated data dir before importing server.js** so the `blocos_5h`
   import doesn't touch the user's real SQLite/settings:
   ```js
   import { mkdtempSync } from 'node:fs';
   import { tmpdir } from 'node:os';
   import { join } from 'node:path';
   process.env.ACC_DATA = mkdtempSync(join(tmpdir(), 'acc-usage-'));
   const { blocos_5h } = await import('../src/server.js');
   import { custo_estimado } from '../src/scanner.js';
   import { serie_de_usage, analisar_jsonl } from '../src/parsers.js';
   ```
   (Use a dynamic `await import` for server.js so the env var is set first.)
4. **Write the `custo_estimado` tests** (table below).
5. **Write the `extrair_usage` tests via `analisar_jsonl`** (feed a tiny Claude
   JSONL and a tiny Codex JSONL; assert `.usage`).
6. **Write the `serie_de_usage` tests.**
7. **Write the `blocos_5h` tests.**
8. Run `npm test` and `npm run check` from `agent-command-center/`.

## Concrete test cases (exact expected values)

### custo_estimado
`const rates = { 'claude-opus-4': { input: 15, output: 75, cache_read: 1.5 } };`
| usage | model | expected |
|-------|-------|----------|
| `{input:1_000_000,output:0,cache_read:0,cache_write:0}` | `claude-opus-4-8` | `15` |
| `{input:0,output:1_000_000,cache_read:0,cache_write:0}` | `claude-opus-4-8` | `75` |
| `{input:0,output:0,cache_read:1_000_000,cache_write:0}` | `claude-opus-4-8` | `1.5` |
| `{input:0,output:0,cache_read:0,cache_write:1_000_000}` | `claude-opus-4-8` | `18.75` (input 15 × 1.25) |
| any | `gpt-5-foo` (no rate in `rates`) | `null` |
| usage present | model `undefined` | `null` |
| model present | usage `undefined` | `null` |

Assert the sum case too: `{input:1e6,output:1e6,cache_read:1e6,cache_write:1e6}`
on `claude-opus-4-8` → `15+75+1.5+18.75 = 110.25`.

### extrair_usage (via analisar_jsonl(...).usage)
- **Claude fixture** — two assistant lines each with
  `message.usage:{input_tokens:10,output_tokens:5,cache_read_input_tokens:2,cache_creation_input_tokens:1}`.
  Expect `.usage` = `{input:20,output:10,cache_read:4,cache_write:2,total:36}`.
- **Codex fixture** — a line `{"type":"session_meta",...}` (forces source=codex)
  plus a `{"payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":100,"cached_input_tokens":30,"output_tokens":20,"total_tokens":120}}}}`.
  Expect `.usage.input === 70` (100−30), `.usage.cache_read === 30`,
  `.usage.output === 20`, `.usage.total === 120`.
- Build fixtures with `String.fromCharCode(10)` joins; pass through
  `analisar_jsonl(content, 'x.jsonl', {birthtime:new Date('2026-01-01'), mtime:new Date('2026-01-02')}, 'claude'|'codex')`.

### serie_de_usage
- Input `[{timestamp:'2026-01-01T00:00:00Z', message:{usage:{input_tokens:1},model:'claude-opus-4-8'}}]`
  → array length 1 with `{ts:'2026-01-01T00:00:00Z', input:1, output:0, cache_read:0, cache_write:0, model:'claude-opus-4-8'}`.
- A record with `message.usage` but **no `timestamp`** → excluded (length 0).
- A record with no `message.usage` → excluded.

### blocos_5h
- Two entries 1h apart in the same UTC hour window → **one** block; `inicio` =
  first entry floored to the whole hour; `fim` = `inicio + 5*3600_000`.
  e.g. `[{ts:'2026-01-01T02:30:00Z'},{ts:'2026-01-01T03:15:00Z'}]` → 1 block,
  `inicio === Date.parse('2026-01-01T02:00:00Z')`, `fim === inicio + 18_000_000`.
- Entries > 5h apart → **two** blocks. `[{ts:'2026-01-01T02:30:00Z'},{ts:'2026-01-01T08:30:00Z'}]`
  → 2 blocks (second is ≥ first.fim = 07:00Z).
- Entry with `ts:'not-a-date'` is dropped (does not create a block).
- Empty series → `[]`.

## Edge cases a weaker model would miss

1. **Importing `server.js` has side effects.** Its module top-level runs
   `carregar_settings()` (writes `settings.json`) and `abrir_banco()` (opens the
   real SQLite). You MUST set `process.env.ACC_DATA` to a fresh temp dir *before*
   the `await import('../src/server.js')`, or the test pollutes the user's real DB
   and may fail on Windows if the file is locked by a running dev server. Use
   `await import`, not a static top `import`, so ordering is guaranteed.
2. **`blocos_5h` floors to the whole UTC hour, not the entry time.** Don't assert
   `inicio === Date.parse(entry.ts)`; assert it equals the entry time floored to
   `:00:00Z`. Compute expected with `Math.floor(Date.parse(ts)/3600_000)*3600_000`.
3. **Codex `input_tokens` already includes cached.** The test must prove the
   subtraction (`input === 70`, not `100`). If you assert `100` you've validated the bug.
4. **Never assert on `usage()`/the sparkline/`block.remaining_s` directly** — they
   depend on `Date.now()` and a rolling 6h/2h window, so they're inherently flaky.
   Test the pure pieces (`blocos_5h`, `custo_estimado`, `serie_de_usage`,
   `extrair_usage`) instead. That separation IS the point of this plan.
5. **`custo_estimado` returns `null`, not `0`, for unknown models** — assert
   `=== null` (strict). A `0` would silently pollute the dashboard `HAVING` clause.
6. **Floating point:** `18.75` and `110.25` are exact in IEEE-754, so
   `assert.equal` is fine here; if you add a case that isn't exact, use a tolerance.

## Acceptance criteria (verify)

- `cd agent-command-center && npm test` → all suites pass, and the run shows the
  new `usage-engine` test with **at least 12 assertions** across the 4 functions.
- `npm run check` → exits 0 (no syntax break from the export change).
- Temporarily break the engine to prove the tests bite, then revert:
  - change `custo_estimado`'s `* 1.25` to `* 1` → the cache_write case fails.
  - change `blocos_5h` `Math.floor(t / 3600_000)` to `Math.floor(t / 60_000)` →
    the block-start case fails.
- No production file changed except the single `export { … blocos_5h }` line in
  `server.js`. `git diff --stat` shows only `server.js` (1 line) + the new test file.

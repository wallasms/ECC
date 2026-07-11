# PLAN: Harden secret redaction (close credential-leak gaps) + test corpus

## Rank: 5 of 5

**Why #5 (and why it still matters):** `redigir` (parsers.js:6) is the ONLY thing
standing between a secret in a session `.jsonl` and (a) the persisted SQLite index,
(b) the session detail UI, and (c) the "Ao Vivo" live wall / SSE stream
(`normalizar_evento` → `tail_sessao`). It currently catches
`api_key/token/secret/password/authorization` assignments and a few key prefixes
(`sk`, `ghp`, `github_pat`, `xox*`). It **misses** common high-value credentials
that appear verbatim in real dev sessions. This is a security boundary for a tool
that persists and re-displays real agent transcripts; a leak here writes a live key
into the local DB and streams it to the browser. Med effort, security leverage.

## Goal

Expand `redigir` to cover the credential classes it currently misses, add a
redaction **test corpus** so regressions are caught, and ensure redaction runs on
every path that surfaces session text (it already funnels through `redigir`, but
verify the live-wall path). No false-positive explosion — keep it precise.

## Exact files to touch

1. `agent-command-center/src/parsers.js` — extend the `SEGREDO`/`CHAVE` regexes
   (lines 3–4) and `redigir` (line 6).
2. `agent-command-center/test/parsers.test.js` — add a redaction corpus test.
3. (Verify only, likely no change) `src/server.js` `tail_sessao` → confirms it
   builds lines via `normalizar_evento`, which calls `redigir`. If any live path
   emits raw text without `redigir`, fix it.

## Current patterns (parsers.js:3–4)

```js
const SEGREDO = /((?:api[_-]?key|token|secret|password|authorization)["'\s:=]+)([^\s,"'}]+)/gi;
const CHAVE = /\b(?:sk|ghp|github_pat|xox[baprs])[-_A-Za-z0-9]{12,}\b/g;
```

## Gaps to close (add these classes)

Add to `CHAVE` (standalone tokens, matched anywhere):
- **AWS access key id:** `\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[A-Z0-9]{16}\b`
- **Google API key:** `\bAIza[0-9A-Za-z_\-]{35}\b`
- **Slack (broaden):** already `xox[baprs]`; also `xapp-` app tokens: `\bxapp-\d-[A-Za-z0-9-]{10,}\b`
- **Stripe:** `\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b` (note: overlaps the
  bare `sk` rule but is more specific; keep both — Set-dedup the output isn't needed
  since `.replace` is idempotent).
- **Google OAuth client secret / GOCSPX:** `\bGOCSPX-[A-Za-z0-9_\-]{20,}\b`
- **JWT:** `\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b`
- **Generic long hex/secret after `bearer`:** extend `SEGREDO` alternation with
  `bearer` and `client[_-]?secret`, `aws_secret_access_key`, `private[_-]?key`.

Add a **PEM private-key block** collapse (multi-line) — this needs its own replace,
because it spans lines:
```js
const PEM = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g;
```
and in `redigir`: `.replace(PEM, '[REDACTED PRIVATE KEY]')`.

### Updated `redigir`
```js
export function redigir(valor = '') {
  return String(valor)
    .replace(PEM, '[REDACTED PRIVATE KEY]')
    .replace(SEGREDO, '$1[REDACTED]')
    .replace(CHAVE, '[REDACTED]');
}
```
Order matters: run `PEM` first (multi-line, before whitespace-sensitive rules).

## Step-by-step implementation order

1. Extend `SEGREDO` alternation to include `bearer`, `client[_-]?secret`,
   `aws_secret_access_key`, `private[_-]?key`. Keep the existing capture-group 1 so
   the `$1[REDACTED]` substitution still preserves the label.
2. Extend `CHAVE` with the AWS/Google/Stripe/Slack-app/GOCSPX/JWT alternatives as
   additional `(?:…|…)` branches. Keep the `\b…\b` anchors and the `{n,}` lengths so
   you don't nuke ordinary words.
3. Add the `PEM` regex and wire it as the first `.replace` in `redigir`.
4. Add the corpus test (below).
5. `npm test`, `npm run check`.
6. Verify the live path: read `tail_sessao` (server.js:97) and confirm each emitted
   line's `summary` comes from `normalizar_evento` (which calls `redigir`). It does
   today (server.js:124). If you find any endpoint that returns raw `.jsonl` text
   without `redigir`, that's a bug — fix it in the same PR.

## Redaction corpus test (test/parsers.test.js)

Add one `node:test` case that asserts each secret is gone and each benign string
survives. Use realistic-shaped fakes (never a real key):
```js
const LEAKS = [
  'AKIAIOSFODNN7EXAMPLE',
  'AIzaSyD-1234567890abcdefghijklmnopqrstuv',           // 39 chars total
  'xapp-1-A012-345678901234-abcdef',
  'sk_live_51H1234567890abcdefghij',
  'GOCSPX-abcdefghijklmnopqrstuvwx',
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dozjgNryP4J3jVmNHl0w5N',
  'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  'Authorization: Bearer abcdef1234567890abcdef',
  '-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END RSA PRIVATE KEY-----',
];
for (const s of LEAKS) assert.doesNotMatch(redigir(s), /AKIA|AIzaSy|xapp-1|sk_live|GOCSPX|eyJhbGci|wJalrXU|Bearer abcdef|BEGIN RSA/);
// benign must survive untouched:
const KEEP = ['skateboard', 'tokenizer.js', 'the password field', 'src/secret-santa.ts'];
for (const s of KEEP) assert.equal(redigir(s), s);
```
Adjust the "benign survives" list to whatever your final regexes imply, but you MUST
keep at least: a word starting with `sk` that isn't a key (`skateboard`), a filename
containing `token`/`secret`, and prose containing the word `password` *without* an
assignment. See edge case #2.

## Edge cases a weaker model would miss

1. **The existing `SEGREDO` only redacts the VALUE after a label+separator**
   (`token: xxx`), preserving the label via `$1`. Keep that structure when you add
   `bearer`/`client_secret` — don't collapse the label, or diffs/titles lose
   context. Test that `token: xxx` → `token: [REDACTED]`, not `[REDACTED]`.
2. **False positives are a real cost.** `skateboard`, `tokenizer`, a file named
   `secret-santa.ts`, or the prose "enter your password" must NOT be redacted. The
   bare `sk`/`ghp` rule already requires `{12,}` of key-charset after the prefix and
   word boundaries — preserve those guards. The `password` label rule only fires
   with a separator (`["'\s:=]+`) then a token, so prose "your password field"
   (space then a word) *would* match `password field`… verify and, if it over-redacts
   common prose, tighten the separator to require `[:=]` or quotes for the
   password/secret labels. Add a KEEP test for "your password is important" and
   decide the behavior explicitly.
3. **PEM spans newlines** — `normalizar_evento` preserves `\n`, so the multi-line
   PEM regex works on the joined text, but note `redigir` is sometimes called on a
   single already-split line. In `analisar_texto`/`normalizar_evento` the whole
   block passes through `redigir` before line-limiting, so PEM sees the full block.
   Confirm the call order: `extrair_conteudo` → `redigir(...)` (parsers.js:105) runs
   on the full extracted string, so multi-line PEM is intact there. Good. Do not move
   `redigir` to after a `split('\n')`.
4. **JWT is three base64url segments** joined by dots; the middle can be short.
   Anchor with `\beyJ` (all JWTs start with `{"` base64 = `eyJ`) so you don't match
   arbitrary dotted tokens. Test that a normal `a.b.c` filename/version doesn't match.
5. **Regex catastrophic backtracking:** the PEM `[\s\S]*?` is lazy and bounded by
   the END marker — fine. Avoid nested quantifiers on untrusted input. Keep each
   `CHAVE` branch linear (character classes with `{n,}`), no `(x+)+`.
6. **Redaction must stay idempotent** — running it twice yields the same string.
   The `.replace` chain is idempotent because `[REDACTED]` contains none of the
   trigger patterns. Add one assertion: `redigir(redigir(x)) === redigir(x)`.
7. **Do not redact file paths in the `files` list** — that's produced by
   `arquivos_de_tools` which deliberately skips `redigir` (a path could contain
   `sk...`). This plan only touches text summaries/titles, not the files list. Leave
   `arquivos_de_tools` alone.

## Acceptance criteria (verify)

- `cd agent-command-center && npm test` → the new redaction corpus test passes:
  every entry in `LEAKS` is redacted, every entry in `KEEP` is untouched, and
  `redigir(redigir(x)) === redigir(x)`.
- `npm run check` exits 0.
- Manual: craft a throwaway `.jsonl` under a scanned session path containing a fake
  `AKIA…`/JWT/PEM in an assistant message, `POST /api/scan {"full":true}`, open the
  session detail and the Ao Vivo wall → the secret shows as `[REDACTED]` in both the
  stored summary and the live stream, never in raw form.
- `git grep -n "redigir" src/` shows every session-text surface (title, snippet,
  event summary, tail line) still routes through it.

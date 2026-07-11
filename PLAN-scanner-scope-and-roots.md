# PLAN: Fix scanner skill-scope bug + wire the dead `project_roots` config

## Rank: 2 of 5

(Supersedes/refreshes the older `PLAN-scanner-correctness-fixes.md` with exact
current line references. If that file still exists, delete it at the end.)

**Why #2:** Two concrete correctness defects in `src/scanner.js` that produce
wrong or missing data users can see:
- Every skill's **scope label** (`user` vs `project`) is computed by a broken
  boolean with an operator-precedence trap, so labels are frequently wrong.
- `settings.project_roots` is advertised config (`default_settings.project_roots`,
  server.js:29) but **no scanner ever reads it**. Projects that have no indexed
  session never appear on the Projects page, even though the user configured a
  root to watch. Dead config that silently does nothing.

## Goal

1. Make skill scope deterministic and correct (project-local skills → `project`,
   global/home skills → `user`), independent of the server's `process.cwd()`.
2. Make `project_roots` real: scan each configured root for immediate child repos
   and upsert them as projects (with `agents_md`/`claude_md` flags) even when they
   have zero sessions.

## Exact files to touch

1. `agent-command-center/src/scanner.js` — fix scope (line 107); add
   `escanear_project_roots(db, settings)` and call it inside `executar_scan`
   (line 152, inside the existing transaction).
2. `agent-command-center/test/scanner.test.js` — add tests for both fixes.
3. `agent-command-center/README.md` (optional) — one line noting `project_roots`
   is now scanned.

## Bug 1 — skill scope precedence (scanner.js:107)

Current:
```js
const escopo = arquivo.includes('.codex') || arquivo.includes('.claude') && !arquivo.includes(process.cwd()) ? 'user' : 'project';
```
`&&` binds tighter than `||`, so this parses as
`.codex  ||  (.claude && !cwd)`. Consequences:
- Any path containing `.codex` → `user`, even a project-local `.codex/skills/...`.
- A `.claude` skill is `user` only if its path doesn't contain the **server's**
  cwd — but the server runs from `agent-command-center/`, so `process.cwd()` has
  nothing to do with where the user's projects live. The check is meaningless.

### Fix
Scope by whether the skill lives under the user's **home** dir (global) vs
somewhere else (project). Home-rooted skill dirs = `user`; anything else =
`project`. Import `homedir` and normalize both paths.
```js
import { homedir } from 'node:os';
// …inside escanear_skills, per file:
const home = resolve(homedir());
const escopo = resolve(arquivo).startsWith(home + sep) &&
  (arquivo.includes(`${sep}.claude${sep}`) || arquivo.includes(`${sep}.codex${sep}`) || arquivo.includes(`${sep}.agents${sep}`))
  ? 'user' : 'project';
```
Import `sep` from `node:path`. Rationale: the three global skill roots in
`default_settings.skill_paths` all live under `~/.claude`, `~/.codex`, `~/.agents`.
A skill found under the user's home in one of those dot-dirs is global (`user`);
a skill found under a project checkout (e.g. `…/Projetos/foo/.claude/skills`) is
NOT under home's dot-dirs at the top level... — see edge case #2, which is why the
check is "under home AND in a dot-dir", not just "in a dot-dir".

## Bug 2 — dead `project_roots`

`default_settings.project_roots` exists but the only place projects are created is
`projeto(db, caminho)` (scanner.js:37), called from `salvar_sessao` with a
session's `project_path`. No session → no project row.

### Fix — add `escanear_project_roots`
Insert after `escanear_subagents` (around scanner.js:144):
```js
function escanear_project_roots(db, settings) {
  for (const raiz of settings.project_roots || []) {
    if (!existsSync(raiz)) continue;
    let entradas = [];
    try { entradas = readdirSync(raiz, { withFileTypes: true }); } catch { continue; }
    for (const entrada of entradas) {
      if (!entrada.isDirectory()) continue;
      if (['node_modules', '.git', 'cache', 'tmp'].includes(entrada.name)) continue;
      projeto(db, join(raiz, entrada.name)); // upsert; reuses agents_md/claude_md detection
    }
  }
}
```
Then call it inside `executar_scan`'s try block (scanner.js:152), right after
`escanear_subagents(db, settings);`:
```js
escanear_skills(db, settings); escanear_hooks(db, settings); escanear_subagents(db, settings); escanear_project_roots(db, settings);
```
`projeto()` already does an upsert keyed on `path`, sets `name`, and detects
`AGENTS.md`/`CLAUDE.md`, so a root-scanned project and a session-scanned project
converge on the same row. No schema change.

## Step-by-step implementation order

1. Add `homedir` import from `node:os` and `sep` to the existing `node:path`
   import at the top of `scanner.js`.
2. Replace the `escopo` line (107) with the home+dot-dir version above.
3. Add the `escanear_project_roots` function after `escanear_subagents`.
4. Add the call in `executar_scan` (line 152).
5. Add tests (below).
6. `npm test`, `npm run check`.
7. If `../PLAN-scanner-correctness-fixes.md` exists, delete it (this supersedes it).

## Tests to add (test/scanner.test.js)

The existing test uses `arquivos_em`. Add two `node:test` cases:

1. **project_roots scan** — build a temp dir with two child folders, one
   containing an empty `AGENTS.md`. `abrir_banco(':memory:')`, call
   `executar_scan(db, { session_paths:{codex:[],claude:[]}, skill_paths:{codex:[],claude:[],shared:[]}, agent_paths:[], hook_paths:[], project_roots:[tempRoot] })`.
   Assert `SELECT COUNT(*) FROM projects` ≥ 2 and that the one with `AGENTS.md`
   has `agents_md = 1`, the other `agents_md = 0`.
2. **skill scope** — you cannot easily fake `homedir()`, so test the *helper logic*
   by extracting the scope decision into a tiny exported pure function
   `escopo_skill(arquivo, home)` and unit-test it:
   - `escopo_skill('/home/u/.claude/skills/x/SKILL.md', '/home/u')` → `'user'`.
   - `escopo_skill('/home/u/Projetos/foo/.claude/skills/x/SKILL.md', '/home/u')`
     → `'project'` (a project checkout under home but NOT a top-level home dot-dir —
     see edge case #2 to get this right; if your implementation can't distinguish,
     document the chosen behavior and assert it).
   - `escopo_skill('/work/repo/.codex/skills/y/SKILL.md', '/home/u')` → `'project'`.
   Export `escopo_skill` from scanner.js and use it inside `escanear_skills`.

## Edge cases a weaker model would miss

1. **Operator precedence is the whole bug.** Do not "fix" it by adding parens
   around `.claude && !cwd` — that keeps the meaningless `process.cwd()` check.
   Replace the logic entirely (home-based), don't reparenthesize it.
2. **A project checkout can live under `$HOME`** (e.g.
   `C:\Users\walla\Desktop\Projetos\foo\.claude\skills`). "Path is under home"
   alone would wrongly mark those `user`. That's why the rule is "under home
   **and** the path segment is a top-level home dot-dir" — i.e. `~/.claude/…`,
   `~/.codex/…`, `~/.agents/…` specifically. Match the dot-dir with **path
   separators around it** (`${sep}.claude${sep}`) so `.claudexyz` doesn't match,
   and prefer checking it appears immediately under home if you can. Pick a rule,
   encode it in `escopo_skill`, and TEST the checkout-under-home case explicitly.
3. **Use `resolve()` + `sep` for cross-platform.** On Windows `homedir()` is
   `C:\Users\walla` with backslashes; `arquivo` from `arquivos_em` is already
   `resolve()`d with backslashes. Compare resolved paths, and build the dot-dir
   needle with `sep`, never a hardcoded `/`.
4. **`readdirSync` on a root can throw** (permissions, missing) — wrap in
   try/catch and `continue`, exactly like `arquivos_em` does. Don't let one
   unreadable root abort the whole scan (it runs inside the `executar_scan`
   transaction; an unhandled throw rolls back the entire scan).
5. **Don't recurse into project roots.** Only scan **immediate** children
   (`readdirSync`, not `arquivos_em`). Recursing would create a project row for
   every nested folder. One level = repos.
6. **`projeto()` normalizes with `resolve()`** and upserts on `path`; a root child
   and a session's `project_path` for the same repo produce the same normalized
   path → same row. Verify no duplicate rows appear for a repo that has both a
   session and a root entry.

## Acceptance criteria (verify)

- `cd agent-command-center && npm test` → all pass, including the two new scanner
  tests.
- `npm run check` → exits 0.
- Manual: set `project_roots` in `data/settings.json` to a folder containing a
  repo with no indexed sessions, `POST /api/scan {"full":true}`, then
  `GET /api/projects` → the repo appears with correct `agents_md`/`claude_md`.
- Manual: a project-local skill (under a repo checkout) shows scope `project` in
  `GET /api/skills`; a `~/.claude/skills/...` skill shows `user`.
- `escopo_skill` is exported and has ≥3 passing assertions covering user, project,
  and checkout-under-home.

# PLAN: Wire the command-bar / palette filters that are silently dropped

## Rank: 3 of 5

(Refreshes the older `PLAN-projects-filter-fix.md` with the current app.js/server.js
line references and the palette path included. Delete that file at the end if present.)

**Why #3:** `comando_ui` (server.js:267) and the ⌘K palette promise navigations
that carry a filter — but three of them land on pages that ignore the filter, so
the feature is a visible dead-end:
- "projetos sem AGENTS.md" → `{page:'projects', filters:{missing_agents:true}}`
  → Projects page renders **all** projects; the filter is dropped.
- "skill sobre X" → `{page:'skills', query:'x'}` → Skills page shows everything.
- "hook perigoso" → `{page:'hooks', template:'block-dangerous-bash'}` → no effect.

`runCommand` (app.js:862) does `goto(r.page, r.filters||{})` and only `filters.q`
survives because the sessions page is the only one that reads `filters`. The other
pages (`cardPage`, `skills`, `hooks`) never look at the hash filters.

## Goal

Make the three non-session command targets actually filter their destination page,
using the data those pages already fetch (client-side filtering — no new API work).
Specifically:
1. Projects: honor `filters.missing_agents` → show only projects with `agents_md == 0`.
2. Skills: honor `filters.q` (rename `query`→`q` in `comando_ui`) → filter skill
   cards by name/description substring.
3. Hooks: honor `filters.q`/`filters.template` → filter hook cards.

## Exact files to touch

1. `agent-command-center/src/server.js` — `comando_ui` (lines 267–276): normalize
   the three branches to emit `filters.q` (not `query`) and `filters.missing_agents`
   / `filters.template` consistently so the frontend has one contract.
2. `agent-command-center/public/app.js`:
   - `cardPage(endpoint, title, subtitle, cardFn)` (the generic list renderer used
     by projects/skills/hooks — around app.js:739 call sites) → accept an optional
     `filterFn(item, filters)` and apply it before mapping to cards.
   - the projects/skills/hooks render calls (app.js ~739) → pass a `filterFn`.
   - a small visible "filtro ativo · limpar" chip when a filter is applied, so the
     user knows the list is narrowed (and can clear it → `goto(page,{})`).
3. `agent-command-center/test/server.test.js` — assert `comando_ui` output shape
   for the three commands (pure function, already imported/exported).

## Current behavior to preserve

- Sessions page filtering (`q`, `status`, `source`, `sort`, `dir`, `project`) is
  correct — do not touch it.
- `goto(page, filters)` already serializes `filters` into the location hash and
  `readHash()` parses them back. Reuse that; do NOT add a second state channel.

## Step-by-step implementation order

1. **Normalize `comando_ui`** (server.js:271, 273): change the skills branch to
   `return { action:'navigate', page:'skills', filters:{ q: t.replace(/.*(?:skill|related to|sobre)\s*/, '') } };`
   and the hooks branch to
   `return { action:'navigate', page:'hooks', filters:{ template: /danger|perigos/.test(t) ? 'block-dangerous-bash' : undefined, q: undefined } };`
   Keep the projects branch emitting `filters:{ missing_agents: true }` (already
   correct shape). Now every navigate result uses `filters`, and `runCommand`'s
   existing `f = r.filters || {}` picks them up with no frontend change.
2. **Teach `cardPage` to filter.** Find its definition in app.js (the helper that
   fetches `endpoint`, maps items through the card fn, and renders the empty state).
   Add a 5th param `filterFn`:
   ```js
   async function cardPage(endpoint, title, subtitle, cardFn, filterFn) {
     let items = await api(endpoint);
     if (filterFn) items = items.filter((it) => filterFn(it, filters));
     // …existing render, but if items.length === 0 after filtering, show the
     //   empty state AND the "limpar filtro" chip (see step 4).
   }
   ```
3. **Pass filter predicates at the call sites** (app.js ~739):
   - projects: `cardPage('/api/projects','Projetos','…',projectCard, (p,f)=> f.missing_agents ? !p.agents_md : true)`
   - skills: skills page currently has its own renderer — apply
     `f.q ? (name+desc).toLowerCase().includes(f.q.toLowerCase()) : true`.
   - hooks: `(h,f)=> (!f.q || (h.event+h.matcher+h.description).toLowerCase().includes(f.q.toLowerCase())) && (!f.template || h.source_path.includes(f.template))`.
     Note: `template` maps to a hook template name; match it against the hook's
     `source_path`/`event` — verify the field that actually carries the template id
     for installed hooks and match on that. If no installed hook matches a template
     name, fall back to filtering by `q` only and document it.
4. **Add a "filtro ativo" chip** rendered above the card grid whenever `filters`
   has any key beyond page nav (`missing_agents`, `q`, `template`). Chip text names
   the filter; clicking it calls `goto(page, {})` to clear. This is the signal that
   prevents "the list looks empty/wrong" confusion (see edge case #3).
5. Add `comando_ui` shape assertions to `test/server.test.js`.
6. `npm test`, `npm run check`, and manual verification in the browser.

## Edge cases a weaker model would miss

1. **`goto` drops falsy filter values.** `goto` builds the query string from
   `Object.entries(f).filter(([,v]) => v)`, so `missing_agents:true` survives but
   `missing_agents:false`/`undefined` vanish — good, but it also means a filter
   value of the string `"false"` (from the hash round-trip) is **truthy**. When you
   read `filters.missing_agents` back from the hash it's the **string** `"true"`,
   not boolean `true`. So the predicate must treat presence-of-key as on:
   `f.missing_agents` (string "true") is truthy → fine; but never compare `=== true`.
2. **Hash values are always strings.** After `readHash`, `filters.missing_agents ===
   "true"`, not `true`. Predicates must not use strict boolean comparison. Same for
   any numeric filter.
3. **Empty result after filtering must not look like "no data".** If filtering
   yields zero cards, show the empty state *plus* the "limpar filtro" chip — otherwise
   the user thinks there are no projects at all. This is the difference between a
   good and a confusing fix.
4. **Don't add a server-side `?missing_agents=` param.** `/api/projects` already
   returns `agents_md` per row; filter on the client. Adding a backend param is
   more surface for no benefit at this scale (dozens of projects).
5. **`comando_ui` is exported and unit-tested** — changing `query`→`q` will break
   any existing assertion that checks `.query`. Update those assertions in the same
   commit. Grep `test/` for `comando_ui` and `.query`.
6. **The palette (⌘K) uses the same `goto`/`filters` path** (app.js ~883). Once
   `comando_ui` and `cardPage` are fixed, palette-triggered filters work for free —
   verify one palette action that navigates to projects/skills to confirm, don't
   build a second code path.

## Acceptance criteria (verify)

- Typing "projetos sem AGENTS.md" (or the palette equivalent) navigates to Projects
  and shows **only** projects whose card has the "sem AGENTS.md" pill; a "filtro
  ativo · limpar" chip is visible and clears the filter on click.
- Typing "skill sobre funding" shows only skills matching "funding".
- The hooks command narrows the hooks list (by template or by text) or, if no
  template matches, filters by text and the behavior is documented in the plan/PR.
- `cd agent-command-center && npm test` passes, including the updated `comando_ui`
  shape assertions; `npm run check` exits 0.
- Sessions-page filtering is unchanged (regression check: status/source/q/sort still
  work).
- `git grep -n "query:" src/server.js` shows the skills branch now emits `q`, not `query`.

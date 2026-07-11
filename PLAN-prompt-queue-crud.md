# PLAN: Finish the Prompt Queue — delete, edit, and status transitions

## Rank: 4 of 5

**Why #4:** The Prompt Queue is a visible, half-built feature. `/api/prompts`
supports only `GET` (list) and `POST` (create) (server.js:327–333). `promptCard`
(app.js:596) renders title/body/priority/status/target but has **no controls** —
once a prompt is added it can never be removed, edited, or advanced. The DB table
already has everything needed (`status`, `priority`, `updated_at`, and columns for
`context_pack`, `model`, `effort`, `expected_output`, `checklist` — see
`migrations/001_initial.sql`). This is high user-visible value for modest effort,
and it's purely additive (no risk to scanners/redaction/localhost).

## Goal

Give the queue a real lifecycle:
- **Delete** a prompt.
- **Advance status** through `draft → queued → done` (and back).
- **Edit** title/body/target/priority of an existing prompt.
All local, read-only-of-sessions preserved (this only writes the `prompts` table,
which is user-authored data, never session data).

## Non-goal (explicitly out of scope)

Actually *sending* a prompt to a running Claude/Codex agent. That needs a spawn/IPC
mechanism and breaks the "read-only, no external actions" posture. This plan is
CRUD + status only. If "send" is ever wanted, it's a separate plan with its own
security review. Say so in the PR description.

## Exact files to touch

1. `agent-command-center/src/server.js`:
   - add `PUT /api/prompts/:id` (update fields + status).
   - add `DELETE /api/prompts/:id`.
   - place both **before** the existing `GET /api/prompts/...`-less block; there is
     no `/api/prompts/:id` route yet, so add explicit method+regex checks in `api()`
     next to the current prompts routes (around server.js:327).
2. `agent-command-center/public/app.js`:
   - `promptCard(x)` (app.js:596) → add action buttons (advance/delete/edit).
   - `bind()` (where `#prompt-form` submit is wired, app.js:777) → wire the new
     buttons with event delegation on the queue container.
3. `agent-command-center/test/server.test.js` — add PUT/DELETE contract tests.

## Backend design

### PUT /api/prompts/:id
Whitelist updatable columns; ignore anything else. Bump `updated_at`.
```js
if (req.method === 'PUT' && /^\/api\/prompts\/\d+$/.test(url.pathname)) {
  const id = Number(url.pathname.split('/').at(-1));
  const b = await corpo(req);
  const cols = ['title','body','target','priority','status','project'];
  const sets = cols.filter((c) => c in b);
  if (!sets.length) return json(res, 400, { error: 'Nada para atualizar' });
  const valores = sets.map((c) => b[c]);
  const stmt = `UPDATE prompts SET ${sets.map((c) => `${c}=?`).join(',')}, updated_at=? WHERE id=?`;
  const r = db.prepare(stmt).run(...valores, new Date().toISOString(), id);
  if (!r.changes) return json(res, 404, { error: 'Prompt não encontrado' });
  return json(res, 200, db.prepare('SELECT * FROM prompts WHERE id=?').get(id));
}
```
Constrain `status` to `draft|queued|done` and `priority` to `low|medium|high`
server-side (reject others with 400) — do not trust the client.

### DELETE /api/prompts/:id
```js
if (req.method === 'DELETE' && /^\/api\/prompts\/\d+$/.test(url.pathname)) {
  const id = Number(url.pathname.split('/').at(-1));
  const r = db.prepare('DELETE FROM prompts WHERE id=?').run(id);
  if (!r.changes) return json(res, 404, { error: 'Prompt não encontrado' });
  return json(res, 200, { deleted: id });
}
```

## Frontend design

- `promptCard(x)` gains a footer row of buttons:
  - **Avançar** → PUT status to the next state (`draft→queued→done`); label reflects
    next state; at `done` show **Reabrir** (→ `queued`).
  - **Editar** → swap the card into an inline form (reuse the create form markup)
    that PUTs on submit.
  - **Excluir** → DELETE after a lightweight confirm.
- Give each card `data-id="${x.id}"` and delegate clicks in `bind()`:
  ```js
  $('#queue')?.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('[data-act=del]')) { if (!confirm('Excluir prompt?')) return; await api(`/api/prompts/${id}`, { method:'DELETE' }); render(); }
    if (e.target.closest('[data-act=adv]')) { const next = e.target.dataset.next; await api(`/api/prompts/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: next }) }); render(); }
    // edit: reveal inline form, PUT on submit
  });
  ```
- Wrap the queue in `<div id="queue">…</div>` so the delegated handler has a stable
  root across re-renders.
- Status is already conveyed as a pill; keep color + text (DESIGN.md a11y rule:
  color is never the only signal).

## Step-by-step implementation order

1. Add the PUT and DELETE routes in `api()` (server.js). Put the `\d+`-regex checks
   **above** the generic 404 and near the existing prompts routes.
2. Add server-side validation of `status`/`priority` enums.
3. Wrap the queue container with `id="queue"` in `prompts()` (app.js:600).
4. Extend `promptCard` with the action buttons + `data-id`/`data-act`/`data-next`.
5. Add the delegated click handler in `bind()`.
6. Add the inline-edit path (reuse the create form; on submit PUT then `render()`).
7. Add backend contract tests.
8. `npm test`, `npm run check`, manual browser check.

## Edge cases a weaker model would miss

1. **`node:sqlite` has no `?`-array spread convenience** beyond positional args —
   build the `SET` clause and the positional values array in the **same order**.
   An off-by-one between `sets` and `valores` writes the wrong column. Derive both
   from the same `sets` array (as shown), never two separate literals.
2. **Never build SQL by interpolating column values.** Column *names* come from a
   fixed whitelist (`cols`), values are bound with `?`. Do not `${b.title}` into the
   query — that's SQL injection into the user's own DB.
3. **Validate enums server-side.** The UI advances status, but a crafted PUT could
   set `status:"anything"`. Reject non-enum `status`/`priority` with 400 so the
   `ORDER BY CASE priority …` (server.js:327) never sees an unknown value (it would
   sort it last silently — not fatal, but wrong).
4. **Delegated handler must survive re-render.** `render()` replaces `#app`
   innerHTML, so per-card `onclick` handlers set before a render are lost. Delegate
   on a stable parent (`#queue`) and re-attach in `bind()` (which runs every render),
   OR attach once on `#app`. Do not attach a fresh listener per card per render
   without removing the old ones (leak).
5. **`confirm()` returns false on cancel** — bail before the DELETE. Don't `await`
   the API call unconditionally.
6. **Empty-after-delete.** If the last prompt is deleted, `render()` must show the
   existing empty state (`emptyState('prompts', …)`), not a broken grid. Since you
   call `render()` after mutations, this is automatic — verify it.
7. **`updated_at` drives the list order** (list is `ORDER BY priority, updated_at
   DESC`). Editing bumps `updated_at`, so an edited card jumps to the top of its
   priority band. That's acceptable, but note it so it isn't reported as a bug.
8. **Status `done` items still show** in the queue. Decide: keep them (with a
   muted style + "Reabrir") or hide behind a toggle. Simplest correct choice: keep
   them, muted. Document the choice.

## Acceptance criteria (verify)

- `POST` a prompt, then in the UI: **Avançar** moves `draft→queued→done` and the
  pill updates without a full page reload feeling broken; **Reabrir** returns it to
  `queued`; **Excluir** removes it (with confirm); **Editar** changes title/body and
  persists after reload.
- `curl -X PUT .../api/prompts/1 -d '{"status":"bogus"}'` → 400.
- `curl -X DELETE .../api/prompts/9999` → 404 `{error:…}`.
- `curl -X PUT .../api/prompts/9999 -d '{"title":"x"}'` → 404.
- `cd agent-command-center && npm test` passes with new PUT/DELETE contract tests;
  `npm run check` exits 0.
- Scanners, redaction, localhost binding untouched (`git diff` touches only
  server.js routes + app.js queue UI + tests).

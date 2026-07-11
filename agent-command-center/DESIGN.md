# DESIGN.md — Agent Command Center design contract

The design contract for humans and agents (Claude Code / Codex) working on this
frontend. Read this before touching `public/`. It is the source of truth; the UI
should never drift from it without updating this file first.

## Product personality

A **premium, local-first AI command center** for monitoring and orchestrating
real Claude Code and Codex sessions. It should feel like macOS + Apple
Intelligence + Raycast + Linear + Arc — a calm studio, not an admin panel.

Tone: quiet, confident, spatial. Lots of whitespace, strong alignment, subtle
depth. Numbers before adjectives. Nothing neon, nothing cluttered, nothing
"SaaS dashboard".

## Architecture (do not fight it)

- **No build step.** Vanilla ES modules + one CSS file. `public/index.html`,
  `public/app.js`, `public/styles.css`. Served static by `src/server.js`.
- "Components" are **render helpers** (functions returning HTML strings) in
  `app.js` plus **CSS classes** in `styles.css`. There is no React/TSX. Do not
  introduce a bundler, framework, or dependency for UI work — it breaks the
  local-first, zero-install promise.
- All data comes from `/api/*`. Never invent fields. Missing data →
  `não detectado` / neutral placeholder, never a fake value.

## Visual principles

1. **Light mode is the default and must be beautiful.** Dark mode is a peer,
   not a priority. Both are driven by CSS custom properties on `:root` /
   `[data-theme=dark]`.
2. **Depth via translucency and soft shadow**, not borders alone. Thin borders,
   rounded corners (10–16px), layered surfaces.
3. **Whitespace is a feature.** Generous padding, calm density.
4. **Motion is minimal and purposeful.** Fade/slide-in on mount, lift on hover,
   a single pulse for "live". Everything respects `prefers-reduced-motion`.
5. **Color is never the only signal.** Status = color + label + icon/shape.

## Color palette (tokens in `styles.css :root`)

| Role | Token | Light |
|------|-------|-------|
| Background | `--bg` | soft cool off-white `#f2f1ee` |
| Surface | `--surface` | translucent white |
| Elevated | glass presets | white + blur |
| Border | `--border` / `--border-soft` | rgba gray |
| Primary text | `--fg` | near-black |
| Secondary text | `--muted` / `--muted-2` | cool gray |
| Accent | `--accent` | calm Apple blue `#1769d2` |
| Success | `--st-working` | muted green |
| Warning | `--st-needs` | soft amber |
| Danger | `--st-failed` | muted red |
| Info | `--st-completed` | soft indigo |

Avoid saturated neon. Status colors are muted on purpose.

## Typography

- UI: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
  Inter, "Segoe UI", sans-serif`. Tight tracking on headings (`-0.03em`).
- **Mono is only for terminal / logs / code / paths** (`ui-monospace`). Never
  set body copy in mono.

## Glassmorphism & Liquid Glass rules

Glass is a **progressive enhancement layer**, CSS-first.

- `LiquidGlassSurface` → in this codebase this is the `.glass` class family. It
  is **pure CSS glass** (`backdrop-filter: blur + saturate`, translucent bg,
  hairline top highlight). It works with zero WebGL.
- naughtyduk/liquidGL (WebGL lensing) is an **optional future enhancement**
  only. If ever added, it must (a) mount behind `.glass` surfaces as decoration,
  (b) never be required for readability, (c) be lazy-loaded, (d) be gated by the
  same "Liquid Glass" setting. Do not add it just to add it.
- **Glass on:** top command bar, hero panel, floating command palette, canvas
  cards, inspector panel, selected modal surfaces, agent avatar cards.
- **Glass off (flat/opaque):** terminal text, raw logs, transcript, dense
  tables, long scrolling lists. Readability wins over effect, always.
- Never nest heavy blur inside heavy blur. Never blur behind code text.
- Honor the **Liquid Glass toggle** (Settings → localStorage `acc-glass`) and
  `prefers-reduced-transparency` / `prefers-reduced-motion`: both collapse glass
  to opaque surfaces.

## Accessibility rules

- Text over glass must stay ≥ 4.5:1. If a surface can't guarantee it, make it
  opaque.
- Visible focus rings (`:focus-visible`) on every interactive element.
- Full keyboard nav: cards/rows are `role="button"` + `tabindex="0"` + Enter/Space.
- Reduced motion and reduced transparency fully respected.
- Status conveyed by color **and** text/icon.

## Data-density rules

- Tables and long lists stay flat, opaque, high-contrast — no glass, no lift
  animation per row.
- Cap terminal/log rendering (last N lines); never snapshot huge scroll areas.
- Canvas/studio can be spatial and glassy because it holds few, large cards.

## Terminal / log readability

- Mono font, high contrast, subtle status dot, no blur behind text.
- Show real inferred command/output when session events contain tool/shell
  activity; otherwise show "Nenhuma saída de terminal detectada ainda."
- Never fabricate terminal output. Sample output appears only in explicit
  demo/sample mode and is labeled.
- **Ao Vivo (live wall):** the `GET /api/sessions/:id/tail?from=<offset>`
  endpoint reads only the new bytes appended to the real session `.jsonl` as
  agents write, redacted via the shared `normalizar_evento`. The frontend polls
  ~1.4s, appends lines, auto-scrolls, caps DOM at 400 lines. The offset always
  advances to a line boundary so a half-written trailing line is re-read, never
  duplicated. Read-only: it only reads/streams files, never writes.

## Component usage (render helpers in `app.js`)

`agentAvatar(source, opts)` · `statusPill(status)` · `terminalPreview(session)` ·
`agentCard(session)` · `agentCanvas(sessions)` · `sessionRow(session)` ·
`timelineEvent(event)` · glass surfaces via `.glass` / `.glass-card` /
`.apple-panel` / `.command-bar` / `.term-panel` classes.

Keep helpers small and pure (data → HTML string). Escape all interpolated data
with `esc()`. One helper, one job.

## Feedback & confirmation patterns

- **Native browser dialogs are banned.** No `alert()`, no `confirm()`, no
  `prompt()` — ever. Gate: `grep -F "alert(" public/app.js` → 0.
- **Toast is the only async feedback channel** (`toast(msg, kind)` with kinds
  `info`/`working`/`needs_input`/`failed`). Rules:
  - button-triggered mutation: keep the inline text-in-button progress AND
    toast only on error;
  - palette actions: always toast (success and error) — the palette closes
    before the action runs, so the toast is never behind a backdrop.
- **Destructive confirmation = two-step armed button.** First click arms the
  button for 3s (`.danger-armed`, label "Confirmar exclusão?"), second click
  executes; timeout or `Escape` disarms; a re-render implicitly disarms.
  Markup: the same button, `data-armed` via dataset — no extra dialog, no
  dependency. White-on-`--st-failed` meets AA.

## ARIA contract (dynamic components)

- Toast host: `role="status" aria-live="polite"` (set at creation in `toast()`).
- Sortable headers (`th()`): `aria-sort="ascending|descending|none"` kept in
  sync with `filters.dir`.
- Detail tabs: `role="tablist"` on the container, `role="tab"` +
  `aria-selected` on buttons, `role="tabpanel"` on the pane; ←/→ move and
  activate tabs (handlers scoped to the focused tab — never global).
- Sidebar nav: active item carries `aria-current="page"` (toggled in `render()`).
- Dialogs use `showModal()` (native focus trap + Esc); do not reimplement.

## Spacing-token rule

`--s1..--s7` govern **layout rhythm**: grid gaps between cards/sections,
section margins, `main`/`topbar` paddings. Literal px is deliberate for
hairlines (1px), icon/avatar dimensions, radii, font sizes, and
component-internal spacing (a pill's padding is the component's intrinsic
size, not page rhythm). Never swap a px for a token of a *different* value —
that's a visual change disguised as a refactor. Full map: `docs/AUDIT-frontend.md`.

## What NOT to do

- No neon, no cyberpunk, no heavy gradients, no drop shadows everywhere.
- No glass on dense tables, logs, or long lists.
- No fake/placeholder data presented as real.
- No new build tooling, framework, or npm dependency for the frontend.
- No animation without a reduced-motion fallback.
- Do not weaken redaction, localhost binding, or read-only scanning for the
  sake of a visual.

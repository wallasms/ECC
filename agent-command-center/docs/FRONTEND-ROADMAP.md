# Frontend improvement plan — Agent Command Center

Roadmap for evolving the command-center frontend. Ordered by value/effort.
Everything here respects the hard constraints: **no build step**, vanilla ES
modules + one CSS file, read-only scanners, localhost-only, redaction intact,
`/api/*` contracts stable. See `DESIGN.md` for the design contract.

Status legend: ✅ done · 🔜 next · 🔭 later.

## Shipped this cycle ✅

- Apple-style shell: frosted sidebar, glass command bar, ⌘K palette, light
  default + dark, design tokens, motion with reduced-motion fallback.
- Components: `agentAvatar`, `statusPill`, `terminalPreview`, `agentCard`,
  `agentCanvas`, `sessionRow`, tabbed session detail, `skill/hook/project`
  cards, Design System page, `DESIGN.md`.
- **Ao Vivo** live terminal wall — tails real session `.jsonl` via
  `GET /api/sessions/:id/tail?from=<offset>` (byte-delta, redacted, read-only).
- Readable event extractor (no more JSON blobs; base64/encrypted never leak).
- Syntax-colored diffs (Claude Edit/Write, Codex apply_patch) in timeline +
  live wall.
- Live wall polish: jump-to-new chip, freshness readout, pause when hidden,
  live status recompute, grep filter across panels.
- Session detail: files grouped by directory (click-to-copy), tools categorized.
- ⌘K palette: runnable actions (scan/theme/glass), quick status filters, and
  fuzzy session jump.
- Per-page loading skeletons; friendly error state with retry.

## 🔜 Next (high value, low/med effort)

1. **Virtualize the sessions table.** At 300+ rows it's fine; past ~1k, window
   the rows (simple manual windowing, no library) to keep scroll smooth. *Med.*
2. **Keyboard-first nav.** `j/k` to move the session list, `Enter` to open,
   `g d`/`g l`/`g s` chords for pages (Linear-style). *Med.*
3. **Notifications.** When a watched session flips to `needs_input`/`failed`,
   surface a toast (opt-in Notification API). *Small.*
4. **Diff viewer polish.** Side-by-side (old/new) toggle for Edit events,
   collapsible hunks, word-level intra-line highlighting. *Med.*
5. **Hooks empty-state action** → "abrir docs/hooks.md"; per-page empties with a
   primary action. *Small.*

## 🔭 Later (bigger or needs backend)

8. **True streaming via SSE.** Replace the 1.4s poll with a single
   `GET /api/sessions/:id/stream` (Server-Sent Events) using `fs.watch` +
   incremental read. Lower latency and CPU; needs connection lifecycle handling
   and a heartbeat. Poll stays as the fallback. *Med backend.*
9. **Capture real stdout/stderr.** Today terminal output is reconstructed from
   the event index. A scanner enhancement to capture Bash/shell `tool_result`
   and Codex `*_output` as first-class stdout/stderr would make the terminal
   literal. Purely additive to the parser. *Med.*
10. **Cost estimation.** `cost` is always null. Derive it from `tokens` × a
    per-model rate table (config in settings) so the Custo card and per-project
    consumption light up. Show it as "estimado". *Med, backend + UI.*
11. **Diff viewer polish.** Side-by-side (old/new) toggle for Edit events,
    collapsible hunks, and word-level intra-line highlighting. Builds on the
    current line-level coloring. *Med, frontend.*
12. **Agent Canvas connectors.** Draw soft links between a parent session and
    its subagents when the relationship is inferable (Codex `sub_agent_activity`
    events carry `agent_path`). Structured, not a full node editor. *Med.*
13. **Command palette actions.** Beyond navigation: run scan, toggle glass/theme,
    jump to a specific session by title (fuzzy), quick-filter by status. *Small.*
14. **Notifications.** When a watched session flips to `needs_input` or `failed`,
    surface a toast (and optionally the Notification API, opt-in). *Small.*
15. **Keyboard-first nav.** `j/k` to move the session list, `Enter` to open,
    `g d`/`g l`/`g s` chords for pages (Linear-style). *Med.*
16. **Perf hardening.** Memoize card/timeline render by session id+updated_at,
    cap live DOM per panel (done at 500), lazy-mount off-screen canvas clusters
    via `IntersectionObserver`. *Med.*

## Guardrails for whoever picks this up

- Don't add a bundler/framework/npm dep for the frontend. Render helpers + CSS.
- Never fabricate data; missing → neutral placeholder, labeled if inferred.
- Keep glass off dense tables/logs; readability wins.
- Every animation needs a `prefers-reduced-motion` fallback.
- Re-run `npm test` and `npm run check` before committing.

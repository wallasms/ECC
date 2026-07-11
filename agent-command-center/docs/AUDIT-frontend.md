# AUDIT-frontend — inventário do passe "nível profissional" (2026-07-10)

Auditoria F0 do PLAN-frontend-professional.md. Cada achado nomeia função/seletor
(nunca número de linha). Status marcado após a execução F2–F4 do mesmo ciclo.

## 1. Diálogos nativos do browser

| Onde (função) | O quê | Correção | Status |
|---|---|---|---|
| `bind()` → helper `escanear`, catch | `alert(err.message)` | `toast(err.message,'failed')` | ✅ corrigido |
| `detail()`, catch | `alert(e.message)` | `toast(e.message,'failed')` | ✅ corrigido |
| `paletteScan`, sucesso E erro | `alert(...)` ×2 | `toast(...,'info'/'failed')` | ✅ corrigido |
| handler `#queue` ação `del` | `confirm('Excluir este prompt?')` | two-step armado no botão (3s, Escape desarma) | ✅ corrigido |

Gate: `grep -F "alert(" public/app.js` e `grep -F "confirm(" public/app.js` → 0.

## 2. Gaps de ARIA

| Componente | Gap | Correção | Status |
|---|---|---|---|
| host `#toasts` (criado em `toast()`) | sem live region | `role="status" aria-live="polite"` | ✅ |
| `th()` → `.sortable` | sem `aria-sort` | `aria-sort` sincronizado com `filters.dir` | ✅ |
| tabs de `detail()` | sem roles nem teclado | `tablist/tab/tabpanel` + setas ←/→ (escopadas ao foco no tab; sem colisão com j/k global — modal suprime nav global) | ✅ |
| nav lateral (toggle em `render()`) | sem `aria-current` | `aria-current="page"` no ativo | ✅ |
| dialogs (`#detail`, palette) | — | `showModal()` já dá focus-trap nativo; sem ação | n/a |

## 3. Mapa px→token (espaçamento)

**Regra adotada (spec F1, DESIGN.md):** tokens `--s*` governam **ritmo de layout**
(gaps de grid entre cards/seções, margins de seção, paddings de `main`/`topbar`).
**Exceções documentadas** — permanecem em px literal, de propósito:

- `1px` hairlines (bordas) — nunca tokenizar;
- dimensões de ícone/avatar/dot (`width/height`), `border-radius`, `font-size`;
- espaçamento **interno de componente** (gap de um flex-row dentro de pill/card/row,
  paddings de controles): tamanho intrínseco do componente, não ritmo da página;
- valores sem token equivalente exato (ex.: `gap:14px` em `.cards`, `margin:22px` em
  `.toolbar`): trocar mudaria pixels, violando o gate F4 "zero diferença visual".

Convertidos (match exato, ritmo de layout): `.stats{gap}`, `.canvas{gap}`,
`.cluster-body{gap}` → `var(--s3)`/`var(--s4)`. Demais ocorrências caem nas exceções acima.

## 4. Walkthrough teclado-apenas

Verificado no preview (2026-07-10): `g`-chords navegam páginas; `j/k`+`Enter` na lista
(inclusive janelada); `/` foca comando; `⌘K` abre palette (setas+Enter); tabs do detalhe
agora respondem a ←/→; `Esc` fecha dialog/palette e desarma botão de exclusão armado.
Foco retorna ao documento após fechar modal (comportamento nativo de `<dialog>`).

## 5. Já em nível (não tocar)

Copy 100% pt-BR; zero inline styles (o `style="--stat-accent:…"` é CSS-var, padrão
legítimo); skeletons por página; erro com retry; empty-states com ação primária;
contraste AA auditado no ciclo anterior; reduced-motion/transparency respeitados.

## 6. Teto conhecido (aceito, decisão F1)

Topbar bleed: em viewport >1580px a borda inferior da topbar termina no limite de
`main{max-width:1500px}`, 40px antes do fim do painel. Ultrawide é cauda; corrigir
exigiria pseudo-elemento full-width ou mover a topbar para fora do wrapper. Aceito
e documentado — reavaliar se houver reclamação real.

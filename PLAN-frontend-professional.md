# PLAN: Front-end a nível profissional (Agent Command Center)

## Escopo proibido (confirmar antes de executar)

Herdado de `agent-command-center/DESIGN.md` e `CLAUDE.md` — vale para TODAS as fases:

- **NÃO** adicionar framework, bundler ou dependência npm de frontend (vanilla ES + 1 CSS).
- **NÃO** tocar em `src/` exceto se um gate exigir (nenhuma fase abaixo exige) — contratos `/api/*` estáveis.
- **NÃO** enfraquecer redaction, bind localhost ou scanners read-only.
- **NÃO** aplicar glass em tabelas densas/logs/transcript; toda animação com fallback `prefers-reduced-motion`.
- Copy da UI permanece **pt-BR**; dado ausente → `não detectado`/placeholder neutro, nunca valor fabricado.

## Diagnóstico (evidência colhida no recon, 2026-07-10)

O que hoje impede a leitura "profissional" — cada item verificado por grep no working tree:

1. **Diálogos nativos do browser** — o tell nº 1. `alert()` em 4 pontos e `confirm()` em 1,
   **com sistema de toast próprio já existente e ignorado**:
   - `bind()` → helper `escanear`: `alert(err.message)` no catch;
   - `detail()`: `alert(e.message)` no catch;
   - `paletteScan`: `alert()` no **sucesso** e no erro;
   - handler delegado de `#queue` (ação `del`): `confirm('Excluir este prompt?')`.
2. **A11y de componentes dinâmicos incompleta**:
   - host de toasts (`#toasts`) sem `aria-live`/`role="status"` — leitor de tela não anuncia;
   - `th` ordenáveis (`.sortable`) sem `aria-sort`;
   - tabs do dialog de detalhe sem `role="tablist"/"tab"/"tabpanel"` nem navegação por setas;
   - nav lateral ativa sem `aria-current="page"`.
3. **Escala de espaçamento adotada pela metade**: tokens `--s1..--s7` existem, mas
   `styles.css` tem ~50 ocorrências de `12px`, ~40 de `14px` etc. em paddings/margins/gaps
   (1px hairline e tamanhos de ícone são legítimos e ficam).
4. **Topbar bleed** para em `max-width:1500px` — em viewport >1580px a borda inferior da
   topbar morre 40px antes do fim do painel (cosmético, ultrawide).
5. Já em nível (não tocar): copy 100% pt-BR, zero inline styles (o `style="--stat-accent:…"`
   é CSS-var, padrão legítimo), `showModal()` já dá focus-trap nativo aos dialogs,
   roadmap "Next" 100% shipped, 25 testes verdes.

## Ferramentas disponíveis

- Subagents: `Explore` (recon barato), `Plan`, `general-purpose`. Sem agente custom de UI no repo.
- Skill `time-feature` cobre features de UI neste repo (agentview listado), mas este plano é
  passe de qualidade transversal, não feature — pipeline de fases abaixo é o veículo.
- Skill `find-skills` não existe neste repo (verificado); templates `ui-polish-apple` em
  `agent-command-center/templates/` servem só como referência de tom, nunca instalar.
- Convenção do usuário: **Opus executa, Fable revisa** (advisor read-only antes de mudança
  estrutural + review final).

## Fases

### F0 — Auditoria sistemática (inventário, não opinião)

| Quem | Modelo/Effort |
|---|---|
| `Explore` subagent | Sonnet, medium |

**Objetivo**: transformar "não está profissional" em checklist verificável.
**Arquivos**: leitura de `public/app.js`, `public/styles.css`, `public/index.html` (nenhuma escrita além do relatório).
**Entregável**: `agent-command-center/docs/AUDIT-frontend.md` com:

1. Tabela de todos os `alert(`/`confirm(` com função container (grep -nF).
2. Gaps de aria por componente: toast host, `.sortable`, tabs do detalhe, nav, `details` de arquivos.
3. Mapa px→token: toda ocorrência de `8|12|16|24|32|48px` em padding/margin/gap de `styles.css`
   com a substituição `var(--sN)` proposta; marcar explicitamente as EXCEÇÕES (1px hairline,
   width/height de ícone/avatar, border-radius) que NÃO devem virar token.
4. Walkthrough teclado-apenas (Tab/Enter/Esc/j/k/g-chords) página a página, anotando onde o
   foco se perde ou não retorna ao invocador após fechar dialog/palette.
5. Matriz de screenshots: {dashboard, sessions, detalhe aberto, prompts vazio, hooks} × {light, dark}.

**Gate F0**: relatório existe, cada achado tem função/seletor nomeado (proibido número de linha).

### F1 — Spec do sistema de feedback + a11y (decisão de design)

| Quem | Modelo/Effort |
|---|---|
| Fable (advisor, read-only) | high |

**Objetivo**: especificar, antes de codar, os dois padrões novos:

1. **Feedback unificado**: toast é o único canal de erro/sucesso assíncrono
   (`toast(msg, 'failed'|'info'|'working')` já existe). Definir: quando toast vs feedback
   inline no botão (regra proposta: mutação disparada por botão mantém o texto-no-botão
   existente E ganha toast só no erro; ações de palette → sempre toast).
2. **Confirmação destrutiva sem `confirm()`**: padrão two-step no próprio botão
   ("Excluir" → vira "Confirmar exclusão?" por 3s com classe `.danger-armed`, segundo clique
   executa, timeout desarma). Zero dialog novo, zero dependência — decisão: popover glass foi
   considerado e rejeitado (mais código, mesmo valor).
3. **A11y spec**: `#toasts` ganha `role="status" aria-live="polite"`; `.sortable` ganha
   `aria-sort="ascending|descending|none"` sincronizado com `filters.dir`; tabs do detalhe
   ganham `role="tablist"/"tab"/"tabpanel"` + setas ←/→ movem a aba ativa; nav ativa ganha
   `aria-current="page"`.
4. **Topbar bleed**: decidir entre aceitar (documentar como teto) ou mover a borda para
   pseudo-elemento full-width. Recomendação Fable: aceitar e documentar — ultrawide é cauda.

**Entregável**: seção nova em `DESIGN.md` ("Feedback & confirmation patterns" + "ARIA contract").
**Gate F1**: DESIGN.md atualizado; padrões têm exemplo de markup exato copiável.

### F2 — Implementação Wave A: matar diálogos nativos

| Quem | Modelo/Effort |
|---|---|
| Opus (executor) | medium |

**Arquivos**: `public/app.js` apenas.
**Ordem**:
1. `escanear` (em `bind()`): catch → `toast(err.message, 'failed')`.
2. `detail()`: catch → `toast(e.message, 'failed')`.
3. `paletteScan`: sucesso → `toast(\`${r.indexados} indexadas · ${r.erros} erros\`, 'info')`;
   erro → `toast(e.message, 'failed')`. Remover ambos `alert`.
4. Handler `del` do `#queue`: implementar two-step armado conforme spec F1
   (estado no próprio botão via dataset + setTimeout 3s; Escape desarma).
**Edge cases** (um modelo fraco erra aqui):
   - o botão do two-step é re-renderizado pelo `render()` do auto-refresh de 30s — o estado
     armado NÃO pode sobreviver a re-render (aceitável: desarma; documentar no código);
   - `paletteScan` fecha a palette antes do toast, senão o toast fica atrás do `::backdrop`.
**Gate F2**: `grep -F "alert(" public/app.js` → 0 hits; `grep -F "confirm(" public/app.js` → 0 hits;
`node --check`; preview_eval exercitando: erro de scan (stub fetch 500), delete two-step
(1º clique arma, 2º executa, timeout desarma), paletteScan feliz.

### F3 — Implementação Wave B: contrato ARIA

| Quem | Modelo/Effort |
|---|---|
| Sonnet (mecânico, spec aprovada) | medium |

**Arquivos**: `public/app.js` (host de toast, `th()`, tabs de `detail()`, render da nav),
`public/styles.css` (nenhuma mudança visual esperada — só atributos).
**Ordem**: toast host → aria-sort em `th()` → tablist/tab/tabpanel + setas no detalhe →
`aria-current` na nav.
**Edge cases**: `aria-sort` vive no `span.sortable` dentro de `.row.head` (não há `<th>` real);
setas nas tabs não podem colidir com j/k global — só ativas quando foco está dentro do tablist.
**Gate F3**: preview_eval lendo os atributos pós-render (`[aria-sort]`, `[role=tablist]`,
`#toasts[aria-live]`, `.nav[aria-current]`); walkthrough teclado do F0 re-executado sem regressão.

### F4 — Implementação Wave C: sweep px→token

| Quem | Modelo/Effort |
|---|---|
| Sonnet (mecânico, guiado pelo mapa do F0) | low |

**Arquivos**: `public/styles.css` apenas.
**Regra**: substituir SOMENTE o que o mapa F0 aprovou (padding/margin/gap semânticos ≥8px);
manter literal: 1px hairlines, ícones/avatares, radii, font-sizes.
**Edge case**: `calc()` com token dentro de media query >900px — conferir que a topbar
mantém o bleed correto no breakpoint.
**Gate F4**: screenshots da matriz F0 antes/depois SEM diferença visual perceptível
(mudança é de manutenibilidade, não de pixel); `npm test` verde.

### F5 — Review adversarial final

| Quem | Modelo/Effort |
|---|---|
| Fable (advisor, read-only) | high |

**Objetivo**: caçar regressão e "quase-profissional" remanescente.
**Checklist**: matriz de screenshots light+dark; contraste dos estados novos
(`.danger-armed` precisa passar AA sobre `--surface`); console limpo em todas as páginas;
teclado-apenas de ponta a ponta; reduced-motion; `npm test` + `npm run check`.
**Saída**: findings com severidade; Opus aplica blockers/nits e commita
(`feat(acc): professional-grade feedback, ARIA contract and token sweep`).

## Critérios de aceite globais (verificáveis)

1. `grep -FE "alert\(|confirm\(" public/app.js` → **0 ocorrências**.
2. Toasts anunciados por leitor de tela (`#toasts[role=status][aria-live=polite]` presente pós-boot).
3. Ordenação, tabs e nav com atributos ARIA corretos, lidos via preview_eval.
4. Jornada completa por teclado sem mouse: navegar páginas (g-chords), abrir sessão (j/k+Enter),
   trocar aba do detalhe (setas), fechar (Esc, foco retorna), excluir prompt (two-step), sem armadilha de foco.
5. `styles.css` sem px mágico em padding/margin/gap fora das exceções documentadas no F0.
6. `npm test` 25/25 e `npm run check` verdes; zero erros de console nas 9 páginas × 2 temas.

## Ordem de execução e paradas

F0 → F1 são baratas e destravam tudo; executar já. Parada obrigatória pós-F1 (spec é decisão
de design — usuário pode vetar o two-step). F2 é o maior salto perceptível de profissionalismo;
se o tempo acabar aí, já valeu. F3–F4 são mecânicas e paralelizáveis após F1. F5 fecha.

**NÃO executar este plano sem ordem explícita.**

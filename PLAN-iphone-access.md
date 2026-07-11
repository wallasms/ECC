# PLAN: Acessar o Agent Command Center no iPhone

## Escopo proibido (confirmar antes de executar)

- **NÃO enfraquecer o bind localhost por default** — guardrail explícito do
  `agent-command-center/CLAUDE.md`. Qualquer exposição de rede é opt-in.
- **NÃO tocar** redaction (`redigir`), scanners read-only, nem contratos `/api/*`.
- **NÃO adicionar dependências** (guardrail do roadmap: sem libs).

## Contexto (recon desta sessão)

- `src/server.js`: `const HOST = '127.0.0.1'` hardcoded; `server.listen(PORT, HOST)`.
  `/api/health` reporta o host. O dashboard expõe caminhos de arquivos locais e
  conteúdo de sessões (prompts, código) — dado sensível: exposição exige autenticação.
- `public/index.html`: `<meta name="viewport">` já existe. ✔
- `public/styles.css`: breakpoints em 1100px e 900px (sidebar 72px, tabela reduz a
  3 colunas). **Não há faixa < 520px** — num iPhone (~390px) a sidebar de 72px come
  ~20% da tela, touch targets são pequenos (`.live-btn` 26×22px), e a parede Ao Vivo
  usa grid multi-coluna.
- SSE/EventSource, `<details>`, `color-mix`: todos suportados no iOS Safari 16+. ✔

## Decisão central (Fase 0): como chegar no servidor

| Opção | Código | Segurança | Veredito |
|---|---|---|---|
| **A. Tailscale Serve** | **zero** | rede privada WireGuard, HTTPS automático, bind continua 127.0.0.1 | **Recomendada** |
| B. Opt-in `ACC_HOST` + token Bearer | ~30 linhas | senha própria, HTTP puro na LAN | fallback se não quiser instalar Tailscale |
| C. Port-forward / bind 0.0.0.0 sem auth | 1 linha | ❌ expõe sessões inteiras na LAN | **vetada** (viola guardrail) |

**Opção A (recomendada)**: instalar Tailscale no PC e no iPhone (mesma conta),
depois `tailscale serve --bg 4310`. O server **não muda uma linha** — o daemon
faz proxy reverso do tailnet para 127.0.0.1:4310 com HTTPS. Acesso no iPhone:
`https://<hostname>.<tailnet>.ts.net`. Funciona fora de casa também (4G).

**Opção B (só se A for rejeitada)**: em `server.js`,
`const HOST = process.env.ACC_HOST || '127.0.0.1'` + middleware no topo do
`createServer`: se `HOST !== '127.0.0.1'`, exigir `Authorization: Bearer <ACC_TOKEN>`
(comparação com `timingSafeEqual`) em TODA rota, e recusar iniciar se `ACC_HOST`
setado sem `ACC_TOKEN`. Cookie de sessão após um form de login simples para o
browser do iPhone. ~30 linhas + teste. SSE nota: `EventSource` não envia headers
custom — o token teria de ir em cookie ou query (`?token=`), mais um motivo para
preferir a Opção A.

## Fases

### Fase 0 — Decisão de acesso (usuário + advisor)
- **Quem**: discussão com o usuário; se houver dúvida de arquitetura, Fable
  (advisor read-only, effort high).
- **Gate**: usuário escolhe A ou B. Default A.
- Se A: nada a codar no server. Documentar o comando no README do
  `agent-command-center/` (seção "Acesso remoto") e encerrar a fase.

### Fase 1 — CSS mobile (< 520px)
- **Quem**: Sonnet, effort medium (mecânico; segue spec abaixo).
- **Arquivo**: `public/styles.css` (só a nova media query + ajustes).
- Spec:
  - `@media(max-width:520px)`: sidebar vira **bottom tab bar** fixa (ícones da
    `.nav`, `position:fixed;bottom:0`, `padding-bottom:env(safe-area-inset-bottom)`);
    `body` vira coluna única (`grid-template-columns:1fr`), `main` ganha
    `padding-bottom` para não ficar sob a tab bar.
  - `.live-wall` e `.stats`: 1 coluna. `.term-body`/`.live-body`: `max-height`
    proporcional (`40dvh`).
  - Touch targets ≥ 44px: `.live-btn`, `.nav`, botões da tab bar (só na faixa mobile).
  - `.toolbar`: empilhar (`flex-wrap`), `.search` com `width:100%` e
    `font-size:16px` (evita zoom automático do iOS ao focar input).
  - Tabela de sessões: já reduz a 3 colunas em 900px — manter; conferir que a
    `.vrows .row` mantém altura fixa (pré-requisito da virtualização) com
    `overflow:hidden` quando o título quebrar.
  - Modal `#detail`: `max-width:100vw;max-height:100dvh` na faixa mobile
    (usar `dvh`, não `vh` — barra do Safari).
- **Edge cases**: `env(safe-area-inset-*)` exige `viewport-fit=cover` no meta
  viewport (1 linha no `index.html`); grid do diff side-by-side é apertado em
  390px — na faixa mobile, forçar unified (esconder o botão `[data-diff-toggle]`
  via CSS, zero JS).
- **Gate**: `npm run check` + preview_resize 375×812 sem overflow horizontal em
  Dashboard, Sessões, Ao Vivo e detalhe.

### Fase 2 — Ajustes JS mínimos (só o que CSS não cobre)
- **Quem**: Sonnet, effort medium.
- **Arquivo**: `public/app.js`.
- Spec (curta de propósito — quase tudo já funciona):
  - `hover`-dependências: nenhuma ação é hover-only (conferir e não mexer).
  - Virtualização usa `window.scrollY` — funciona no Safari iOS; conferir só que
    o rAF-throttle não trava com momentum scroll (teste manual; se travar,
    adicionar `touchmove` ao listener — 1 linha).
  - j/k e ⌘K são teclado-only: irrelevantes no touch, não remover.
- **Gate**: navegação por toque completa no preview mobile (abrir sessão, trocar
  aba, pausar painel ao vivo).

### Fase 3 — Review adversarial + verificação real
- **Quem**: Fable ou Opus, effort high (review); usuário no iPhone (verificação).
- Review: nenhuma rota nova sem auth? bind default intacto? (`git diff` de
  `server.js` deve ser vazio na Opção A); CSS não vazou para desktop
  (conferir 1280px no preview).
- Verificação no aparelho: abrir a URL do Tailscale no Safari do iPhone —
  Dashboard, Ao Vivo (SSE conecta? caret pisca?), detalhe de sessão, scroll da
  tabela virtualizada com momentum.
- **Gate final**: `npm test` + `npm run check` verdes; checklist acima ok.

## Riscos

- **Opção B escolhida**: auth caseira é superfície de erro (timing, SSE sem
  header, token em query aparece em logs). Mitigação: preferir A; se B, review
  da Fase 3 vira obrigatório com foco em auth.
- **iOS Safari e SSE em background**: Safari derruba EventSource quando a aba
  vai para background — o retry automático + `Last-Event-ID` já cobrem (design
  atual é idempotente por offset). Nada a fazer.
- **PWA (ícone na home screen)**: fora de escopo; se quiser depois, é só um
  `manifest.json` + `apple-mobile-web-app-capable` (fase futura, 30 min).

## Estimativa

| Fase | Esforço |
|---|---|
| 0 (Tailscale) | 15 min de setup manual, zero código |
| 1 (CSS) | ~60–80 linhas de CSS + 1 linha no HTML |
| 2 (JS) | 0–5 linhas |
| 3 (review+device) | 20 min |

# PLAN: "Claude Island" web — monitor de consumo/bloco 5h no Agent Command Center

Referência: https://github.com/anshaneja5/claude-island (inspiração de features/UX).

## Decisão de viabilidade (Fase 0 — já resolvida pelo contexto)

O claude-island original é **Swift/iOS + bridge macOS**: launchd roda `ccusage` a
cada 5 min, publica JSON num gist privado, e um app iOS (ActivityKit) lê o gist e
renderiza na Dynamic Island. **Port literal é inviável aqui**:

1. Você está no Windows — sem Mac, sem Xcode, sem launchd.
2. ActivityKit/Dynamic Island é API nativa fechada — web app não renderiza lá.

**Equivalente web dentro do ACC é superior no seu setup**: o iPhone já acessa o
app via Tailscale (`https://legionwallas.tail1a92c9.ts.net`) — toda a gambiarra
gist+ETag do original existe só porque o iPhone não alcançava o Mac; aqui esse
problema já está resolvido. E o parser do ACC já extrai usage por sessão dos
mesmos `.jsonl` que o ccusage lê. Falta apenas: série temporal, lógica de bloco
5h, e a UI.

**Teto honesto**: sem Dynamic Island nem lock screen widget. O que dá: pill
"ilha" persistente no topo do app + PWA (ícone na home screen, abre standalone).

## Escopo proibido

- **NÃO usar serviço externo** (gist, API, push de terceiros) — local-first; o
  Tailscale já resolve o transporte. `external_apis:false` continua verdadeiro.
- **NÃO tocar** bind localhost, redaction, scanners read-only.
- **NÃO adicionar dependências** (sem lib de chart — SVG na mão, padrão do repo).
- **NÃO quebrar** contratos `/api/*` existentes; endpoint novo é aditivo.
- **NÃO fabricar dados**: modelo sem rate → custo `null` (regra existente do
  `custo_estimado`), nunca 0.

## Contexto (recon)

- `src/scanner.js` → `custo_estimado(sessao, rates)`: custo USD por sessão via
  `settings.model_rates` (match por prefixo). **Reutilizar** — exportar a função
  (1 linha) em vez de duplicar.
- `src/parsers.js` → `extrair_usage(registros)`: retorna TOTAIS por sessão; para
  bloco/burn rate falta a **série temporal** (usage por mensagem com timestamp —
  os registros `type:"assistant"` do Claude têm `timestamp` + `message.usage`).
- SQLite `sessions`: `tokens`, `cost`, `model`, `updated_at`, `source_path`,
  `source` — suficiente para o histórico de 14 dias **sem reler jsonl antigo**.
- Frontend: auto-refresh de 30s já existe; topbar é o lugar natural da pill.

## Semântica do bloco de 5h (espelhar ccusage)

- Início do bloco = timestamp da **primeira mensagem** após o fim do bloco
  anterior, **arredondado para baixo para a hora cheia (UTC)**.
- Fim = início + 5h. Mensagem após o fim abre bloco novo.
- Burn rate = custo do bloco ÷ **tempo decorrido desde o início** (não ÷ 5h).
- Projeção do bloco = burn rate × 5h.

## Fases

### Fase 1 — Backend: série de usage + endpoint `/api/usage`
- **Quem**: Opus (executor), effort medium — lógica de bloco tem armadilhas; não é
  100% mecânico.
- **Arquivos**: `src/parsers.js`, `src/scanner.js` (só `export`), `src/server.js`,
  `test/parsers.test.js`, `test/server.test.js`.
- Ordem:
  1. `parsers.js`: nova função exportada `serie_de_usage(registros)` →
     `[{ ts, input, output, cache_read, cache_write, model }]` a partir das
     mensagens assistant do Claude (mesmos campos que `extrair_usage` soma).
     **Claude-only**: o `token_count` do Codex é cumulativo e sem timestamp
     confiável por delta — fora do bloco (documentar como teto, igual ao original
     que também só cobre Claude Code).
  2. `scanner.js`: `export` em `custo_estimado`.
  3. `server.js`: `GET /api/usage` que responde:
     - `block`: { start, end, remaining_s, cost, tokens, burn_rate_hr, projected }
       — computado relendo **apenas** os `.jsonl` de sessões Claude com
       `updated_at` nas últimas ~6h (SELECT no SQLite por `source='claude'` e
       `updated_at`), extraindo a série e aplicando a semântica de bloco.
     - `spark`: série dos últimos 120 min agregada em janelas de 5 min
       (custo/janela) para o sparkline.
     - `history`: 14 dias direto do SQLite — `SUM(tokens)`, `SUM(cost)` por
       `date(updated_at)` × `model` (aproximação por sessão; documentar).
     - `rates_known`: bool por modelo (a UI mostra "estimado" e marca modelos
       sem rate).
     - `limit`: estimativa do teto do bloco — `max(tokens por bloco)` dos
       últimos 14 dias (semântica ccusage `--token-limit max`), sobrescrevível
       por `settings.block_limit_tokens`. Junto: `pct_consumed` =
       tokens_do_bloco ÷ limite (null se não há histórico nem override).
  4. Testes: `parsers` (série extrai ts+usage na ordem; ignora registros sem
     usage), `server` (endpoint responde com sessão semeada; bloco vazio →
     `block:null`, sem fabricar).
- **Edge cases**:
  - Bloco recém-aberto: burn ÷ minutos decorridos (mín. 1 min p/ não dividir por ~0).
  - Sem atividade nas últimas 5h → `block: null` (UI mostra "sem bloco ativo"),
    não um bloco zerado.
  - Fuso: bloco em UTC (como ccusage); exibição em hora local no cliente.
  - `remaining_s` calculado no servidor; cliente decrementa localmente (não
    confiar no relógio do iPhone vs PC).
  - Arquivo >25MB: cap existente do scanner — na releitura do endpoint, ler só a
    cauda (reusar padrão do `tail_sessao`, offset por tamanho) se necessário.
  - Custo por mensagem usa o `model` da própria mensagem (sessões trocam de
    modelo no meio).
- **Gate**: `npm test` verde com os testes novos; `npm run check`;
  `curl /api/usage` com dados reais mostra bloco coerente com o uso da sessão atual.

### Fase 2 — Frontend: pill "ilha" + painel de uso
- **Quem**: Sonnet, effort medium (segue spec; UI padrão do repo). Alternativa:
  skill `time-feature` se quiser o pipeline de time completo para o visual.
- **Arquivos**: `public/app.js`, `public/styles.css`.
- Spec:
  - **Pill no topbar** (todas as páginas): custo do bloco + countdown `resets in
    H:MM:SS`, cor por heat (verde → laranja → vermelho conforme % do bloco ou
    burn projetado vs teto configurável). Clique → abre o painel. Poll de 60s no
    `/api/usage` + decremento local do countdown a cada 1s. Na faixa mobile
    (<520px) a pill fica compacta (só custo + tempo).
  - **Painel "Uso"** (seção no Dashboard ou página nova, decidir na implementação
    pelo que for menor diff): anel SVG de progresso do bloco (elapsed/5h),
    stats row (custo, tokens, $/h, projeção, total do dia), sparkline SVG do
    burn das últimas 2h, barras de 14 dias por modelo (histórico do endpoint).
    Rótulo "estimado" em tudo que envolve custo (herda a convenção do Dashboard).
  - Formato BR: US$ com 2 casas, tokens com separador de milhar, bps não se
    aplica; eixos do histórico com unidade.
- **Edge cases**: `block:null` → pill mostra "—" (não 0); aba oculta → pausar o
  poll (padrão do Ao Vivo); countdown chegar a 0 → refetch imediato.
- **Gate**: preview 375×812 e 1280×800 sem overflow; pill visível em todas as
  páginas; valores batem com `curl /api/usage`.

### Fase 3 — PWA: ícone na home screen do iPhone
- **Quem**: Sonnet, effort low (mecânico, ~25 linhas).
- **Arquivos**: `public/manifest.json` (novo), `public/index.html` (links/meta).
- `manifest.json` (name, short_name, display:standalone, theme_color, ícone SVG
  já existente como data URI → gerar PNG 180/512 simples) +
  `apple-mobile-web-app-capable` + `apple-touch-icon`.
- **Edge case**: iOS ignora manifest parcialmente — as meta tags `apple-*` são o
  que vale; `display:standalone` via meta. Servir os PNGs pelo static handler
  existente (mime `.png` — conferir se está no mapa `mime` do server; se não,
  adicionar 1 entrada).
- **Gate**: "Adicionar à Tela de Início" no Safari do iPhone abre standalone
  (sem barra do Safari), com ícone correto.

### Fase 3b — Widget iPhone via Scriptable (home + lock screen)
- **Quem**: Opus, effort medium (API do Scriptable tem pegadinhas de layout).
- **Arquivo**: `agent-command-center/widget-scriptable.js` (novo — vive na repo,
  usuário cola no app Scriptable) + seção no README com instalação.
- Spec:
  - Fetch de `https://<tailnet>/api/usage` (URL configurável no topo do script).
  - **Máquina de estados** (definida pelo usuário):
    1. **Bloco ativo**: `"{pct}% consumido"` + `"reset às HH:MM"` (texto fixo —
       determinístico, não precisa refresh) + countdown de minutos **ticando ao
       vivo** via `applyTimerStyle()` (renderizado pelo iOS, zero refresh).
       Anel = % consumido do limite (não % do tempo), redesenhado a cada refresh.
    2. **Sem bloco ativo**: `"0% consumido · sessão ainda não iniciada"`, sem
       countdown (não existe reset agendado), anel vazio.
    3. **PC/Tailscale inacessível**: último dado em cache do script
       (`Keychain`/`FileManager.local` do Scriptable) + marca "offline HH:MM".
  - Custo mostrado com **extrapolação no render** (`custo_conhecido + burn ×
    Δt desde o último dado`), rotulado `≈`; true-up no próximo refresh.
  - `refreshAfterDate`: +10 min com bloco ativo; +60 min ocioso (dica ao iOS,
    economiza os refreshes que ele raciona).
  - Tamanhos: small (anel + pct + timer), accessoryCircular p/ lock screen
    (anel + pct).
- **Edge cases**: iOS mata fetch > ~10s (timeout curto + cache); `pct_consumed`
  null (sem histórico) → mostrar só custo/tempo, não inventar %; bloco que
  expira entre refreshes → timer nativo chega a 0:00 sozinho e o próximo
  refresh muda o estado para "sessão não iniciada".
- **Gate**: widget na home screen mostra os 3 estados corretamente (testar
  forçando: com uso ativo, sem uso há >5h, e com Tailscale desligado).

### Fase 4 — Review adversarial + verificação no aparelho
- **Quem**: Fable (advisor, effort high) + usuário no iPhone.
- Review: lógica de bloco vs ccusage (off-by-one na hora cheia, bloco atravessando
  meia-noite UTC); endpoint não vaza conteúdo de sessão (só números); custo nunca
  fabricado; poll de 60s não acumula entre navegações (padrão `LIVE.stop()`).
- Verificação: iPhone via Tailscale — pill viva, countdown ticando, painel com
  anel/sparkline/histórico; PWA instalado na home screen.
- **Gate final**: `npm test` + `npm run check` verdes; checklist ok.

## Riscos

- **Divergência vs ccusage**: nossa fonte é a mesma (jsonl), mas custo usa
  `model_rates` locais → números podem diferir do app original / da fatura.
  Mitigação: rótulo "estimado" em tudo; rates editáveis em settings.
- **Sessões de outros diretórios**: o bloco 5h é global por conta, mas só
  enxergamos os paths escaneados em `settings.session_paths`. Se houver uso de
  Claude Code fora deles, o bloco fica subestimado. Documentar no painel.
- **Performance da releitura**: reler jsonl das últimas 6h a cada poll de 60s;
  com poucas sessões ativas é barato. Teto: se pesar, cachear por mtime
  (`ponytail:` comment com o upgrade path).

## Estimativa

| Fase | Esforço |
|---|---|
| 1 (backend) | ~120 linhas + 2 testes |
| 2 (frontend) | ~180 linhas (SVG na mão) |
| 3 (PWA) | ~25 linhas + 2 PNGs |
| 4 (review) | 30 min |

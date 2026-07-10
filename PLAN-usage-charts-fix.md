# PLAN: Corrigir os gráficos de uso (Claude Island / painel "Uso")

## Alvo

Os dois charts do medidor de uso: **"Burn últimas 2h"** (sparkline) e **"14 dias
por modelo · tokens"** (barras empilhadas), no ISLAND (topbar) e no painel do
Dashboard. Render no frontend; agregação no backend.

## Escopo proibido

- **NÃO** adicionar framework/bundler/dep npm (charts continuam SVG inline).
- **NÃO** enfraquecer redaction, bind localhost ou scanner read-only.
- **NÃO** quebrar os demais campos escalares que JÁ estão corretos e verificados
  (custo/tokens/burn/projeção do bloco batem: projeção = burn × 5; custo = burn ×
  Δt do bloco). O bug é **só** nos dois gráficos e na atribuição por modelo.
- Copy pt-BR; dado ausente → placeholder neutro, nunca valor fabricado.

## Diagnóstico (evidência de `/api/usage`, 2026-07-10)

Fatos colhidos, não hipóteses:

- **9 modelos** no `history`: `[null, "claude-opus-4-8", "claude-sonnet-4-6",
  "gpt-5.5", "<synthetic>", "claude-haiku-4-5-20251001", "claude-sonnet-5",
  "claude-fable-5", "gpt-5.6-terra"]`.
- **`MODEL_COLORS` tem só 6 cores** (`--accent, --st-working, --st-needs,
  --st-completed, --st-failed, --st-stale`). `models.indexOf(m) % 6` → **colisão**:
  `null`/`claude-sonnet-5`/`gpt-5.5` viram a mesma cor; opus-4-8/fable-5 idem;
  sonnet-4-6/gpt-5.6-terra idem. Legenda ilegível (é o que a screenshot mostra:
  três azuis, dois verdes, dois laranjas).
- **`null` e `<synthetic>` são "modelos"**: `null` tem 6 linhas mas **0 tokens** —
  invisível no gráfico, mas **polui a legenda**. `<synthetic>` é string literal
  vinda de alguma sessão.
- **Atribuição por modelo é errada (bug mais profundo)**: o `history` agrega
  `SUM(tokens) GROUP BY dia, model` usando `sessions.model` — **um único modelo
  por sessão**. Mas uma sessão troca de modelo no meio (o próprio `usage()`
  comenta isso e o bloco 5h usa `serie_de_usage`, que tem `model` **por
  mensagem**). Logo o chart de 14 dias joga **todos** os tokens de uma sessão no
  modelo final dela → barras por modelo mentem. Inconsistente com o bloco.
- **Sparkline lê como "marcas flutuantes"**: 24 janelas de 5min, só **4 com
  custo**. `null = gap` (não plota). 4 barras isoladas num trilho largo, cada uma
  escalada ao `max` local → parecem flutuar. Não há baseline/trilho de fundo.
- **Rótulo ambíguo**: "14 DIAS POR MODELO · TOKENS / 377.983.508 tok". Esse 377M é
  o `maxTok` (y-máx = dia mais cheio = HOJE), não um total de 14 dias — mas lido
  como "total 14d". Confirmado: hoje sozinho = 377.983.508 tok.
- **Não é bug**: as barras SÃO bottom-anchored (viewBox `0 0 W H`, `y=H-hh`,
  `preserveAspectRatio="none"`, CSS `height:84px`/`34px` 1:1). O "flutuante" é
  efeito das barras isoladas + colisão de cor, não de âncora.

## Arquivos que a mudança toca (por nome, não por linha)

- `public/app.js`: `usageSparkline()`, `usageHistory()`, const `MODEL_COLORS`,
  `usagePanel()` (rótulos), e o ISLAND que consome o mesmo cache.
- `public/styles.css`: classes `.isl-hbars`, `.isl-spark`, `.spk-bar`,
  `.isl-legend`, `.isl-leg` (baseline do sparkline, swatches da legenda).
- `src/server.js`: função `usage()` — bloco `history` (a query SQLite de 14 dias) e
  possivelmente `rates_known`.
- **Se** a decisão F1 for atribuição precisa: `src/scanner.js` (`salvar_sessao`/
  `escanear_sessoes`), `src/parsers.js` (`serie_de_usage` já dá model/mensagem;
  novo agregador `tokens_por_modelo`), `src/db.js` (migração de schema).
- `test/usage-engine.test.js`, `test/server.test.js` (contratos).

## Ferramentas / agentes

- Subagents: `Explore` (recon), `Plan`, `general-purpose`. Sem agente custom.
- Sem skill `find-skills` no repo. `preview_*` MCP para inspeção visual ao vivo.
- Convenção: **Opus executa, Fable revisa** (advisor antes da decisão de schema e
  no review final).

## Fases

### F0 — Diagnóstico confirmado (inventário)

| Quem | Modelo/Effort |
|---|---|
| `Explore` + preview_inspect | Sonnet, medium |

**Objetivo**: já quase pronto (ver Diagnóstico). Materializar em
`docs/AUDIT-usage-charts.md`: por bug → evidência (contagem de `/api/usage`),
seletor/função afetada, severidade. Incluir screenshot inspecionado dos dois
charts (light+dark) com `preview_inspect` medindo se as barras tocam o baseline.
**Gate**: cada bug tem número real por trás (ex.: "9 modelos, 6 cores").

### F1 — Decisão de arquitetura (a cara)

| Quem | Modelo/Effort |
|---|---|
| Fable (advisor, read-only) → Opus decide | high |

Três decisões, cada uma com opção recomendada:

1. **Atribuição por modelo (bug central).**
   - (a) **Preciso**: no scan, gravar `tokens_por_modelo` por sessão (coluna JSON
     nova ou tabela `session_model_tokens`) a partir de `serie_de_usage`; o chart
     de 14 dias agrega isso via SQLite, sem reler jsonl antigo. Correto e barato
     em runtime; custa migração de schema + reprocesso (full rescan).
   - (b) **Honesto-barato**: manter `sessions.model` e **rotular** o chart como
     "por modelo final da sessão"; aceitar a aproximação.
   - (c) **Sem split**: chart vira "tokens/dia" (uma cor), elimina o problema mas
     perde a leitura por modelo.
   - *Recomendação*: (a) — é o único "nível profissional"; o bloco 5h já é preciso
     por mensagem, os 14 dias deviam ser também. Fable valida custo/risco da
     migração antes de commitar.
2. **Cores.** Trocar `MODEL_COLORS` fixo por **gerador determinístico** (hash do
   nome do modelo → matiz HSL estável, S/L fixos por tema) OU por uma paleta
   curada de ≥10 cores distintas AA. Recomendação: paleta curada de 10
   (previsível, sóbria — evita HSL feio); modelos além de 10 caem em "outros".
3. **`null` / `<synthetic>` / modelos com 0 token.** Excluir do chart e da legenda
   linhas com `tokens=0`; mapear `null`→"desconhecido" só se tiver tokens>0;
   decidir se `<synthetic>` é ruído a filtrar (provável) ou modelo real.

**Entregável**: seção em `DESIGN.md` ("Usage charts — data contract") + decisão
registrada. **Gate**: decisões (a/b/c, cores, filtro) fixadas com exemplo de markup.

### F2 — Backend: agregação correta

| Quem | Modelo/Effort |
|---|---|
| Opus (executor) | medium/high |

*(Só se F1 escolher (a).)* Ordem:
1. `db.js`: migração idempotente — `CREATE TABLE IF NOT EXISTS session_model_tokens
   (session_id, model, tokens, PRIMARY KEY(session_id, model))` com FK/ON DELETE.
2. `parsers.js`: exportar `tokens_por_modelo(registros)` que soma
   input+output+cache por `message.model` (reusa a lógica de `serie_de_usage`).
3. `scanner.js` `salvar_sessao`: apagar+reinserir as linhas de model_tokens da
   sessão (mesmo padrão do `session_events`).
4. `server.js` `usage()`: trocar a query `history` para agregar de
   `session_model_tokens JOIN sessions` por `date(updated_at), model`; `cost` por
   modelo derivado de `model_rates` (não da coluna `cost` agregada, que é por
   sessão). Manter fallback para sessões antigas sem model_tokens (contam em
   "desconhecido" até o próximo full rescan).
**Edge cases (um modelo fraco erra)**:
   - Codex não tem `message.usage` por mensagem → `tokens_por_modelo` vazio para
     Codex; a sessão inteira cai em `sessions.model` (fallback) — documentar;
   - full rescan obrigatório para popular retroativo — o botão "Reindexar tudo"
     já existe; a migração não pode apagar dado de sessão ao adicionar a tabela;
   - somar cache_read no "tokens" é intencional (paridade ccusage) — NÃO mudar a
     definição de token aqui, só a atribuição por modelo.
**Gate**: `/api/usage` `history` sem `model=null`/`<synthetic>` com token>0;
soma dos tokens por modelo do dia == total de tokens do dia (invariante testável).

### F3 — Frontend: cor, baseline, rótulos

| Quem | Modelo/Effort |
|---|---|
| Sonnet (mecânico, spec F1) | medium |

Ordem:
1. Substituir `MODEL_COLORS`/`colorFor` pela estratégia F1 (paleta ≥10 ou hash);
   swatch da legenda usa a MESMA função → zero divergência.
2. `usageHistory`: filtrar `tokens>0`; ordenar modelos por total (maior embaixo);
   legenda só com modelos presentes; rótulo `maxTok` vira "máx/dia" explícito.
3. `usageSparkline`: desenhar **trilho baseline** faint full-width + as barras
   sobre ele; janelas vazias como tick de 1px (não sumir) para ler como série
   temporal, não marcas soltas. Manter null≠0 na semântica de custo.
4. Tooltip (`<title>`) por segmento com modelo + tokens + % do dia.
**Edge cases**: `preserveAspectRatio="none"` distorce stroke — usar `rx` e larguras
em unidades de viewBox, sem stroke; contraste dos swatches em light E dark (AA).
**Gate**: preview_eval — nenhum swatch duplicado (`new Set(cores).size == nº
modelos`); nenhum "null"/"<synthetic>" na legenda; barras tocam o baseline
(inspect do y+height == H).

### F4 — Testes

| Quem | Modelo/Effort |
|---|---|
| Opus | medium |

- `usage-engine.test.js`: `tokens_por_modelo` (Claude multi-modelo numa sessão →
  split correto; Codex → vazio); invariante "soma por modelo == total".
- `server.test.js`: `/api/usage` semeado com sessão multi-modelo → `history` sem
  null/synthetic, atribuição por modelo bate; migração idempotente (rodar scan 2×).
**Gate**: `npm test` verde incluindo os novos; `npm run check`.

### F5 — Review adversarial + visual

| Quem | Modelo/Effort |
|---|---|
| Fable (advisor) | high |

Screenshots light+dark dos dois charts antes/depois; conferir legenda legível,
baseline visível, atribuição plausível (opus caro aparece com tokens condizentes),
console limpo, reduced-motion. Opus aplica findings e commita
(`fix(acc): correct per-model token attribution and usage chart rendering`).

## Critérios de aceite globais (verificáveis)

1. `/api/usage.history` não contém `model:null` nem `<synthetic>` com `tokens>0`;
   linhas de 0 token não aparecem na legenda.
2. Cores únicas por modelo: `new Set(models.map(colorFor)).size === models.length`
   (até o teto da paleta; excedente rotulado "outros").
3. Se F1=(a): para toda sessão, `Σ tokens_por_modelo == sessions.tokens`
   (invariante em teste); o chart de 14d agrega dessa fonte, não `sessions.model`.
4. Sparkline com baseline visível; janelas vazias marcadas; barras não "flutuam".
5. Rótulo do y deixa claro que é "máx/dia", não total 14d.
6. `npm test` verde, `npm run check` limpo, zero erro de console, light+dark ok.
7. Escalares (custo/tokens/burn/projeção do bloco) inalterados — só charts+atribuição.

## Ordem e paradas

F0→F1 já; **parada obrigatória pós-F1** — a decisão (a) implica migração de
schema + full rescan, o usuário precisa aprovar. Se ele vetar (a), F2 vira
relabel barato (b) e o resto segue. F3 dá o maior ganho visual isolado. F4–F5 fecham.

**NÃO executar sem ordem explícita.**

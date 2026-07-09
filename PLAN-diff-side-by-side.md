# PLAN: Diff viewer — side-by-side, hunks colapsáveis e realce por palavra

## Objetivo

Roadmap item 4 (🔜). O timeline e a parede Ao Vivo já colorem diffs por linha
(`eventBody`/`diffLineClass`, `public/app.js:302–309, 473–477`). Evoluir só o
**timeline do detalhe** (onde há espaço): toggle unified ↔ side-by-side para
eventos de Edit, hunks colapsáveis para patches longos e realce intra-linha
(palavra) em pares -/+ correspondentes. Ao Vivo continua unified (painéis estreitos).

## Arquivos a tocar

- `agent-command-center/public/app.js` — `eventBody()` + helpers novos
- `agent-command-center/public/styles.css` — grid do side-by-side, marcadores `<mark>`, hunk colapsado

## Os DOIS formatos de diff (mapeado nos parsers — tratá-los diferente)

1. **Claude Edit/Write** (`parsers.js:51–54`): summary = `$ Edit path` + bloco de
   linhas `-` (old_string inteiro) + bloco de linhas `+` (new_string inteiro),
   cada lado capado em 40 linhas por `linhas_diff`. **Blocos contíguos**: parear
   linha i do bloco `-` com linha i do bloco `+`.
2. **Codex apply_patch** (`*** Update File` + hunks `@@`): linhas `+`/`-`
   **intercaladas** com contexto. Parear apenas sequências contíguas de `-`
   seguidas de `+` dentro do mesmo hunk (formato clássico de diff).

## Ordem de implementação

### Passo 1 — parsear o summary em linhas tipadas

```js
// -> [{t:'ctx'|'add'|'del'|'hunk'|'phdr'|'cmd', s:'texto sem o sinal'}]
function parseDiff(summary) {
  return String(summary).split(/\n/).map((l) => {
    const dc = diffLineClass(l); // já existe: hunk/phdr/add/del
    if (dc === 'add' || dc === 'del') return { t: dc, s: l.slice(1) };
    if (dc) return { t: dc, s: l };
    if (/^\$ /.test(l)) return { t: 'cmd', s: l };
    return { t: 'ctx', s: l };
  });
}
```

### Passo 2 — realce por palavra (prefixo/sufixo comum, sem LCS)

```js
// Realça só o miolo que difere entre uma linha del e sua par add.
// ponytail: prefixo/sufixo comum, não LCS — suficiente p/ edits típicos.
function marcarPar(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const wrap = (s) => `${esc(s.slice(0, i))}<mark>${esc(s.slice(i, s.length - j))}</mark>${esc(s.slice(s.length - j))}`;
  return [wrap(a), wrap(b)];
}
```

Regra: só aplicar quando o par existe (mesmo índice dentro da sequência -/+) **e**
`i + j > 0` (alguma âncora comum) — senão renderizar sem `<mark>` (linhas 100%
diferentes viram um mark gigante inútil).

### Passo 3 — pareamento

```js
function pares(linhas) {
  // percorre; ao encontrar run de del seguido de run de add, casa del[n] com add[n]
  // sobras ficam sem par. Marca cada linha com pair_id p/ o realce e o side-by-side.
}
```

Funciona para os dois formatos: no formato Edit do Claude há exatamente um run de
`-` e um de `+`; no apply_patch, runs por hunk.

### Passo 4 — renderizadores

- **Unified (default)**: manter `eventBody` atual, mas usar `marcarPar` nos pares
  (substituir `esc(l)` pelo html com `<mark>` quando a linha tem par).
- **Side-by-side**: grid 2 colunas; para cada par → del à esquerda, add à direita;
  del sem par → esquerda + célula vazia; add sem par → vazia + direita; `ctx` →
  mesma linha nas duas colunas; `hunk`/`phdr`/`cmd` → linha full-width.

```css
.diff-sbs { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
.diff-sbs .full { grid-column: 1 / -1; }
.dl mark { background: transparent; border-radius: 3px; }
.dl.add mark { background: color-mix(in srgb, var(--st-working) 30%, transparent); }
.dl.del mark { background: color-mix(in srgb, var(--st-failed) 30%, transparent); }
```

- **Hunks colapsáveis**: envolver cada hunk em `<details open>` com `<summary>` =
  linha `@@`/`*** Update File`; hunks com > 25 linhas nascem fechados
  (`<details>` sem `open`). `<details>` é nativo — zero JS de colapso.

### Passo 5 — toggle no evento do timeline

Em `timelineEvent` (app.js:478), quando `isDiff(e.summary)`, adicionar botão no
`ev-head`: `<button class="link-btn" data-diff-toggle>lado a lado</button>`.
Estado é local do evento (re-renderiza o `<pre>` no clique via listener delegado
no host do timeline — o timeline é montado em `renderTab()`/`designSystem`, ligar
o handler em `renderTab` após montar, padrão do `#kind-filter` app.js:572).
Ao Vivo (`appendLiveLines`) NÃO ganha o botão — não tocar.

## Edge cases que um modelo mais fraco erraria

- **Dois formatos com pareamento diferente** (Edit = blocos contíguos; apply_patch
  = intercalado por hunk). Um pareador só "linha - com próxima linha +" produz
  pares errados no formato Edit (todas as dels vêm antes de todas as adds).
- **`esc()` ANTES de inserir `<mark>`** — `marcarPar` escapa os 3 segmentos
  separadamente; escapar a string já marcada destruiria as tags. Nunca passar o
  resultado por `esc()` de novo.
- **Falsos diffs**: `isDiff` (app.js:302) existe para prosa com bullets `-` não
  virar diff — não afrouxar essa guarda ao adicionar o botão.
- **`---`/`+++` são excluídos por `diffLineClass`** (negative lookahead) — o parser
  do Passo 1 herda isso de graça; não reimplementar regex.
- **Truncamento**: `linhas_diff` capa em 40 linhas por lado e o summary em 2200
  chars — o último par pode estar cortado no meio. Se a última linha não termina
  igual ao padrão, renderizar sem `<mark>` (o guard `i+j>0` já mitiga).
- **`<details>` dentro de `<pre>` é HTML inválido** — o side-by-side/hunks devem
  trocar o `<pre>` por `<div class="diff">` com `white-space: pre-wrap` no CSS
  (conferir que o unified atual usa `<pre class="diff">`, app.js:476; a versão
  nova em div precisa manter `font: mono` e `white-space`).
- **Sem animação de colapso custom** → nada a fazer de `prefers-reduced-motion`
  (guardrail do roadmap satisfeito por usar `<details>` nativo).
- **Design System** (app.js:468) monta `timelineEvent` com eventos fake — conferir
  que não quebra (nenhum é diff, então o botão não aparece; ok).

## Critérios de aceite

1. `npm run check` verde; `npm test` verde.
2. Abrir o detalhe de uma sessão com evento `$ Edit …`: no timeline, o evento tem
   botão "lado a lado"; clicando, old à esquerda / new à direita, alinhados; o
   miolo alterado de cada par tem fundo destacado (`<mark>`), não a linha inteira.
3. Evento apply_patch (Codex) com 2+ hunks: cada hunk é um `<details>`; hunks
   longos (>25 linhas) nascem fechados; o `@@` é o summary clicável.
4. Bullets de prosa começando com `-` continuam SEM cor de diff (regressão zero
   no `isDiff`).
5. Parede Ao Vivo inalterada (unified, sem botão).
6. Nenhum HTML injetado: colar `<script>` num old_string de teste e conferir que
   aparece como texto.

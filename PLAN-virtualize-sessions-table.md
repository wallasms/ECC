# PLAN: Virtualizar a tabela de Sessões (windowing manual, sem lib)

## Objetivo

Roadmap item 1 (🔜). A página Sessions renderiza até 500 linhas (`LIMIT 500` no
server, `server.js:83`) de uma vez via `innerHTML`, e o auto-refresh de 30s
(`app.js:658`) re-renderiza tudo. Cada `sessionRow` tem avatar SVG + pills + badges
— DOM pesado. Janelar manualmente: renderizar só as linhas visíveis + buffer,
com espaçadores por altura fixa. **Sem biblioteca** (guardrail do roadmap).

## Arquivos a tocar

- `agent-command-center/public/app.js` — `tabela()`, `sessions()`, bind da tabela, navegação j/k
- `agent-command-center/public/styles.css` — altura fixa da `.row` + estilos dos spacers

## Pré-requisito de design: altura fixa por linha

Windowing manual só é trivial com altura constante. Definir em styles.css:

```css
.vrows .row { height: 56px; box-sizing: border-box; overflow: hidden; }
```

(Conferir a altura real de uma `.row` atual no DevTools e usar esse valor — o
título tem 1 linha + snippet 1 linha; se hoje a altura varia, o `overflow:hidden`
com `height` fixa normaliza.)

## Ordem de implementação

### Passo 1 — app.js: estado do windowing

Perto do estado de página (linha 56):

```js
const VT = { data: [], row_h: 56, buffer: 10, container: null };
```

### Passo 2 — trocar `tabela()` por versão janelada quando > 200 itens

Manter `tabela(items, sortable)` como está para listas pequenas (Dashboard usa
`tabela(d.recent.slice(0, 8))`). Adicionar:

```js
function tabelaVirtual(items) {
  VT.data = items;
  return `<div class="surface">${tableHead()}<div class="vrows" id="vrows" style="position:relative"></div></div>`;
}
function paintWindow() {
  const c = VT.container; if (!c) return;
  const scroller = document.scrollingElement; // a página rola, não a div
  const top = Math.max(0, scroller.scrollTop - c.getBoundingClientRect().top - scroller.scrollTop + window.scrollY - c.offsetTop);
  // simplificação robusta: usar posição da div relativa ao documento
  const inicio = Math.max(0, Math.floor((window.scrollY - absTop(c)) / VT.row_h) - VT.buffer);
  const fim = Math.min(VT.data.length, inicio + Math.ceil(innerHeight / VT.row_h) + 2 * VT.buffer);
  c.innerHTML = `<div style="height:${inicio * VT.row_h}px"></div>${VT.data.slice(inicio, fim).map(sessionRow).join('')}<div style="height:${(VT.data.length - fim) * VT.row_h}px"></div>`;
}
const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
```

Em `sessions()` (app.js:258): `items.length > 200 ? tabelaVirtual(data) : tabela(data, true)`.

### Passo 3 — repintar no scroll (com rAF-throttle)

Em `bind()`, quando `page === 'sessions'` e `$('#vrows')` existe:

```js
VT.container = $('#vrows');
paintWindow();
let raf = 0;
const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintWindow(); bindRows(); }); };
addEventListener('scroll', onScroll, { passive: true });
// registrar p/ remover na próxima render: reutilizar o padrão LIVE.stop()
VT.cleanup = () => removeEventListener('scroll', onScroll);
```

E em `render()` (app.js:489, junto de `LIVE.stop()`): `VT.cleanup?.(); VT.cleanup = null;`.

### Passo 4 — event delegation em vez de onclick por linha

`bind()` hoje faz `querySelectorAll('[data-session]').forEach(r => r.onclick = ...)`
(app.js:519). Linhas repintadas no scroll perderiam o handler. Extrair `bindRows()`:

```js
function bindRows() { /* re-liga onclick/keydown só dentro de #vrows */ }
```

— ou, mais simples e definitivo: um único listener delegado no container:

```js
VT.container.onclick = (e) => { const r = e.target.closest('[data-session]'); if (r) detail(r.dataset.session); };
```

Preferir a delegação (1 listener, sobrevive a qualquer repintura).

### Passo 5 — consertar a navegação j/k

O handler global (app.js:649–655) faz `querySelectorAll('#app .row[data-session]')`
e indexa `kbRow` **no DOM** — com windowing, as linhas fora da janela não existem.
Trocar para indexar em `VT.data` quando a tabela é virtual:

```js
if (page === 'sessions' && !busy) {
  const virtual = !!$('#vrows');
  const total = virtual ? VT.data.length : document.querySelectorAll('#app .row[data-session]').length;
  if (!total) return;
  if (e.key === 'j' || e.key === 'ArrowDown') kbRow = Math.min(total - 1, kbRow + 1);
  else if (e.key === 'k' || e.key === 'ArrowUp') kbRow = Math.max(0, kbRow - 1);
  else if (e.key === 'Enter') { const id = virtual ? VT.data[kbRow]?.id : rows[kbRow]?.dataset.session; if (id) detail(id); e.preventDefault(); return; }
  else return;
  e.preventDefault();
  if (virtual) { window.scrollTo({ top: absTop(VT.container) + kbRow * VT.row_h - innerHeight / 2 }); paintWindow(); }
  highlightRowById(virtual ? VT.data[kbRow]?.id : null); // marca .kb pela id, não pelo índice DOM
}
```

`highlightRowById` procura `[data-session="<id>"]` dentro da janela pintada (pode
não existir se rolou rápido — inofensivo, a próxima pintura + chamada corrige).
Manter o comportamento antigo intacto para tabelas não-virtuais.

### Passo 6 — auto-refresh preserva posição

`render(true)` a cada 30s recria o DOM. Antes do `innerHTML` em `render()`, salvar
`window.scrollY` se `page === 'sessions'` e restaurar após `bind()` — 2 linhas.
(O `kbRow = -1` do render já reseta a seleção; aceitável, já era o comportamento.)

## Edge cases que um modelo mais fraco erraria

- **j/k quebram silenciosamente**: a navegação por teclado indexa nós do DOM; após
  virtualizar, `rows[kbRow]` fica `undefined` para linhas fora da janela e o Enter
  não abre nada. O Passo 5 é a parte central do trabalho, não um extra.
- **Handlers por-elemento evaporam a cada repintura** — delegação no container é
  obrigatória (ou re-bind a cada paint, que é fácil de esquecer num dos caminhos).
- **Quem rola é o documento, não a div**: o layout atual não tem scroll interno na
  `.surface`. Calcular o índice com `window.scrollY - absTop(container)`, não com
  `container.scrollTop` (que é sempre 0).
- **Listener de scroll acumula entre renders**: sem `VT.cleanup` no `render()`,
  cada navegação adiciona um listener global a mais (memory leak + paints duplos).
- **Altura precisa ser constante**: um título de 2 linhas quebra o alinhamento do
  spacer. `height` fixa + `overflow:hidden` no CSS resolve por construção.
- **Sorting continua no servidor**: os headers `data-sort` fazem `goto()` com query
  — nada muda, mas o `tableHead()` precisa continuar FORA de `#vrows` para não ser
  destruído pelo `paintWindow()`.
- **Threshold 200**: abaixo disso, render integral (Dashboard e listas curtas nunca
  entram no caminho virtual — zero risco de regressão lá).

## Critérios de aceite

1. `npm run check` verde; `npm test` verde (não há testes de frontend — ok).
2. Com >200 sessões indexadas (ou baixar o threshold para 10 temporariamente para
   testar): a página Sessions mostra a lista completa, a barra de scroll tem o
   tamanho proporcional ao total, e `document.querySelectorAll('.row[data-session]').length`
   no console fica ~(janela + 2×buffer), não o total.
3. Rolar rápido até o fim → última linha correta (sem branco permanente).
4. `j`/`k`/`Enter` funcionam do primeiro ao último item, inclusive atravessando a
   janela (a página rola junto e a linha selecionada ganha `.kb`).
5. Clicar em qualquer linha (inclusive após rolar) abre o detalhe.
6. Ordenar por coluna e filtrar por status/busca continuam funcionando.
7. Esperar o auto-refresh de 30s no meio da lista → posição de scroll preservada.

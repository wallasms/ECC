# PLAN: Streaming SSE no Ao Vivo (substituir o poll de 1,4s)

## Objetivo

Roadmap item 8. A parede "Ao Vivo" abre até **6 painéis**, cada um com `setInterval`
de 1,4s chamando `GET /api/sessions/:id/tail` (`public/app.js:368`) — ~4,3 req/s
constantes, cada uma com `statSync` + `openSync/readSync`. Substituir por
`GET /api/sessions/:id/stream` (Server-Sent Events) com `fs.watch` + leitura
incremental. **O poll continua existindo como fallback** — não deletar.

## Arquivos a tocar

- `agent-command-center/src/server.js` — rota `/api/sessions/:id/stream`
- `agent-command-center/public/app.js` — `startLive()` usa `EventSource`, poll vira fallback
- `agent-command-center/test/server.test.js` — teste da rota

## Ordem de implementação

### Passo 1 — server.js: extrair o corpo do tail

`tail_sessao(id, from)` (server.js:89) já faz tudo (delta por offset, cap 400k,
descarte de linha parcial, redaction via `normalizar_evento`). **Reutilizar como está.**

### Passo 2 — server.js: rota SSE

Registrar em `api()` ANTES do handler genérico `startsWith('/api/sessions/')`
(mesma posição relativa do `/tail$`, ~linha 162):

```js
if (req.method === 'GET' && /^\/api\/sessions\/.+\/stream$/.test(url.pathname)) {
  const partes = url.pathname.split('/');
  const id = decodeURIComponent(partes[partes.length - 2]);
  const row = db.prepare('SELECT source_path FROM sessions WHERE id=?').get(id);
  if (!row) return json(res, 404, { error: 'Sessão não encontrada' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  // Last-Event-ID = offset em bytes; reconexão do EventSource retoma de onde parou.
  let offset = Number(req.headers['last-event-id']) || Number(url.searchParams.get('from')) || 0;
  const enviar = () => {
    try {
      const out = tail_sessao(id, offset);
      if (!out) return;
      offset = out.offset;
      if (out.lines.length || out.missing) res.write(`id: ${offset}\ndata: ${JSON.stringify(out)}\n\n`);
    } catch { /* arquivo em rotação; próximo tick tenta de novo */ }
  };
  enviar();
  let watcher = null;
  try { watcher = watch(row.source_path, () => enviar()); } catch { /* arquivo pode não existir ainda */ }
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
  const safety = setInterval(enviar, 5_000); // fs.watch no Windows às vezes para de disparar
  req.on('close', () => { clearInterval(heartbeat); clearInterval(safety); watcher?.close(); });
  return; // NÃO cair no json()/404
}
```

Importar `watch` de `node:fs` no topo (já importa vários; só adicionar à lista).

### Passo 3 — server.js: proteger o handler de erro global

O `createServer` (linha 197) tem `catch (erro) { json(res, 500, ...) }`. Depois de
headers SSE enviados, `res.writeHead` de novo **lança**. Trocar por:

```js
} catch (erro) { if (!res.headersSent) json(res, 500, { error: String(erro.message || erro) }); else res.end(); }
```

### Passo 4 — app.js: EventSource com fallback

Em `startLive()` (app.js:343), por painel:

```js
let falhas = 0; let es = null;
const conectar = () => {
  es = new EventSource(`/api/sessions/${encodeURIComponent(id)}/stream?from=${body.dataset.offset || 0}`);
  es.onmessage = (ev) => { falhas = 0; aplicar(JSON.parse(ev.data)); };
  es.onerror = () => { falhas += 1; if (falhas >= 3) { es.close(); es = null; iniciarPoll(); } };
};
```

onde `aplicar(r)` é o corpo atual do `poll` a partir de `body.dataset.offset = r.offset`
(extrair esse trecho para função compartilhada entre SSE e poll — o poll de 1,4s
vira `iniciarPoll()` e só roda se o SSE falhar 3×).

Pausa/aba oculta: no handler `onmessage`, se `LIVE.paused.has(id) || document.hidden`,
apenas ignorar a mensagem (barato) — OU fechar o ES no `visibilitychange` e reabrir;
a primeira opção é suficiente e mais simples.

### Passo 5 — app.js: lifecycle no LIVE

`LIVE.stop()` (app.js:282) hoje só limpa timers. Adicionar registro dos EventSource:

```js
const LIVE = { timers: [], sources: [], paused: new Set(),
  stop() { this.timers.forEach(clearInterval); this.sources.forEach((e) => e.close()); this.timers = []; this.sources = []; this.paused.clear(); } };
```

e `LIVE.sources.push(es)` a cada `conectar()`. **Sem isso, cada troca de página
vaza uma conexão SSE + um fs.watch no servidor** (render() roda a cada navegação
e a cada 30s no auto-refresh).

### Passo 6 — teste

Em `test/server.test.js`: requisição a `/api/sessions/<id-fake>/stream` → 404.
Para o caminho feliz, basta testar que a rota responde `Content-Type: text/event-stream`
e envia o primeiro `data:` (usar sessão semeada como os testes existentes fazem;
abortar a request após o primeiro chunk).

## Edge cases que um modelo mais fraco erraria

- **`fs.watch` no Windows é não-confiável**: pode disparar 2× por append, pode parar
  após rename/rotação, e `watch()` num arquivo inexistente lança. Por isso o
  `try/catch` na criação, o `safety` interval de 5s e o design idempotente de
  `enviar()` (delta por offset → evento duplicado do watch envia 0 linhas, inofensivo).
- **Headers já enviados**: sem o Passo 3, a primeira exceção dentro do stream derruba
  o processo com `ERR_HTTP_HEADERS_SENT` no handler global.
- **Reconexão do EventSource não muda a URL**: o `?from=` só vale na primeira conexão.
  Usar `id:` = offset para que o browser mande `Last-Event-ID` na reconexão — é assim
  que o offset sobrevive a quedas.
- **Vazamento por navegação SPA**: `render()` recria o DOM sem destruir os ES.
  O Passo 5 é obrigatório, não polimento.
- **Rotação/truncamento do arquivo**: `tail_sessao` já trata (`start > size → 0`);
  não reimplementar.
- **Ordem das rotas**: a regex `/stream$` precisa vir antes do
  `startsWith('/api/sessions/')` genérico, senão o id "xxx/stream" vira 404 de sessão.
- **Não usar `json()` dentro da rota SSE** — ela chama `res.writeHead` de novo.

## Critérios de aceite

1. `npm test` e `npm run check` verdes em `agent-command-center/`.
2. Com o servidor rodando e a página **Ao Vivo** aberta sobre uma sessão ativa:
   `curl -N http://127.0.0.1:4310/api/sessions/<id>/stream` mostra `data:` chegando
   quando o `.jsonl` cresce, e `: ping` a cada ~15s.
3. Na aba Network do browser: **zero** requisições `/tail` repetidas enquanto o SSE
   está saudável (apenas 1 conexão `stream` pendurada por painel).
4. Matar o servidor e religar → painéis reconectam sozinhos (retry do EventSource)
   e continuam do offset (sem redesenhar tudo desde o começo).
5. Navegar Ao Vivo → Dashboard → Ao Vivo 5×: `lsof`/Process Explorer não acumula
   conexões; no servidor não acumulam watchers (adicionar `console.log` temporário
   no `req.on('close')` para conferir que fecha).
6. Bloquear a rota (comentar temporariamente) → após 3 erros o painel volta ao poll
   de 1,4s e segue funcionando (fallback intacto).

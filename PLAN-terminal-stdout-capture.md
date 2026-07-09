# PLAN: Capturar stdout/stderr reais como eventos de primeira classe

## Objetivo

Roadmap item 9. Hoje o "Terminal" das sessões é reconstruído do índice de eventos
(o próprio app avisa: "stdout/stderr brutos não são capturados", `public/app.js:574`).
Os dados **existem** nos `.jsonl` (tool_result do Claude, `*_output` do Codex) mas o
parser os mistura com prosa. Marcar esses eventos com `kind: 'stdout'` / `'stderr'`
para o terminal (preview, aba Terminal e parede Ao Vivo) mostrar saída literal.
Puramente aditivo ao parser — scanner e schema não mudam (`session_events.kind` é TEXT).

## Arquivos a tocar

- `agent-command-center/src/parsers.js` — classificar outputs em `normalizar_evento`
- `agent-command-center/public/app.js` — `termLines`, `liveLineClass`, `EVENT_KIND` reconhecem os kinds novos
- `agent-command-center/test/parsers.test.js` — testes dos dois formatos

## Onde os dados estão (mapeado explorando os parsers)

- **Claude**: registros `type:"user"` com `message.content` contendo blocos
  `{type:'tool_result', tool_use_id, content, is_error?}`. `bloco_claude` (parsers.js:47)
  já extrai o texto, mas o registro inteiro fica com `kind='user'` e `role='user'`
  — a UI pinta como prompt do usuário.
- **Codex**: `payload.type === 'function_call_output' | 'custom_tool_call_output'`
  (parsers.js:82). O `payload.output` às vezes é uma **string JSON**
  `{"output":"...","metadata":{"exit_code":0,...}}` — hoje entra cru no summary.

## Ordem de implementação

### Passo 1 — parsers.js: detectar tool_result no registro Claude

Em `normalizar_evento` (parsers.js:95), após calcular `kind`, sobrescrever quando o
conteúdo é resultado de tool:

```js
// tool_result vem em registro role:user — sem isso a UI pinta output como prompt.
const blocos = registro?.message?.content;
if (Array.isArray(blocos) && blocos.some((b) => b?.type === 'tool_result')) {
  kind = blocos.some((b) => b?.type === 'tool_result' && b.is_error) ? 'stderr' : 'stdout';
  role = null;
}
```

(Trocar `const kind`/`const role` por `let` — hoje são const nas linhas 97–98.)

### Passo 2 — parsers.js: outputs do Codex

No `case 'custom_tool_call_output': case 'function_call_output':` de
`extrair_conteudo` (parsers.js:82), desembrulhar o JSON de metadata:

```js
case 'custom_tool_call_output': case 'function_call_output': {
  let out = typeof payload.output === 'string' ? payload.output : texto(payload.output);
  let erro = false;
  try { const o = JSON.parse(out); if (typeof o.output === 'string') { erro = Number(o.metadata?.exit_code) > 0; out = o.output; } } catch { /* string simples */ }
  return (erro ? '⛔ ' : '') + out;
}
```

E em `normalizar_evento`, mapear o kind desses payloads:

```js
if (payload?.type === 'function_call_output' || payload?.type === 'custom_tool_call_output') {
  kind = bruto.startsWith('⛔') ? 'stderr' : 'stdout';
}
```

(Fazer isso depois de `bruto` existir; reordenar as declarações se preciso.)

### Passo 3 — parsers.js: outputs ganham a faixa de 2200 chars

O limite de summary (parsers.js:102) dá 2200 chars a patches e 600 à prosa.
Incluir os kinds novos na faixa larga:

```js
const limite = /(\*\*\* (Begin Patch|Update File|Add File|Delete File)|\n@@ |^\$ )/.test(bruto) || kind === 'stdout' || kind === 'stderr' ? 2200 : 600;
```

### Passo 4 — app.js: terminal usa os kinds

- `termLines` (app.js:123): em vez de "último evento não-user", preferir os últimos
  eventos `stdout`/`stderr`:

```js
const outs = evs.filter((e) => e.kind === 'stdout' || e.kind === 'stderr');
const outEv = outs.at(-1) || [...evs].reverse().find((e) => e.summary && e.role !== 'user') || evs.at(-1);
```

  e classe `err` quando `outEv.kind === 'stderr'` (mantendo o fallback por status).
- `liveLineClass` (app.js:292): antes dos regexes, curto-circuito:
  `if (e.kind === 'stderr') return 'err'; if (e.kind === 'stdout') return 'out';`
- `EVENT_KIND` (app.js:472): adicionar no INÍCIO da lista
  `[/^stderr$/, 'k-error', 'terminal', 'stderr']` e `[/^stdout$/, 'k-term', 'terminal', 'stdout']`
  — a lista é first-match e `/tool|.../` casaria antes.

### Passo 5 — testes

Em `test/parsers.test.js`:
1. JSONL Claude com registro user contendo `tool_result` (`is_error: false`) →
   evento com `kind: 'stdout'`, `role: null`, summary = texto do resultado.
2. Mesmo com `is_error: true` → `kind: 'stderr'`.
3. JSONL Codex com `function_call_output` cujo `output` é a string JSON
   `'{"output":"oi\\n","metadata":{"exit_code":1}}'` → `kind: 'stderr'`, summary contém `oi`.

## Edge cases que um modelo mais fraco erraria

- **tool_result mora em registro `role:"user"`** — o pulo do gato. Sem sobrescrever
  kind/role, `liveLineClass` pinta output de Bash como prompt (`usr`) e
  `mensagens_usuario` (parsers.js:147) usaria output de tool como TÍTULO da sessão.
  Conferir depois do Passo 1 que o título continua vindo do primeiro prompt real:
  o filtro de título usa `role === 'user'`, e nós zeramos `role` — é exatamente o
  que corrige títulos poluídos, mas o teste 1 deve garantir que um jsonl com
  prompt + tool_result mantém o título do prompt.
- **`payload.output` do Codex é string JSON aninhada** — sem o try/parse o terminal
  mostra `{"output":"...` cru com escapes `\n` colados.
- **`exit_code` pode ser 0, ausente, ou string** — `Number(...) > 0` cobre os três
  (NaN > 0 é false → stdout, o default certo).
- **`status_por_eventos`** (parsers.js:22) faz regex de `error|failed` sobre
  `kind + summary` dos últimos 20 eventos. `kind='stderr'` NÃO contém "error", ok;
  mas um stdout com a palavra "error" já flipava status antes — comportamento
  pré-existente, não tentar consertar aqui.
- **Redaction continua passando por `redigir`** em `normalizar_evento` — não criar
  caminho novo de texto que fuja dela.
- **Sessões antigas só atualizam com "Reindexar tudo"** (cache de mtime no scanner).
- **`RUIDO`** (parsers.js:32): não adicionar os tipos de output lá por engano.

## Critérios de aceite

1. `npm test` verde com os 3 testes novos; `npm run check` verde.
2. Após "Reindexar tudo": abrir uma sessão Claude que rodou Bash → aba **Terminal**
   mostra a saída real do comando (não só o snippet), e a aba Timeline mostra o
   evento rotulado "stdout" (não "Prompt").
3. Comando que falhou (exit code ≠ 0 / is_error) aparece em vermelho (classe `err`)
   no preview e na parede Ao Vivo.
4. Títulos das sessões não regridem para texto de output (comparar lista de sessões
   antes/depois do reindex).
5. Nenhum base64/JSON cru novo no terminal (guardrail do extractor mantido).

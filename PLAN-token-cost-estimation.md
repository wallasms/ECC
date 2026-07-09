# PLAN: Tokens corretos + custo estimado (Dashboard "Custo" acende)

## Objetivo

Hoje `tokens` está **errado ou nulo** para quase todas as sessões e `cost` é sempre
`null` (roadmap item 10). Consertar a extração de tokens no parser e derivar custo
via tabela de preços por modelo (configurável em settings), rotulado como "estimado".
Isso acende o card **Custo** do Dashboard e a seção **Consumo por projeto**.

## Bug raiz (encontrado explorando — não está no roadmap)

Em `agent-command-center/src/parsers.js:158`:

```js
const token_obj = registros.map((r) => r?.payload?.usage || r?.usage).find(Boolean) || {};
```

Dois problemas:
1. **Claude**: o usage fica em `r.message.usage` (dentro de registros `type:"assistant"`),
   caminho que essa linha NUNCA olha → tokens `null` para toda sessão Claude.
2. **Codex**: eventos `payload.type === 'token_count'` carregam
   `payload.info.total_token_usage` (cumulativo). `find(Boolean)` pega o **primeiro**,
   ou seja o menor valor da sessão, não o total.

## Arquivos a tocar

- `agent-command-center/src/parsers.js` — extração de tokens (substituir linha 158 por função)
- `agent-command-center/src/server.js` — `default_settings` (tabela de rates) + cálculo de custo no scan… ver passo 3 (o custo entra no parser? não — entra no scanner, ver abaixo)
- `agent-command-center/src/scanner.js` — aplicar rate table antes de `salvar_sessao`
- `agent-command-center/public/app.js` — rotular custo como "estimado" (Dashboard e detalhe)
- `agent-command-center/test/parsers.test.js` — testes das duas semânticas de agregação

## Ordem de implementação

### Passo 1 — parsers.js: extrair usage estruturado

Criar função (perto de `arquivos_de_tools`):

```js
// Claude: soma usage por mensagem (cada chamada de API fatura o input inteiro).
// Codex: token_count é CUMULATIVO — vale o ÚLTIMO, nunca somar.
function extrair_usage(registros) {
  let claude = null;
  for (const r of registros) {
    const u = r?.message?.usage;
    if (u && typeof u === 'object') {
      claude = claude || { input: 0, output: 0, cache_read: 0, cache_write: 0 };
      claude.input += u.input_tokens || 0;
      claude.output += u.output_tokens || 0;
      claude.cache_read += u.cache_read_input_tokens || 0;
      claude.cache_write += u.cache_creation_input_tokens || 0;
    }
  }
  if (claude) return { ...claude, total: claude.input + claude.output + claude.cache_read + claude.cache_write };
  const tc = [...registros].reverse().find((r) => r?.payload?.type === 'token_count' && r.payload.info?.total_token_usage);
  if (tc) {
    const u = tc.payload.info.total_token_usage;
    return { input: u.input_tokens || 0, output: u.output_tokens || 0, cache_read: u.cached_input_tokens || 0, cache_write: 0, total: u.total_tokens || 0 };
  }
  // fallback: formato antigo que a linha atual cobria
  const legado = registros.map((r) => r?.payload?.usage || r?.usage).find(Boolean);
  if (legado) return { input: 0, output: 0, cache_read: 0, cache_write: 0, total: legado.total_tokens || legado.totalTokenCount || 0 };
  return null;
}
```

### Passo 2 — parsers.js: usar no retorno de `analisar_jsonl`

Substituir a linha 158 e o campo `tokens` do objeto retornado (linha 167):

```js
const usage = extrair_usage(registros);
// ...no return:
tokens: usage?.total || null, usage, cost: null,
```

`usage` é campo novo do objeto de sessão em memória (não vai pro DB; o scanner o consome).

### Passo 3 — server.js: rate table em `default_settings`

Adicionar chave em `default_settings` (linha 17–30). Valores em USD por 1M tokens.
Match por **prefixo** do id do modelo (ids reais têm sufixo de data):

```js
model_rates: {
  'claude-opus-4': { input: 15, output: 75, cache_read: 1.5 },
  'claude-sonnet': { input: 3, output: 15, cache_read: 0.3 },
  'claude-haiku': { input: 1, output: 5, cache_read: 0.1 },
  'gpt-5': { input: 1.25, output: 10, cache_read: 0.125 }
}
```

⚠️ São estimativas de tabela pública — o rótulo "estimado" na UI existe por isso.
`carregar_settings` já faz merge raso (`{...default_settings, ...json}`), então
settings.json antigos ganham a chave automaticamente. Não editar o settings.json em `data/`.

### Passo 4 — scanner.js: calcular custo antes de salvar

`executar_scan` recebe `settings` — passar `settings.model_rates` até `salvar_sessao`
ou, mais simples, calcular em `escanear_sessoes` logo após `analisar_jsonl` (linha 69):

```js
sessao.cost = custo_estimado(sessao, settings.model_rates || {});
```

com helper no topo do scanner.js:

```js
function custo_estimado(sessao, rates) {
  if (!sessao.usage || !sessao.model) return null;
  const chave = Object.keys(rates).find((k) => sessao.model.startsWith(k));
  if (!chave) return null; // sem rate conhecido → null, NUNCA 0
  const r = rates[chave]; const u = sessao.usage;
  return (u.input * (r.input || 0) + u.output * (r.output || 0) + u.cache_read * (r.cache_read || 0) + u.cache_write * (r.input || 0) * 1.25) / 1_000_000;
}
```

### Passo 5 — app.js: rótulo "estimado"

- Dashboard card Custo (`public/app.js:241`): trocar `'Custo'` por `'Custo (est.)'`
  quando `d.stats.cost > 0` — ou simplesmente fixar o label `'Custo estimado'`.
- Detalhe da sessão (`public/app.js:552`): `['Custo', s.cost ? usd(s.cost) + ' (est.)' : 'não detectado']`.
- Consumo por projeto já usa `usd(p.cost)` — nada a mudar.

### Passo 6 — testes

Em `test/parsers.test.js`, adicionar:
1. JSONL Claude com 3 registros `assistant` com `message.usage` → tokens = soma.
2. JSONL Codex com 2 eventos `token_count` (info.total_token_usage) → tokens = valor do ÚLTIMO.
3. JSONL sem usage → `tokens: null`.

## Edge cases que um modelo mais fraco erraria

- **Semânticas opostas de agregação**: Claude é por-mensagem (SOMAR), Codex é
  cumulativo (pegar o ÚLTIMO). Somar Codex infla ~n×; pegar o primeiro do Claude
  subconta. O teste 1 e 2 existem para travar isso.
- **`cost` nunca pode virar 0**: modelo sem rate → `null`. A UI trata `null` como
  "não detectado" e a query do dashboard usa `HAVING tokens>0 OR cost>0` — um 0
  gravado polui e um valor fabricado viola o guardrail "never fabricate data" do
  FRONTEND-ROADMAP.md.
- **Match de modelo por prefixo**, não igualdade: `claude-opus-4-8-20250915`
  precisa casar com `claude-opus-4`.
- **Sessões antigas não reprocessam sozinhas**: o scan incremental pula arquivo com
  mtime/size iguais (`scanner.js:67`). Para popular tokens/custo do histórico é
  preciso "Reindexar tudo" (scan `full:true`). Colocar isso no critério de aceite.
- **Não gravar `usage` no DB**: o schema `sessions` não tem coluna; é campo transitório
  do objeto. Não criar migração — `tokens` e `cost` já existem.
- **`cache_creation` fatura ~1.25× input** (Anthropic); `cache_read` ~0.1×. Já refletido
  no helper.

## Critérios de aceite

1. `cd agent-command-center && npm test` verde, incluindo os 3 testes novos.
2. `npm run check` verde.
3. Subir o servidor (`npm start`), clicar **Reindexar tudo** no Dashboard:
   - Card **Tokens** > 0 (havendo sessões Claude/Codex reais na máquina).
   - Card **Custo estimado** mostra `US$ x,xx` para sessões de modelos na rate table.
   - **Consumo por projeto** aparece com valores.
4. Sessão de modelo desconhecido → detalhe mostra Custo "não detectado" (não US$ 0,00).
5. `GET /api/settings` retorna `model_rates`; editar um rate no settings.json e
   reindexar muda o custo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// server.js roda código no topo (carregar_settings + abrir_banco). Isola o DATA
// num tempdir ANTES de importar, para não tocar o SQLite/settings reais.
process.env.ACC_DATA = mkdtempSync(join(tmpdir(), 'acc-usage-'));
const { blocos_5h } = await import('../src/server.js');
const { custo_estimado } = await import('../src/scanner.js');
const { serie_de_usage, analisar_jsonl } = await import('../src/parsers.js');

const NL = String.fromCharCode(10);
const stats = { birthtime: new Date('2026-01-01'), mtime: new Date('2026-01-02') };
const rates = { 'claude-opus-4': { input: 15, output: 75, cache_read: 1.5 } };

test('custo_estimado: cada componente e a soma', () => {
  const M = 1_000_000;
  assert.equal(custo_estimado({ usage: { input: M, output: 0, cache_read: 0, cache_write: 0 }, model: 'claude-opus-4-8' }, rates), 15);
  assert.equal(custo_estimado({ usage: { input: 0, output: M, cache_read: 0, cache_write: 0 }, model: 'claude-opus-4-8' }, rates), 75);
  assert.equal(custo_estimado({ usage: { input: 0, output: 0, cache_read: M, cache_write: 0 }, model: 'claude-opus-4-8' }, rates), 1.5);
  assert.equal(custo_estimado({ usage: { input: 0, output: 0, cache_read: 0, cache_write: M }, model: 'claude-opus-4-8' }, rates), 18.75); // input 15 × 1.25
  assert.equal(custo_estimado({ usage: { input: M, output: M, cache_read: M, cache_write: M }, model: 'claude-opus-4-8' }, rates), 110.25);
});

test('custo_estimado: null (nunca 0) quando falta dado ou rate', () => {
  assert.equal(custo_estimado({ usage: { input: 1e6, output: 0, cache_read: 0, cache_write: 0 }, model: 'gpt-5-foo' }, rates), null);
  assert.equal(custo_estimado({ usage: { input: 1e6 }, model: undefined }, rates), null);
  assert.equal(custo_estimado({ model: 'claude-opus-4-8' }, rates), null);
});

test('extrair_usage (via analisar_jsonl): Claude soma campos disjuntos', () => {
  const linha = JSON.stringify({ type: 'assistant', timestamp: '2026-01-01T00:00:00Z', message: { role: 'assistant', content: [{ type: 'text', text: 'oi' }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 1 } } });
  const r = analisar_jsonl(linha + NL + linha, 'x.jsonl', stats, 'claude');
  assert.deepEqual(r.usage, { input: 20, output: 10, cache_read: 4, cache_write: 2, total: 36 });
  assert.equal(r.tokens, 36);
});

test('extrair_usage (via analisar_jsonl): Codex normaliza cached e usa o último cumulativo', () => {
  const meta = JSON.stringify({ type: 'session_meta', timestamp: '2026-01-01T00:00:00Z', payload: { id: 'abc' } });
  const tc = JSON.stringify({ payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 30, output_tokens: 20, total_tokens: 120 } } } });
  const r = analisar_jsonl(meta + NL + tc, 'x.jsonl', stats, 'codex');
  assert.equal(r.usage.input, 70); // 100 − 30 cached
  assert.equal(r.usage.cache_read, 30);
  assert.equal(r.usage.output, 20);
  assert.equal(r.usage.total, 120);
});

test('serie_de_usage: só mensagens Claude com usage E timestamp', () => {
  const registros = [
    { timestamp: '2026-01-01T00:00:00Z', message: { usage: { input_tokens: 1, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, model: 'claude-opus-4-8' } },
    { message: { usage: { input_tokens: 9 } } }, // sem timestamp → fora
    { timestamp: '2026-01-01T01:00:00Z', type: 'text' } // sem usage → fora
  ];
  const serie = serie_de_usage(registros);
  assert.equal(serie.length, 1);
  assert.deepEqual(serie[0], { ts: '2026-01-01T00:00:00Z', input: 1, output: 0, cache_read: 0, cache_write: 0, model: 'claude-opus-4-8' });
});

test('blocos_5h: floor para hora cheia UTC, janela de 5h', () => {
  const cinco_h = 5 * 3600_000;
  const um = blocos_5h([{ ts: '2026-01-01T02:30:00Z' }, { ts: '2026-01-01T03:15:00Z' }]);
  assert.equal(um.length, 1);
  assert.equal(um[0].inicio, Date.parse('2026-01-01T02:00:00Z'));
  assert.equal(um[0].fim, Date.parse('2026-01-01T02:00:00Z') + cinco_h);

  const dois = blocos_5h([{ ts: '2026-01-01T02:30:00Z' }, { ts: '2026-01-01T08:30:00Z' }]);
  assert.equal(dois.length, 2); // 08:30 ≥ fim do 1º (07:00)

  assert.equal(blocos_5h([{ ts: 'not-a-date' }]).length, 0); // ts inválido dropado
  assert.equal(blocos_5h([]).length, 0);
});

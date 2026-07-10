import test from 'node:test';
import assert from 'node:assert/strict';
import { analisar_jsonl, redigir, serie_de_usage } from '../src/parsers.js';

const stats = { birthtime: new Date('2026-01-01'), mtime: new Date('2026-01-02') };

test('parser Codex extrai metadados e redige segredo', () => {
  const input = [
    { type:'session_meta', timestamp:'2026-01-01T00:00:00Z', payload:{ id:'abc', cwd:'C:\\repo', model:'gpt-test' } },
    { type:'response_item', timestamp:'2026-01-01T00:01:00Z', payload:{ type:'message', role:'user', content:[{ type:'text', text:'Criar scanner token=secreto123' }] } }
  ].map(JSON.stringify).join('\n');
  const result = analisar_jsonl(input, 'C:\\Users\\me\\.codex\\sessions\\x.jsonl', stats);
  assert.equal(result.source, 'codex'); assert.equal(result.id, 'abc'); assert.match(result.title, /REDACTED/); assert.doesNotMatch(JSON.stringify(result), /secreto123/);
});

test('redactor cobre chaves conhecidas', () => assert.equal(redigir('key sk-abcdefghijklmnop'), 'key [REDACTED]'));

test('tokens Claude: soma usage por mensagem (campos disjuntos)', () => {
  const msg = (i) => ({ type:'assistant', timestamp:`2026-01-01T00:0${i}:00Z`,
    message:{ role:'assistant', model:'claude-sonnet-5', content:[{ type:'text', text:`resposta ${i}` }],
      usage:{ input_tokens:10, output_tokens:5, cache_read_input_tokens:100, cache_creation_input_tokens:20 } } });
  const input = [msg(1), msg(2), msg(3)].map(JSON.stringify).join('\n');
  const r = analisar_jsonl(input, 'C:\\Users\\me\\.claude\\projects\\p\\x.jsonl', stats, 'claude');
  assert.equal(r.tokens, 405); // (10+5+100+20) * 3
  assert.equal(r.usage.output, 15); assert.equal(r.usage.cache_write, 60);
  assert.equal(r.model, 'claude-sonnet-5'); // vem de message.model, senão custo fica null p/ Claude
});

test('tokens Codex: token_count é cumulativo — vale o ÚLTIMO, input normalizado', () => {
  const tc = (input_tokens, cached, output, total) => ({ type:'event_msg', timestamp:'2026-01-01T00:00:00Z',
    payload:{ type:'token_count', info:{ total_token_usage:{ input_tokens, cached_input_tokens:cached, output_tokens:output, total_tokens:total } } } });
  const input = [tc(50, 20, 5, 55), tc(200, 80, 20, 220)].map(JSON.stringify).join('\n');
  const r = analisar_jsonl(input, 'C:\\Users\\me\\.codex\\sessions\\x.jsonl', stats, 'codex');
  assert.equal(r.tokens, 220);              // último total, não a soma (275) nem o primeiro (55)
  assert.equal(r.usage.input, 120);         // 200 - 80 cached (evita cobrar cache 2×)
  assert.equal(r.usage.cache_read, 80);
});

test('tokens ausentes → null (não fabrica)', () => {
  const input = [{ type:'assistant', message:{ role:'assistant', content:[{ type:'text', text:'oi' }] } }].map(JSON.stringify).join('\n');
  const r = analisar_jsonl(input, 'C:\\Users\\me\\.claude\\projects\\p\\x.jsonl', stats, 'claude');
  assert.equal(r.tokens, null); assert.equal(r.usage, null);
});

test('Claude tool_result vira stdout e não polui o título', () => {
  const input = [
    { type:'user', timestamp:'2026-01-01T00:00:00Z', message:{ role:'user', content:[{ type:'text', text:'rode os testes' }] } },
    { type:'assistant', timestamp:'2026-01-01T00:01:00Z', message:{ role:'assistant', content:[{ type:'tool_use', name:'Bash', input:{ command:'npm test' } }] } },
    { type:'user', timestamp:'2026-01-01T00:02:00Z', message:{ role:'user', content:[{ type:'tool_result', tool_use_id:'t1', content:'7 passing', is_error:false }] } }
  ].map(JSON.stringify).join('\n');
  const r = analisar_jsonl(input, 'C:\\Users\\me\\.claude\\projects\\p\\x.jsonl', stats, 'claude');
  const out = r.events.find((e) => e.kind === 'stdout');
  assert.ok(out, 'evento stdout existe'); assert.equal(out.role, null); assert.match(out.summary, /7 passing/);
  assert.match(r.title, /rode os testes/); // título vem do prompt real, não do output
});

test('Claude tool_result is_error vira stderr', () => {
  const input = [
    { type:'user', timestamp:'2026-01-01T00:00:00Z', message:{ role:'user', content:[{ type:'tool_result', tool_use_id:'t1', content:'boom', is_error:true }] } }
  ].map(JSON.stringify).join('\n');
  const r = analisar_jsonl(input, 'C:\\Users\\me\\.claude\\projects\\p\\x.jsonl', stats, 'claude');
  assert.equal(r.events.find((e) => e.summary.includes('boom')).kind, 'stderr');
});

test('serie_de_usage extrai ts+usage na ordem e ignora registros sem usage', () => {
  const registros = [
    { type:'assistant', timestamp:'2026-01-01T00:01:00Z', message:{ role:'assistant', model:'claude-sonnet-5', usage:{ input_tokens:10, output_tokens:5, cache_read_input_tokens:100, cache_creation_input_tokens:20 } } },
    { type:'user', timestamp:'2026-01-01T00:02:00Z', message:{ role:'user', content:[{ type:'text', text:'sem usage' }] } },
    { type:'assistant', timestamp:'2026-01-01T00:03:00Z', message:{ role:'assistant', model:'claude-opus-4-8', usage:{ input_tokens:1, output_tokens:2, cache_read_input_tokens:3, cache_creation_input_tokens:4 } } }
  ];
  const serie = serie_de_usage(registros);
  assert.equal(serie.length, 2); // ignora o registro sem usage
  assert.deepEqual(serie.map((e) => e.ts), ['2026-01-01T00:01:00Z', '2026-01-01T00:03:00Z']);
  assert.equal(serie[0].input, 10); assert.equal(serie[0].cache_write, 20); assert.equal(serie[0].model, 'claude-sonnet-5');
  assert.equal(serie[1].model, 'claude-opus-4-8');
});

test('serie_de_usage ignora usage sem timestamp confiável', () => {
  const serie = serie_de_usage([{ type:'assistant', message:{ role:'assistant', usage:{ input_tokens:5, output_tokens:5 } } }]);
  assert.equal(serie.length, 0);
});

test('Codex function_call_output desembrulha JSON e marca stderr por exit_code', () => {
  const input = [
    { type:'response_item', timestamp:'2026-01-01T00:00:00Z', payload:{ type:'function_call_output', output:'{"output":"oi\\n","metadata":{"exit_code":1}}' } }
  ].map(JSON.stringify).join('\n');
  const r = analisar_jsonl(input, 'C:\\Users\\me\\.codex\\sessions\\x.jsonl', stats, 'codex');
  const ev = r.events.find((e) => e.summary.includes('oi'));
  assert.equal(ev.kind, 'stderr');
  assert.doesNotMatch(ev.summary, /metadata|exit_code/); // desembrulhado, não cru
});

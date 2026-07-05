import test from 'node:test';
import assert from 'node:assert/strict';
import { analisar_jsonl, redigir } from '../src/parsers.js';

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

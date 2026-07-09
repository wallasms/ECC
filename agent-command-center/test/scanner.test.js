import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arquivos_em } from '../src/scanner.js';

test('scanner ignora node_modules e respeita extensões', () => {
  const root = mkdtempSync(join(tmpdir(), 'acc-')); mkdirSync(join(root,'node_modules')); writeFileSync(join(root,'a.jsonl'),'{}'); writeFileSync(join(root,'node_modules','b.jsonl'),'{}');
  assert.deepEqual(arquivos_em(root,new Set(['.jsonl'])),[join(root,'a.jsonl')]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { arquivos_em, escopo_skill, executar_scan } from '../src/scanner.js';
import { abrir_banco } from '../src/db.js';

test('scanner ignora node_modules e respeita extensões', () => {
  const root = mkdtempSync(join(tmpdir(), 'acc-')); mkdirSync(join(root,'node_modules')); writeFileSync(join(root,'a.jsonl'),'{}'); writeFileSync(join(root,'node_modules','b.jsonl'),'{}');
  assert.deepEqual(arquivos_em(root,new Set(['.jsonl'])),[join(root,'a.jsonl')]);
});

test('escopo_skill: dot-dir global sob HOME = user; checkout = project', () => {
  const home = join('C:', 'Users', 'u');
  assert.equal(escopo_skill(join(home, '.claude', 'skills', 'x', 'SKILL.md'), home), 'user');
  assert.equal(escopo_skill(join(home, '.codex', 'skills', 'y', 'SKILL.md'), home), 'user');
  // checkout de projeto SOB o home, mas não num dot-dir global de topo → project
  assert.equal(escopo_skill(join(home, 'Projetos', 'foo', '.claude', 'skills', 'x', 'SKILL.md'), home), 'project');
  // fora do home → project
  assert.equal(escopo_skill(join('D:', 'work', 'repo', '.codex', 'skills', 'y', 'SKILL.md'), home), 'project');
});

test('escanear_project_roots: cria projetos sem sessão e detecta AGENTS.md', () => {
  const root = mkdtempSync(join(tmpdir(), 'acc-roots-'));
  mkdirSync(join(root, 'com-agents')); writeFileSync(join(root, 'com-agents', 'AGENTS.md'), '# x');
  mkdirSync(join(root, 'sem-agents'));
  mkdirSync(join(root, 'node_modules')); // deve ser ignorado
  const db = abrir_banco(':memory:');
  executar_scan(db, { session_paths: { codex: [], claude: [] }, skill_paths: { codex: [], claude: [], shared: [] }, agent_paths: [], hook_paths: [], project_roots: [root] });
  const rows = db.prepare('SELECT name, agents_md FROM projects ORDER BY name').all();
  const nomes = rows.map((r) => r.name);
  assert.ok(nomes.includes('com-agents') && nomes.includes('sem-agents'));
  assert.ok(!nomes.includes('node_modules'));
  assert.equal(rows.find((r) => r.name === 'com-agents').agents_md, 1);
  assert.equal(rows.find((r) => r.name === 'sem-agents').agents_md, 0);
  db.close();
});

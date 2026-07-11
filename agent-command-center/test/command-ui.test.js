import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.ACC_DATA = mkdtempSync(join(tmpdir(), 'acc-cmd-'));
const { comando_ui } = await import('../src/server.js');

test('comando_ui: navegações não-sessão emitem filters (contrato único)', () => {
  const skills = comando_ui('skill sobre funding');
  assert.equal(skills.page, 'skills');
  assert.equal(skills.filters.q, 'funding');
  assert.equal(skills.query, undefined); // não usa mais o campo antigo

  const proj = comando_ui('projetos sem agents.md');
  assert.equal(proj.page, 'projects');
  assert.equal(proj.filters.missing_agents, true);

  const hooks = comando_ui('hook perigoso');
  assert.equal(hooks.page, 'hooks');
  assert.equal(hooks.filters.template, 'bash');
  assert.equal(hooks.template, undefined);
});

test('comando_ui: fallback de busca em sessões', () => {
  const r = comando_ui('qualquer coisa');
  assert.equal(r.action, 'search');
  assert.equal(r.page, 'sessions');
  assert.equal(r.query, 'qualquer coisa');
});

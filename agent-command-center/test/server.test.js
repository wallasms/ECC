import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir_banco } from '../src/db.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(AQUI, '..', 'src', 'server.js');
const PORT = 4873;
const BASE = `http://127.0.0.1:${PORT}`;

function semear(dir) {
  const db = abrir_banco(join(dir, 'agent-command-center.sqlite'));
  const agora = new Date().toISOString();
  db.prepare('INSERT INTO projects(path,name,agents_md,claude_md,updated_at) VALUES(?,?,?,?,?)').run('/proj/x', 'ProjX', 1, 1, agora);
  const pid = db.prepare('SELECT id FROM projects WHERE path=?').get('/proj/x').id;
  const ins = db.prepare(`INSERT INTO sessions(id,source,source_path,project_id,title,status,model,effort,created_at,updated_at,tokens,cost,snippet,source_mtime,source_size)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  ins.run('s-a', 'claude', '/p/a.jsonl', pid, 'Alpha', 'completed', 'm', null, agora, '2026-01-03T00:00:00Z', 100, 1.5, 'snippet a', 1, 10);
  ins.run('s-b', 'codex', '/p/b.jsonl', pid, 'Beta', 'failed', 'm', null, agora, '2026-01-02T00:00:00Z', 200, 2.5, 'snippet b', 2, 20);
  ins.run('s-c', 'claude', '/p/c.jsonl', pid, 'Gamma', 'working', 'm', null, agora, '2026-01-01T00:00:00Z', 0, 0, 'snippet c', 3, 30);
  // termo que só existe no corpo do evento, não em título/snippet — valida busca em eventos
  db.prepare('INSERT INTO session_events(session_id,position,timestamp,kind,role,summary,raw_json) VALUES(?,?,?,?,?,?,?)')
    .run('s-c', 0, agora, 'message', 'assistant', 'contexto com zebraunica dentro do evento', null);
  db.close();
}

async function esperar_saude() {
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Servidor não respondeu /api/health a tempo');
}

test('contratos /api/* (sort, busca em eventos, custo, scan full)', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acc-test-'));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({
    session_paths: { codex: [], claude: [] }, skill_paths: { codex: [], claude: [], shared: [] },
    agent_paths: [], hook_paths: [], project_roots: [], scan_on_start: false
  }));
  semear(dir);
  const proc = spawn(process.execPath, [SERVER], { env: { ...process.env, ACC_DATA: dir, ACC_PORT: String(PORT) }, stdio: 'ignore' });
  t.after(async () => {
    proc.kill();
    await new Promise((r) => { proc.on('exit', r); setTimeout(r, 2000); });
    // Windows só libera o handle do SQLite após o processo sair; remoção best-effort.
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }); } catch { /* lixo em tmp é tolerável */ }
  });
  await esperar_saude();
  const get = async (qs) => (await fetch(`${BASE}/api/sessions${qs}`)).json();

  const asc = await get('?sort=title&dir=asc');
  assert.deepEqual(asc.map((s) => s.title), ['Alpha', 'Beta', 'Gamma']);

  const desc = await get('?sort=title&dir=desc');
  assert.deepEqual(desc.map((s) => s.title), ['Gamma', 'Beta', 'Alpha']);

  // coluna fora da whitelist não quebra nem injeta: cai no default e retorna as 3
  const malicioso = await get('?sort=title);DROP TABLE sessions;--');
  assert.equal(malicioso.length, 3);

  // busca casa o termo que só aparece no corpo do evento
  const busca = await get('?q=zebraunica');
  assert.deepEqual(busca.map((s) => s.id), ['s-c']);

  const dash = await (await fetch(`${BASE}/api/dashboard`)).json();
  assert.equal(dash.stats.tokens, 300);
  assert.equal(dash.stats.cost, 4);
  assert.equal(dash.stats.failed, 1);
  assert.equal(dash.projects[0].tokens, 300);

  const scan = await (await fetch(`${BASE}/api/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full: true }) })).json();
  assert.ok(Number.isInteger(scan.run_id) && 'indexados' in scan && 'erros' in scan);
  // scan de paths vazios não apaga as sessões semeadas
  assert.equal((await get('')).length, 3);

  // SSE: id inexistente → 404
  const semStream = await fetch(`${BASE}/api/sessions/nao-existe/stream`);
  assert.equal(semStream.status, 404);
  await semStream.body?.cancel();

  // SSE: sessão real → text/event-stream + primeiro data: (source_path não existe → missing:true)
  const ctrl = new AbortController();
  const stream = await fetch(`${BASE}/api/sessions/s-c/stream`, { signal: ctrl.signal });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  const chunk = await stream.body.getReader().read();
  assert.match(Buffer.from(chunk.value).toString('utf8'), /data:/);
  ctrl.abort();
});

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

// Seeda uma sessão Claude com .jsonl real e timestamps recentes → bloco 5h ativo.
function semear_usage(dir, jsonlPath) {
  const db = abrir_banco(join(dir, 'agent-command-center.sqlite'));
  const agora = new Date().toISOString();
  const msg = (ts) => ({ type:'assistant', timestamp:ts, message:{ role:'assistant', model:'claude-sonnet-5',
    usage:{ input_tokens:1000, output_tokens:500, cache_read_input_tokens:2000, cache_creation_input_tokens:100 } } });
  const t1 = new Date(Date.now() - 10 * 60_000).toISOString();
  const t2 = new Date(Date.now() - 5 * 60_000).toISOString();
  writeFileSync(jsonlPath, [msg(t1), msg(t2)].map(JSON.stringify).join('\n'));
  db.prepare(`INSERT INTO sessions(id,source,source_path,project_id,title,status,model,effort,created_at,updated_at,tokens,cost,snippet,source_mtime,source_size)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('s-live', 'claude', jsonlPath, null, 'Live', 'working', 'claude-sonnet-5', null, agora, agora, 7200, 0.023, 'snippet', 1, 10);
  db.close();
}

test('/api/usage com bloco ativo (jsonl real semeado)', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acc-usage-'));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({
    session_paths: { codex: [], claude: [] }, skill_paths: { codex: [], claude: [], shared: [] },
    agent_paths: [], hook_paths: [], project_roots: [], scan_on_start: false
  }));
  semear_usage(dir, join(dir, 'live.jsonl'));
  const port = PORT + 1;
  const proc = spawn(process.execPath, [SERVER], { env: { ...process.env, ACC_DATA: dir, ACC_PORT: String(port) }, stdio: 'ignore' });
  t.after(async () => {
    proc.kill();
    await new Promise((r) => { proc.on('exit', r); setTimeout(r, 2000); });
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }); } catch { /* lixo em tmp é tolerável */ }
  });
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 100)); }

  const u = await (await fetch(`http://127.0.0.1:${port}/api/usage`)).json();
  assert.ok(u.block, 'bloco ativo existe');
  assert.equal(u.block.tokens, 7200);           // (1000+500+2000+100) * 2
  assert.ok(u.block.cost > 0, 'custo estimado > 0 (sonnet tem rate)');
  assert.ok(u.block.remaining_s > 0 && u.block.remaining_s <= 5 * 3600, 'remaining_s dentro da janela de 5h');
  assert.ok(u.block.burn_rate_hr > 0);
  assert.equal(u.spark.length, 24);
  assert.ok(Array.isArray(u.history));
  assert.equal(u.rates_known['claude-sonnet-5'], true);
});

test('/api/usage sem atividade recente → block:null (não fabrica)', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'acc-usage-vazio-'));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({
    session_paths: { codex: [], claude: [] }, skill_paths: { codex: [], claude: [], shared: [] },
    agent_paths: [], hook_paths: [], project_roots: [], scan_on_start: false
  }));
  const db = abrir_banco(join(dir, 'agent-command-center.sqlite'));
  // sessão Claude antiga (fora da janela de 6h) → série vazia → sem bloco.
  db.prepare(`INSERT INTO sessions(id,source,source_path,project_id,title,status,model,effort,created_at,updated_at,tokens,cost,snippet,source_mtime,source_size)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('s-old', 'claude', '/p/old.jsonl', null, 'Old', 'completed', 'm', null, '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z', 100, 1, 'x', 1, 10);
  db.close();
  const port = PORT + 2;
  const proc = spawn(process.execPath, [SERVER], { env: { ...process.env, ACC_DATA: dir, ACC_PORT: String(port) }, stdio: 'ignore' });
  t.after(async () => {
    proc.kill();
    await new Promise((r) => { proc.on('exit', r); setTimeout(r, 2000); });
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }); } catch { /* lixo em tmp é tolerável */ }
  });
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 100)); }

  const u = await (await fetch(`http://127.0.0.1:${port}/api/usage`)).json();
  assert.equal(u.block, null);
  assert.equal(u.pct_consumed, null);
  assert.ok(Array.isArray(u.spark) && u.spark.length === 24);
});

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

  // Prompt Queue CRUD
  const pj = (m, u, b) => fetch(`${BASE}${u}`, { method: m, headers: { 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) });
  const pid = (await (await pj('POST', '/api/prompts', { title: 'P1', priority: 'high' })).json()).id;
  assert.ok(Number.isInteger(pid));
  const upd = await pj('PUT', `/api/prompts/${pid}`, { status: 'queued' });
  assert.equal(upd.status, 200);
  assert.equal((await upd.json()).status, 'queued');
  assert.equal((await pj('PUT', `/api/prompts/${pid}`, { status: 'bogus' })).status, 400);       // enum inválido
  assert.equal((await pj('PUT', `/api/prompts/${pid}`, { priority: 'urgente' })).status, 400);    // prioridade inválida
  assert.equal((await pj('PUT', '/api/prompts/999999', { title: 'x' })).status, 404);             // id inexistente
  assert.equal((await pj('DELETE', `/api/prompts/${pid}`)).status, 200);
  assert.equal((await pj('DELETE', `/api/prompts/${pid}`)).status, 404);                          // já removido

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

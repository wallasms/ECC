import { createServer } from 'node:http';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir_banco } from './db.js';
import { executar_scan } from './scanner.js';
import { normalizar_evento } from './parsers.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.ACC_DATA || join(ROOT, 'data');
const SETTINGS_PATH = join(DATA, 'settings.json');
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.ACC_PORT || process.env.PORT || 4310);
const HOST = '127.0.0.1';

const default_settings = {
  session_paths: {
    codex: [join(homedir(), '.codex', 'sessions')],
    claude: [join(homedir(), '.claude', 'projects'), join(homedir(), '.claude', 'sessions')]
  },
  skill_paths: {
    codex: [join(homedir(), '.agents', 'skills'), join(homedir(), '.codex', 'skills')],
    claude: [join(homedir(), '.claude', 'skills')],
    shared: [join(dirname(ROOT), '.agents', 'skills')]
  },
  agent_paths: [join(homedir(), '.claude', 'agents'), join(ROOT, 'templates', 'claude', 'agents')],
  hook_paths: [join(homedir(), '.claude', 'settings.json'), join(dirname(ROOT), 'hooks', 'hooks.json')],
  project_roots: [dirname(ROOT)], scan_on_start: true
};

function carregar_settings() {
  mkdirSync(DATA, { recursive: true });
  if (!existsSync(SETTINGS_PATH)) writeFileSync(SETTINGS_PATH, JSON.stringify(default_settings, null, 2));
  try { return { ...default_settings, ...JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) }; }
  catch { return default_settings; }
}

let settings = carregar_settings();
const db = abrir_banco(join(DATA, 'agent-command-center.sqlite'));

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function corpo(req) {
  let bruto = '';
  for await (const trecho of req) {
    bruto += trecho;
    if (bruto.length > 1_000_000) throw new Error('Payload excede 1 MB');
  }
  return bruto ? JSON.parse(bruto) : {};
}

function sessao_publica(row) {
  if (!row) return null;
  return {
    ...row,
    tools: JSON.parse(row.tools_json || '[]'), files: JSON.parse(row.files_json || '[]'),
    warnings: JSON.parse(row.warnings_json || '[]'),
    tools_json: undefined, files_json: undefined, warnings_json: undefined
  };
}

function listar_sessoes(url) {
  const filtros = []; const valores = [];
  for (const [param, coluna] of [['source', 's.source'], ['status', 's.status'], ['model', 's.model']]) {
    if (url.searchParams.get(param)) { filtros.push(`${coluna}=?`); valores.push(url.searchParams.get(param)); }
  }
  if (url.searchParams.get('project')) { filtros.push('p.name=?'); valores.push(url.searchParams.get('project')); }
  if (url.searchParams.get('q')) {
    // ponytail: LIKE + EXISTS cobre busca em título/snippet/eventos na escala local (≤500 sessões).
    // Teto: se o volume de eventos crescer a ponto de o scan ficar lento, migrar para FTS5.
    filtros.push('(s.title LIKE ? OR s.snippet LIKE ? OR EXISTS(SELECT 1 FROM session_events e WHERE e.session_id=s.id AND e.summary LIKE ?))');
    const q = `%${url.searchParams.get('q')}%`; valores.push(q, q, q);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  // ponytail: whitelist de colunas ordenáveis; qualquer outro valor cai no default.
  const colunas = { updated_at: 's.updated_at', status: 's.status', project: 'p.name', title: 's.title', source: 's.source' };
  const ordem = colunas[url.searchParams.get('sort')] || 's.updated_at';
  const dir = url.searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';
  return db.prepare(`SELECT s.*,p.name project,p.path project_path FROM sessions s LEFT JOIN projects p ON p.id=s.project_id ${where} ORDER BY ${ordem} ${dir} LIMIT 500`).all(...valores).map(sessao_publica);
}

// Lê apenas os bytes novos do arquivo de sessão ao vivo (delta desde `from`).
// O offset sempre avança até uma quebra de linha, então uma linha parcial (agente
// escrevendo naquele instante) é relida no próximo poll. Redação vem de normalizar_evento.
function tail_sessao(id, from) {
  const row = db.prepare('SELECT source_path,status FROM sessions WHERE id=?').get(id);
  if (!row) return null;
  const arquivo = row.source_path;
  if (!existsSync(arquivo)) return { offset: 0, size: 0, status: row.status, missing: true, lines: [] };
  const size = statSync(arquivo).size;
  let start = Number(from) || 0;
  if (start > size) start = 0; // arquivo rotacionado/reescrito
  if (start >= size) return { offset: size, size, status: row.status, lines: [] };
  const CAP = 400_000; // primeira carga mostra só a cauda recente
  let capped = false;
  if (size - start > CAP) { start = size - CAP; capped = true; }
  const len = size - start;
  let buf = Buffer.alloc(len);
  const fd = openSync(arquivo, 'r');
  try { readSync(fd, buf, 0, len, start); } finally { closeSync(fd); }
  if (capped) { const f = buf.indexOf(10); if (f >= 0) { start += f + 1; buf = buf.subarray(f + 1); } } // descarta 1ª linha parcial
  let nl = -1;
  for (let i = buf.length - 1; i >= 0; i -= 1) { if (buf[i] === 10) { nl = i; break; } }
  if (nl < 0) return { offset: start, size, status: row.status, lines: [] };
  const trecho = buf.subarray(0, nl).toString('utf8');
  const offset = start + nl + 1;
  const lines = [];
  let pos = 0;
  for (const linha of trecho.split(/\r?\n/)) {
    if (!linha.trim()) { pos += 1; continue; }
    let reg; try { reg = JSON.parse(linha); } catch { pos += 1; continue; }
    const e = normalizar_evento(reg, pos); pos += 1;
    if (e.summary) lines.push({ timestamp: e.timestamp, kind: e.kind, role: e.role, summary: e.summary });
  }
  return { offset, size, status: row.status, lines };
}

function dashboard() {
  const stats = Object.fromEntries(db.prepare('SELECT status,COUNT(*) total FROM sessions GROUP BY status').all().map((r) => [r.status, r.total]));
  return {
    stats: { active: stats.working || 0, needs_input: stats.needs_input || 0, completed: stats.completed || 0, failed: stats.failed || 0,
      sessions: Object.values(stats).reduce((a, b) => a + b, 0),
      ...db.prepare('SELECT COALESCE(SUM(tokens),0) tokens,COALESCE(SUM(cost),0) cost FROM sessions').get() },
    recent: listar_sessoes(new URL('http://local')).slice(0, 12),
    attention: db.prepare(`SELECT id,source,title,status,updated_at FROM sessions WHERE status IN ('needs_input','failed') ORDER BY updated_at DESC LIMIT 10`).all(),
    projects: db.prepare(`SELECT p.name,COUNT(s.id) sessions,COALESCE(SUM(s.tokens),0) tokens,COALESCE(SUM(s.cost),0) cost
      FROM projects p JOIN sessions s ON s.project_id=p.id GROUP BY p.id HAVING tokens>0 OR cost>0 ORDER BY tokens DESC LIMIT 6`).all()
  };
}

function skills() {
  const existentes = db.prepare('SELECT * FROM skills ORDER BY name').all().map((s) => ({ ...s, triggers: JSON.parse(s.triggers_json), warnings: JSON.parse(s.warnings_json), triggers_json: undefined, warnings_json: undefined }));
  const nomes = new Set(existentes.map((s) => s.name));
  const candidatos = [
    ['alm-dashboard-review', 'Revisar hierarquia, DV01 e leitura para ALCO'], ['alco-slide-generation', 'Gerar slides ALCO reprodutíveis'],
    ['excel-python-automation', 'Migrar rotinas Excel para pipelines Python'], ['context-pack-generator', 'Montar contexto enxuto para agentes'],
    ['token-cost-optimizer', 'Reduzir contexto, logs e chamadas'], ['test-and-verify', 'Executar gates mínimos de qualidade'],
    ['commit-summary', 'Resumir alterações para commit'], ['pull-request-preparation', 'Preparar PR e checklist']
  ].filter(([nome]) => !nomes.has(nome)).map(([name, reason]) => ({ name, reason, score: 0.8 }));
  return { installed: existentes, recommendations: candidatos };
}

function comando_ui(texto) {
  const t = String(texto || '').toLowerCase();
  if (/falh|failed/.test(t)) return { action: 'navigate', page: 'sessions', filters: { status: 'failed', source: /codex/.test(t) ? 'codex' : undefined } };
  if (/aguard|input|atenção/.test(t)) return { action: 'navigate', page: 'sessions', filters: { status: 'needs_input' } };
  if (/skill/.test(t)) return { action: 'navigate', page: 'skills', query: t.replace(/.*(?:skill|related to|sobre)\s*/, '') };
  if (/projet.*agents\.md|missing agents/.test(t)) return { action: 'navigate', page: 'projects', filters: { missing_agents: true } };
  if (/hook/.test(t)) return { action: 'navigate', page: 'hooks', template: /danger|perigos/.test(t) ? 'block-dangerous-bash' : undefined };
  if (/sess/.test(t)) return { action: 'navigate', page: 'sessions', filters: { source: /claude/.test(t) ? 'claude' : /codex/.test(t) ? 'codex' : undefined } };
  return { action: 'search', page: 'sessions', query: texto, message: 'Busca aplicada às sessões locais.' };
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, host: HOST, database: 'sqlite', external_apis: false });
  if (req.method === 'GET' && url.pathname === '/api/dashboard') return json(res, 200, dashboard());
  if (req.method === 'GET' && url.pathname === '/api/sessions') return json(res, 200, listar_sessoes(url));
  if (req.method === 'GET' && /^\/api\/sessions\/.+\/tail$/.test(url.pathname)) {
    const partes = url.pathname.split('/');
    const out = tail_sessao(decodeURIComponent(partes[partes.length - 2]), url.searchParams.get('from'));
    if (!out) return json(res, 404, { error: 'Sessão não encontrada' });
    return json(res, 200, out);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/sessions/')) {
    const id = decodeURIComponent(url.pathname.split('/').at(-1));
    const session = sessao_publica(db.prepare('SELECT s.*,p.name project,p.path project_path FROM sessions s LEFT JOIN projects p ON p.id=s.project_id WHERE s.id=?').get(id));
    if (!session) return json(res, 404, { error: 'Sessão não encontrada' });
    session.events = db.prepare('SELECT position,timestamp,kind,role,summary FROM session_events WHERE session_id=? ORDER BY position').all(id);
    session.summary = `${session.source === 'codex' ? 'Codex' : 'Claude Code'} · ${session.status} · ${session.title}. ${session.events.length} eventos indexados.`;
    return json(res, 200, session);
  }
  if (req.method === 'POST' && url.pathname === '/api/scan') return json(res, 200, executar_scan(db, settings, (await corpo(req)).full === true));
  if (req.method === 'GET' && url.pathname === '/api/projects') return json(res, 200, db.prepare('SELECT p.*,COUNT(s.id) sessions,MAX(s.updated_at) last_activity FROM projects p LEFT JOIN sessions s ON s.project_id=p.id GROUP BY p.id ORDER BY last_activity DESC').all());
  if (req.method === 'GET' && url.pathname === '/api/skills') return json(res, 200, skills());
  if (req.method === 'GET' && url.pathname === '/api/hooks') return json(res, 200, db.prepare('SELECT * FROM hooks ORDER BY event').all());
  if (req.method === 'GET' && url.pathname === '/api/subagents') return json(res, 200, db.prepare('SELECT * FROM subagents ORDER BY name').all());
  if (req.method === 'GET' && url.pathname === '/api/prompts') return json(res, 200, db.prepare('SELECT * FROM prompts ORDER BY CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END,updated_at DESC').all());
  if (req.method === 'POST' && url.pathname === '/api/prompts') {
    const b = await corpo(req); if (!b.title) return json(res, 400, { error: 'Título é obrigatório' }); const agora = new Date().toISOString();
    const result = db.prepare('INSERT INTO prompts(title,body,target,project,priority,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(b.title, b.body || '', b.target || 'either', b.project || null, b.priority || 'medium', b.status || 'draft', agora, agora);
    return json(res, 201, { id: Number(result.lastInsertRowid) });
  }
  if (req.method === 'GET' && url.pathname === '/api/settings') return json(res, 200, settings);
  if (req.method === 'PUT' && url.pathname === '/api/settings') {
    const b = await corpo(req); settings = { ...settings, ...b }; writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2)); return json(res, 200, settings);
  }
  if (req.method === 'POST' && url.pathname === '/api/command') return json(res, 200, comando_ui((await corpo(req)).text));
  return json(res, 404, { error: 'Rota não encontrada' });
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const relativo = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const arquivo = resolve(PUBLIC, relativo);
    if (!arquivo.startsWith(PUBLIC) || !existsSync(arquivo)) return json(res, 404, { error: 'Arquivo não encontrado' });
    res.writeHead(200, { 'Content-Type': mime[extname(arquivo)] || 'application/octet-stream' }); res.end(readFileSync(arquivo));
  } catch (erro) { json(res, 500, { error: String(erro.message || erro) }); }
});

server.listen(PORT, HOST, () => {
  console.log(`Agent Command Center: http://${HOST}:${PORT}`);
  if (settings.scan_on_start) setTimeout(() => { try { console.log('Scan:', executar_scan(db, settings)); } catch (e) { console.error('Scan falhou:', e.message); } }, 50);
});

export { comando_ui, carregar_settings };

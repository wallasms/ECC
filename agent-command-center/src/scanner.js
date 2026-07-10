import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { analisar_jsonl, analisar_texto } from './parsers.js';

// Escopo de uma skill: 'user' se vive num dot-dir global sob o HOME do usuário
// (~/.claude, ~/.codex, ~/.agents), senão 'project'. Independe do cwd do servidor.
// Um checkout de projeto sob o HOME (ex.: ~/Projetos/foo/.claude/skills) NÃO casa,
// pois exigimos o dot-dir imediatamente após o HOME.
export function escopo_skill(arquivo, home) {
  const a = resolve(arquivo); const h = resolve(home);
  if (!a.startsWith(h + sep)) return 'project';
  const resto = a.slice(h.length + sep.length);
  const primeiro = resto.split(sep)[0];
  return ['.claude', '.codex', '.agents'].includes(primeiro) ? 'user' : 'project';
}

const MAX_ARQUIVO = 25 * 1024 * 1024;

// Custo estimado em USD. Modelo sem rate conhecido → null (NUNCA 0: 0 gravado
// polui o HAVING do dashboard e viola o "never fabricate data" do roadmap).
export function custo_estimado(sessao, rates) {
  if (!sessao.usage || !sessao.model) return null;
  const chave = Object.keys(rates).find((k) => sessao.model.startsWith(k));
  if (!chave) return null;
  const r = rates[chave]; const u = sessao.usage;
  return (u.input * (r.input || 0) + u.output * (r.output || 0)
    + u.cache_read * (r.cache_read || 0) + u.cache_write * (r.input || 0) * 1.25) / 1_000_000;
}

function arquivos_em(raiz, extensoes, limite = 3000) {
  if (!existsSync(raiz)) return [];
  const resultado = [];
  const pilha = [resolve(raiz)];
  while (pilha.length && resultado.length < limite) {
    const atual = pilha.pop();
    let entradas = [];
    try { entradas = readdirSync(atual, { withFileTypes: true }); } catch { continue; }
    for (const entrada of entradas) {
      const caminho = join(atual, entrada.name);
      if (entrada.isDirectory() && !['node_modules', '.git', 'cache', 'tmp'].includes(entrada.name)) pilha.push(caminho);
      else if (entrada.isFile() && extensoes.has(extname(entrada.name).toLowerCase())) resultado.push(caminho);
      if (resultado.length >= limite) break;
    }
  }
  return resultado;
}

function projeto(db, caminho) {
  if (!caminho) return null;
  const normalizado = resolve(caminho);
  const agora = new Date().toISOString();
  db.prepare(`INSERT INTO projects(path,name,agents_md,claude_md,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(path) DO UPDATE SET agents_md=excluded.agents_md,claude_md=excluded.claude_md,updated_at=excluded.updated_at`)
    .run(normalizado, basename(normalizado), Number(existsSync(join(normalizado, 'AGENTS.md'))), Number(existsSync(join(normalizado, 'CLAUDE.md'))), agora);
  return db.prepare('SELECT id FROM projects WHERE path=?').get(normalizado)?.id || null;
}

function salvar_sessao(db, sessao, stats) {
  // O mesmo sessionId pode aparecer em transcripts/subagentes distintos.
  // O caminho é a identidade estável e evita colisão sem expô-lo na UI.
  const id_bruto = sessao.id;
  sessao.id = `${sessao.source}:${id_bruto}:${createHash('sha1').update(sessao.source_path).digest('hex').slice(0, 10)}`;
  const anterior = db.prepare('SELECT id FROM sessions WHERE source_path=?').get(sessao.source_path);
  if (anterior && anterior.id !== sessao.id) db.prepare('DELETE FROM sessions WHERE id=?').run(anterior.id);
  const projeto_id = projeto(db, sessao.project_path);
  db.prepare(`INSERT INTO sessions(id,source,source_path,project_id,title,status,model,effort,created_at,updated_at,tokens,cost,snippet,tools_json,files_json,warnings_json,source_mtime,source_size)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_path) DO UPDATE SET
    id=excluded.id,project_id=excluded.project_id,title=excluded.title,status=excluded.status,model=excluded.model,effort=excluded.effort,
    created_at=excluded.created_at,updated_at=excluded.updated_at,tokens=excluded.tokens,cost=excluded.cost,snippet=excluded.snippet,
    tools_json=excluded.tools_json,files_json=excluded.files_json,warnings_json=excluded.warnings_json,source_mtime=excluded.source_mtime,source_size=excluded.source_size`)
    .run(sessao.id, sessao.source, sessao.source_path, projeto_id, sessao.title, sessao.status, sessao.model, sessao.effort,
      sessao.created_at, sessao.updated_at, sessao.tokens, sessao.cost, sessao.snippet, JSON.stringify(sessao.tools), JSON.stringify(sessao.files),
      JSON.stringify(sessao.warnings), stats.mtimeMs, stats.size);
  db.prepare('DELETE FROM session_events WHERE session_id=?').run(sessao.id);
  const inserir = db.prepare('INSERT OR REPLACE INTO session_events(session_id,position,timestamp,kind,role,summary) VALUES(?,?,?,?,?,?)');
  for (const evento of sessao.events) inserir.run(sessao.id, evento.position, evento.timestamp, evento.kind, evento.role, evento.summary);
}

function escanear_sessoes(db, settings, run_id, full) {
  let vistos = 0; let indexados = 0; let erros = 0;
  for (const [source, raizes] of Object.entries(settings.session_paths)) {
    for (const raiz of raizes) {
      for (const arquivo of arquivos_em(raiz, new Set(['.jsonl', '.log', '.txt']))) {
        vistos += 1;
        try {
          const stats = statSync(arquivo);
          if (stats.size > MAX_ARQUIVO) throw new Error('Arquivo excede o limite seguro de 25 MB');
          const atual = db.prepare('SELECT source_mtime,source_size FROM sessions WHERE source_path=?').get(arquivo);
          if (!full && atual?.source_mtime === stats.mtimeMs && atual?.source_size === stats.size) continue;
          const conteudo = readFileSync(arquivo, 'utf8');
          const sessao = extname(arquivo) === '.jsonl' ? analisar_jsonl(conteudo, arquivo, stats, source) : analisar_texto(conteudo, arquivo, stats, source);
          sessao.cost = custo_estimado(sessao, settings.model_rates || {});
          salvar_sessao(db, sessao, stats); indexados += 1;
        } catch (erro) {
          erros += 1;
          db.prepare('INSERT INTO warnings(scan_run_id,source_path,message,created_at) VALUES(?,?,?,?)')
            .run(run_id, arquivo, String(erro.message).slice(0, 500), new Date().toISOString());
        }
      }
    }
  }
  return { vistos, indexados, erros };
}

function ler_frontmatter(conteudo) {
  const bloco = conteudo.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!bloco) return {};
  return Object.fromEntries(bloco[1].split(/\r?\n/).map((linha) => linha.match(/^([\w-]+):\s*["']?(.*?)["']?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
}

function escanear_skills(db, settings) {
  const agora = new Date().toISOString();
  for (const [platform, raizes] of Object.entries(settings.skill_paths)) {
    for (const raiz of raizes) for (const arquivo of arquivos_em(raiz, new Set(['.md']))) {
      if (basename(arquivo).toLowerCase() !== 'skill.md') continue;
      try {
        const conteudo = readFileSync(arquivo, 'utf8'); const fm = ler_frontmatter(conteudo); const pasta = dirname(arquivo);
        const escopo = escopo_skill(arquivo, homedir());
        const avisos = [];
        if (!fm.description) avisos.push('Descrição ausente');
        if (conteudo.length > 20_000) avisos.push('Skill possivelmente ampla demais');
        const triggers = (fm.description || '').toLowerCase().match(/[a-zà-ú][a-zà-ú-]{4,}/g)?.slice(0, 8) || [];
        db.prepare(`INSERT INTO skills(name,platform,path,description,scope,triggers_json,has_scripts,has_references,has_assets,warnings_json,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET description=excluded.description,warnings_json=excluded.warnings_json,updated_at=excluded.updated_at`)
          .run(fm.name || basename(pasta), platform, arquivo, fm.description || '', escopo, JSON.stringify(triggers),
            Number(existsSync(join(pasta, 'scripts'))), Number(existsSync(join(pasta, 'references'))), Number(existsSync(join(pasta, 'assets'))), JSON.stringify(avisos), agora);
      } catch { /* Uma skill ilegível não bloqueia o scan. */ }
    }
  }
}

function escanear_hooks(db, settings) {
  for (const arquivo of settings.hook_paths) {
    if (!existsSync(arquivo) || extname(arquivo) !== '.json') continue;
    try {
      const json = JSON.parse(readFileSync(arquivo, 'utf8')); const hooks = json.hooks || {};
      for (const [evento, grupos] of Object.entries(hooks)) for (const grupo of grupos || []) {
        db.prepare(`INSERT OR IGNORE INTO hooks(platform,event,matcher,source_path,enabled,description) VALUES(?,?,?,?,?,?)`)
          .run('claude', evento, grupo.matcher || '*', arquivo, 1, grupo.description || 'Hook configurado');
      }
    } catch { /* Config inválida aparece como ausência, sem expor conteúdo. */ }
  }
}

function escanear_subagents(db, settings) {
  const agora = new Date().toISOString();
  for (const raiz of settings.agent_paths || []) for (const arquivo of arquivos_em(raiz, new Set(['.md']))) {
    try {
      const conteudo = readFileSync(arquivo, 'utf8'); const fm = ler_frontmatter(conteudo);
      db.prepare(`INSERT INTO subagents(name,platform,path,description,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(path) DO UPDATE SET description=excluded.description,updated_at=excluded.updated_at`)
        .run(fm.name || basename(arquivo, '.md'), arquivo.includes('.claude') || arquivo.includes('claude') ? 'claude' : 'shared', arquivo, fm.description || '', agora);
    } catch { /* Definição ilegível não interrompe as sessões. */ }
  }
}

// Cria/atualiza projects a partir de settings.project_roots, varrendo só os filhos
// imediatos de cada raiz (um nível = repos). Faz projetos sem sessão aparecerem.
function escanear_project_roots(db, settings) {
  for (const raiz of settings.project_roots || []) {
    if (!existsSync(raiz)) continue;
    let entradas = [];
    try { entradas = readdirSync(raiz, { withFileTypes: true }); } catch { continue; }
    for (const entrada of entradas) {
      if (!entrada.isDirectory()) continue;
      if (['node_modules', '.git', 'cache', 'tmp'].includes(entrada.name)) continue;
      projeto(db, join(raiz, entrada.name)); // upsert por path; reusa detecção AGENTS/CLAUDE.md
    }
  }
}

export function executar_scan(db, settings, full = false) {
  const inicio = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const run = db.prepare('INSERT INTO scan_runs(started_at) VALUES(?)').run(inicio);
    const resultado = escanear_sessoes(db, settings, run.lastInsertRowid, full);
    escanear_skills(db, settings); escanear_hooks(db, settings); escanear_subagents(db, settings); escanear_project_roots(db, settings);
    db.prepare('UPDATE scan_runs SET finished_at=?,files_seen=?,indexed=?,errors=? WHERE id=?')
      .run(new Date().toISOString(), resultado.vistos, resultado.indexados, resultado.erros, run.lastInsertRowid);
    db.exec('COMMIT');
    return { run_id: Number(run.lastInsertRowid), ...resultado };
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

export { arquivos_em };

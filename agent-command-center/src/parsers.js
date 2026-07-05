import { basename, dirname } from 'node:path';

const SEGREDO = /((?:api[_-]?key|token|secret|password|authorization)["'\s:=]+)([^\s,"'}]+)/gi;
const CHAVE = /\b(?:sk|ghp|github_pat|xox[baprs])[-_A-Za-z0-9]{12,}\b/g;

export function redigir(valor = '') {
  return String(valor).replace(SEGREDO, '$1[REDACTED]').replace(CHAVE, '[REDACTED]');
}

function texto(conteudo) {
  if (typeof conteudo === 'string') return conteudo;
  if (!Array.isArray(conteudo)) return '';
  return conteudo.map((item) => item?.text || item?.content || '').filter(Boolean).join('\n');
}

function titulo(texto_bruto, fallback) {
  const limpo = redigir(texto_bruto).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo || limpo.startsWith('# AGENTS.md')) return fallback;
  return limpo.slice(0, 140);
}

function status_por_eventos(eventos, atualizado_em) {
  const ultimos = eventos.slice(-20).map((e) => `${e.kind} ${e.summary}`.toLowerCase()).join(' ');
  if (/error|failed|exception|panic/.test(ultimos)) return 'failed';
  if (/waiting|needs input|approval|required user|ask user/.test(ultimos)) return 'needs_input';
  if (/task_complete|completed|turn_aborted/.test(ultimos)) return 'completed';
  if (Date.now() - Date.parse(atualizado_em) < 5 * 60_000) return 'working';
  return 'stale';
}

function normalizar_evento(registro, posicao) {
  const payload = registro?.payload || registro?.message || registro;
  const role = payload?.role || registro?.role || null;
  const kind = registro?.type || payload?.type || role || 'event';
  const content = texto(payload?.content) || payload?.message || payload?.text || payload?.name || '';
  const summary = redigir(content || JSON.stringify(payload)).replace(/\s+/g, ' ').slice(0, 600);
  return {
    position: posicao,
    timestamp: registro?.timestamp || payload?.timestamp || null,
    kind: String(kind), role, summary: summary || String(kind),
    raw: redigir(JSON.stringify(registro)).slice(0, 10_000)
  };
}

// ponytail: fonte estruturada de arquivos — tool_use (Claude: file_path/notebook_path) e
// apply_patch (Codex). Sem regex de prosa: escapes \n/\t colados não viram mais falso path.
// Teto: ops via shell_command (Codex) não são capturadas. Paths não passam por redigir()
// de propósito — CHAVE poderia mutilar um nome de arquivo legítimo.
function arquivos_de_tools(registros) {
  const out = new Set();
  for (const r of registros) {
    const content = r?.message?.content;
    if (Array.isArray(content)) for (const b of content) {
      if (b?.type === 'tool_use' && b.input) {
        const f = b.input.file_path ?? b.input.notebook_path;
        if (typeof f === 'string') out.add(f);
      }
    }
    const p = r?.payload || r;
    if (p?.name === 'apply_patch' && typeof p.input === 'string') {
      for (const m of p.input.matchAll(/\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)/g)) out.add(m[1].trim());
    }
  }
  return [...out].slice(0, 100);
}

export function analisar_jsonl(conteudo, arquivo, stats, origem_forcada) {
  const avisos = [];
  const registros = [];
  for (const [indice, linha] of conteudo.split(/\r?\n/).entries()) {
    if (!linha.trim()) continue;
    try { registros.push(JSON.parse(linha)); }
    catch { if (indice < conteudo.split(/\r?\n/).length - 2) avisos.push(`Linha ${indice + 1} inválida`); }
  }
  const meta_registro = registros.find((r) => r?.type === 'session_meta');
  const meta = meta_registro?.payload || {};
  const codex = origem_forcada === 'codex' || Boolean(meta_registro) || arquivo.includes('.codex');
  const origem = codex ? 'codex' : 'claude';
  const eventos = registros.map(normalizar_evento).filter((e) => e.summary);
  const mensagens_usuario = eventos.filter((e) => e.role === 'user' && !e.summary.includes('AGENTS.md instructions'));
  const primeiro = mensagens_usuario[0]?.summary || eventos[0]?.summary || '';
  const timestamps = eventos.map((e) => Date.parse(e.timestamp)).filter(Number.isFinite);
  const criado_em = meta.timestamp || (timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : stats.birthtime.toISOString());
  const atualizado_em = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : stats.mtime.toISOString();
  const project_path = meta.cwd || registros.find((r) => r?.cwd)?.cwd || (codex ? null : dirname(dirname(arquivo)));
  const tools = [...new Set(registros.flatMap((r) => {
    const p = r?.payload || r;
    return [p?.name, p?.tool_name, p?.type === 'function_call' ? p?.name : null].filter(Boolean);
  }))].slice(0, 50);
  const files = arquivos_de_tools(registros);
  const token_obj = registros.map((r) => r?.payload?.usage || r?.usage).find(Boolean) || {};
  return {
    id: meta.id || registros.find((r) => r?.sessionId)?.sessionId || basename(arquivo, '.jsonl'),
    source: origem, source_path: arquivo, project_path,
    title: titulo(primeiro, basename(arquivo, '.jsonl')),
    status: status_por_eventos(eventos, atualizado_em),
    model: registros.find((r) => r?.type === 'turn_context')?.payload?.model || meta.model || registros.find((r) => r?.model)?.model || null,
    effort: registros.find((r) => r?.payload?.effort)?.payload?.effort || null,
    created_at: criado_em, updated_at: atualizado_em,
    tokens: token_obj.total_tokens || token_obj.totalTokenCount || null, cost: null,
    snippet: titulo(eventos.at(-1)?.summary || primeiro, 'not detected'),
    tools, files, warnings: avisos, events: eventos.slice(-500)
  };
}

export function analisar_texto(conteudo, arquivo, stats, origem = 'unknown') {
  const linhas = redigir(conteudo).split(/\r?\n/).filter(Boolean).slice(0, 30);
  return {
    id: basename(arquivo), source: origem, source_path: arquivo, project_path: null,
    title: titulo(linhas[0], basename(arquivo)), status: 'unknown', model: null, effort: null,
    created_at: stats.birthtime.toISOString(), updated_at: stats.mtime.toISOString(),
    tokens: null, cost: null, snippet: titulo(linhas.slice(0, 3).join(' '), 'not detected'),
    tools: [], files: [], warnings: ['Formato não reconhecido; fallback textual aplicado'],
    events: [{ position: 0, timestamp: stats.mtime.toISOString(), kind: 'text', role: null, summary: linhas.join(' ').slice(0, 600), raw: null }]
  };
}

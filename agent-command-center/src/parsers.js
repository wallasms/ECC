import { basename, dirname } from 'node:path';

const SEGREDO = /((?:api[_-]?key|token|secret|password|authorization|bearer|client[_-]?secret|aws_secret_access_key|private[_-]?key)["'\s:=]+)([^\s,"'}]+)/gi;
// Cada alternativa é auto-contida (âncoras próprias) para não vazar o sufixo de
// comprimento entre elas — evita afrouxar a regra original sk/ghp e falso-positivar.
const CHAVE = new RegExp([
  /\b(?:sk|ghp|github_pat|xox[baprs])[-_A-Za-z0-9]{12,}\b/,          // OpenAI/GitHub/Slack (original)
  /\bxapp-\d-[A-Za-z0-9-]{10,}\b/,                                    // Slack app token
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,                 // Stripe
  /\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[A-Z0-9]{16}\b/,                    // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}\b/,                                        // Google API key
  /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/,                                    // Google OAuth secret
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ // JWT
].map((r) => r.source).join('|'), 'g');
// Bloco de chave privada PEM (multi-linha) — colapsa inteiro.
const PEM = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g;

export function redigir(valor = '') {
  return String(valor)
    .replace(PEM, '[REDACTED PRIVATE KEY]')
    .replace(SEGREDO, '$1[REDACTED]')
    .replace(CHAVE, '[REDACTED]');
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

// Tipos de registro que são puro ruído de plumbing (nunca conteúdo útil).
const RUIDO = new Set(['last-prompt', 'mode', 'permission-mode', 'file-history-snapshot',
  'ai-title', 'system', 'queue-operation', 'started', 'attachment', 'turn_context', 'session_meta']);

// Prefixa cada linha de um bloco com '+'/'-' para renderizar como diff. Cap p/ não estourar.
function linhas_diff(txt, sinal) {
  return String(txt).split(/\r?\n/).slice(0, 40).map((l) => sinal + l).join('\n');
}

// Um bloco de content do Claude -> linha legível de terminal.
function bloco_claude(b) {
  if (!b || typeof b !== 'object') return typeof b === 'string' ? b : '';
  switch (b.type) {
    case 'text': return b.text || '';
    case 'thinking': return ''; // criptografado/vazio
    case 'image': return '[imagem]';
    case 'tool_result': return texto(b.content) || (typeof b.content === 'string' ? b.content : '');
    case 'tool_use': {
      const i = b.input || {};
      const nome = b.name || 'tool';
      if ((nome === 'Edit' || nome === 'MultiEdit') && typeof i.old_string === 'string' && typeof i.new_string === 'string') {
        return `$ Edit ${i.file_path || ''}\n${linhas_diff(i.old_string, '-')}\n${linhas_diff(i.new_string, '+')}`;
      }
      if (nome === 'Write' && typeof i.content === 'string') return `$ Write ${i.file_path || ''}\n${linhas_diff(i.content, '+')}`;
      const alvo = i.command ?? i.file_path ?? i.notebook_path ?? i.pattern ?? i.url ?? i.path ?? i.query ?? i.description ?? '';
      return `$ ${nome}${alvo ? ` ${typeof alvo === 'string' ? alvo : JSON.stringify(alvo)}` : ''}`;
    }
    default: return '';
  }
}

// Extrai texto legível de um registro. NUNCA faz JSON.dump (evita vazar base64/
// conteúdo cifrado). Registros sem conteúdo útil retornam '' e são filtrados.
function extrair_conteudo(registro, payload, role) {
  const msg = registro?.message; // Claude: message.content (string ou blocos)
  if (msg && (Array.isArray(msg.content) || typeof msg.content === 'string')) {
    return typeof msg.content === 'string' ? msg.content : msg.content.map(bloco_claude).filter(Boolean).join('\n');
  }
  if (registro?.type === 'result' && typeof registro.result === 'string') return `↳ ${registro.result}`;
  if (registro?.type && RUIDO.has(registro.type)) return '';
  switch (payload?.type) { // Codex: payload.type
    case 'message': return role === 'developer' || role === 'system' ? '' : texto(payload.content);
    case 'user_message': case 'agent_message': return payload.message || '';
    case 'task_complete': return payload.last_agent_message || '';
    case 'turn_aborted': return `⛔ turn_aborted${payload.reason ? `: ${payload.reason}` : ''}`;
    case 'custom_tool_call': return `$ ${payload.name || 'tool'}${payload.input ? `\n${payload.input}` : ''}`;
    case 'function_call': {
      let args = payload.arguments; // string JSON — extrai o campo real p/ recuperar as quebras de linha do patch
      try { const o = JSON.parse(args); args = o.input ?? o.command ?? o.patch ?? o.code ?? o.file_path ?? JSON.stringify(o); } catch { /* mantém string bruta */ }
      return `$ ${payload.name || 'call'}${args ? `\n${args}` : ''}`;
    }
    case 'custom_tool_call_output': case 'function_call_output': {
      // output às vezes é string JSON {"output":"...","metadata":{"exit_code":N}} — desembrulha.
      let out = typeof payload.output === 'string' ? payload.output : texto(payload.output);
      let erro = false;
      try { const o = JSON.parse(out); if (typeof o.output === 'string') { erro = Number(o.metadata?.exit_code) > 0; out = o.output; } } catch { /* string simples */ }
      return (erro ? '⛔ ' : '') + out;
    }
    case 'patch_apply_end': return `$ apply_patch${payload.stdout ? `\n${payload.stdout}` : ''}${payload.stderr ? `\n${payload.stderr}` : ''}`;
    case 'web_search_end': return `🔍 ${payload.query || payload.action?.url || 'busca'}`;
    case 'mcp_tool_call_end': return `$ ${payload.invocation?.server || 'mcp'}.${payload.invocation?.tool || ''}`;
    case 'sub_agent_activity': return `↳ subagente ${payload.agent_path || ''} ${payload.kind || ''}`.trim();
    case 'image_generation_end': return '[imagem gerada]';
    default:
      // fallback seguro: só campos-texto conhecidos, nunca o objeto inteiro.
      return typeof payload?.message === 'string' ? payload.message : typeof payload?.text === 'string' ? payload.text : '';
  }
}

export function normalizar_evento(registro, posicao) {
  const payload = registro?.payload || registro?.message || registro;
  let role = payload?.role || registro?.role || (payload?.type === 'user_message' ? 'user' : null);
  let kind = registro?.type || payload?.type || role || 'event';
  // Preserva quebras de linha (código/output), colapsa só espaços horizontais.
  const bruto = redigir(extrair_conteudo(registro, payload, role)).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  // tool_result vem em registro role:user — sem isso a UI pinta output de Bash como prompt.
  const blocos = registro?.message?.content;
  if (Array.isArray(blocos) && blocos.some((b) => b?.type === 'tool_result')) {
    kind = blocos.some((b) => b?.type === 'tool_result' && b.is_error) ? 'stderr' : 'stdout';
    role = null;
  }
  // Codex: outputs de tool viram stdout/stderr (⛔ vem do exit_code>0 em extrair_conteudo).
  if (payload?.type === 'function_call_output' || payload?.type === 'custom_tool_call_output') {
    kind = bruto.startsWith('⛔') ? 'stderr' : 'stdout';
  }
  // Patches, diffs, comandos e outputs ganham mais espaço para mostrar o código; prosa fica enxuta.
  const limite = /(\*\*\* (Begin Patch|Update File|Add File|Delete File)|\n@@ |^\$ )/.test(bruto) || kind === 'stdout' || kind === 'stderr' ? 2200 : 600;
  const summary = bruto.slice(0, limite);
  return {
    position: posicao,
    timestamp: registro?.timestamp || payload?.timestamp || null,
    kind: String(kind), role, summary
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

// Extrai tokens com a semântica CERTA de cada agente:
// - Claude: usage vem em message.usage por mensagem assistant; campos disjuntos
//   (input NÃO inclui cache) → somar tudo entre as mensagens.
// - Codex: token_count.info.total_token_usage é CUMULATIVO → vale o ÚLTIMO;
//   e input_tokens JÁ INCLUI cached_input_tokens → normaliza p/ não-cacheado
//   para o cálculo de custo não cobrar o cache duas vezes.
function extrair_usage(registros) {
  let claude = null;
  for (const r of registros) {
    const u = r?.message?.usage;
    if (u && typeof u === 'object') {
      claude = claude || { input: 0, output: 0, cache_read: 0, cache_write: 0 };
      claude.input += u.input_tokens || 0;
      claude.output += u.output_tokens || 0;
      claude.cache_read += u.cache_read_input_tokens || 0;
      claude.cache_write += u.cache_creation_input_tokens || 0;
    }
  }
  if (claude) return { ...claude, total: claude.input + claude.output + claude.cache_read + claude.cache_write };
  const tc = [...registros].reverse().find((r) => r?.payload?.type === 'token_count' && r.payload.info?.total_token_usage);
  if (tc) {
    const u = tc.payload.info.total_token_usage;
    const cached = u.cached_input_tokens || 0;
    return { input: Math.max(0, (u.input_tokens || 0) - cached), output: u.output_tokens || 0, cache_read: cached, cache_write: 0, total: u.total_tokens || 0 };
  }
  const legado = registros.map((r) => r?.payload?.usage || r?.usage).find(Boolean);
  if (legado) return { input: 0, output: 0, cache_read: 0, cache_write: 0, total: legado.total_tokens || legado.totalTokenCount || 0 };
  return null;
}

// Série temporal de usage por mensagem — base para bloco 5h e burn rate.
// Claude-only por design: só as mensagens assistant do Claude trazem
// message.usage COM timestamp por mensagem. O token_count do Codex é cumulativo
// e sem timestamp confiável por delta, então fica fora do bloco (mesmo teto do
// claude-island original, que também só cobre Claude Code).
export function serie_de_usage(registros) {
  const serie = [];
  for (const r of registros) {
    const u = r?.message?.usage;
    if (!u || typeof u !== 'object' || !r.timestamp) continue;
    serie.push({
      ts: r.timestamp,
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cache_read: u.cache_read_input_tokens || 0,
      cache_write: u.cache_creation_input_tokens || 0,
      model: r.message.model || null
    });
  }
  return serie;
}

export function analisar_jsonl(conteudo, arquivo, stats, origem_forcada) {
  const avisos = [];
  const registros = [];
  const linhas = conteudo.split(/\r?\n/);
  for (const [indice, linha] of linhas.entries()) {
    if (!linha.trim()) continue;
    try { registros.push(JSON.parse(linha)); }
    catch { if (indice < linhas.length - 2) avisos.push(`Linha ${indice + 1} inválida`); }
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
  const usage = extrair_usage(registros);
  return {
    id: meta.id || registros.find((r) => r?.sessionId)?.sessionId || basename(arquivo, '.jsonl'),
    source: origem, source_path: arquivo, project_path,
    title: titulo(primeiro, basename(arquivo, '.jsonl')),
    status: status_por_eventos(eventos, atualizado_em),
    model: registros.find((r) => r?.type === 'turn_context')?.payload?.model || meta.model || registros.find((r) => r?.message?.model)?.message?.model || registros.find((r) => r?.model)?.model || null,
    effort: registros.find((r) => r?.payload?.effort)?.payload?.effort || null,
    created_at: criado_em, updated_at: atualizado_em,
    tokens: usage?.total || null, usage, cost: null,
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

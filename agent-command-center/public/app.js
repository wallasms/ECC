/* Agent Command Center — premium command center UI. See DESIGN.md for the contract.
   No build step: vanilla ES module. "Components" are pure render helpers (data -> HTML string). */

/* ---------- theme + liquid glass ---------- */
const setTheme = (t) => { document.documentElement.dataset.theme = t; try { localStorage.setItem('acc-theme', t); } catch {} };
setTheme((() => { try { return localStorage.getItem('acc-theme'); } catch { return null; } })() || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
const setGlass = (on) => { document.documentElement.dataset.glass = on ? 'on' : 'off'; try { localStorage.setItem('acc-glass', on ? 'on' : 'off'); } catch {} };
setGlass((() => { try { return localStorage.getItem('acc-glass'); } catch { return null; } })() !== 'off');

/* ---------- icon set (inline SVG, stroked) ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  studio: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
  sessions: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.3"/><circle cx="3.5" cy="12" r="1.3"/><circle cx="3.5" cy="18" r="1.3"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  skills: '<path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4Z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8Z"/>',
  hooks: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  agents: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3.2 3.2 0 0 1 0 4.8"/><path d="M17.2 20a5.5 5.5 0 0 0-3-4.9"/>',
  prompts: '<path d="M4 13h4l1.6 3h4.8L16 13h4"/><path d="M4 13 6 5h12l2 8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>',
  design: '<path d="M12 3a9 9 0 1 0 0 18c1.6 0 1.9-1.3 1.1-2.2-.8-1 .1-2.3 1.3-2.3H17a4 4 0 0 0 4-4c0-4.9-4-9.5-9-9.5Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="16.5" cy="11" r="1.1"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
  spark: '<path d="M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4Z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10l3 2-3 2M13 14h4"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 1-5.2 5.2L5 16l3 3 4.5-4.5a4 4 0 0 1 5.2-5.2l-2.6 2.6-2-2 2.6-2.6Z"/>',
  file: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/>',
  book: '<path d="M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z"/><path d="M9 4v14"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  expand: '<path d="M15 3h6v6M21 3l-8 8M9 21H3v-6M3 21l8-8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/><path d="M9 12l2 2 4-4"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4.5M8.5 13h.5M15 13h.5"/>',
  chevron: '<path d="M7 8l3.5 4L7 16M13 16h4"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/>',
  cmd: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z"/>',
  droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folderOpen: '<path d="M4 8V6a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2H6l-2 10a1 1 0 0 0 1 1h13l2-8H6"/>',
};
const ic = (n, c = '') => `<svg${c ? ` class="${c}"` : ''} width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const icf = (n) => `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- routing ---------- */
const nav = [
  ['Dashboard', 'dashboard', 'dashboard'], ['Ao Vivo', 'live', 'terminal'], ['Studio', 'studio', 'studio'], ['Sessions', 'sessions', 'sessions'],
  ['Projects', 'projects', 'projects'], ['Skills Finder', 'skills', 'skills'], ['Hooks', 'hooks', 'hooks'],
  ['Multiagents', 'agents', 'agents'], ['Prompt Queue', 'prompts', 'prompts'], ['Design System', 'design', 'design'],
  ['Settings', 'settings', 'settings'],
];
const ids = nav.map((n) => n[1]);
let page = 'dashboard'; let filters = {}; let gen = 0;
// Windowing manual da tabela de Sessões (>200 itens). row_h fixo em CSS (.vrows .row).
const VT = { data: [], row_h: 56, buffer: 10, container: null, cleanup: null };
function readHash() { const [p, qs] = location.hash.slice(1).split('?'); page = ids.includes(p) ? p : 'dashboard'; filters = Object.fromEntries(new URLSearchParams(qs || '')); }
function goto(p, f = {}) { const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(); const h = '#' + p + (qs ? '?' + qs : ''); if (h === location.hash) render(); else location.hash = h; }
readHash();

/* ---------- primitives ---------- */
const $ = (s) => document.querySelector(s);
const api = (url, options) => fetch(url, options).then(async (r) => { const b = await r.json(); if (!r.ok) throw Error(b.error); return b; });
const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const absfmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const rel = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
function relTime(v) { const d = (new Date(v) - Date.now()) / 1000; if (!isFinite(d)) return esc(v); const u = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]; for (const [n, s] of u) if (Math.abs(d) >= s) return rel.format(Math.round(d / s), n); return rel.format(Math.round(d), 'second'); }
const fmt = (v) => (v ? `<time datetime="${esc(v)}" title="${esc(absfmt.format(new Date(v)))}">${relTime(v)}</time>` : 'não detectado');
const usd = (v) => `US$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const saudacao = () => { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const STATUS_LABEL = { working: 'Trabalhando', needs_input: 'Precisa de input', completed: 'Concluída', failed: 'Falhou', stale: 'Inativa', unknown: 'Desconhecida' };

/* ---------- Toasts + status-flip detection ---------- */
function toast(msg, kind = 'info') {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast glass t-' + kind; // t- prefixo evita colisão com classes de status (.failed/.needs_input)
  el.innerHTML = `<span class="tdot t-${esc(kind)}"></span><span class="tmsg">${esc(msg)}</span><button class="tx" aria-label="Fechar">✕</button>`;
  host.appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  el.querySelector('.tx').onclick = kill;
  setTimeout(kill, 6000);
  return el;
}
const SEEN = {};
function notifyFlips(list) {
  for (const s of list || []) {
    const prev = SEEN[s.id];
    if (prev && prev !== s.status && (s.status === 'needs_input' || s.status === 'failed')) {
      toast(`${brand(s.source).label}: ${s.title.slice(0, 44)} → ${STATUS_LABEL[s.status]}`, s.status)
        .querySelector('.tmsg').onclick = () => detail(s.id);
    }
    SEEN[s.id] = s.status;
  }
}

/* ---------- AgentAvatar ---------- */
const SUBAGENT_ICON = [[/explor|search|compass/i, 'compass'], [/ui|polish|design|wand/i, 'spark'], [/review|shield|check/i, 'shield'], [/test|fix|wrench/i, 'tool'], [/alm|finance|chart|domain/i, 'chart'], [/skill|librar|book/i, 'book'], [/hook|safety|lock/i, 'lock']];
function brand(source) {
  if (source === 'codex') return { cls: 'codex', label: 'Codex', glyph: 'chevron' };
  if (source === 'claude') return { cls: 'claude', label: 'Claude Code', glyph: 'spark' };
  return { cls: 'unknown', label: 'Agente', glyph: 'bot' };
}
function agentAvatar(source, { size = 36, live = false, round = false, glyph } = {}) {
  const b = brand(source);
  const g = glyph || b.glyph;
  return `<span class="avatar ${b.cls}${round ? ' round' : ''}" data-size="${size}" role="img" aria-label="${esc(b.label)}">${icf(g)}${live ? '<span class="spark"></span>' : ''}</span>`;
}
function subAvatar(name) {
  const g = (SUBAGENT_ICON.find(([re]) => re.test(name)) || [, 'bot'])[1];
  return `<span class="avatar claude round" data-size="28" role="img" aria-label="${esc(name)}">${icf(g)}</span>`;
}

/* ---------- StatusPill ---------- */
const statusPill = (s) => `<span class="spill ${esc(s)}"><span class="dot"></span>${esc(STATUS_LABEL[s] || s)}</span>`;

/* ---------- TerminalPreview / LiveTerminalPanel ----------
   Honest reconstruction from the event index: raw stdout/stderr is not captured
   by the read-only scanner, so we surface the tools invoked (as command badges)
   and the latest recorded output, colored by status. Never fabricated. */
function termLines(s) {
  const lines = [];
  for (const t of (s.tools || []).slice(0, 4)) lines.push({ t: 'cmd', text: t });
  const evs = s.events || [];
  const outs = evs.filter((e) => e.kind === 'stdout' || e.kind === 'stderr');
  const outEv = outs.at(-1) || [...evs].reverse().find((e) => e.summary && e.role !== 'user') || evs.at(-1);
  const out = (outEv && outEv.summary) || s.snippet || '';
  if (out) {
    const cls = outEv?.kind === 'stderr' || s.status === 'failed' ? 'err' : s.status === 'completed' ? 'ok' : 'out';
    for (const l of String(out).split(/\r?\n/).slice(0, 5)) if (l.trim()) lines.push({ t: cls, text: l.slice(0, 200) });
  }
  return lines;
}
function terminalPreview(s, { tall = false, foot = true } = {}) {
  const b = brand(s.source);
  const lines = termLines(s);
  const body = lines.length
    ? lines.map((l, i) => `<div class="term-line ${l.t}"><span class="gutter">${l.t === 'cmd' ? '$' : String(i).padStart(2, '·').replace(/·/g, ' ')}</span><span>${esc(l.text)}</span></div>`).join('')
    : '<div class="term-empty">Nenhuma saída de terminal detectada ainda.</div>';
  return `<div class="term-panel">
    <div class="term-head"><span class="term-dots"><i></i><i></i><i></i></span>
      <span class="term-title">${ic('terminal')}<code>${esc(s.project || s.title || 'session')}</code></span>
      <span class="term-src"><span class="st ${esc(s.status)}"></span>${esc(b.label)}</span></div>
    <div class="term-body${tall ? ' tall' : ''}" data-copy="${esc(lines.map((l) => (l.t === 'cmd' ? '$ ' : '') + l.text).join('\n'))}">${body}</div>
    ${foot ? `<div class="term-foot"><button data-term-copy>${ic('copy')}Copiar saída</button><button data-session-open="${esc(s.id)}">${ic('expand')}Logs completos</button></div>` : ''}
  </div>`;
}

/* ---------- AgentCard / AgentCanvas ---------- */
function agentCard(s) {
  const b = brand(s.source);
  const meta = [s.model && `<span class="pill">${esc(s.model)}</span>`, s.effort && `<span class="pill accent">${esc(s.effort)}</span>`,
    s.tokens && `<span class="pill">${Number(s.tokens).toLocaleString('pt-BR')} tok</span>`].filter(Boolean).join('');
  return `<div class="agent-card glass-card" tabindex="0" role="button" data-session="${esc(s.id)}">
    <div class="ac-top">${agentAvatar(s.source, { size: 44, live: s.status === 'working' })}
      <div class="ac-id"><div class="name">${esc(b.label)}</div><div class="proj">${esc(s.project || 'sem projeto')}</div></div>
      ${statusPill(s.status)}</div>
    <div class="ac-title">${esc(s.title)}</div>
    ${meta ? `<div class="ac-meta">${meta}</div>` : ''}
    <div class="ac-foot"><span class="count-badge">${ic('file')}${(s.files || []).length} arquivos</span>
      <span class="count-badge">${ic('tool')}${(s.tools || []).length} tools</span>
      ${(s.warnings || []).length ? `<span class="count-badge warn">${ic('alert')}${s.warnings.length}</span>` : ''}
      <span style="margin-left:auto">${fmt(s.updated_at)}</span></div>
  </div>`;
}
const CLUSTERS = [
  ['working', 'Ativas', ['working']], ['needs_input', 'Precisam de input', ['needs_input']],
  ['completed', 'Concluídas', ['completed', 'stale']], ['failed', 'Falhas', ['failed', 'unknown']],
];
function agentCanvas(sessions) {
  const groups = CLUSTERS.map(([key, label, statuses]) => [key, label, sessions.filter((s) => statuses.includes(s.status))]).filter(([, , g]) => g.length);
  if (!groups.length) return emptyState('bot', 'Nenhuma sessão no canvas', 'Reescaneie para indexar sessões locais do Claude Code e Codex.');
  return `<div class="canvas">${groups.map(([key, label, g]) => `<div class="cluster rise">
    <div class="cluster-head"><span class="dot ${key}"></span>${esc(label)}<span class="count">${g.length}</span></div>
    <div class="cluster-body">${g.slice(0, 6).map(agentCard).join('')}</div></div>`).join('')}</div>`;
}

/* ---------- shell + empty ---------- */
function shell(title, subtitle, content, action = '') { return `<div class="topline"><div><h1>${title}</h1><div class="muted">${subtitle}</div></div>${action ? `<div class="actions">${action}</div>` : ''}</div>${content}`; }
const emptyState = (glyph, title, hint, cta = '') => `<div class="empty"><div class="glyph">${ic(glyph)}</div><b>${esc(title)}</b><p>${esc(hint)}</p>${cta ? `<div class="cta">${cta}</div>` : ''}</div>`;
const scanCta = `<button class="primary" data-scan-cta>${ic('scan')}Reescanear</button>`;
function animateCounts() {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count); if (!isFinite(target)) return;
    const dur = 650, t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('pt-BR'); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
// Skeleton que espelha o layout final de cada página (evita salto na troca).
function skeletonFor(p) {
  const bar = (c = '') => `<div class="skeleton ${c}"></div>`;
  const n = (k, c) => Array.from({ length: k }).map(() => bar(c)).join('');
  if (p === 'dashboard') return `${bar('hero')}<div class="sk-stats">${n(6, 'sk-box')}</div><div class="sk-wall">${n(3, 'sk-tall')}</div>${bar('tall')}`;
  if (p === 'live' || p === 'studio') return `${bar('sk-bar')}<div class="sk-wall">${n(6, 'sk-tall')}</div>`;
  if (['projects', 'skills', 'hooks', 'agents', 'prompts'].includes(p)) return `${bar('sk-bar')}<div class="sk-cards">${n(6, 'sk-card')}</div>`;
  if (p === 'design') return `<div class="sk-cards">${n(8, 'sk-card')}</div>`;
  return `${bar('sk-bar')}${bar('tall')}`; // sessions / settings
}

/* ---------- Sessions table ---------- */
function sessionRow(s) {
  const b = brand(s.source);
  return `<div class="row" tabindex="0" role="button" data-session="${esc(s.id)}">
    ${agentAvatar(s.source, { size: 28, live: s.status === 'working' })}
    <div style="min-width:0"><div class="title">${esc(s.title)}</div>
      <div class="sub"><code>${esc(s.snippet || 'não detectado')}</code></div></div>
    <div class="cell-agent">${statusPill(s.status)}</div>
    <div class="mono-badge">${esc(b.label)}</div>
    <div class="mono-badge">${esc(s.model || '—')}</div>
    <div class="mono-badge">${esc(s.project || 'não detectado')}</div>
    <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center">
      ${(s.files || []).length ? `<span class="count-badge" title="arquivos tocados">${ic('file')}${s.files.length}</span>` : ''}
      ${(s.warnings || []).length ? `<span class="count-badge warn" title="avisos">${ic('alert')}${s.warnings.length}</span>` : ''}
    </div>
    <div class="mono-badge" style="text-align:right">${fmt(s.updated_at)}</div></div>`;
}
function th(label, key) { const on = filters.sort === key || (!filters.sort && key === 'updated_at'); const arrow = on ? (filters.dir === 'asc' ? ' ↑' : ' ↓') : ''; return `<span class="sortable" data-sort="${key}"${key ? ' tabindex="0" role="button"' : ''}>${label}${arrow}</span>`; }
function tableHead() { return `<div class="row head">${th('', '')}${th('Sessão', 'title')}<span>Status</span>${th('Agente', 'source')}<span>Modelo</span>${th('Projeto', 'project')}<span></span>${th('Atividade', 'updated_at')}</div>`; }
function tabela(items, sortable) { return `<div class="surface">${sortable ? tableHead() : ''}${items.length ? items.map(sessionRow).join('') : emptyState('sessions', 'Nenhuma sessão', 'Ajuste os filtros ou reescaneie para indexar novas sessões.', scanCta)}</div>`; }
// Tabela janelada: só as linhas visíveis + buffer são renderizadas; spacers de altura fixa
// preservam a barra de scroll. tableHead fica FORA de #vrows (não é destruído no repaint).
const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
function tabelaVirtual(items) { VT.data = items; return `<div class="surface">${tableHead()}<div class="vrows" id="vrows" style="position:relative"></div></div>`; }
function paintWindow() {
  const c = VT.container; if (!c) return;
  const inicio = Math.max(0, Math.floor((window.scrollY - absTop(c)) / VT.row_h) - VT.buffer);
  const fim = Math.min(VT.data.length, inicio + Math.ceil(innerHeight / VT.row_h) + 2 * VT.buffer);
  c.innerHTML = `<div style="height:${inicio * VT.row_h}px"></div>${VT.data.slice(inicio, fim).map(sessionRow).join('')}<div style="height:${(VT.data.length - fim) * VT.row_h}px"></div>`;
}

/* ---------- Dashboard ---------- */
async function dashboard() {
  const d = await api('/api/dashboard');
  notifyFlips(d.recent);
  const scan = `<button class="ghost" id="scan-full" title="Reprocessa todos os arquivos, ignorando o cache de mtime">Reindexar tudo</button><button class="primary" id="scan">${ic('scan', 'inline-ic')}Reescanear</button>`;
  if (!d.stats.sessions) {
    return shell(saudacao(), 'Nenhuma sessão indexada ainda.', `<div class="apple-panel onboard rise"><p><b>Primeiro uso?</b> Confira os caminhos em <a href="#settings">Settings</a> e clique em Reescanear para indexar suas sessões locais do Claude Code e Codex.</p></div>`, scan);
  }
  const hero = `<div class="hero apple-panel rise"><div class="hero-mark">${icf('spark')}</div>
    <div><h1>${saudacao()}</h1><div class="muted">Seu estúdio local de agentes — Claude Code e Codex, indexados em 127.0.0.1.</div>
    <div class="sys"><span><span class="live-dot"></span>${d.stats.active} ativas agora</span>
      <span>${ic('lock')}Local e privado</span><span>${ic('clock')}Atualizado ${relTime(d.recent[0]?.updated_at || Date.now())}</span></div></div></div>`;
  const cards = [
    ['Ativas', d.stats.active, '--st-working', 'working', { status: 'working' }],
    ['Precisam de input', d.stats.needs_input, '--st-needs', 'chat', { status: 'needs_input' }],
    ['Concluídas', d.stats.completed, '--st-completed', 'check', { status: 'completed' }],
    ['Falhas', d.stats.failed, '--st-failed', 'alert', { status: 'failed' }],
    ['Tokens', d.stats.tokens.toLocaleString('pt-BR'), '--accent', 'chart', null],
    ['Custo est.', d.stats.cost ? usd(d.stats.cost) : 'não detectado', '--accent', 'droplet', null],
  ];
  const stats = `<div class="stats">${cards.map(([k, v, a, i, f]) => `<div class="stat${f ? ' clickable' : ''}"${a ? ` style="--stat-accent:var(${a})"` : ''}${f ? ` data-goto-sessions='${JSON.stringify(f)}' tabindex="0" role="button"` : ''}>
    <div class="stat-top">${ic(i)}<span class="lbl">${k}</span></div>${Number.isInteger(v) ? `<b data-count="${v}">0</b>` : `<b>${v}</b>`}</div>`).join('')}</div>`;
  const live = d.recent.filter((s) => s.status === 'working' || s.status === 'needs_input').slice(0, 3);
  const strip = live.length ? `<div class="section-head"><h2>Terminais ativos</h2><button class="link-btn" data-goto="live">Ver ao vivo →</button></div>
    <div class="term-strip">${live.map((s) => terminalPreview(s)).join('')}</div>` : '';
  const canvasPrev = `<div class="section-head"><h2>Agent Canvas</h2><button class="link-btn" data-goto="studio">Ver tudo →</button></div>${agentCanvas(d.recent)}`;
  const attention = `<section><h2>Precisa de atenção</h2><div class="surface attention">${d.attention.length
    ? d.attention.map((x) => `<div class="attention-item" tabindex="0" role="button" data-session="${esc(x.id)}">${agentAvatar(x.source, { size: 28 })}<div class="ai-body"><b>${esc(x.title)}</b><small>${fmt(x.updated_at)}</small></div>${statusPill(x.status)}</div>`).join('')
    : emptyState('check', 'Tudo tranquilo', 'Nenhuma sessão precisa de atenção agora.')}</div></section>`;
  const recent = `<section><h2>Sessões recentes</h2>${tabela(d.recent.slice(0, 8))}</section>`;
  const projects = d.projects.length ? `<h2>Consumo por projeto</h2><div class="surface">${d.projects.map((p) => `<div class="usage clickable" tabindex="0" role="button" data-project="${esc(p.name)}"><b>${esc(p.name)}</b><small>${p.sessions} sessões</small><span>${p.tokens.toLocaleString('pt-BR')} tokens</span><span>${p.cost ? usd(p.cost) : '—'}</span></div>`).join('')}</div>` : '';
  return shell(saudacao(), 'Atividade local dos seus agentes.', `${hero}${stats}${usagePanel()}${strip}${canvasPrev}<div class="grid">${recent}${attention}</div>${projects}`, scan);
}

/* ---------- Claude Island: pill de uso do bloco de 5h + painel ----------
   Fonte: GET /api/usage (Fase 1). Custo é sempre "estimado" (rates locais).
   Poll de 60s + tick local de 1s que decrementa o countdown e ACUMULA o custo
   entre polls (block.cost + burn_rate_hr × Δt), snapando no valor real a cada poll. */
const BLOCO_S = 5 * 3600; // bloco de 5h em segundos
const ISL_R = 52, ISL_C = 2 * Math.PI * ISL_R; // raio/circunferência do anel SVG
const MODEL_COLORS = ['--accent', '--st-working', '--st-needs', '--st-completed', '--st-failed', '--st-stale'];
const heatClass = (h) => (h < 0.6 ? 'ok' : h < 0.85 ? 'warn' : 'danger');
function fmtCountdown(s) { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; }
const tok = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR')); // null nunca vira 0
const custo = (v) => (v == null ? '—' : usd(v));

const ISLAND = {
  data: null, fetchedAt: 0, pollTimer: null, tickTimer: null,
  async fetch() { try { this.data = await api('/api/usage'); this.fetchedAt = Date.now(); } catch { /* mantém último dado; não zera */ } paintIsland(); },
  tick() {
    if (document.hidden) return; // aba oculta: pausa (padrão do Ao Vivo)
    const st = islandState();
    if (st && st.remaining <= 0 && Date.now() - this.fetchedAt > 2000) { this.fetch(); return; } // countdown zerou → refetch imediato
    paintIsland();
  },
  start() {
    this.fetch();
    this.pollTimer = setInterval(() => { if (!document.hidden) this.fetch(); }, 60000);
    this.tickTimer = setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.fetch(); }); // volta a ficar visível → snapa
  },
  stop() { clearInterval(this.pollTimer); clearInterval(this.tickTimer); },
};
// Estado derivado do último /api/usage + decorrido local. null = sem bloco ativo.
function islandState() {
  const u = ISLAND.data; if (!u || !u.block) return null;
  const b = u.block;
  const dt = (Date.now() - ISLAND.fetchedAt) / 1000; // segundos desde o último fetch
  const remaining = Math.max(0, b.remaining_s - dt);
  const cost = b.cost == null ? null : (b.burn_rate_hr ? b.cost + b.burn_rate_hr * (dt / 3600) : b.cost); // acúmulo contínuo
  const heat = u.pct_consumed != null ? u.pct_consumed : (BLOCO_S - remaining) / BLOCO_S; // fallback: fração decorrida do bloco
  return { b, u, remaining, cost, heat, pct: u.pct_consumed };
}
function islandPillHTML(st) {
  if (!ISLAND.data) return `<span class="isl-dot"></span><span class="isl-txt muted">uso…</span>`;
  if (!st) return `<span class="isl-dot"></span><span class="isl-txt">sem bloco ativo</span><span class="isl-cost muted"> · —</span>`;
  const pct = st.pct != null ? `<span class="isl-pct">${Math.round(st.pct * 100)}% · </span>` : '';
  return `<span class="isl-dot ${heatClass(st.heat)}"></span>${pct}<span class="isl-cost">${custo(st.cost)}</span><span class="isl-time"> · <span class="isl-lbl">reset em </span>${fmtCountdown(st.remaining)}</span>`;
}
// Atualiza a pill (sempre) e os elementos vivos do painel (se estiver montado no Dashboard).
function paintIsland() {
  const el = $('#island'); if (!el) return;
  const st = islandState();
  el.innerHTML = islandPillHTML(st);
  el.classList.remove('h-ok', 'h-warn', 'h-danger', 'h-none');
  el.classList.add(st ? 'h-' + heatClass(st.heat) : 'h-none');
  const ring = $('#isl-ring-time');
  if (ring && st) {
    ring.textContent = fmtCountdown(st.remaining);
    const fg = $('#isl-ring-fg');
    if (fg) { const f = Math.min(1, Math.max(0, (BLOCO_S - st.remaining) / BLOCO_S)); fg.style.strokeDashoffset = ISL_C * (1 - f); }
    const cs = $('#isl-cost-stat'); if (cs) cs.textContent = custo(st.cost);
  }
}
function usageSparkline(spark) {
  if (!spark || !spark.length) return '<div class="muted" style="font-size:11px">sem série de burn</div>';
  const w = 100, h = 28, bw = w / spark.length;
  const max = Math.max(...spark.map((s) => s.cost).filter((c) => c != null), 0) || 1;
  const bars = spark.map((s, i) => { // null = gap (não plota como 0)
    if (s.cost == null) return '';
    const bh = (s.cost / max) * h;
    return `<rect x="${(i * bw).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${bh.toFixed(1)}" rx="0.5" class="spk-bar"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="isl-spark" preserveAspectRatio="none" aria-label="Burn das últimas 2h">${bars}</svg>`;
}
function usageHistory(history) {
  if (!history || !history.length) return '<div class="muted" style="font-size:11px">sem histórico</div>';
  const byDay = {};
  for (const r of history) (byDay[r.dia] = byDay[r.dia] || []).push(r);
  const dias = Object.keys(byDay).sort().slice(-14);
  const models = [...new Set(history.map((r) => r.model))];
  const colorFor = (m) => `var(${MODEL_COLORS[Math.max(0, models.indexOf(m)) % MODEL_COLORS.length]})`;
  const totalDia = (d) => byDay[d].reduce((a, r) => a + (r.tokens || 0), 0);
  const maxTok = Math.max(...dias.map(totalDia), 1);
  const W = 280, H = 84, bw = W / dias.length;
  const bars = dias.map((d, i) => {
    let y = H;
    return byDay[d].map((r) => { const hh = ((r.tokens || 0) / maxTok) * (H - 2); y -= hh; return `<rect x="${(i * bw + 2).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${hh.toFixed(1)}" fill="${colorFor(r.model)}" rx="1"><title>${esc(d)} · ${esc(r.model)} · ${tok(r.tokens)} tok</title></rect>`; }).join('');
  }).join('');
  const legend = models.map((m) => `<span class="isl-leg"><i style="background:${colorFor(m)}"></i>${esc(m)}</span>`).join('');
  return `<div class="isl-hist">
    <div class="isl-hist-ymax">${tok(maxTok)} tok</div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="isl-hbars">${bars}</svg>
    <div class="isl-hist-x"><span>${esc(dias[0] || '')}</span><span>${esc(dias.at(-1) || '')}</span></div>
    <div class="isl-legend">${legend}</div></div>`;
}
// Painel "Uso" no Dashboard. Renderiza do cache do ISLAND (evita 2º fetch); vazio → estado vazio, nunca charts zerados.
function usagePanel() {
  const u = ISLAND.data;
  const head = `<div class="section-head"><h2>Uso — bloco de 5h <span class="pill">estimado</span></h2></div>`;
  if (!u) return `<section id="usage-panel">${head}<div class="surface" style="padding:16px"><span class="muted">carregando…</span></div></section>`;
  if (!u.block) return `<section id="usage-panel">${head}${emptyState('clock', 'Nenhum bloco de uso ativo', 'Sessão ainda não iniciada — nenhuma atividade do Claude Code nas últimas 5h.')}</section>`;
  const st = islandState();
  const f = Math.min(1, Math.max(0, (BLOCO_S - st.remaining) / BLOCO_S));
  const hoje = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
  const totalHoje = (u.history || []).filter((r) => r.dia === hoje).reduce((a, r) => (r.cost == null ? a : (a || 0) + r.cost), null);
  const ring = `<svg viewBox="0 0 120 120" class="isl-ringsvg h-${heatClass(st.heat)}">
    <circle cx="60" cy="60" r="${ISL_R}" class="ring-bg"/>
    <circle cx="60" cy="60" r="${ISL_R}" id="isl-ring-fg" class="ring-fg" style="stroke-dasharray:${ISL_C.toFixed(1)};stroke-dashoffset:${(ISL_C * (1 - f)).toFixed(1)}"/>
    <text x="60" y="58" text-anchor="middle" class="ring-time" id="isl-ring-time">${fmtCountdown(st.remaining)}</text>
    <text x="60" y="76" text-anchor="middle" class="ring-sub">restante</text></svg>`;
  const stats = [
    ['Custo', `<b id="isl-cost-stat">${custo(st.cost)}</b>`],
    ['Tokens', `<b>${tok(st.b.tokens)}</b>`],
    ['$/h burn', `<b>${custo(st.b.burn_rate_hr)}</b>`],
    ['Projeção do bloco', `<b>${custo(st.b.projected)}</b>`],
    ['Total do dia', `<b>${custo(totalHoje)}</b>`],
  ].map(([k, v]) => `<div class="isl-stat"><span class="lbl">${k}</span>${v}</div>`).join('');
  return `<section id="usage-panel">${head}
    <div class="surface isl-body">
      <div class="isl-ringwrap">${ring}</div>
      <div class="isl-right">
        <div class="isl-stats">${stats}</div>
        <div class="isl-spark-wrap"><span class="isl-cap">Burn últimas 2h</span>${usageSparkline(u.spark)}</div>
        <div class="isl-hist-wrap"><span class="isl-cap">14 dias por modelo · tokens</span>${usageHistory(u.history)}</div>
      </div>
    </div>
    <p class="muted" style="font-size:11px;margin-top:6px">${ic('alert')} Custo estimado por rates locais (settings) — pode diferir da fatura. Só enxerga sessões dos caminhos escaneados.</p>
  </section>`;
}

/* ---------- Sessions ---------- */
async function sessions() {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  const data = await api('/api/sessions?' + qs);
  notifyFlips(data);
  const seg = (val, label, glyph) => `<button class="${(filters.source || '') === val ? 'on' : ''}" data-source="${val}">${glyph ? ic(glyph) : ''}${label}</button>`;
  const toolbar = `<div class="toolbar">
    <div class="segmented">${seg('', 'Todos')}${seg('claude', 'Claude', 'spark')}${seg('codex', 'Codex', 'chevron')}</div>
    <input class="search" id="search" placeholder="Buscar sessões, comandos, saída…" value="${esc(filters.q || '')}">
    <select id="status"><option value="">Todos os status</option>${['working', 'needs_input', 'completed', 'failed', 'stale', 'unknown'].map((x) => `<option value="${x}" ${filters.status === x ? 'selected' : ''}>${STATUS_LABEL[x]}</option>`).join('')}</select></div>`;
  const corpo = data.length > 200 ? tabelaVirtual(data) : tabela(data, true);
  return shell('Sessões', `${data.length} sessões indexadas localmente.`, `${toolbar}${corpo}`);
}

/* ---------- Studio ---------- */
async function studio() {
  const data = await api('/api/sessions?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v)));
  const live = data.filter((s) => s.status === 'working' || s.status === 'needs_input').slice(0, 4);
  const terminals = live.length ? `<h2>Terminais ao vivo</h2><div class="term-strip">${live.map((s) => terminalPreview(s)).join('')}</div>` : '';
  return shell('Studio', 'Orquestre seus agentes: canvas de sessões, terminais ao vivo e fila de prompts.',
    `${agentCanvas(data)}${terminals}<div class="section-head"><h2>Fila de prompts</h2><button class="link-btn" data-goto="prompts">Gerenciar →</button></div><div id="studio-queue" class="muted">carregando…</div>`);
}

/* ---------- Ao Vivo: real-time terminal wall ----------
   Tails the actual session .jsonl files as agents append to them, via
   /api/sessions/:id/tail?from=<offset>. Real data, redacted server-side. */
const LIVE = { timers: [], sources: [], paused: new Set(),
  stop() { this.timers.forEach(clearInterval); this.sources.forEach((e) => e.close()); this.timers = []; this.sources = []; this.paused.clear(); } };
let liveFilter = '';
function filterBody(body) {
  body.querySelectorAll('.term-line').forEach((el) => {
    const hit = !liveFilter || el.textContent.toLowerCase().includes(liveFilter);
    el.style.display = hit ? '' : 'none';
    el.classList.toggle('hit', !!liveFilter && hit);
  });
}
function applyLiveFilter() { document.querySelectorAll('.live-body').forEach(filterBody); }
function liveLineClass(e) {
  if (e.kind === 'stderr') return 'err';
  if (e.kind === 'stdout') return 'out';
  const h = `${e.kind} ${e.role || ''}`.toLowerCase();
  if (/error|fail|exception|panic|traceback/.test(h)) return 'err';
  if (/tool|function_call|apply_patch|patch|bash|shell|exec|command/.test(h)) return 'cmd';
  if (/user/.test(h)) return 'usr';
  if (/complete|done|finish/.test(h)) return 'ok';
  return 'out';
}
// Diff/patch detection — only colorize +/- when the event is actually a patch,
// so prose bullets starting with "-" don't turn red.
const isDiff = (s) => /(^|\n)(\*\*\* (Begin Patch|Add File|Update File|Delete File|End Patch)|@@ )/.test(s) || /^\$ (apply_patch|Edit|MultiEdit|Write)\b/.test(s);
function diffLineClass(l) {
  if (/^@@/.test(l)) return 'hunk';
  if (/^\*\*\* /.test(l)) return 'phdr';
  if (/^\+(?!\+\+)/.test(l)) return 'add';
  if (/^-(?!--)/.test(l)) return 'del';
  return '';
}
// Status ao vivo a partir das linhas transmitidas (espelha status_por_eventos do backend).
function liveStatus(texts) {
  const j = texts.join(' ').toLowerCase();
  if (/error|failed|exception|panic|traceback/.test(j)) return 'failed';
  if (/waiting|needs input|approval|required user|ask user|aguard/.test(j)) return 'needs_input';
  if (/task_complete|turn_aborted|conclu[ií]|completed/.test(j)) return 'completed';
  return 'working';
}
function liveTermShell(s) {
  const b = brand(s.source);
  return `<div class="term-panel live-term rise" data-live-id="${esc(s.id)}">
    <div class="term-head"><span class="term-dots"><i></i><i></i><i></i></span>
      <span class="term-title">${ic('terminal')}<code>${esc(s.project || s.title || s.id)}</code></span>
      <span class="term-src"><span class="st ${esc(s.status)}"></span>${esc(b.label)}${s.model ? ` · ${esc(s.model)}` : ''}</span>
      <button class="live-btn" data-live-pause title="Pausar/continuar">❚❚</button>
      <button class="live-btn" data-live-expand title="Expandir">⤢</button>
      <button class="live-btn" data-session-open="${esc(s.id)}" title="Abrir detalhes">${ic('expand')}</button></div>
    <div class="term-body live-body" data-offset="0"><div class="term-line out"><span class="gutter"> </span><span style="color:var(--term-dim)">conectando ao arquivo de sessão…</span></div></div>
    <button class="live-jump" data-live-jump>↓ novas linhas</button>
    <div class="live-caret"><span class="blink">▍</span>ao vivo · ${esc(b.label)}<span class="cfresh"></span></div></div>`;
}
async function livePage() {
  const data = await api('/api/sessions?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v)));
  const rank = { working: 0, needs_input: 1, stale: 2, unknown: 3, completed: 4, failed: 5 };
  const list = [...data].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (b.updated_at > a.updated_at ? 1 : -1)).slice(0, 6);
  liveFilter = '';
  const seg = (val, label, glyph) => `<button class="${(filters.source || '') === val ? 'on' : ''}" data-source="${val}">${glyph ? ic(glyph) : ''}${label}</button>`;
  const toolbar = `<div class="toolbar"><div class="segmented">${seg('', 'Todos')}${seg('claude', 'Claude', 'spark')}${seg('codex', 'Codex', 'chevron')}</div>
    <input class="search" id="live-filter" placeholder="Filtrar linhas ao vivo (grep)…" value="">
    <span class="muted" style="margin-left:4px">${ic('alert')} Lido direto dos arquivos de sessão — o fluxo mostra prompts, respostas, tools e edições conforme o agente escreve.</span></div>`;
  const wall = list.length ? `<div class="live-wall">${list.map(liveTermShell).join('')}</div>` : emptyState('terminal', 'Nenhuma sessão para acompanhar', 'Nenhuma sessão indexada ainda. Reescaneie no Dashboard para indexar sessões locais.');
  return shell('Ao Vivo', 'Saída dos terminais em tempo real — as telas descem conforme os agentes trabalham.', `${toolbar}${wall}`);
}
function startLive() {
  document.querySelectorAll('.live-term').forEach((panel) => {
    const id = panel.dataset.liveId; const body = panel.querySelector('.live-body');
    const caret = panel.querySelector('.cfresh');
    const dot = panel.querySelector('.term-src .st');
    const freshness = () => { const at = Number(body.dataset.lastAt || 0); if (!at || !caret) return; const s = Math.round((Date.now() - at) / 1000); caret.textContent = s < 3 ? ' · ativo agora' : ` · última linha há ${s}s`; };
    let cleared = false; let recent = [];
    // Aplica um delta (do SSE ou do poll) ao painel — idempotente por offset.
    const aplicar = (r) => {
      if (LIVE.paused.has(id) || document.hidden) return; // aba oculta/pausado: ignora barato
      body.dataset.offset = r.offset;
      if (r.missing && !cleared) { body.innerHTML = '<div class="term-line err"><span class="gutter">!</span><span>arquivo de sessão não encontrado</span></div>'; cleared = true; return; }
      if (r.lines.length) {
        if (!cleared) { body.innerHTML = ''; cleared = true; }
        appendLiveLines(body, r.lines);
        body.dataset.lastAt = Date.now();
        recent = recent.concat(r.lines.map((l) => l.summary)).slice(-25);
        const st = liveStatus(recent); // recomputa status ao vivo, sem esperar rescan
        if (dot && !dot.classList.contains(st)) dot.className = 'st ' + st;
      }
      freshness();
    };
    const iniciarPoll = () => {
      const poll = async () => {
        if (LIVE.paused.has(id) || document.hidden) return; // não consome CPU em aba oculta
        try { aplicar(await api(`/api/sessions/${encodeURIComponent(id)}/tail?from=${body.dataset.offset || 0}`)); }
        catch { /* mantém tentando no próximo tick */ }
      };
      poll();
      LIVE.timers.push(setInterval(poll, 1400));
    };
    // SSE primário; após 3 erros consecutivos cai para o poll de 1,4s (fallback intacto).
    if (window.EventSource) {
      let falhas = 0;
      const es = new EventSource(`/api/sessions/${encodeURIComponent(id)}/stream?from=${body.dataset.offset || 0}`);
      es.onmessage = (ev) => { falhas = 0; try { aplicar(JSON.parse(ev.data)); } catch { /* payload inválido, ignora */ } };
      es.onerror = () => { falhas += 1; if (falhas >= 3) { es.close(); LIVE.sources = LIVE.sources.filter((s) => s !== es); iniciarPoll(); } };
      LIVE.sources.push(es);
    } else { iniciarPoll(); }
    LIVE.timers.push(setInterval(freshness, 1000));
    body.addEventListener('scroll', () => { if (body.scrollHeight - body.scrollTop - body.clientHeight < 40) panel.classList.remove('has-new'); });
  });
  document.querySelectorAll('[data-live-pause]').forEach((b) => { b.onclick = () => { const p = b.closest('.live-term'); const id = p.dataset.liveId; if (LIVE.paused.has(id)) { LIVE.paused.delete(id); b.textContent = '❚❚'; p.classList.remove('paused'); } else { LIVE.paused.add(id); b.textContent = '▶'; p.classList.add('paused'); } }; });
  document.querySelectorAll('[data-live-expand]').forEach((b) => { b.onclick = () => b.closest('.live-term').classList.toggle('focus'); });
  document.querySelectorAll('[data-live-jump]').forEach((b) => { b.onclick = () => { const body = b.closest('.live-term').querySelector('.live-body'); body.scrollTop = body.scrollHeight; b.closest('.live-term').classList.remove('has-new'); }; });
  let fdeb; $('#live-filter')?.addEventListener('input', (e) => { clearTimeout(fdeb); const v = e.target.value.toLowerCase().trim(); fdeb = setTimeout(() => { liveFilter = v; applyLiveFilter(); }, 200); });
}
function appendLiveLines(body, lines) {
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 70;
  const html = lines.map((e) => {
    const base = liveLineClass(e);
    const diff = isDiff(e.summary);
    return String(e.summary).split(/\n/).map((s, i) => {
      const isCmd = /^\$ /.test(s);
      const dc = diff ? diffLineClass(s) : '';
      const cls = dc || (isCmd ? 'cmd' : i === 0 ? base : base === 'cmd' ? 'out' : base);
      const gutter = dc === 'add' ? '+' : dc === 'del' ? '-' : isCmd ? '$' : ' ';
      return `<div class="term-line ${cls} lnew"><span class="gutter">${gutter}</span><span>${esc(isCmd ? s.slice(2) : s)}</span></div>`;
    }).join('');
  }).join('');
  body.insertAdjacentHTML('beforeend', html);
  while (body.children.length > 500) body.removeChild(body.firstChild); // não guardar scroll infinito
  if (liveFilter) filterBody(body); // grep também nas linhas novas
  if (nearBottom) body.scrollTop = body.scrollHeight;
  else body.closest('.live-term')?.classList.add('has-new'); // usuário rolou p/ cima: avisa
}

/* ---------- generic card page ---------- */
async function cardPage(endpoint, title, subtitle, renderCard, action = '', filterFn = null, filterLabel = '') {
  const data = await api(endpoint);
  let items = Array.isArray(data) ? data : data.installed;
  const filtrando = filterFn && filterLabel;
  if (filtrando) items = items.filter((it) => filterFn(it, filters));
  const chip = filtrando ? `<div class="filter-chip"><span class="pill accent">${ic('search')}${esc(filterLabel)}</span><button class="link-btn" data-clear-filter>limpar</button></div>` : '';
  const recs = data.recommendations && !filtrando
    ? `<h2>Recomendações rule-based</h2><div class="cards">${data.recommendations.map((x) => `<div class="card rise"><div class="card-head"><h3><span class="card-icon">${ic('spark')}</span>${esc(x.name)}</h3><span class="score"><span class="bar"><i style="width:${Math.round((x.score || 0) * 100)}%"></i></span>${Math.round((x.score || 0) * 100)}</span></div><p>${esc(x.reason)}</p></div>`).join('')}</div>`
    : '';
  const vazio = filtrando ? emptyState('search', 'Nenhum resultado para o filtro', 'Nenhum item corresponde ao filtro ativo. Limpe o filtro para ver todos.') : emptyState('search', 'Nada detectado', `Nenhum item de ${title.toLowerCase()} foi encontrado nos caminhos configurados.`, scanCta);
  return shell(title, subtitle, `${chip}<div class="${items.length ? 'cards' : 'surface'}">${items.length ? items.map(renderCard).join('') : vazio}</div>${recs}`, action);
}
const SKILL_CAT = [[/ui|design|polish/i, 'UI / Design', 'design'], [/alm|finance|report|dashboard|dv01/i, 'ALM / Finance', 'chart'], [/review|pr|commit/i, 'Code Review', 'shield'], [/test|verify/i, 'Testing', 'check'], [/hook/i, 'Hooks', 'hooks'], [/prompt|context/i, 'Prompting', 'chat'], [/cost|token|optim/i, 'Cost', 'droplet'], [/session|parser|scan/i, 'Session Parsing', 'sessions']];
function skillCat(s) { const hay = `${s.name} ${s.description || ''}`; return SKILL_CAT.find(([re]) => re.test(hay)) || [, 'Skill', 'book']; }
function skillCard(x) {
  const [, cat, glyph] = skillCat(x);
  const plat = x.platform === 'shared' ? 'accent' : x.platform;
  return `<div class="card rise">
    <div class="card-head"><h3><span class="card-icon">${ic(glyph)}</span>${esc(x.name)}</h3><span class="pill ${plat}">${esc(x.platform)}</span></div>
    <p>${esc(x.description || 'Sem descrição')}</p>
    ${x.path ? `<p class="path">${esc(x.path)}</p>` : ''}
    <div>${(x.triggers || []).slice(0, 4).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}<span class="pill accent">${esc(cat)}</span>${(x.warnings || []).map((w) => `<span class="pill warning">${esc(w)}</span>`).join('')}</div>
    <div class="card-actions"><button class="link-btn" data-copy-path="${esc(x.path || '')}">Copiar caminho</button></div></div>`;
}
function riskLevel(h) { const s = `${h.event} ${h.matcher || ''} ${h.description || ''}`; if (/bash|exec|rm |danger|delete|write|deploy/i.test(s)) return 'high'; if (/edit|format|notify|post|pre/i.test(s)) return 'medium'; return 'low'; }
function hookCard(x) {
  const risk = riskLevel(x);
  return `<div class="card rise">
    <div class="card-head"><h3><span class="card-icon">${ic('hooks')}</span>${esc(x.event)}</h3><span class="pill ${x.platform === 'claude' ? 'claude' : x.platform === 'codex' ? 'codex' : ''}">${esc(x.platform)}</span></div>
    <p>${esc(x.description || 'Hook detectado (somente inspeção).')}</p>
    ${x.matcher ? `<p class="path">matcher: ${esc(x.matcher)}</p>` : ''}
    <div><span class="pill risk-${risk}">${ic('shield')}risco ${risk === 'high' ? 'alto' : risk === 'medium' ? 'médio' : 'baixo'}</span><span class="pill ${x.enabled ? 'accent' : ''}">${x.enabled ? 'ativo' : 'template'}</span></div>
    <div class="card-actions"><span class="muted" style="font-size:11px">${ic('lock')} Nunca ativado automaticamente — revise antes de instalar.</span></div></div>`;
}
function projectCard(x) {
  return `<div class="card clickable rise" tabindex="0" role="button" data-project="${esc(x.name)}">
    <div class="card-head"><h3><span class="card-icon">${ic('projects')}</span>${esc(x.name)}</h3></div>
    <p class="path">${esc(x.path)}</p>
    <div><span class="pill">${x.sessions} sessões</span>${x.last_activity ? `<span class="pill">${relTime(x.last_activity)}</span>` : ''}${!x.agents_md ? '<span class="pill warning">sem AGENTS.md</span>' : ''}${x.claude_md ? '<span class="pill accent">CLAUDE.md</span>' : ''}</div></div>`;
}
function subagentCard(x) {
  return `<div class="card rise"><div class="card-head"><h3>${subAvatar(x.name)}${esc(x.name)}</h3><span class="pill ${x.platform === 'claude' ? 'claude' : x.platform === 'codex' ? 'codex' : ''}">${esc(x.platform)}</span></div><p>${esc(x.description || 'Sem descrição')}</p></div>`;
}

/* ---------- Prompt queue ---------- */
const PROMPT_NEXT = { draft: 'queued', queued: 'done', done: 'queued' };
function promptCard(x) {
  const done = x.status === 'done';
  const nextLabel = done ? 'Reabrir' : x.status === 'queued' ? 'Concluir' : 'Enfileirar';
  const opt = (v, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${v}</option>`;
  return `<div class="card rise${done ? ' done' : ''}" data-id="${x.id}">
    <div class="card-head"><h3><span class="card-icon">${ic('prompts')}</span>${esc(x.title)}</h3><span class="pill ${x.priority === 'high' ? 'warning' : 'accent'}">${esc(x.priority)}</span></div>
    <p>${esc(x.body || 'Sem corpo')}</p>
    <div><span class="pill">${esc(x.target)}</span><span class="pill ${done ? '' : 'accent'}">${esc(x.status)}</span>${x.project ? `<span class="pill">${esc(x.project)}</span>` : ''}</div>
    <div class="card-actions"><button class="link-btn" data-act="adv" data-next="${PROMPT_NEXT[x.status] || 'queued'}">${nextLabel}</button><button class="link-btn" data-act="edit">Editar</button><button class="link-btn danger" data-act="del">Excluir</button></div>
    <form class="form edit-form" hidden data-editid="${x.id}"><input name="title" value="${esc(x.title)}" required><textarea name="body">${esc(x.body || '')}</textarea><div class="ds-row"><select name="target">${['either', 'codex', 'claude'].map((t) => opt(t, x.target)).join('')}</select><select name="priority">${['low', 'medium', 'high'].map((p) => opt(p, x.priority)).join('')}</select><button class="primary">Salvar</button></div></form>
  </div>`;
}
async function prompts() {
  const data = await api('/api/prompts');
  const form = `<form class="form" id="prompt-form"><label>Novo prompt</label><input name="title" placeholder="Título" required><textarea name="body" placeholder="Prompt"></textarea><div class="ds-row"><select name="target"><option value="either">Claude ou Codex</option><option value="codex">Codex</option><option value="claude">Claude Code</option></select><select name="priority"><option value="medium">Prioridade média</option><option value="high">Alta</option><option value="low">Baixa</option></select><button class="primary">Adicionar à fila</button></div></form>`;
  const queue = data.length ? `<div class="cards">${data.map(promptCard).join('')}</div>` : `<div class="surface">${emptyState('prompts', 'Fila vazia', 'Prompts adicionados aparecem aqui, prontos para enviar ao Codex ou Claude Code.')}</div>`;
  return shell('Prompt Queue', 'Prepare trabalho antes de enviar aos agentes.', `${form}<h2>Fila (${data.length})</h2><div id="queue">${queue}</div>`);
}

/* ---------- Settings ---------- */
async function settingsView() {
  const s = await api('/api/settings');
  const glassOn = document.documentElement.dataset.glass !== 'off';
  return shell('Settings', 'Caminhos configuráveis; o scanner permanece read-only.', `
    <div class="apple-panel rise" style="max-width:580px;margin-bottom:16px"><div class="ds-row" style="justify-content:space-between"><div><b>Liquid Glass</b><small>Superfícies de vidro Apple. Desligue para superfícies opacas.</small></div><button class="pill-btn" id="glass-toggle">${ic('droplet')}${glassOn ? 'Ativado' : 'Desativado'}</button></div></div>
    <form class="form" id="settings-form"><label>Codex sessions<small>Um caminho por linha</small></label><textarea name="codex">${esc(s.session_paths.codex.join('\n'))}</textarea><label>Claude sessions</label><textarea name="claude">${esc(s.session_paths.claude.join('\n'))}</textarea><button class="primary">Salvar</button></form>`);
}

/* ---------- Design System page ---------- */
function designSystem() {
  const colors = [['--accent', 'Accent'], ['--st-working', 'Success'], ['--st-needs', 'Warning'], ['--st-failed', 'Danger'], ['--st-completed', 'Info'], ['--bg', 'Background'], ['--surface', 'Surface'], ['--muted', 'Muted']];
  const demoSession = { id: 'demo', source: 'claude', status: 'working', title: 'ALM Dashboard UI Polish', project: 'agent-command-center', model: 'claude-opus-4-8', effort: 'high', tokens: 48211, files: ['SessionTimeline.tsx', 'styles.css'], tools: ['Edit', 'Bash', 'Read'], warnings: [], snippet: 'compiled successfully in 482ms', updated_at: new Date().toISOString(), events: [] };
  return shell('Design System', 'O contrato visual vivo — inspirado em open-design. Amostras reais dos componentes. <span class="pill accent">demo</span>', `
    <div class="ds-section"><h2>Cores</h2><div class="ds-swatches">${colors.map(([v, n]) => `<div class="ds-swatch"><div class="chip" style="background:var(${v})"></div><div class="info"><b>${n}</b><br><code>${v}</code></div></div>`).join('')}</div></div>
    <div class="ds-section"><h2>Tipografia</h2><div class="apple-panel ds-type"><div style="font-size:28px;font-weight:650;letter-spacing:-.03em">Display 28 / -.03em</div><div style="font-size:16px">Body 16 — SF Pro / system stack</div><div style="font-size:13px" class="muted">Secondary 13 muted</div><div style="font:12px ui-monospace,monospace" class="muted">Mono 12 — terminais e paths</div></div></div>
    <div class="ds-section"><h2>Raio & superfícies</h2><div class="ds-radius"><div class="r" style="border-radius:9px">9</div><div class="r" style="border-radius:12px">12</div><div class="r" style="border-radius:16px">16</div><div class="r" style="border-radius:20px">20</div></div></div>
    <div class="ds-section"><h2>Status</h2><div class="ds-row">${['working', 'needs_input', 'completed', 'failed', 'stale', 'unknown'].map(statusPill).join('')}</div></div>
    <div class="ds-section"><h2>Agent avatars</h2><div class="ds-row">${agentAvatar('claude', { size: 44, live: true })}${agentAvatar('codex', { size: 44 })}${agentAvatar('unknown', { size: 44 })}${['Explore Agent', 'UI Polish Agent', 'Code Review Agent', 'Test Fixer', 'ALM Domain', 'Skill Librarian', 'Hook Safety'].map(subAvatar).join('')}</div></div>
    <div class="ds-section"><h2>Glass surfaces</h2><div class="ds-row"><div class="glass-card" style="padding:18px;width:220px"><b>GlassCard</b><br><span class="muted">CSS backdrop-filter</span></div><div class="apple-panel" style="width:220px"><b>ApplePanel</b><br><span class="muted">superfície elevada</span></div></div></div>
    <div class="ds-section"><h2>Session card & terminal</h2><div class="ds-row" style="align-items:stretch"><div style="width:320px">${agentCard(demoSession)}</div><div style="flex:1;min-width:320px">${terminalPreview(demoSession, { foot: false })}</div></div></div>
    <div class="ds-section"><h2>Timeline</h2><div class="apple-panel"><div class="timeline">${[['user', 'Prompt do usuário'], ['assistant', 'Resposta do agente'], ['tool', 'Chamada de tool'], ['term', 'npm run dev'], ['complete', 'Concluído']].map(([k, t]) => timelineEvent({ kind: k, summary: t, timestamp: new Date().toISOString() })).join('')}</div></div></div>`);
}

/* ---------- Timeline event ---------- */
const EVENT_KIND = [[/^stderr\b/, 'k-error', 'terminal', 'stderr'], [/^stdout\b/, 'k-term', 'terminal', 'stdout'], [/error|fail|exception|panic/i, 'k-error', 'alert', 'Erro'], [/complete|done|abort|finish/i, 'k-complete', 'check', 'Concluído'], [/user|prompt/i, 'k-user', 'chat', 'Prompt'], [/bash|shell|exec|command|term/i, 'k-term', 'terminal', 'Terminal'], [/tool|function_call|apply_patch|patch/i, 'k-tool', 'tool', 'Tool'], [/hook/i, 'k-hook', 'hooks', 'Hook'], [/skill/i, 'k-skill', 'book', 'Skill'], [/subagent|agent/i, 'k-agent', 'agents', 'Subagente'], [/assistant|message|response/i, 'k-assistant', 'spark', 'Resposta']];
// Diff estruturado — parse por linha tipada, pareamento -/+ e realce por palavra.
const sbsOpen = new Set(); // índices de eventos do timeline em modo side-by-side
function parseDiff(summary) {
  return String(summary).split(/\n/).map((l) => {
    const dc = diffLineClass(l); // hunk/phdr/add/del já existe
    if (dc === 'add' || dc === 'del') return { t: dc, s: l.slice(1) };
    if (dc) return { t: dc, s: l }; // hunk/phdr mantêm o marcador
    if (/^\$ /.test(l)) return { t: 'cmd', s: l };
    return { t: 'ctx', s: l };
  });
}
// Casa runs contíguos de del com o run de add seguinte (vale p/ Edit e p/ hunk do apply_patch).
function parearDiff(linhas) {
  const par = new Array(linhas.length).fill(-1);
  let k = 0;
  while (k < linhas.length) {
    if (linhas[k].t === 'del') {
      const dels = []; while (k < linhas.length && linhas[k].t === 'del') dels.push(k++);
      const adds = []; while (k < linhas.length && linhas[k].t === 'add') adds.push(k++);
      for (let m = 0; m < Math.min(dels.length, adds.length); m++) { par[dels[m]] = adds[m]; par[adds[m]] = dels[m]; }
    } else k += 1;
  }
  return par;
}
// Realça só o miolo que difere. ponytail: prefixo/sufixo comum, não LCS — basta p/ edits típicos.
function marcarPar(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j += 1;
  if (i + j === 0) return null; // 100% diferentes: sem <mark> gigante inútil
  const wrap = (s) => `${esc(s.slice(0, i))}<mark>${esc(s.slice(i, s.length - j))}</mark>${esc(s.slice(s.length - j))}`;
  return [wrap(a), wrap(b)];
}
function marcarLado(ln, linhas, par) {
  const p = par[ln.idx];
  if (p < 0) return null;
  const m = ln.t === 'del' ? marcarPar(ln.s, linhas[p].s) : marcarPar(linhas[p].s, ln.s);
  if (!m) return null;
  return ln.t === 'del' ? m[0] : m[1];
}
// Segmenta por cabeçalho de hunk (@@ / *** File) p/ colapso nativo com <details>.
function agruparHunks(linhas) {
  const segs = []; let cur = { header: null, lines: [] };
  linhas.forEach((ln, idx) => {
    if (ln.t === 'hunk' || ln.t === 'phdr') { if (cur.header || cur.lines.length) segs.push(cur); cur = { header: ln, lines: [] }; }
    else cur.lines.push({ ...ln, idx });
  });
  if (cur.header || cur.lines.length) segs.push(cur);
  return segs;
}
function linhaUnified(ln, linhas, par) {
  const cls = ['add', 'del', 'cmd'].includes(ln.t) ? ln.t : '';
  const sign = ln.t === 'add' ? '+' : ln.t === 'del' ? '-' : '';
  const html = ((ln.t === 'add' || ln.t === 'del') && marcarLado(ln, linhas, par)) || esc(ln.s);
  return `<span class="dl${cls ? ' ' + cls : ''}">${sign}${html || ' '}</span>`;
}
function linhasSbs(lines, linhas, par) {
  const rows = [];
  for (const ln of lines) {
    if (ln.t === 'del') {
      const p = par[ln.idx];
      if (p >= 0) { const m = marcarPar(ln.s, linhas[p].s); const l = m ? m[0] : esc(ln.s), r = m ? m[1] : esc(linhas[p].s); rows.push(`<span class="dl del">-${l || ' '}</span><span class="dl add">+${r || ' '}</span>`); }
      else rows.push(`<span class="dl del">-${esc(ln.s) || ' '}</span><span class="dl empty"></span>`);
    } else if (ln.t === 'add') {
      if (par[ln.idx] >= 0) continue; // já renderizado ao lado do seu del
      rows.push(`<span class="dl empty"></span><span class="dl add">+${esc(ln.s) || ' '}</span>`);
    } else if (ln.t === 'cmd') rows.push(`<span class="dl cmd full">${esc(ln.s)}</span>`);
    else rows.push(`<span class="dl full">${esc(ln.s) || ' '}</span>`);
  }
  return rows.join('');
}
function renderDiff(summary, sbs) {
  const linhas = parseDiff(summary);
  const par = parearDiff(linhas);
  const gridCls = sbs ? 'diff diff-sbs' : 'diff';
  const bloco = (lines) => sbs ? linhasSbs(lines, linhas, par) : lines.map((ln) => linhaUnified(ln, linhas, par)).join('');
  const parts = agruparHunks(linhas).map((seg) => {
    if (!seg.header) return `<div class="${gridCls}">${bloco(seg.lines)}</div>`;
    const open = seg.lines.length > 25 ? '' : ' open'; // hunks longos nascem fechados
    return `<details${open}><summary>${esc(seg.header.s)}</summary><div class="${gridCls}">${bloco(seg.lines)}</div></details>`;
  });
  return `<div class="diff-wrap">${parts.join('')}</div>`;
}
function eventBody(summary, sbs) {
  if (!isDiff(summary)) return `<pre>${esc(summary)}</pre>`;
  return renderDiff(summary, !!sbs);
}
function timelineEvent(e, i) {
  const hay = `${e.kind} ${e.role || ''}`;
  const [, cls, glyph, label] = EVENT_KIND.find(([re]) => re.test(hay)) || [, 'k-event', 'chevron', e.kind];
  const toggle = isDiff(e.summary) ? `<button class="link-btn" data-diff-toggle="${i}">${sbsOpen.has(i) ? 'unificado' : 'lado a lado'}</button>` : '';
  return `<div class="event ${cls}" data-kind="${esc(e.kind)}" data-ev="${i}"><span class="ev-icon">${ic(glyph)}</span>
    <div class="ev-head"><b>${esc(label)}</b>${e.role ? `<span class="role">· ${esc(e.role)}</span>` : ''}${e.timestamp ? `<small>${fmt(e.timestamp)}</small>` : ''}${toggle}</div>
    <div class="ev-body">${eventBody(e.summary, sbsOpen.has(i))}</div></div>`;
}

/* ---------- render ---------- */
async function render(quiet) {
  const g = ++gen;
  LIVE.stop(); kbRow = -1;
  VT.cleanup?.(); VT.cleanup = null; VT.container = null; // remove scroll listener da render anterior
  const savedY = quiet && page === 'sessions' ? window.scrollY : null; // auto-refresh preserva posição
  document.querySelectorAll('.nav').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  if (!quiet) $('#app').innerHTML = skeletonFor(page);
  try {
    let html;
    if (page === 'dashboard') html = await dashboard();
    else if (page === 'live') html = await livePage();
    else if (page === 'studio') html = await studio();
    else if (page === 'sessions') html = await sessions();
    else if (page === 'projects') html = await cardPage('/api/projects', 'Projetos', 'Sessões agrupadas por repositório.', projectCard, '', filters.missing_agents ? (p) => !p.agents_md : null, filters.missing_agents ? 'sem AGENTS.md' : '');
    else if (page === 'skills') html = await cardPage('/api/skills', 'Skills Finder', 'Skills instaladas e lacunas detectadas — como um App Store de skills.', skillCard, '', filters.q ? (s, f) => `${s.name} ${s.description || ''}`.toLowerCase().includes(f.q.toLowerCase()) : null, filters.q ? `“${filters.q}”` : '');
    else if (page === 'hooks') html = await cardPage('/api/hooks', 'Hooks', 'Somente inspeção. Templates não são ativados automaticamente.', hookCard, '', (filters.q || filters.template) ? (h, f) => (!f.q || `${h.event} ${h.matcher || ''} ${h.description || ''}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.template || `${h.event} ${h.matcher || ''} ${h.description || ''} ${h.source_path || ''}`.toLowerCase().includes(f.template.toLowerCase())) : null, filters.template ? `template ${filters.template}` : filters.q ? `“${filters.q}”` : '');
    else if (page === 'agents') html = await cardPage('/api/subagents', 'Multiagents', 'Definições locais de subagentes.', subagentCard);
    else if (page === 'prompts') html = await prompts();
    else if (page === 'design') html = designSystem();
    else html = await settingsView();
    if (g !== gen) return;
    $('#app').innerHTML = html; bind();
    if (savedY != null) { window.scrollTo(0, savedY); if (VT.container) paintWindow(); } // repinta na posição restaurada
  } catch (e) {
    if (g !== gen) return;
    const offline = /fetch|network|load failed/i.test(e.message || '');
    const msg = offline ? 'Não foi possível falar com o servidor local. Verifique se ele está rodando em 127.0.0.1.' : e.message;
    $('#app').innerHTML = emptyState('alert', offline ? 'Sem conexão com o servidor' : 'Algo falhou', msg, '<button class="primary" id="retry">Tentar de novo</button>');
    $('#retry')?.addEventListener('click', () => render());
  }
}

/* ---------- bind ---------- */
function bind() {
  const key = (el) => { el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }; };
  document.querySelectorAll('[data-session]').forEach((r) => { if (r.closest('#vrows')) return; r.onclick = () => detail(r.dataset.session); key(r); });
  document.querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => goto(b.dataset.goto); });
  document.querySelectorAll('[data-goto-sessions]').forEach((b) => { b.onclick = () => goto('sessions', JSON.parse(b.dataset.gotoSessions)); key(b); });
  document.querySelectorAll('.sortable[data-sort]:not([data-sort=""])').forEach((h) => { h.onclick = () => { const k = h.dataset.sort; if (filters.sort === k || (!filters.sort && k === 'updated_at')) filters.dir = filters.dir === 'asc' ? 'desc' : 'asc'; else { filters.sort = k; filters.dir = 'desc'; } goto(page, filters); }; key(h); });
  document.querySelectorAll('[data-project]').forEach((c) => { c.onclick = () => goto('sessions', { project: c.dataset.project }); key(c); });
  document.querySelectorAll('[data-source]').forEach((b) => { b.onclick = () => { filters.source = b.dataset.source; goto(page, filters); }; });
  document.querySelectorAll('[data-session-open]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); detail(b.dataset.sessionOpen); }; });
  document.querySelectorAll('[data-term-copy]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const t = b.closest('.term-panel')?.querySelector('[data-copy]')?.dataset.copy || ''; copy(t, b); }; });
  document.querySelectorAll('[data-copy-path]').forEach((b) => { b.onclick = () => copy(b.dataset.copyPath, b); });
  $('[data-clear-filter]')?.addEventListener('click', () => goto(page, {}));
  $('#glass-toggle')?.addEventListener('click', () => { setGlass(document.documentElement.dataset.glass === 'off'); render(); });
  const escanear = async (b, full) => { b.disabled = true; const t = b.innerHTML; b.textContent = full ? 'Reindexando…' : 'Escaneando…'; try { const r = await api('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full }) }); b.textContent = `${r.indexados} indexadas · ${r.erros} erros`; setTimeout(() => { b.disabled = false; b.innerHTML = t; render(); }, 1600); } catch (err) { b.disabled = false; b.innerHTML = t; alert(err.message); } };
  $('#scan')?.addEventListener('click', (e) => escanear(e.currentTarget, false));
  $('#scan-full')?.addEventListener('click', (e) => escanear(e.currentTarget, true));
  document.querySelector('[data-scan-cta]')?.addEventListener('click', (e) => escanear(e.currentTarget, false));
  let deb; $('#search')?.addEventListener('input', (e) => { clearTimeout(deb); const v = e.target.value; deb = setTimeout(() => { filters.q = v; goto(page, filters); }, 320); });
  $('#status')?.addEventListener('change', (e) => { filters.status = e.target.value; goto(page, filters); });
  $('#prompt-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await api('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(e.target))) }); render(); });
  $('#queue')?.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-id]'); const btn = e.target.closest('[data-act]'); if (!card || !btn) return;
    const id = card.dataset.id;
    if (btn.dataset.act === 'del') { if (!confirm('Excluir este prompt?')) return; await api(`/api/prompts/${id}`, { method: 'DELETE' }); render(); }
    else if (btn.dataset.act === 'adv') { await api(`/api/prompts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: btn.dataset.next }) }); render(); }
    else if (btn.dataset.act === 'edit') { card.querySelector('.edit-form')?.toggleAttribute('hidden'); }
  });
  $('#queue')?.addEventListener('submit', async (e) => {
    if (!e.target.classList.contains('edit-form')) return;
    e.preventDefault();
    await api(`/api/prompts/${e.target.dataset.editid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    render();
  });
  $('#settings-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); const current = await api('/api/settings'); current.session_paths = { codex: d.codex.split('\n').filter(Boolean), claude: d.claude.split('\n').filter(Boolean) }; await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) }); render(); });
  if (page === 'studio') loadStudioQueue();
  if (page === 'live') startLive();
  if (page === 'dashboard') animateCounts();
  if (page === 'sessions' && $('#vrows')) { // tabela janelada: delegação + repintura no scroll
    VT.container = $('#vrows');
    VT.container.onclick = (e) => { const r = e.target.closest('[data-session]'); if (r) detail(r.dataset.session); };
    VT.container.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { const r = e.target.closest('[data-session]'); if (r) { e.preventDefault(); detail(r.dataset.session); } } };
    paintWindow();
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintWindow(); }); };
    addEventListener('scroll', onScroll, { passive: true });
    VT.cleanup = () => removeEventListener('scroll', onScroll);
  }
}
function copy(text, btn) { navigator.clipboard?.writeText(text).then(() => { if (!btn) return; const o = btn.innerHTML; btn.innerHTML = ic('check') + 'Copiado'; setTimeout(() => { btn.innerHTML = o; }, 1200); }).catch(() => {}); }
async function loadStudioQueue() { try { const q = await api('/api/prompts'); const el = $('#studio-queue'); if (el) el.outerHTML = q.length ? `<div class="cards">${q.slice(0, 6).map(promptCard).join('')}</div>` : `<div class="surface">${emptyState('prompts', 'Fila vazia', 'Adicione prompts na Prompt Queue.')}</div>`; } catch {} }

/* ---------- Session detail (tabbed) ---------- */
const TABS = [['timeline', 'Timeline', 'sessions'], ['terminal', 'Terminal', 'terminal'], ['files', 'Arquivos', 'file'], ['tools', 'Tools', 'tool'], ['summary', 'Resumo', 'chat']];
let detailState = null;
async function detail(id) {
  try {
    const s = await api('/api/sessions/' + encodeURIComponent(id));
    detailState = { s, tab: 'timeline' }; sbsOpen.clear();
    const b = brand(s.source);
    const meta = [['Agente', b.label], ['Status', STATUS_LABEL[s.status] || s.status], ['Modelo', s.model || 'não detectado'], ['Esforço', s.effort || 'não detectado'], ['Tokens', s.tokens ? s.tokens.toLocaleString('pt-BR') : 'não detectado'], ['Custo est.', s.cost ? usd(s.cost) : 'não detectado'], ['Projeto', s.project || 'não detectado'], ['Eventos', s.events.length]];
    const counts = { timeline: s.events.length, terminal: (s.tools || []).length, files: (s.files || []).length, tools: (s.tools || []).length };
    $('#detail-content').innerHTML = `<div class="detail-scroll"><div class="detail-head glass">
      <button class="close" onclick="this.closest('dialog').close()">Fechar</button>
      <div class="dh-top">${agentAvatar(s.source, { size: 44, live: s.status === 'working' })}<div class="dh-id"><h1>${esc(s.title)}</h1><div class="muted">${esc(b.label)} · ${s.events.length} eventos indexados</div></div>${statusPill(s.status)}</div>
      ${s.source_path ? `<p class="path">${esc(s.source_path)}</p>` : ''}</div>
      <div class="detail-body"><div class="meta">${meta.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
      ${(s.warnings || []).length ? `<div class="chips">${s.warnings.map((w) => `<span class="pill warning">${ic('alert')}${esc(w)}</span>`).join('')}</div>` : ''}
      <div class="tabs">${TABS.map(([k, l, g]) => `<button data-tab="${k}" class="${k === 'timeline' ? 'on' : ''}">${ic(g)}${l}${counts[k] != null ? `<span class="tc">${counts[k]}</span>` : ''}</button>`).join('')}</div>
      <div id="detail-tab"></div></div></div>`;
    renderTab();
    $('#detail-content').querySelectorAll('[data-tab]').forEach((btn) => { btn.onclick = () => { detailState.tab = btn.dataset.tab; $('#detail-content').querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === btn)); renderTab(); }; });
    $('#detail').showModal();
  } catch (e) { alert(e.message); }
}
function renderTab() {
  const { s, tab } = detailState; const host = $('#detail-tab'); if (!host) return;
  if (tab === 'timeline') {
    const kinds = [...new Set(s.events.map((e) => e.kind))].sort();
    host.innerHTML = `<div class="tabpane"><div class="toolbar"><select id="kind-filter"><option value="">Todos os tipos (${s.events.length})</option>${kinds.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></div><div class="timeline">${s.events.length ? s.events.map(timelineEvent).join('') : emptyState('sessions', 'Sem eventos', 'Nenhum evento indexado para esta sessão.')}</div></div>`;
    $('#kind-filter').onchange = (ev) => { const k = ev.target.value; host.querySelectorAll('.event').forEach((el) => { el.style.display = !k || el.dataset.kind === k ? '' : 'none'; }); };
    host.onclick = (ev) => { // toggle unified ↔ side-by-side por evento (delegado, sobrevive a re-render)
      const btn = ev.target.closest('[data-diff-toggle]'); if (!btn) return;
      const i = Number(btn.dataset.diffToggle);
      if (sbsOpen.has(i)) sbsOpen.delete(i); else sbsOpen.add(i);
      btn.textContent = sbsOpen.has(i) ? 'unificado' : 'lado a lado';
      btn.closest('.event').querySelector('.ev-body').innerHTML = eventBody(s.events[i].summary, sbsOpen.has(i));
    };
  } else if (tab === 'terminal') {
    host.innerHTML = `<div class="tabpane">${terminalPreview(s, { tall: true })}<p class="muted" style="margin-top:10px;font-size:11px">${ic('alert')} Reconstruído a partir do índice de eventos — stdout/stderr brutos não são capturados pelo scanner read-only.</p></div>`;
    host.querySelectorAll('[data-term-copy]').forEach((btn) => { btn.onclick = () => { const t = btn.closest('.term-panel')?.querySelector('[data-copy]')?.dataset.copy || ''; copy(t, btn); }; });
    host.querySelectorAll('[data-session-open]').forEach((btn) => { btn.onclick = () => { detailState.tab = 'timeline'; renderTab(); }; });
  } else if (tab === 'files') {
    const files = s.files || [];
    if (!files.length) { host.innerHTML = `<div class="tabpane">${emptyState('file', 'Nenhum arquivo', 'Nenhum arquivo tocado foi detectado nos eventos.')}</div>`; }
    else {
      const groups = {};
      for (const f of files) { const n = f.replace(/\\/g, '/'); const i = n.lastIndexOf('/'); const dir = i >= 0 ? n.slice(0, i) : '.'; (groups[dir] = groups[dir] || []).push({ name: i >= 0 ? n.slice(i + 1) : n, full: f }); }
      host.innerHTML = `<div class="tabpane"><p class="muted" style="margin-bottom:10px">${files.length} arquivos tocados em ${Object.keys(groups).length} pastas · clique para copiar o caminho</p>
        ${Object.entries(groups).map(([dir, fs]) => `<div class="filegroup"><div class="dir">${ic('projects')}<code>${esc(dir)}</code><span>${fs.length}</span></div>
          ${fs.map((f) => `<button class="filerow" data-copy-path="${esc(f.full)}">${ic('file')}<code>${esc(f.name)}</code>${ic('copy')}</button>`).join('')}</div>`).join('')}</div>`;
      host.querySelectorAll('[data-copy-path]').forEach((b) => { b.onclick = () => copy(b.dataset.copyPath, b); });
    }
  } else if (tab === 'tools') {
    const tools = s.tools || [];
    if (!tools.length) { host.innerHTML = `<div class="tabpane">${emptyState('tool', 'Nenhuma tool', 'Nenhuma chamada de tool detectada.')}</div>`; }
    else {
      const CAT = [[/read|glob|grep|ls|cat|view/i, 'Leitura', 'file'], [/edit|write|patch|notebook|create/i, 'Edição', 'tool'], [/bash|shell|exec|command|run|terminal/i, 'Execução', 'terminal'], [/web|fetch|search|browser|navigate/i, 'Web', 'search'], [/task|agent|spawn/i, 'Subagente', 'agents']];
      const buckets = {};
      for (const t of tools) { const [, label, glyph] = CAT.find(([re]) => re.test(t)) || [, 'Outros', 'chevron']; (buckets[label] = buckets[label] || { glyph, items: [] }).items.push(t); }
      host.innerHTML = `<div class="tabpane">${Object.entries(buckets).map(([label, b]) => `<div class="toolgroup"><div class="dir">${ic(b.glyph)}<code>${esc(label)}</code><span>${b.items.length}</span></div><div class="chips">${b.items.map((t) => `<span class="pill accent">${ic(b.glyph)}${esc(t)}</span>`).join('')}</div></div>`).join('')}</div>`;
    }
  } else {
    host.innerHTML = `<div class="tabpane"><p style="line-height:1.6">${esc(s.summary)}</p></div>`;
  }
}

/* ---------- Command bar + palette ---------- */
const runCommand = async () => { const r = await api('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: $('#command-input').value }) }); const f = r.filters || {}; if (r.query) f.q = r.query; goto(r.page || 'sessions', f); };
$('#command-input').onkeydown = (e) => { if (e.key === 'Enter') runCommand(); };
const palette = $('#palette');
const paletteScan = async () => { try { const r = await api('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); render(); alert(`${r.indexados} indexadas · ${r.erros} erros`); } catch (e) { alert(e.message); } };
function paletteItems() {
  return [
    ...nav.map(([label, id, icon]) => ({ label, icon, hint: 'ir para', run: () => goto(id) })),
    { label: 'Reescanear sessões', icon: 'scan', hint: 'ação', run: paletteScan },
    { label: 'Alternar tema claro/escuro', icon: 'settings', hint: 'ação', run: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') },
    { label: 'Alternar Liquid Glass', icon: 'droplet', hint: 'ação', run: () => { setGlass(document.documentElement.dataset.glass === 'off'); render(); } },
    { label: 'Sessões que falharam', icon: 'alert', hint: 'filtro', run: () => goto('sessions', { status: 'failed' }) },
    { label: 'Sessões que precisam de input', icon: 'chat', hint: 'filtro', run: () => goto('sessions', { status: 'needs_input' }) },
    { label: 'Sessões ativas', icon: 'terminal', hint: 'filtro', run: () => goto('sessions', { status: 'working' }) },
  ];
}
function openPalette() {
  const statics = paletteItems();
  let sessionItems = []; let sel = 0; let deb;
  const q = () => ($('#palette-input').value || '').toLowerCase();
  const list = () => statics.filter((i) => i.label.toLowerCase().includes(q())).concat(sessionItems);
  const runSel = (i) => { if (!i) return; palette.close(); i.run(); };
  const paint = () => { const l = list(); sel = Math.max(0, Math.min(sel, l.length - 1)); $('#palette-list').innerHTML = l.map((i, n) => `<div class="palette-item ${n === sel ? 'on' : ''}" data-n="${n}">${ic(i.icon)}<span>${esc(i.label)}</span><span class="hint">${i.hint}</span></div>`).join('') || '<div class="palette-item"><span class="hint">Nenhum comando</span></div>'; $('#palette-list').querySelectorAll('[data-n]').forEach((el) => { el.onclick = () => runSel(l[Number(el.dataset.n)]); }); };
  const search = async () => { const term = q(); if (term.length < 2) { sessionItems = []; paint(); return; } try { const r = await api('/api/sessions?q=' + encodeURIComponent(term)); sessionItems = r.slice(0, 6).map((s) => ({ label: s.title.slice(0, 64), icon: brand(s.source).glyph, hint: 'sessão', run: () => detail(s.id) })); } catch { sessionItems = []; } paint(); };
  $('#palette-input').value = ''; sessionItems = []; paint(); palette.showModal(); $('#palette-input').focus();
  $('#palette-input').oninput = () => { sel = 0; paint(); clearTimeout(deb); deb = setTimeout(search, 220); };
  $('#palette-input').onkeydown = (e) => { const l = list(); if (!l.length) return; if (e.key === 'ArrowDown') { sel = (sel + 1) % l.length; paint(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = (sel - 1 + l.length) % l.length; paint(); e.preventDefault(); } else if (e.key === 'Enter') { runSel(l[sel]); } };
}

/* ---------- nav render + global wiring ---------- */
$('#nav').innerHTML = nav.map(([label, id, icon]) => `<button class="nav ${id === page ? 'active' : ''}" data-page="${id}">${ic(icon)}<span>${label}</span></button>`).join('');
$('#nav').onclick = (e) => { const b = e.target.closest('[data-page]'); if (b) goto(b.dataset.page); };
$('#command').onclick = () => $('#command-input').focus();
window.addEventListener('hashchange', () => { readHash(); render(); });
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#palette-btn').onclick = openPalette;
// Pill de uso → abre o painel no Dashboard. ISLAND vive fora do #app (topbar), logo
// tem seu próprio lifecycle e NÃO é reiniciado pelo render()/LIVE.stop() a cada navegação.
$('#island').onclick = () => { goto('dashboard'); setTimeout(() => $('#usage-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); };
ISLAND.start();
let kbRow = -1; let gPending = false;
const GCHORD = { d: 'dashboard', l: 'live', t: 'studio', s: 'sessions', p: 'projects', k: 'skills', h: 'hooks', a: 'agents', q: 'prompts' };
function highlightRow(rows) { rows.forEach((r) => r.classList.remove('kb')); const r = rows[kbRow]; if (r) { r.classList.add('kb'); r.scrollIntoView({ block: 'nearest' }); } }
function highlightRowById(id) { document.querySelectorAll('#app .row.kb').forEach((r) => r.classList.remove('kb')); if (id == null) return; document.querySelector(`#vrows [data-session="${CSS.escape(id)}"]`)?.classList.add('kb'); }
addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  const busy = $('#detail').open || palette.open;
  if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#command-input').focus(); return; }
  if (gPending) { gPending = false; if (GCHORD[e.key]) { e.preventDefault(); goto(GCHORD[e.key]); } return; }
  if (e.key === 'g' && !busy) { gPending = true; setTimeout(() => { gPending = false; }, 700); return; }
  if (page === 'sessions' && !busy) {
    const virtual = !!$('#vrows');
    const rows = virtual ? [] : [...document.querySelectorAll('#app .row[data-session]')];
    const total = virtual ? VT.data.length : rows.length;
    if (!total) return;
    if (e.key === 'j' || e.key === 'ArrowDown') kbRow = Math.min(total - 1, kbRow + 1);
    else if (e.key === 'k' || e.key === 'ArrowUp') kbRow = Math.max(0, kbRow - 1);
    else if (e.key === 'Enter') { const id = virtual ? VT.data[kbRow]?.id : rows[kbRow]?.dataset.session; if (id) detail(id); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    if (virtual) { window.scrollTo({ top: absTop(VT.container) + kbRow * VT.row_h - innerHeight / 2 }); paintWindow(); highlightRowById(VT.data[kbRow]?.id); }
    else highlightRow(rows);
  }
});
render();
setInterval(() => { if ((page === 'dashboard' || page === 'sessions' || page === 'studio') && !$('#detail').open && !palette.open && !$('#scan')?.disabled && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) render(true); }, 30000);

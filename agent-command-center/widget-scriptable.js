// Agent Command Center — widget iPhone (Scriptable)
// Cole este arquivo inteiro num script novo do app Scriptable e adicione o
// widget na home screen ou na lock screen. Roda no runtime do Scriptable
// (ListWidget/Request/DrawContext/FileManager…), NÃO no Node.
//
// ─── CONFIG ──────────────────────────────────────────────────────────────
// TROQUE a URL abaixo pelo seu endpoint /api/usage (Tailscale serve do PC):
const API_URL = "https://legionwallas.tail1a92c9.ts.net/api/usage";
const TIMEOUT_S = 8;              // iOS mata fetch > ~10s; margem curta
const CACHE_FILE = "acc_usage_cache.json";
// ─────────────────────────────────────────────────────────────────────────

const FG = new Color("#e8e8ea");
const MUTED = new Color("#8b8b94");
const TRACK = new Color("#2a2a33");
const CORAL = new Color("#d97757"); // acento/identidade (ecoa o ícone)

// Busca o endpoint; em erro devolve o cache em disco marcado como offline.
async function carregar() {
  const fm = FileManager.local();
  const caminho = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
  try {
    const req = new Request(API_URL);
    req.timeoutInterval = TIMEOUT_S;
    const dados = await req.loadJSON();
    fm.writeString(caminho, JSON.stringify({ at: Date.now(), dados })); // true-up p/ render offline
    return { dados, offline: false, offlineAt: null };
  } catch (e) {
    if (fm.fileExists(caminho)) {
      try {
        const cache = JSON.parse(fm.readString(caminho));
        return { dados: cache.dados, offline: true, offlineAt: cache.at };
      } catch (_) { /* cache corrompido → sem conexão */ }
    }
    return { dados: null, offline: true, offlineAt: null };
  }
}

// Cor do anel por fração consumida: verde → laranja → vermelho (heat = sinal de uso).
function heat(frac) {
  if (frac == null) return MUTED;
  if (frac < 0.5) return new Color("#22c55e");
  if (frac < 0.8) return new Color("#f59e0b");
  return new Color("#ef4444");
}

// Fundo gradiente diagonal — eco do ícone (escuro, com profundidade).
function aplicarFundo(w) {
  const g = new LinearGradient();
  g.colors = [new Color("#24242e"), new Color("#0a0a0e")];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
}

// Polilinha de arco (DrawContext não tem primitiva de arco). Densa o bastante
// p/ virar banda contínua ao ser traçada com espessura — sem os "pontos" da v1.
function arco(cx, cy, r, a0, a1, passos) {
  const p = new Path();
  for (let i = 0; i <= passos; i++) {
    const a = a0 + (a1 - a0) * (i / passos);
    const pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
    if (i === 0) p.move(pt); else p.addLine(pt);
  }
  return p;
}

// Mini starburst coral (assinatura do ícone) no centro do anel — discreto.
function desenharStarburst(ctx, cx, cy, R) {
  ctx.setFillColor(CORAL);
  const raios = 8;
  for (let i = 0; i < raios; i++) {
    const a = -Math.PI / 2 + i * (2 * Math.PI / raios);
    const tip = new Point(cx + R * Math.cos(a), cy + R * Math.sin(a));
    const bx = cx + R * 0.34 * Math.cos(a), by = cy + R * 0.34 * Math.sin(a);
    const px = Math.cos(a + Math.PI / 2) * R * 0.14, py = Math.sin(a + Math.PI / 2) * R * 0.14;
    const p = new Path();
    p.move(new Point(cx, cy));
    p.addLine(new Point(bx + px, by + py));
    p.addLine(tip);
    p.addLine(new Point(bx - px, by - py));
    p.closeSubpath();
    ctx.addPath(p); ctx.fillPath();
  }
}

// Anel liso como imagem quadrada. frac null/0 → só o track. comMarca desenha
// o starburst no centro (home screen); na lock screen o centro leva o pct.
function desenharAnel(size, frac, cor, comMarca) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - size * 0.13;
  const th = size * 0.10;
  ctx.setLineWidth(th);
  ctx.setStrokeColor(TRACK);
  ctx.addPath(arco(cx, cy, r, 0, 2 * Math.PI, 160));
  ctx.strokePath();
  const f = frac == null ? 0 : Math.min(1, Math.max(0, frac));
  if (f > 0) {
    const a0 = -Math.PI / 2, a1 = a0 + 2 * Math.PI * f; // começa no topo, horário
    ctx.setStrokeColor(cor);
    ctx.addPath(arco(cx, cy, r, a0, a1, Math.max(2, Math.round(160 * f))));
    ctx.strokePath();
    // ponta do arco: halo + dot p/ acabamento
    const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1);
    ctx.setFillColor(new Color(cor.hex, 0.3));
    ctx.fillEllipse(new Rect(ex - th * 0.95, ey - th * 0.95, th * 1.9, th * 1.9));
    ctx.setFillColor(cor);
    ctx.fillEllipse(new Rect(ex - th * 0.6, ey - th * 0.6, th * 1.2, th * 1.2));
  }
  if (comMarca) desenharStarburst(ctx, cx, cy, size * 0.14);
  return ctx.getImage();
}

// HH:MM local a partir de um ISO (texto fixo, determinístico).
function horaLocal(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function usd(v) { return v == null ? "—" : `US$ ${v.toFixed(2)}`; } // null nunca vira 0

// Custo extrapolado no render: conhecido + burn × Δt desde o dado. Nunca fabrica.
function custoExtrapolado(block, offlineAt) {
  if (!block || block.cost == null) return "—";
  let custo = block.cost;
  if (block.burn_rate_hr != null) {
    const ref = offlineAt || Date.now();
    // ponytail: sem timestamp do dado no payload; extrapola do horário do fetch
    // (online) ou do cache (offline); o próximo refresh faz true-up.
    custo += block.burn_rate_hr * Math.max(0, (Date.now() - ref) / 3_600_000);
  }
  return `≈ US$ ${custo.toFixed(2)}`;
}

// Custo de hoje somando o history (dia = date(updated_at) em UTC → comparar UTC).
function custoHoje(dados) {
  if (!dados.history) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  let tot = null;
  for (const r of dados.history) if (r.dia === hoje && r.cost != null) tot = (tot || 0) + r.cost;
  return tot;
}

// --- helpers de texto ---
function centro(w, texto, cor, tam, bold) {
  const t = w.addText(texto);
  t.textColor = cor; t.font = bold ? Font.boldSystemFont(tam) : Font.systemFont(tam); t.centerAlignText();
  return t;
}
function linhaKV(col, label, valor, cor) { // "label ........ valor" (valor mono)
  const s = col.addStack(); s.centerAlignContent();
  const l = s.addText(label); l.textColor = MUTED; l.font = Font.mediumSystemFont(11);
  s.addSpacer();
  const v = s.addText(valor); v.textColor = cor; v.font = Font.boldMonospacedSystemFont(13);
}
function badgeOffline(w, offlineAt) {
  w.addSpacer(4);
  const m = offlineAt ? horaLocal(new Date(offlineAt).toISOString()) : horaLocal(new Date().toISOString());
  centro(w, `offline ${m}`, CORAL, 10, false); // coral, não vermelho (vermelho = heat alto)
}

async function montarWidget() {
  const familia = config.widgetFamily || "medium";
  const { dados, offline, offlineAt } = await carregar();

  const w = new ListWidget();
  aplicarFundo(w);
  w.setPadding(14, 16, 14, 16);

  // ESTADO 4: sem conexão e sem cache.
  if (!dados) {
    w.addSpacer();
    centro(w, "sem conexão", FG, familia === "accessoryCircular" ? 11 : 15, true);
    if (familia !== "accessoryCircular") centro(w, "ligue o Tailscale", MUTED, 12, false);
    w.addSpacer();
    w.refreshAfterDate = new Date(Date.now() + 10 * 60_000);
    return w;
  }

  const block = dados.block;
  const pct = dados.pct_consumed;             // 0..1 ou null
  const frac = block ? pct : 0;               // sem bloco → anel vazio
  const cor = block ? heat(frac) : MUTED;

  // ── Lock screen: anel + pct, mínimo. ──
  if (familia === "accessoryCircular") {
    w.backgroundImage = desenharAnel(160, frac, cor, false);
    w.addSpacer();
    centro(w, frac == null ? "—" : `${Math.round(frac * 100)}%`, FG, 15, true);
    w.addSpacer();
    w.refreshAfterDate = new Date(Date.now() + (block ? 10 : 60) * 60_000);
    return w;
  }

  // ── Medium: anel à esquerda, coluna de stats à direita. ──
  if (familia === "medium") {
    const row = w.addStack(); row.centerAlignContent();
    const ring = row.addImage(desenharAnel(300, frac, cor, true));
    ring.imageSize = new Size(122, 122);
    row.addSpacer(18);
    const col = row.addStack(); col.layoutVertically();
    if (block) {
      // ESTADO 1: countdown AO VIVO via addDate+applyTimerStyle (iOS tica sozinho).
      const t = col.addDate(new Date(block.end));
      t.applyTimerStyle(); t.font = Font.boldMonospacedSystemFont(30); t.textColor = FG;
      const rst = col.addText(`reset às ${horaLocal(block.end)}`); // texto fixo, determinístico
      rst.textColor = MUTED; rst.font = Font.mediumSystemFont(12);
      col.addSpacer(7);
      linhaKV(col, "bloco", custoExtrapolado(block, offline ? offlineAt : null), cor);
      linhaKV(col, "burn", block.burn_rate_hr == null ? "—" : `US$ ${block.burn_rate_hr.toFixed(2)}/h`, MUTED);
      linhaKV(col, "hoje", usd(custoHoje(dados)), MUTED);
      if (pct != null) { const p = col.addText(`${Math.round(pct * 100)}% consumido`); p.textColor = MUTED; p.font = Font.mediumSystemFont(11); }
    } else {
      // ESTADO 2: sem bloco ativo.
      const a = col.addText("sessão ainda"); a.textColor = FG; a.font = Font.boldSystemFont(15);
      const b = col.addText("não iniciada"); b.textColor = MUTED; b.font = Font.mediumSystemFont(12);
    }
    if (offline) badgeOffline(w, offlineAt); // ESTADO 3 (sobreposto)
    w.refreshAfterDate = new Date(Date.now() + (block ? 10 : 60) * 60_000);
    return w;
  }

  // ── Small (default): anel centrado, countdown ABAIXO (sem sobrepor). ──
  const im = w.addImage(desenharAnel(300, frac, cor, true));
  im.centerAlignImage(); im.imageSize = new Size(96, 96);
  w.addSpacer(8);
  if (block) {
    const s = w.addStack(); s.addSpacer();
    const d = s.addDate(new Date(block.end)); d.applyTimerStyle();
    d.font = Font.boldMonospacedSystemFont(22); d.textColor = FG;
    s.addSpacer();
    if (pct != null) centro(w, `${Math.round(pct * 100)}% consumido`, MUTED, 11, false);
    centro(w, custoExtrapolado(block, offline ? offlineAt : null), FG, 13, true);
  } else {
    centro(w, "0% consumido", FG, 14, true);
    centro(w, "sessão não iniciada", MUTED, 11, false);
  }
  if (offline) badgeOffline(w, offlineAt);
  w.refreshAfterDate = new Date(Date.now() + (block ? 10 : 60) * 60_000);
  return w;
}

const widget = await montarWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium(); // preview ao rodar dentro do app
}
Script.complete();

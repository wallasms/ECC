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

const INDIGO = new Color("#6366f1");
const FG = new Color("#e8e8ea");
const MUTED = new Color("#8b8b94");
const TRACK = new Color("#2a2a33");
const BG = new Color("#0c0c10");

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

// Cor do anel por fração consumida: verde → laranja → vermelho.
function heat(frac) {
  if (frac == null) return MUTED;
  if (frac < 0.5) return new Color("#22c55e");
  if (frac < 0.8) return new Color("#f59e0b");
  return new Color("#ef4444");
}

// Anel desenhado como pontos ao redor do círculo (DrawContext não tem arco).
// Contexto no aspecto da família p/ o backgroundImage encher sem distorcer o anel.
function desenharAnel(w, h, frac, cor) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const cx = w / 2, cy = h / 2;
  const raio = Math.min(w, h) / 2 - 10;
  const espessura = Math.max(6, raio * 0.16);
  const passos = 120;
  const preenchidos = frac == null ? 0 : Math.round(Math.min(1, frac) * passos);
  for (let i = 0; i < passos; i++) {
    const ang = -Math.PI / 2 + (i / passos) * 2 * Math.PI; // começa no topo
    const px = cx + raio * Math.cos(ang);
    const py = cy + raio * Math.sin(ang);
    ctx.setFillColor(i < preenchidos ? cor : TRACK);
    ctx.fillEllipse(new Rect(px - espessura / 2, py - espessura / 2, espessura, espessura));
  }
  return ctx.getImage();
}

// Tamanho do contexto do anel por família (pontos ×3 p/ nitidez retina).
function tamanhoFamilia(familia) {
  if (familia === "accessoryCircular") return { w: 160, h: 160 };
  if (familia === "medium") return { w: 690, h: 315 };
  return { w: 465, h: 465 }; // small (default)
}

// HH:MM local a partir de um ISO (texto fixo, determinístico).
function horaLocal(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Custo extrapolado no render: conhecido + burn × Δt desde o dado. Nunca fabrica.
function custoExtrapolado(block, offlineAt) {
  if (!block || block.cost == null) return "—";
  let custo = block.cost;
  if (block.burn_rate_hr != null) {
    const ref = offlineAt || Date.now();
    // Sem timestamp do dado no payload; usamos "agora" (online) ou o horário do cache.
    // ponytail: extrapola a partir do horário do fetch; o próximo refresh faz true-up.
    const dtHoras = Math.max(0, (Date.now() - ref) / 3_600_000);
    custo += block.burn_rate_hr * dtHoras;
  }
  return `≈ US$ ${custo.toFixed(2)}`;
}

function txt(stack, texto, cor, tamanho, bold) {
  const t = stack.addText(texto);
  t.textColor = cor;
  t.font = bold ? Font.boldSystemFont(tamanho) : Font.systemFont(tamanho);
  t.centerAlignText();
  return t;
}

async function montarWidget() {
  const familia = config.widgetFamily || "medium";
  const { dados, offline, offlineAt } = await carregar();

  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(10, 10, 10, 10);

  // ESTADO 4: sem conexão e sem cache.
  if (!dados) {
    w.addSpacer();
    txt(w, "sem conexão", FG, familia === "accessoryCircular" ? 11 : 15, true);
    if (familia !== "accessoryCircular") txt(w, "ligue o Tailscale", MUTED, 12, false);
    w.addSpacer();
    w.refreshAfterDate = new Date(Date.now() + 10 * 60_000);
    return w;
  }

  const block = dados.block;
  const pct = dados.pct_consumed; // 0..1 ou null
  // Anel: % consumido do limite; sem bloco/sem histórico → vazio.
  const frac = block ? pct : 0;
  const cor = block ? heat(frac) : MUTED;

  const sz = tamanhoFamilia(familia);
  w.backgroundImage = desenharAnel(sz.w, sz.h, frac, cor);

  const pctTexto = frac == null ? null : `${Math.round(frac * 100)}% consumido`;

  if (familia === "accessoryCircular") {
    // Lock screen: só anel + pct (sem countdown, espaço mínimo).
    w.addSpacer();
    txt(w, frac == null ? "—" : `${Math.round(frac * 100)}%`, FG, 15, true);
    w.addSpacer();
    w.refreshAfterDate = new Date(Date.now() + (block ? 10 : 60) * 60_000);
    return w;
  }

  // small / medium: layout completo, centralizado sobre o anel.
  w.addSpacer();

  if (block) {
    // ESTADO 1: bloco ativo.
    // Countdown AO VIVO: addDate + applyTimerStyle → o iOS tica sozinho, sem
    // rerodar o script. Aqui está a chave do widget (timer nativo, não string).
    const timer = w.addDate(new Date(block.end));
    timer.applyTimerStyle();
    timer.font = Font.boldSystemFont(familia === "medium" ? 30 : 26);
    timer.textColor = FG;
    timer.centerAlignText();

    if (pctTexto) txt(w, pctTexto, FG, 13, false);
    txt(w, `reset às ${horaLocal(block.end)}`, MUTED, 12, false); // texto fixo, determinístico
    txt(w, custoExtrapolado(block, offline ? offlineAt : null), MUTED, 12, false);
  } else {
    // ESTADO 2: sem bloco ativo (sessão não iniciada) — sem countdown, anel vazio.
    txt(w, "0% consumido", FG, 15, true);
    txt(w, "sessão ainda não iniciada", MUTED, 12, false);
  }

  // ESTADO 3 (sobreposto aos demais): dado veio do cache → marca offline HH:MM.
  if (offline) {
    const marca = offlineAt ? horaLocal(new Date(offlineAt).toISOString()) : horaLocal(new Date().toISOString());
    txt(w, `offline ${marca}`, new Color("#ef4444"), 10, false);
  }

  w.addSpacer();
  // Dica de refresh ao iOS: +10min com bloco ativo, +60min ocioso.
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

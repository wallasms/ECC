# PLAN: Ícone novo — visual Claude Code + efeitos de blur/vidro

## Escopo proibido

- **NÃO adicionar dependências** (nada de sharp/canvas npm — rasterização via
  browser do preview ou encoder PNG manual, ver Fase 3).
- **NÃO tocar** lógica do server (o mapa `mime` já tem `.png`/`.svg`), widget
  Scriptable, nem o endpoint `/api/usage`.
- **NÃO republicar** o asset oficial da Anthropic: o starburst é marca deles.
  Desenhar uma **aproximação própria** em SVG, uso pessoal/local. Não usar em
  distribuição pública sem revisar.

## Contexto (recon)

Superfícies do ícone hoje:
- `public/index.html` — favicon SVG inline (data URI): quadrado #6366f1 + losango branco.
- `public/icon.svg` — mesma arte em 512px; referenciado pelo `manifest.json` e
  pelo `apple-touch-icon` (ceiling documentado: iOS prefere PNG raster — este
  plano resolve isso na Fase 3).
- `public/manifest.json` — `icons` + `theme_color` #0c0c10.
- `styles.css` — `.mark` da sidebar usa `--claude-grad` (violeta/indigo); a
  `--claude-grad` também marca sessões Claude no app inteiro — **não mudar a
  gradient global**, só o `.mark` se quiser alinhar (opcional, Fase 2).

## Direção visual (Fase 1 — spec)

- **Quem**: Fable, effort high (decisão de design, uma passada).
- Referência: ícone do Claude Code — fundo escuro quase-preto, starburst coral.
- Spec do SVG (uma arte, escala livre):
  1. Fundo: rounded square, gradiente radial `#1b1b22 → #0c0c10` (bate com o
     `theme_color` do manifest e o dark do app).
  2. **Starburst coral** (aproximação do spark da Claude): 8 raios orgânicos,
     cor `#d97757` (coral Anthropic) com leve gradiente p/ `#e8875f`.
  3. **Blur/glow**: cópia do starburst atrás com `feGaussianBlur`
     (stdDeviation ~2.5 na viewBox 24) em coral 60% — o "brilho" que dá
     profundidade sobre o fundo escuro.
  4. **Vidro**: metade superior com overlay branco 6–8% + blur suave
     (highlight de lente, estilo iOS), e stroke 1px branco 10% no contorno do
     rounded square.
  5. Vinheta sutil nas bordas (radial escuro 20%) p/ o ícone não "achatar" na
     home screen.
- Gate: SVG renderiza idêntico no Chrome e Safari (filtros SVG básicos, nada
  de `backdrop-filter` — não existe em SVG standalone).

## Fases

### Fase 2 — Implementar o SVG (Sonnet, effort medium)
- **Arquivos**: `public/icon.svg` (arte nova), `public/index.html` (favicon
  data URI regenerado da mesma arte, minificado), `public/manifest.json`
  (sem mudança estrutural; conferir refs).
- Opcional (decidir na hora, menor diff vence): `.mark` da sidebar herda o
  starburst coral em vez do "A" — só se ficar coeso com o Quiet Command.
- Edge cases: data URI precisa de `%23` p/ `#` nas cores; filtros com
  `filterUnits` default podem cortar o glow — usar `x/y/width/height` folgados
  no `<filter>` (ex.: `-30%..160%`); testar tema claro do browser (favicon
  sobre aba clara — o fundo escuro do ícone resolve).

### Fase 3 — Rasterizar PNG 180/512 (Opus, effort medium)
Resolve o ceiling do apple-touch-icon (iOS quer raster).
- **Sem dependência**: rasterizar via **browser do preview** — carregar o SVG
  num `<canvas>` (`drawImage` + `toDataURL('image/png')`) via `preview_eval`,
  salvar o base64 em `public/apple-touch-icon.png` (180) e `public/icon-512.png`.
  Plano B se o eval truncar o base64 de 512px: gerar só o 180 (o que o iOS usa)
  e manter o SVG no manifest.
- Atualizar `index.html` (`apple-touch-icon` → PNG) e `manifest.json` (icons:
  PNG 512 + SVG any). Remover o `ponytail:` do ceiling no README.
- Edge cases: filtros SVG dentro de `drawImage` rasterizam OK em Chrome
  (mesma origem, sem taint com data URI); conferir fundo — canvas transparente
  + ícone já tem fundo próprio, não precisa flatten.
- Gate: `curl -sI /apple-touch-icon.png` → `200 image/png`; abrir o PNG e
  conferir glow/vidro presentes (não um quadrado chapado).

### Fase 4 — Verificação (eu + usuário)
- Preview: favicon na aba, manifest válido (`JSON.parse`), ícones servindo.
- iPhone (usuário): re-adicionar à Tela de Início — **iOS cacheia o ícone**;
  precisa REMOVER o atalho antigo e adicionar de novo p/ ver o novo.
- Gate final: `npm test` + `npm run check` verdes (nada de src tocado, mas
  barato); commit só após aprovação visual do usuário.

## Riscos

- **Marca Anthropic**: aproximação própria + uso pessoal = ok pragmático;
  não distribuir. (Se um dia abrir o repo, trocar por arte neutra.)
- **Cache do iOS**: ícone antigo persistindo → sempre re-adicionar o atalho.
- **Filtros SVG em favicon**: alguns browsers rasterizam favicon sem filtros —
  o data URI inline pode perder o glow na aba (16px, imperceptível); o que
  importa (home screen) usa o PNG rasterizado com tudo.

## Estimativa

| Fase | Esforço |
|---|---|
| 1 (spec) | já embutida acima — 0 extra |
| 2 (SVG) | ~40 linhas de SVG + data URI |
| 3 (PNG) | 1 eval no preview + 2 arquivos |
| 4 (verificação) | 10 min |

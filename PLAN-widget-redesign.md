# PLAN: Redesign do widget Scriptable (Claude Island)

## Decisão assumida (do turno anterior — sobrescreva se discordar)

**Heat mantido**: a cor do anel continua sinalizando consumo (verde → laranja →
vermelho). Num monitor de uso, cor carregando informação > cor como identidade.
A identidade do novo ícone (fundo escuro + coral `#d97757`) entra no **chrome**:
fundo, marca starburst e acentos — não no anel.

## Escopo proibido

- **NÃO tocar** o contrato `/api/usage`, o frontend do app (pill/painel), nem
  qualquer arquivo além de `agent-command-center/widget-scriptable.js`.
- **NÃO mudar o comportamento**: máquina de 3 estados (ativo/ocioso/offline),
  countdown nativo via `applyTimerStyle`, cache em disco, extrapolação `≈` do
  custo e `refreshAfterDate` 10/60min ficam como estão. Redesign = camada visual.
- **NÃO adicionar dependência** (Scriptable é self-contained).

## Contexto (recon — código lido nesta sessão)

Problemas do visual atual:
1. **Anel granulado**: 120 pontos via `fillEllipse` — os pontos são visíveis.
2. **Fundo chapado** `#0c0c10` — o ícone novo tem gradiente + vidro; o widget destoa.
3. **Layout medium desperdiça espaço**: anel como `backgroundImage` full-bleed
   com o texto empilhado por cima — no medium (retangular), o anel distorce a
   composição e o timer colide visualmente com o arco.
4. `INDIGO` é constante morta (sobra do ícone antigo).
5. Payload já traz `history` — o custo "hoje" está disponível e não é exibido.

## Spec de design (Fase 1 — embutida, decisão Fable)

- **Fundo**: `widget.backgroundGradient` (LinearGradient diagonal
  `#24242e → #0a0a0e`), eco do ícone. Sem imagem de fundo full-bleed.
- **Anel liso**: continuar em `DrawContext` (não há arco nativo), mas com
  ~300 passos e espaçamento < espessura → banda contínua, sem pontos visíveis.
  Track escuro `#2a2a33`; progresso na cor de heat; **ponta do arco** com um
  dot levemente maior + halo coral 30% (acabamento).
- **Marca**: mini starburst coral de 8 raios (~10px) desenhado no `DrawContext`
  do anel (canto do widget) — assinatura do ícone sem roubar atenção.
- **Layouts por família**:
  - `small`: anel centrado como imagem (não background), timer nativo ABAIXO do
    anel (não sobreposto — resolve a colisão), depois `{pct}% consumido` e custo `≈`.
  - `medium`: **anel à esquerda** (imagem quadrada), coluna de stats à direita:
    timer nativo (grande), `reset às HH:MM`, custo `≈` do bloco, burn `US$ X/h`,
    e **hoje: US$ Y** (soma de `history` onde `dia == hoje`; `—` se null).
  - `accessoryCircular`: como está (anel + pct), só herda o anel liso.
- **Tipografia**: `Font.mediumSystemFont` p/ labels, `boldMonospacedSystemFont`
  p/ números (timer e custo alinham dígitos). Labels em MUTED, números em FG.
- **Offline**: badge discreto no rodapé (`offline HH:MM` em coral, não vermelho
  — vermelho fica reservado ao heat de consumo alto).

## Fases

### Fase 2 — Implementação (Opus, effort medium)
- **Arquivo**: `agent-command-center/widget-scriptable.js` (único).
- Ordem: fundo gradiente → anel liso (função `desenharAnel` reescrita, agora
  retornando imagem quadrada dimensionada por família) → starburst na marca →
  layouts small/medium (stacks horizontais no medium via `w.addStack()`) →
  custo "hoje" de `history` → remover `INDIGO` → estados 2/3/4 herdando o chrome.
- **Edge cases**:
  - `history` vazio ou sem o dia atual → "hoje: —" (nunca 0).
  - Fuso: `dia` do history é `date(updated_at)` em UTC — comparar com a data
    UTC de agora (não local), documentar no comentário.
  - `pct_consumed > 1` → `Math.min(1, frac)` já existe no anel; manter no texto
    (`>100%` pode aparecer no label, é informação real — não capar o TEXTO).
  - Medium: `addStack` + `addSpacer` têm comportamento diferente de widget body;
    timer nativo dentro de stack funciona (`stack.addDate`).
  - `accessoryCircular` ignora backgroundGradient em lock screen (iOS impõe
    material) — inofensivo, não condicionar.
- **Gate**: `node --check widget-scriptable.js`; diff não toca nenhuma linha da
  máquina de estados/cache/refresh além de mover chamadas de render.

### Fase 3 — Review + verificação no aparelho (Fable high + usuário)
- Review (read-only): estados preservados? `applyTimerStyle` continua fora de
  string estática? null nunca vira 0? nenhum fetch novo?
- Usuário: recolar o script no Scriptable (o widget na home screen atualiza
  sozinho na próxima execução — não precisa recriar o widget), testar os 3
  estados e mandar screenshot.
- **Gate final**: aprovação visual do usuário; commit só depois.

## Riscos

- **Renderização só verificável no aparelho**: não há como rodar Scriptable no
  PC. Mitigação: mudanças de layout usam APIs já provadas no script atual
  (`addStack`/`addDate`/`DrawContext`); o review da Fase 3 foca em regressão de
  comportamento, e o visual é validado por screenshot do usuário.
- **Medium com anel como imagem em stack**: dimensionamento de imagem em stack
  do Scriptable às vezes estica — fixar `img.imageSize` explícito.

## Estimativa

| Fase | Esforço |
|---|---|
| 2 (implementação) | ~80 linhas alteradas no arquivo único |
| 3 (review + device) | 15 min + screenshot do usuário |

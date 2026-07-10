# Agent Command Center

Cockpit local-first para indexar sessões reais Claude Code e Codex, skills, hooks, projetos e prompts. O servidor escuta apenas em `127.0.0.1`, usa SQLite local e não chama APIs externas.

## Executar

Requer Node.js 22.5+.

```powershell
cd agent-command-center
rtk npm start
```

Abra `http://127.0.0.1:4310`. O primeiro scan usa `~/.codex/sessions`, `~/.claude/projects` e `~/.claude/sessions`. Ajuste os caminhos em Settings e clique em **Reescanear**.

## Verificar

```powershell
rtk npm test
rtk npm run check
```

## Privacidade

- leitura de sessões e configurações; nenhuma ação destrutiva;
- arquivos acima de 25 MB são rejeitados;
- segredos conhecidos são redigidos antes da persistência;
- conteúdo bruto completo não é copiado: somente até 500 eventos e 10 KB por evento;
- templates de hooks nunca são instalados automaticamente.

## Widget no iPhone

O app é instalável e traz um widget nativo de acompanhamento do bloco de 5h. O iPhone acessa o PC via Tailscale (`https://<sua-tailnet>/`).

### PWA (ícone na home screen)

1. Abra o app no Safari do iPhone (via URL do Tailscale).
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abre em modo standalone (sem a barra do Safari), com o ícone do ACC.

`ponytail:` os ícones são SVG (`public/icon.svg`, sem dependência de imagem). O manifest aceita SVG normalmente; para `apple-touch-icon` o iOS historicamente prefere PNG raster, mas o iOS 16+ costuma aceitar SVG. **Teto conhecido:** em iOS antigo o ícone da home screen pode cair no genérico (screenshot da página) — upgrade path é gerar PNGs 180/512 e referenciá-los, sem trocar o resto.

### Widget do Scriptable (home + lock screen, com countdown ao vivo)

1. Instale o app **Scriptable** (App Store).
2. Crie um script novo, cole o conteúdo de `widget-scriptable.js`.
3. No topo do script, troque `API_URL` pela URL `/api/usage` da sua tailnet.
4. Rode o script uma vez dentro do app para ver o preview.
5. Na home/lock screen: adicione um widget do Scriptable, escolha o script.

O countdown até o reset do bloco tica **ao vivo** sem re-rodar o script — usa `addDate(...).applyTimerStyle()`, renderizado pelo próprio iOS. Estados: bloco ativo (anel + timer + custo `≈` estimado), sem bloco (`0% consumido · sessão ainda não iniciada`), e offline (último dado em cache com marca `offline HH:MM`).

## Limitações do MVP

Status é inferido por eventos e recência. Custo só aparece quando o formato fornece esse dado. O frontend é deliberadamente mínimo; o backend e os contratos `/api/*` são o foco desta versão.

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

## Limitações do MVP

Status é inferido por eventos e recência. Custo só aparece quando o formato fornece esse dado. O frontend é deliberadamente mínimo; o backend e os contratos `/api/*` são o foco desta versão.

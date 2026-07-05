# Formatos de sessão

- Codex: rollouts JSONL com `session_meta`, `turn_context` e payloads de mensagem.
- Claude Code: JSONL em `~/.claude/projects`; campos variam e são normalizados por papel/tipo/conteúdo.
- Desconhecido: caminho, timestamps e snippet redigido são preservados com warning explícito.

Ausência de model, tokens, custo ou projeto vira `null`/“não detectado”; nunca derruba o scan.

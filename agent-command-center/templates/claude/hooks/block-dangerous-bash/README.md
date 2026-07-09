# block-dangerous-bash

Evento: `PreToolUse`. Template desabilitado por padrão.

## Instalação manual

Revise `script.js`, copie o diretório e adicione o exemplo abaixo ao evento correto em `~/.claude/settings.json`:

```json
{"matcher":"*","hooks":[{"type":"command","command":"node /CAMINHO/block-dangerous-bash/script.js"}]}
```

## Segurança

Não executa comandos externos. Teste com entrada sintética antes de habilitar. Para desabilitar, remova apenas esta entrada do settings.

# notify-when-waiting-for-input

Evento: `Notification`. Template desabilitado por padrão.

## Instalação manual

Revise `script.js`, copie o diretório e adicione o exemplo abaixo ao evento correto em `~/.claude/settings.json`:

```json
{"matcher":"*","hooks":[{"type":"command","command":"node /CAMINHO/notify-when-waiting-for-input/script.js"}]}
```

## Segurança

Não executa comandos externos. Teste com entrada sintética antes de habilitar. Para desabilitar, remova apenas esta entrada do settings.

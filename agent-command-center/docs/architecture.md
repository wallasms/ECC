# Arquitetura

`public` chama a API HTTP local. `server.js` controla rotas, config e SQLite. `scanner.js` descobre arquivos somente em caminhos configurados, compara mtime/tamanho e persiste mudanças. `parsers.js` normaliza JSONL Claude/Codex e aplica fallback textual. Dados permanecem em `data/`, ignorados pelo Git.

O controlador de linguagem natural retorna ações determinísticas (`page`, `filters`, `query`); pode ser substituído por Page Agent ou LLM futuro sem alterar telas ou scanners.

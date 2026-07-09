# Agent Command Center

Aplicação local-first: Node nativo, SQLite e frontend estático. `src/parsers.js` normaliza formatos; `src/scanner.js` faz descoberta read-only e incremental; `src/server.js` expõe a API somente em localhost.

- Comandos: `rtk npm start`, `rtk npm test`, `rtk npm run check`.
- Ponytail full: stdlib e menor diff correto; não introduza framework sem necessidade medida.
- Nunca enviar sessões a APIs externas, imprimir segredos ou bindar em interface pública.
- Parsers devem falhar de forma parcial e visível; formato desconhecido usa fallback.
- UI usa system fonts, superfícies claras, whitespace e estados acessíveis.
- Lógica não trivial exige o menor teste Node executável.

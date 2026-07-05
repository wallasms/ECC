import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const skills = {
  claude: ['ui-polish-apple','session-summary','alm-dashboard-review','prompt-context-builder','hook-safety-review','skill-librarian'],
  codex: ['ui-polish-apple','repo-cleanup','context-pack-generator','alm-report-engineer','codex-cost-optimizer','session-parser-engineer']
};
const descriptions = {
  'ui-polish-apple':'Polir interfaces com hierarquia, tipografia e espaçamento inspirados em produtos Apple.',
  'session-summary':'Resumir sessões locais com fatos rastreáveis, pendências e arquivos tocados.',
  'alm-dashboard-review':'Revisar dashboards ALM para leitura executiva, DV01, liquidez e ALCO.',
  'prompt-context-builder':'Montar prompts e context packs mínimos sem perder restrições críticas.',
  'hook-safety-review':'Revisar hooks quanto a comandos destrutivos, vazamento e falhas abertas.',
  'skill-librarian':'Auditar skills duplicadas, amplas ou sem metadados.',
  'repo-cleanup':'Remover dívida e arquivos mortos com diff pequeno e verificável.',
  'context-pack-generator':'Gerar pacote de contexto enxuto e rastreável para Codex.',
  'alm-report-engineer':'Produzir relatórios ALM reprodutíveis com números antes de adjetivos.',
  'codex-cost-optimizer':'Reduzir tokens via seleção de contexto, RTK e roteamento simples.',
  'session-parser-engineer':'Criar parsers tolerantes para logs de agentes com fallbacks seguros.'
};
for (const [platform, names] of Object.entries(skills)) for (const name of names) {
  const file = join(root, platform, 'skills', name, 'SKILL.md'); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `---\nname: ${name}\ndescription: "${descriptions[name]}"\n---\n\n# ${name}\n\n## Quando usar\n\nUse quando o pedido corresponder diretamente à descrição.\n\n## Quando não usar\n\nNão use para trabalho adjacente, ações destrutivas ou quando faltarem dados essenciais.\n\n## Procedimento\n\n1. Inspecione fontes e restrições relevantes.\n2. Escolha a menor solução correta e rastreável.\n3. Execute sem expor segredos ou enviar dados externamente.\n4. Valide o resultado com o menor check executável.\n\n## Saída esperada\n\nArtefato pronto, fontes usadas, limitações e próximo passo.\n\n## Checklist de validação\n\n- [ ] Requisito atendido\n- [ ] Dados sensíveis redigidos\n- [ ] Sem dependência ou abstração desnecessária\n- [ ] Verificação executada\n`);
}

const agents = {
  'explore-agent':'Exploração read-only do codebase antes de editar.',
  'ui-polish-agent':'Hierarquia visual, acessibilidade e acabamento Apple-style.',
  'code-review-agent':'Riscos de correção, segurança e testes ausentes.',
  'alm-domain-agent':'ALM, IRRBB, liquidez e convenções de relatórios para ALCO.',
  'skill-librarian-agent':'Qualidade, duplicidade e escopo de skills.'
};
for (const [name, description] of Object.entries(agents)) {
  const file = join(root, 'claude', 'agents', `${name}.md`); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `---\nname: ${name}\ndescription: "${description}"\ntools: Read, Grep, Glob\n---\n\n# ${name}\n\n${description}\n\nTrabalhe de forma local, não destrutiva e apresente evidências verificáveis.\n`);
}

for (const [file, focus] of Object.entries({'AGENTS.md':'regras compartilhadas','AGENTS.ui.md':'UI e acessibilidade','AGENTS.alm.md':'domínio ALM','AGENTS.review.md':'review e testes'})) {
  const path = join(root, 'codex', 'agents-md', file); mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# ${file}\n\nFoco: ${focus}.\n\n- Local-first; nenhuma API externa.\n- Ponytail full: menor diff correto.\n- Use RTK nos comandos suportados.\n- Preserve segurança, validação e privacidade.\n- Termine com o menor teste relevante.\n`);
}

const hooks = {
  'notify-when-waiting-for-input':'Notification', 'block-dangerous-bash':'PreToolUse',
  'format-after-edit':'PostToolUse', 'capture-session-event':'PostToolUse',
  'summarize-test-failure':'PostToolUse', 'filter-large-output':'PostToolUse'
};
for (const [name, event] of Object.entries(hooks)) {
  const dir = join(root, 'claude', 'hooks', name); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'README.md'), `# ${name}\n\nEvento: \`${event}\`. Template desabilitado por padrão.\n\n## Instalação manual\n\nRevise \`script.js\`, copie o diretório e adicione o exemplo abaixo ao evento correto em \`~/.claude/settings.json\`:\n\n\`\`\`json\n{"matcher":"*","hooks":[{"type":"command","command":"node /CAMINHO/${name}/script.js"}]}\n\`\`\`\n\n## Segurança\n\nNão executa comandos externos. Teste com entrada sintética antes de habilitar. Para desabilitar, remova apenas esta entrada do settings.\n`);
  const logic = name === 'block-dangerous-bash'
    ? `const dangerous=/(?:rm\\s+-rf|git\\s+reset\\s+--hard|format\\s+[a-z]:|Remove-Item.+-Recurse)/i;process.exit(dangerous.test(input)?2:0);`
    : `process.stdout.write(JSON.stringify({ok:true,template:${JSON.stringify(name)}}));`;
  writeFileSync(join(dir, 'script.js'), `'use strict';\nlet input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{${logic}});\n`);
}
const codex = join(root, 'codex', 'hooks', 'README.md'); mkdirSync(dirname(codex), { recursive: true });
writeFileSync(codex, '# Codex hooks\n\nPlaceholder seguro. A configuração ECC local informa que Codex ainda não possui paridade com hooks Claude. Verifique a documentação da versão instalada antes de implementar; nenhum hook é habilitado por este projeto.\n');
console.log('Templates gerados em', root);

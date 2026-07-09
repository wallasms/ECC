'use strict';
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const dangerous=/(?:rm\s+-rf|git\s+reset\s+--hard|format\s+[a-z]:|Remove-Item.+-Recurse)/i;process.exit(dangerous.test(input)?2:0);});

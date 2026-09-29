/*
 * CLI for the hashed private-term register (scripts/private-terms.mjs), used
 * by the identity & language CI gate. Kept separate so the register module
 * stays free of Node-only imports.
 */
import { readFileSync } from 'node:fs';
import { termHash, findPrivateTerms } from './private-terms.mjs';

// CLI: `--hash <word>` prints a register value; otherwise each argument is a
// file to scan, reported as file:line and exiting 1 on any hit.
const args = process.argv.slice(2);
if (args[0] === '--hash') {
  for (const w of args.slice(1)) console.log(termHash(w));
  process.exit(0);
}
let fail = 0;
for (const f of args) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const hit of findPrivateTerms(line)) {
      console.log(`${f}:${i + 1}: private ${hit.kind}`);
      console.log(`::error file=${f},line=${i + 1}::Private ${hit.kind} on a public surface.`);
      fail = 1;
    }
  });
}
process.exit(fail);

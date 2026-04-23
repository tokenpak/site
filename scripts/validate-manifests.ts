/*
 * Manifest validator. Validates every schemas/*.schema.json against its
 * matching data/*.json. Missing data files are tolerated (not every
 * manifest exists yet in Phase 1 — releases + docs-links arrive in
 * PR#8 + PR#9). Schema failures are hard build failures.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const pairs: Array<{ schema: string; data: string; required: boolean }> = [
  { schema: 'product-config.schema.json', data: 'product-config.json', required: true },
  { schema: 'releases.schema.json',       data: 'releases.json',       required: false },
  { schema: 'docs-links.schema.json',     data: 'docs-links.json',     required: false },
];

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

let failed = 0;
let skipped = 0;
let passed = 0;

for (const { schema, data, required } of pairs) {
  const schemaPath = path.join(repoRoot, 'schemas', schema);
  const dataPath = path.join(repoRoot, 'data', data);

  if (!fs.existsSync(schemaPath)) {
    if (required) {
      console.error(`FAIL ${schema}: schema missing (required)`);
      failed++;
    } else {
      console.log(`SKIP ${schema}: schema not yet present (tolerated in Phase 1)`);
      skipped++;
    }
    continue;
  }

  if (!fs.existsSync(dataPath)) {
    if (required) {
      console.error(`FAIL ${data}: data missing (required)`);
      failed++;
    } else {
      console.log(`SKIP ${data}: data not yet present (tolerated)`);
      skipped++;
    }
    continue;
  }

  const schemaDoc = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const dataDoc = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const validate = ajv.compile(schemaDoc);

  if (validate(dataDoc)) {
    console.log(`PASS ${data} validates against ${schema}`);
    passed++;
  } else {
    console.error(`FAIL ${data} fails ${schema}:`);
    for (const err of validate.errors ?? []) {
      console.error(`  - ${err.instancePath || '<root>'}: ${err.message} ${JSON.stringify(err.params)}`);
    }
    failed++;
  }
}

console.log(`\nSummary: ${passed} pass, ${skipped} skip, ${failed} fail`);
if (failed > 0) process.exit(1);

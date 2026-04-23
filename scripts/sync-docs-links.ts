/*
 * Fetch docs-links.yaml from tokenpak/docs@main, resolve relative URLs
 * against config.docs_base_url, and write data/docs-links.json.
 *
 * tokenpak/docs owns the content; this site repo only consumes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'data', 'docs-links.json');
const configPath = path.join(repoRoot, 'data', 'product-config.json');

const RAW_YAML_URL = 'https://raw.githubusercontent.com/tokenpak/docs/main/docs-links.yaml';

interface RawLink {
  title: string;
  url: string;
  section: string;
  description: string;
  updated_at?: string;
  source_hint?: string;
}

function parseSimpleYamlList(yaml: string): RawLink[] {
  // Minimal YAML parser for the flat docs-links.yaml shape
  // (list of mappings, scalar string values only, no nesting).
  const items: RawLink[] = [];
  let current: Partial<RawLink> | null = null;

  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    if (line.startsWith('- ')) {
      if (current) items.push(current as RawLink);
      current = {};
      const firstKV = line.slice(2);
      const m = firstKV.match(/^([a-z_]+):\s*(.*)$/);
      if (m) (current as Record<string, string>)[m[1]] = stripQuotes(m[2]);
    } else if (line.startsWith('  ')) {
      if (!current) throw new Error(`Unexpected key outside of list item: ${line}`);
      const m = line.trim().match(/^([a-z_]+):\s*(.*)$/);
      if (m) (current as Record<string, string>)[m[1]] = stripQuotes(m[2]);
    }
  }
  if (current) items.push(current as RawLink);
  return items;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { docs_base_url: string };
  const docsBase = config.docs_base_url.replace(/\/+$/, '');

  const headers: Record<string, string> = { Accept: 'text/plain' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(RAW_YAML_URL, { headers });
  if (res.status === 404) {
    console.warn(`docs-links.yaml not yet present at ${RAW_YAML_URL}; writing empty manifest.`);
    fs.writeFileSync(outPath, '[]\n', 'utf8');
    return;
  }
  if (!res.ok) {
    throw new Error(`docs-links fetch ${res.status} ${res.statusText}`);
  }

  const yaml = await res.text();
  const raw = parseSimpleYamlList(yaml);

  const resolved = raw.map((link) => {
    const url = link.url.startsWith('http') ? link.url : `${docsBase}${link.url.startsWith('/') ? '' : '/'}${link.url}`;
    return { ...link, url };
  });

  fs.writeFileSync(outPath, JSON.stringify(resolved, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${resolved.length} docs-links to ${outPath}`);
}

main().catch((err) => {
  console.error('sync-docs-links failed:', err.message);
  process.exit(1);
});

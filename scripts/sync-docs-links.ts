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

// GitHub Contents API returns base64-encoded file content with proper
// Authorization: Bearer handling for private repos. raw.githubusercontent.com
// does not reliably serve private-repo content with a Bearer header —
// GitHub returns 404 instead of 403, which is indistinguishable from
// "file absent" at the HTTP layer. The Contents API is the supported path.
const CONTENTS_API_URL = 'https://api.github.com/repos/tokenpak/docs/contents/docs-links.yaml?ref=main';

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

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(CONTENTS_API_URL, { headers });
  if (res.status === 404) {
    console.warn(
      `docs-links.yaml not found at ${CONTENTS_API_URL} (404). If the repo ` +
      `is private, confirm MAIN_REPO_TOKEN has contents:read on tokenpak/docs. ` +
      `Writing empty manifest.`,
    );
    fs.writeFileSync(outPath, '[]\n', 'utf8');
    return;
  }
  if (!res.ok) {
    throw new Error(`docs-links fetch ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { content?: string; encoding?: string };
  if (!body.content || body.encoding !== 'base64') {
    throw new Error(`docs-links contents API returned unexpected shape: ${JSON.stringify(body).slice(0, 200)}`);
  }
  const yaml = Buffer.from(body.content, 'base64').toString('utf8');
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

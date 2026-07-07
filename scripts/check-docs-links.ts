/*
 * Validate site-owned docs links against the live docs sitemap.
 *
 * Redirect compatibility pages may not appear in the sitemap, so a URL passes
 * when either the URL itself is listed or its canonical/refresh target is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const docsLinksPath = path.join(repoRoot, 'data', 'docs-links.json');
const productConfigPath = path.join(repoRoot, 'data', 'product-config.json');

interface DocsLink {
  title?: string;
  url?: string;
}

interface ProductConfig {
  docs_base_url: string;
  cta_urls?: Record<string, string>;
}

interface Candidate {
  source: string;
  url: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl, baseUrl);
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

function extractLocs(xml: string): Set<string> {
  const locs = new Set<string>();
  const locPattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locPattern.exec(xml)) !== null) {
    locs.add(normalizeUrl(match[1]));
  }
  return locs;
}

function extractRedirectTargets(html: string, pageUrl: string): string[] {
  const targets: string[] = [];

  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
  const href = canonical?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (href) targets.push(normalizeUrl(href, pageUrl));

  const refresh = html.match(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/i)?.[0];
  const content = refresh?.match(/\bcontent=["']([^"']+)["']/i)?.[1];
  const target = content?.match(/url=([^;]+)$/i)?.[1]?.trim();
  if (target) targets.push(normalizeUrl(target, pageUrl));

  return targets;
}

function collectCandidates(config: ProductConfig, docsLinks: DocsLink[]): Candidate[] {
  const docsBase = normalizeUrl(config.docs_base_url);
  const candidates = new Map<string, Candidate>();

  for (const [index, link] of docsLinks.entries()) {
    if (!link.url) continue;
    const url = normalizeUrl(link.url, docsBase);
    if (url.startsWith(docsBase)) {
      candidates.set(`docs-links:${url}`, {
        source: `data/docs-links.json[${index}] ${link.title ?? 'untitled'}`,
        url,
      });
    }
  }

  for (const [name, value] of Object.entries(config.cta_urls ?? {})) {
    if (!value.startsWith(config.docs_base_url)) continue;
    const url = normalizeUrl(value, docsBase);
    candidates.set(`cta:${name}:${url}`, {
      source: `data/product-config.json cta_urls.${name}`,
      url,
    });
  }

  return Array.from(candidates.values()).sort((a, b) =>
    a.url.localeCompare(b.url) || a.source.localeCompare(b.source),
  );
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'tokenpak-site-docs-link-check',
      Accept: 'text/html,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`${url} returned ${res.status} ${res.statusText}`);
  }

  return res.text();
}

async function main() {
  const config = readJson<ProductConfig>(productConfigPath);
  const docsLinks = readJson<DocsLink[]>(docsLinksPath);
  const docsBase = normalizeUrl(config.docs_base_url);
  const sitemapUrl = process.env.DOCS_SITEMAP_URL ?? new URL('sitemap.xml', docsBase).toString();
  const candidates = collectCandidates(config, docsLinks);

  if (candidates.length === 0) {
    throw new Error('No docs-link candidates found to validate.');
  }

  const sitemap = await fetchText(sitemapUrl);
  const sitemapUrls = extractLocs(sitemap);
  const failures: string[] = [];

  for (const candidate of candidates) {
    if (sitemapUrls.has(candidate.url)) {
      console.log(`PASS ${candidate.source} -> ${candidate.url}`);
      continue;
    }

    const html = await fetchText(candidate.url);
    const redirectTargets = extractRedirectTargets(html, candidate.url);
    const matchingTarget = redirectTargets.find((target) => sitemapUrls.has(target));

    if (matchingTarget) {
      console.log(`PASS ${candidate.source} -> ${candidate.url} -> ${matchingTarget}`);
      continue;
    }

    const expectedOrigin = new URL(docsBase).origin;
    const sameOriginSitemapSample = Array.from(sitemapUrls)
      .filter((url) => new URL(url).origin === expectedOrigin)
      .slice(0, 5)
      .join(', ');
    const quotedTargets = redirectTargets.length > 0 ? redirectTargets.join(', ') : 'none';
    failures.push(
      `${candidate.source} -> ${candidate.url} is not in ${sitemapUrl}; ` +
      `canonical/refresh targets in sitemap: ${quotedTargets}. ` +
      `Sitemap sample: ${sameOriginSitemapSample}`,
    );
  }

  if (failures.length > 0) {
    console.error(`FAIL docs link check: ${failures.length} broken link(s)`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`PASS docs link check: ${candidates.length} site docs URL(s) validated against ${sitemapUrl}`);
}

main().catch((err) => {
  const redacted = err instanceof Error
    ? err.message.replace(new RegExp(escapeRegExp(process.cwd()), 'g'), '<repo>')
    : String(err);
  console.error(`check-docs-links failed: ${redacted}`);
  process.exit(1);
});

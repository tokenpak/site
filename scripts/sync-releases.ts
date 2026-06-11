/*
 * Fetch GitHub Releases for tokenpak/tokenpak, map to the releases.json
 * shape, write to data/releases.json. Marks exactly one entry as
 * latest=true (the non-prerelease with the highest published_at).
 *
 * Authenticated via GITHUB_TOKEN env var when available (CI default).
 * Falls back to unauthenticated requests locally (rate-limited, fine for
 * the dev-time spot-check).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'data', 'releases.json');

const OWNER = 'tokenpak';
const REPO = 'tokenpak';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=50`;

interface GhAsset { name: string; browser_download_url: string }
interface GhRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  created_at: string;
  html_url: string;
  assets: GhAsset[];
}

function tagToVersion(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

function firstParagraph(body: string | null): string {
  if (!body) return '';
  const trimmed = body.trim();
  const idx = trimmed.indexOf('\n\n');
  return (idx === -1 ? trimmed : trimmed.slice(0, idx)).slice(0, 600);
}

// Public-safe defaults: private home-config paths (e.g. `~/.<tool>/…` or
// `/home/<user>/.<tool>/…`) should not appear in published release notes.
// Upstream GitHub Release bodies are copied verbatim by this sync, so
// genericize those paths on import — this keeps the generated
// data/releases.json (and the deployed /releases pages) public-safe on EVERY
// sync, so a newly-published release body containing such a path cannot
// re-leak it. This is the durable recurrence-prevention layer behind any
// one-shot data scrub.
//
// Allowlisted home-config dirs are preserved (and normalized to ~-form):
// the product's own `~/.tokenpak/*`, the generic `~/.openclaw-governor/*`
// placeholder, and the documented third-party CLI config dirs `~/.codex/*`
// and `~/.claude/*` (generic, no host/user disclosure — kept by review).
// Every other `~/.<tool>` / `/home/<user>/.<tool>` home-config prefix
// (e.g. the fleet's own runtime dir, or any future unknown tool) is replaced
// with a neutral `<config-dir>` placeholder while the meaningful tail is kept.
// The bare integration name (e.g. "OpenClaw") is allowlisted and untouched —
// only private *paths* are genericized.
const ALLOWED_DOTDIRS = new Set(['tokenpak', 'openclaw-governor', 'codex', 'claude']);

export function sanitizeBody(body: string | null): string | null {
  if (body == null) return body;
  return body.replace(
    /(?:~|\/home\/[A-Za-z0-9._-]+)\/\.([A-Za-z0-9._-]+)/g,
    (match: string, dotdir: string) =>
      ALLOWED_DOTDIRS.has(dotdir)
        ? match.replace(/^\/home\/[A-Za-z0-9._-]+/, '~')
        : '<config-dir>',
  );
}

async function main() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(API, { headers });
  if (res.status === 404 || res.status === 403) {
    // Source repo may be private and unreadable by the default workflow
    // GITHUB_TOKEN (which is scoped to this repo only). Degrade gracefully:
    // write an empty array so downstream pages render their empty-state
    // rather than failing the whole build. Setting a cross-repo-read PAT
    // as MAIN_REPO_TOKEN (and wiring it in sync-release-data.yml) flips
    // this on once tokenpak/tokenpak is readable.
    console.warn(
      `GitHub API ${res.status} on ${API}. Source likely private for this token; ` +
      `writing empty releases.json and exiting cleanly.`,
    );
    fs.writeFileSync(outPath, '[]\n', 'utf8');
    return;
  }
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText}`);
  }
  const ghReleases = (await res.json()) as GhRelease[];

  const published = ghReleases.filter((r) => !r.draft);
  const mapped = published.map((r) => {
    const version = tagToVersion(r.tag_name);
    const body = sanitizeBody(r.body);
    return {
      version,
      published_at: r.published_at ?? r.created_at,
      title: r.name?.trim() || `TokenPak ${version}`,
      summary: firstParagraph(body),
      body_markdown: body ?? '',
      changelog_url: `https://github.com/${OWNER}/${REPO}/blob/main/CHANGELOG.md`,
      github_release_url: r.html_url,
      pypi_url: `https://pypi.org/project/${REPO}/${version}/`,
      prerelease: r.prerelease,
    };
  });

  // Mark latest = most recent non-prerelease.
  const latestIdx = mapped
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.prerelease)
    .sort((a, b) => Date.parse(b.r.published_at) - Date.parse(a.r.published_at))[0]?.i;

  const final = mapped.map((r, i) => ({ ...r, latest: i === latestIdx }));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(final, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${final.length} releases to ${outPath}; latest=${final[latestIdx]?.version ?? '(none)'}`);
}

// Only run the network sync when invoked directly (`tsx scripts/sync-releases.ts`).
// Importing this module (e.g. from the unit test) must not fire the API call.
const invokedDirectly =
  !!process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error('sync-releases failed:', err.message);
    process.exit(1);
  });
}

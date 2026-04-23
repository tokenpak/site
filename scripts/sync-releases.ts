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
    return {
      version,
      published_at: r.published_at ?? r.created_at,
      title: r.name?.trim() || `TokenPak ${version}`,
      summary: firstParagraph(r.body),
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

main().catch((err) => {
  console.error('sync-releases failed:', err.message);
  process.exit(1);
});

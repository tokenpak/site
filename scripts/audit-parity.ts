/*
 * Phase 3 / mini-3F content-parity audit.
 *
 * For every canonical claim the site makes (savings %, latency,
 * compatibility list, feature-count anchors), fetch each upstream
 * surface — tokenpak/tokenpak:README.md, tokenpak/docs:*.md via the
 * Contents API — and check that the same claim is stated consistently
 * wherever it appears.
 *
 * A "claim" is a named regex that should match on every surface where
 * it applies. If it matches on the site but not on README / docs, or
 * if the values differ across surfaces, we flag it.
 *
 * Output: docs/audits/phase-3-parity-YYYY-MM-DD/
 *   index.md           — human-readable rollup + per-claim detail
 *   findings.json      — raw findings for CI consumption
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const OUT_DIR = path.join(repoRoot, 'docs', 'audits', `phase-3-parity-${new Date().toISOString().slice(0, 10)}`);

// --- Surface definitions ------------------------------------------

interface Surface {
  name: string;
  load(): Promise<string>;
}

function listSiteSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string, exts: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, exts);
      else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
    }
  };
  walk(path.join(repoRoot, 'src'), ['.astro', '.md', '.ts', '.tsx']);
  // data/*.json carry canonical values (e.g., package_paid) referenced
  // dynamically from Astro via {config.*}. Include so claims matched
  // from rendered output pick them up.
  walk(path.join(repoRoot, 'data'), ['.json']);
  return out;
}

const siteText: Surface = {
  name: 'tokenpak/site:src+data',
  async load() {
    return listSiteSources().map((f) => fs.readFileSync(f, 'utf8')).join('\n\n');
  },
};

async function ghContents(owner: string, repo: string, filePath: string, ref: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${owner}/${repo}:${filePath} ${res.status}`);
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (!body.content || body.encoding !== 'base64') return null;
  return Buffer.from(body.content, 'base64').toString('utf8');
}

const tokenpakReadme: Surface = {
  name: 'tokenpak/tokenpak:README.md',
  async load() {
    return (await ghContents('tokenpak', 'tokenpak', 'README.md', 'main')) ?? '';
  },
};

// Curated docs surfaces — the docs-links.yaml entries that live
// naturally adjacent to what the site says.
const docsPages: Surface[] = [
  { name: 'tokenpak/docs:docs/quickstart.md',       async load() { return (await ghContents('tokenpak', 'docs', 'docs/quickstart.md', 'main')) ?? ''; } },
  { name: 'tokenpak/docs:docs/install.md',          async load() { return (await ghContents('tokenpak', 'docs', 'docs/install.md', 'main')) ?? ''; } },
  { name: 'tokenpak/docs:docs/architecture.md',     async load() { return (await ghContents('tokenpak', 'docs', 'docs/architecture.md', 'main')) ?? ''; } },
];

const SURFACES: Surface[] = [siteText, tokenpakReadme, ...docsPages];

// --- Claim definitions --------------------------------------------

interface Claim {
  id: string;
  description: string;
  // A regex whose match returns the canonical claim string.
  // If the regex doesn't match on a given surface, the claim is "absent"
  // there — not a failure unless `requiredOn` names the surface.
  pattern: RegExp;
  // Surfaces where the claim SHOULD appear.
  requiredOn: string[];
  // Optional normalizer: collapse minor formatting differences before comparison.
  normalize?: (match: string) => string;
}

// Normalizers
const norm = {
  dashes: (s: string) => s.replace(/[–—]/g, '-'),
  lower: (s: string) => s.toLowerCase(),
  ws: (s: string) => s.replace(/\s+/g, ' ').trim(),
  combined: (s: string) => norm.ws(norm.dashes(s)).toLowerCase(),
};

const CLAIMS: Claim[] = [
  {
    id: 'savings-range',
    description: 'Savings percentage range for typical agent workloads',
    pattern: /30[–-]50\s*%/,
    requiredOn: ['tokenpak/site:src+data', 'tokenpak/tokenpak:README.md'],
    normalize: norm.combined,
  },
  {
    id: 'latency-bound',
    description: 'Compression overhead latency upper bound',
    // "under 50ms", "<50ms", "less than 50 milliseconds"
    pattern: /(?:<\s*50\s*ms|under\s*50\s*ms|less than\s*50\s*ms)/i,
    requiredOn: ['tokenpak/site:src+data'],
    normalize: norm.combined,
  },
  {
    id: 'install-command',
    description: 'Canonical install command for OSS package',
    pattern: /pip\s+install\s+tokenpak(?![-_])/,
    requiredOn: ['tokenpak/site:src+data', 'tokenpak/tokenpak:README.md'],
    normalize: norm.combined,
  },
  {
    id: 'paid-package-name',
    description: 'Paid package name (never "tokenpak-pro")',
    pattern: /tokenpak-paid/,
    requiredOn: ['tokenpak/site:src+data'],
    normalize: norm.combined,
  },
  {
    id: 'clients-list-marker',
    description: 'References to the canonical 9-client integration surface',
    // Match any wording that anchors the full client list — look for
    // the distinctive "Claude Code, Cursor" opening.
    pattern: /Claude Code,\s*Cursor/,
    requiredOn: ['tokenpak/site:src+data', 'tokenpak/tokenpak:README.md'],
    normalize: norm.combined,
  },
  {
    id: 'license-apache-2',
    description: 'OSS license declaration',
    pattern: /Apache[\s-]2\.0/,
    requiredOn: ['tokenpak/site:src+data', 'tokenpak/tokenpak:README.md'],
    normalize: norm.combined,
  },
];

// --- Forbidden markers --------------------------------------------
//
// Phrases that should NEVER appear on the site (07 §3 claim boundaries
// + §6 forbidden phrases). A hit on the site surface is a hard finding.

interface Forbidden {
  id: string;
  description: string;
  pattern: RegExp;
  allowWhere?: (surfaceName: string, context: string) => boolean;
}

// 07 §3 + §6 are claim boundaries on marketing copy. Docs repo content
// that uses 'instant' to describe cache-hit timing in a sequence diagram
// or similar technical exposition isn't a marketing claim. Gate the
// strictest phrases to the marketing surfaces (site + README).
const MARKETING_SURFACES = new Set<string>(['tokenpak/site:src+data', 'tokenpak/tokenpak:README.md']);

const FORBIDDEN: Forbidden[] = [
  { id: 'no-90pct',         description: '90 % savings (workload-dependent; forbidden per 07 §3)', pattern: /\b90\s*%\s*savings/i },
  { id: 'no-instant',       description: '"instant" as a latency claim on marketing surfaces (07 §3)',
    pattern: /\binstant\b/i,
    allowWhere: (surfaceName, ctx) =>
      !MARKETING_SURFACES.has(surfaceName) || /instantiat|instance|instant-?on/i.test(ctx) },
  { id: 'no-zero-overhead', description: '"zero overhead" (07 §3)',                                pattern: /zero\s*overhead/i },
  { id: 'no-fully-private', description: '"fully private" (07 §3 — requests go to providers)',    pattern: /fully\s*private/i },
  { id: 'no-no-setup',      description: '"no setup" (07 §3 — there is setup)',                    pattern: /\bno\s*setup\b/i },
  { id: 'no-tokenpak-pro',  description: 'tokenpak-pro — wrong package name (07 §5.4)',           pattern: /tokenpak[-_]pro\b/i },
  { id: 'no-marketing-filler-rev',      description: 'marketing filler: revolutionary',           pattern: /\brevolutionary\b/i },
  { id: 'no-marketing-filler-gamech',   description: 'marketing filler: game-changing',           pattern: /\bgame[-\s]?changing\b/i },
  { id: 'no-marketing-filler-cutedge',  description: 'marketing filler: cutting-edge',            pattern: /\bcutting[-\s]?edge\b/i },
  { id: 'no-marketing-filler-indlead',  description: 'marketing filler: industry-leading',        pattern: /\bindustry[-\s]?leading\b/i },
  { id: 'no-marketing-filler-nextgen',  description: 'marketing filler: next-gen',                pattern: /\bnext[-\s]?gen\b/i },
  { id: 'no-marketing-filler-bestinc',  description: 'marketing filler: best-in-class',           pattern: /\bbest[-\s]?in[-\s]?class\b/i },
];

// --- Run -----------------------------------------------------------

interface Finding {
  kind: 'missing-claim' | 'value-drift' | 'forbidden-hit';
  severity: 'high' | 'medium' | 'low';
  claim: string;
  detail: string;
  surface: string;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const surfaceTexts = new Map<string, string>();
  for (const s of SURFACES) {
    try {
      surfaceTexts.set(s.name, await s.load());
    } catch (err) {
      console.warn(`WARN  ${s.name}: ${(err as Error).message}`);
      surfaceTexts.set(s.name, '');
    }
  }

  const findings: Finding[] = [];
  const claimMatches: Array<{ claim: Claim; matches: Map<string, string | null> }> = [];

  for (const claim of CLAIMS) {
    const matches = new Map<string, string | null>();
    for (const s of SURFACES) {
      const text = surfaceTexts.get(s.name) ?? '';
      const m = text.match(claim.pattern);
      matches.set(s.name, m ? (claim.normalize ? claim.normalize(m[0]) : m[0]) : null);
    }
    claimMatches.push({ claim, matches });

    // 1. Missing on a required surface?
    for (const required of claim.requiredOn) {
      if (!matches.get(required)) {
        findings.push({
          kind: 'missing-claim',
          severity: 'high',
          claim: claim.id,
          surface: required,
          detail: `Expected pattern /${claim.pattern.source}/ to match on ${required} but it did not.`,
        });
      }
    }
    // 2. Value drift between surfaces where both matched?
    const values = Array.from(matches.entries())
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, v as string] as const);
    if (values.length >= 2) {
      const [firstK, firstV] = values[0];
      for (const [k, v] of values.slice(1)) {
        if (v !== firstV) {
          findings.push({
            kind: 'value-drift',
            severity: 'medium',
            claim: claim.id,
            surface: `${firstK} vs ${k}`,
            detail: `Different normalized match: "${firstV}" vs "${v}".`,
          });
        }
      }
    }
  }

  // 3. Forbidden phrases on any surface.
  for (const f of FORBIDDEN) {
    for (const s of SURFACES) {
      const text = surfaceTexts.get(s.name) ?? '';
      const match = text.match(f.pattern);
      if (!match) continue;
      const context = text.slice(Math.max(0, match.index! - 30), (match.index! + match[0].length + 30));
      if (f.allowWhere && f.allowWhere(s.name, context)) continue;
      findings.push({
        kind: 'forbidden-hit',
        severity: 'high',
        claim: f.id,
        surface: s.name,
        detail: `Forbidden phrase "${match[0]}" found — ${f.description}. Context: …${context}…`,
      });
    }
  }

  // --- Emit ---
  fs.writeFileSync(
    path.join(OUT_DIR, 'findings.json'),
    JSON.stringify(findings, null, 2) + '\n',
  );

  const byKind = {
    'missing-claim': findings.filter((f) => f.kind === 'missing-claim').length,
    'value-drift':   findings.filter((f) => f.kind === 'value-drift').length,
    'forbidden-hit': findings.filter((f) => f.kind === 'forbidden-hit').length,
  };

  const lines: string[] = [];
  lines.push(`# Phase 3 content-parity audit (${new Date().toISOString().slice(0, 10)})`);
  lines.push('');
  lines.push('Cross-surface check: every canonical claim the site makes matches the same claim on README + docs; no 07 §3/§6 forbidden phrases anywhere.');
  lines.push('');
  lines.push('## Rollup');
  lines.push('');
  lines.push('| Finding class | Count |');
  lines.push('|---|---|');
  lines.push(`| Missing claim on required surface | ${byKind['missing-claim']} |`);
  lines.push(`| Value drift between surfaces | ${byKind['value-drift']} |`);
  lines.push(`| Forbidden phrase hit | ${byKind['forbidden-hit']} |`);
  lines.push(`| **Total** | **${findings.length}** |`);
  lines.push('');

  lines.push('## Surfaces audited');
  lines.push('');
  for (const s of SURFACES) {
    const text = surfaceTexts.get(s.name) ?? '';
    lines.push(`- \`${s.name}\` — ${text ? `${text.length} chars loaded` : 'empty / unreachable'}`);
  }
  lines.push('');

  lines.push('## Claim match matrix');
  lines.push('');
  lines.push('| Claim | ' + SURFACES.map((s) => `\`${s.name.split(':')[1] ?? s.name}\``).join(' | ') + ' |');
  lines.push('|---' + SURFACES.map(() => '|---').join('') + '|');
  for (const { claim, matches } of claimMatches) {
    const row = SURFACES.map((s) => matches.get(s.name) ? '✅' : '—').join(' | ');
    lines.push(`| \`${claim.id}\` — ${claim.description} | ${row} |`);
  }
  lines.push('');

  if (findings.length > 0) {
    lines.push('## Findings');
    lines.push('');
    for (const f of findings) {
      lines.push(`### [${f.severity}] ${f.kind} — \`${f.claim}\``);
      lines.push('');
      lines.push(`- Surface: \`${f.surface}\``);
      lines.push(`- Detail: ${f.detail}`);
      lines.push('');
    }
  } else {
    lines.push('## Findings');
    lines.push('');
    lines.push('**Zero findings.** All canonical claims match across surfaces; no forbidden phrases anywhere.');
    lines.push('');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.md'), lines.join('\n') + '\n');

  console.log(`SUMMARY missing=${byKind['missing-claim']} drift=${byKind['value-drift']} forbidden=${byKind['forbidden-hit']}`);
  console.log(`Artifacts: ${OUT_DIR}`);

  const hardFail = byKind['forbidden-hit'] > 0 || byKind['missing-claim'] > 0;
  if (hardFail && !process.env.AUDIT_TOLERATE_FINDINGS) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('audit-parity failed:', err);
  process.exit(1);
});

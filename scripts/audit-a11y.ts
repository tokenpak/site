/*
 * Phase 2 accessibility + mobile-baseline audit runner.
 *
 * For each live route:
 *   1. Navigate via headless Chromium.
 *   2. Run axe-core WCAG 2.1 AA; emit JSON + summary line.
 *   3. Switch viewport to 375 x 667 (iPhone SE / 22 §19 spec).
 *   4. Capture full-page PNG screenshot.
 *   5. Measure document scrollWidth vs clientWidth; flag horizontal overflow.
 *
 * Emits artifacts under docs/audits/phase-2-YYYY-MM-DD/:
 *   axe-<slug>.json         (per-route raw axe results)
 *   mobile-<slug>.png       (per-route 375 px screenshot)
 *   overflow.csv            (route, scrollWidth, clientWidth, overflow)
 *   index.md                (human-readable summary + severity rollup)
 */
import { chromium, type Browser, type Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const BASE_URL = process.env.AUDIT_BASE_URL ?? 'https://tokenpak.ai';
const OUT_DIR = process.env.AUDIT_OUT_DIR
  ?? path.join(repoRoot, 'docs', 'audits', `phase-2-${new Date().toISOString().slice(0, 10)}`);

const ROUTES: Array<{ path: string; label: string; slug: string }> = [
  { path: '/',                    label: 'Home',                    slug: 'home' },
  { path: '/open-source/',        label: 'Open Source',             slug: 'open-source' },
  { path: '/product/',            label: 'Product',                 slug: 'product' },
  { path: '/paid/',               label: 'Pro',                     slug: 'paid' },
  { path: '/about/',              label: 'About',                   slug: 'about' },
  { path: '/releases/',           label: 'Releases (index)',        slug: 'releases' },
  { path: '/releases/1.3.7/',     label: 'Release detail (1.3.7)',  slug: 'release-detail' },
];

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

interface Finding {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  helpUrl: string;
  nodes: number;
}

interface RouteResult {
  route: string;
  label: string;
  slug: string;
  axeDesktop: Finding[];
  axeMobile: Finding[];
  scrollWidth: number;
  clientWidth: number;
  overflow: boolean;
}

function toFindings(results: { violations: { id: string; impact: string | null; help: string; helpUrl: string; nodes: unknown[] }[] }): Finding[] {
  return results.violations.map((v) => ({
    id: v.id,
    impact: (v.impact as Finding['impact']) ?? null,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
  }));
}

async function auditRoute(browser: Browser, route: typeof ROUTES[number]): Promise<RouteResult> {
  const ctx = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page: Page = await ctx.newPage();
  const url = `${BASE_URL}${route.path}`;

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // --- Desktop axe pass ---
  // 05 §5.2 wordmark exception: the split-color 'Pak' span is the
  // one permitted tp-accent-on-tp-paper usage. The parent <a>
  // carries the accessible name; the span is decorative brand
  // typography. Excluded from axe so CI fails on real regressions,
  // not on the documented exception.
  const desktopResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-wordmark-accent]')
    .analyze();
  const axeDesktop = toFindings(desktopResults);
  fs.writeFileSync(
    path.join(OUT_DIR, `axe-${route.slug}-desktop.json`),
    JSON.stringify(desktopResults, null, 2) + '\n',
  );

  // --- Mobile viewport pass ---
  await page.setViewportSize(MOBILE_VIEWPORT);
  // Let layout settle at the new viewport
  await page.waitForTimeout(250);

  const mobileResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-wordmark-accent]')
    .analyze();
  const axeMobile = toFindings(mobileResults);
  fs.writeFileSync(
    path.join(OUT_DIR, `axe-${route.slug}-mobile.json`),
    JSON.stringify(mobileResults, null, 2) + '\n',
  );

  await page.screenshot({
    path: path.join(OUT_DIR, `mobile-${route.slug}.png`),
    fullPage: true,
  });

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const overflow = scrollWidth > clientWidth + 1;

  await ctx.close();

  return {
    route: route.path,
    label: route.label,
    slug: route.slug,
    axeDesktop,
    axeMobile,
    scrollWidth,
    clientWidth,
    overflow,
  };
}

function severityRank(impact: Finding['impact']): number {
  return impact === 'critical' ? 4
       : impact === 'serious'  ? 3
       : impact === 'moderate' ? 2
       : impact === 'minor'    ? 1
       : 0;
}

function countBy(findings: Finding[]): Record<string, number> {
  const out: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const f of findings) if (f.impact) out[f.impact]++;
  return out;
}

function renderMarkdown(results: RouteResult[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Phase 2 — accessibility + 375 px mobile baseline (${date})`);
  lines.push('');
  lines.push(`Base URL: \`${BASE_URL}\`  `);
  lines.push(`Tool: Playwright + @axe-core/playwright (WCAG 2.1 AA)  `);
  lines.push(`Viewports: desktop 1280×800, mobile 375×667`);
  lines.push('');
  lines.push('## Rollup');
  lines.push('');
  lines.push('| Route | Critical | Serious | Moderate | Minor | Overflow@375px |');
  lines.push('|---|---|---|---|---|---|');
  let totalCritical = 0, totalSerious = 0, totalModerate = 0, totalMinor = 0, overflowRoutes = 0;
  for (const r of results) {
    const combined = dedupeByImpactAndRule([...r.axeDesktop, ...r.axeMobile]);
    const c = countBy(combined);
    totalCritical += c.critical;
    totalSerious  += c.serious;
    totalModerate += c.moderate;
    totalMinor    += c.minor;
    if (r.overflow) overflowRoutes++;
    lines.push(`| \`${r.route}\` | ${c.critical} | ${c.serious} | ${c.moderate} | ${c.minor} | ${r.overflow ? `❌ ${r.scrollWidth}>${r.clientWidth}` : '✅'} |`);
  }
  lines.push(`| **Total** | **${totalCritical}** | **${totalSerious}** | **${totalModerate}** | **${totalMinor}** | **${overflowRoutes} overflow** |`);
  lines.push('');
  lines.push('## Per-route detail');
  for (const r of results) {
    lines.push('');
    lines.push(`### ${r.label} — \`${r.route}\``);
    lines.push('');
    lines.push(`- Desktop violations: ${r.axeDesktop.length}`);
    lines.push(`- Mobile violations: ${r.axeMobile.length}`);
    lines.push(`- 375 px overflow: ${r.overflow ? `YES (scrollWidth ${r.scrollWidth}, clientWidth ${r.clientWidth})` : 'no'}`);
    const combined = dedupeByImpactAndRule([...r.axeDesktop, ...r.axeMobile])
      .sort((a, b) => severityRank(b.impact) - severityRank(a.impact));
    if (combined.length === 0) {
      lines.push('- axe: clean');
    } else {
      lines.push('');
      lines.push('  | Impact | Rule | Nodes | Help |');
      lines.push('  |---|---|---|---|');
      for (const f of combined) {
        lines.push(`  | ${f.impact ?? '-'} | \`${f.id}\` | ${f.nodes} | [${f.help}](${f.helpUrl}) |`);
      }
    }
    lines.push('');
    lines.push(`  _Raw JSON:_ [\`axe-${r.slug}-desktop.json\`](axe-${r.slug}-desktop.json) · [\`axe-${r.slug}-mobile.json\`](axe-${r.slug}-mobile.json)  `);
    lines.push(`  _Screenshot (375 px):_ [\`mobile-${r.slug}.png\`](mobile-${r.slug}.png)`);
  }
  return lines.join('\n') + '\n';
}

function dedupeByImpactAndRule(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.id}|${f.impact}`;
    const existing = seen.get(key);
    if (!existing || f.nodes > existing.nodes) seen.set(key, f);
  }
  return Array.from(seen.values());
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results: RouteResult[] = [];

  for (const route of ROUTES) {
    process.stdout.write(`auditing ${route.path} ... `);
    try {
      const r = await auditRoute(browser, route);
      const desktopCounts = countBy(r.axeDesktop);
      const mobileCounts = countBy(r.axeMobile);
      console.log(
        `desktop crit=${desktopCounts.critical} serious=${desktopCounts.serious} | ` +
        `mobile crit=${mobileCounts.critical} serious=${mobileCounts.serious} | ` +
        `overflow=${r.overflow ? 'YES' : 'no'}`,
      );
      results.push(r);
    } catch (err) {
      console.error(`FAILED: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }

  await browser.close();

  // overflow.csv
  const csv = ['route,scrollWidth,clientWidth,overflow']
    .concat(results.map((r) => `${r.route},${r.scrollWidth},${r.clientWidth},${r.overflow}`))
    .join('\n') + '\n';
  fs.writeFileSync(path.join(OUT_DIR, 'overflow.csv'), csv);

  // index.md
  fs.writeFileSync(path.join(OUT_DIR, 'index.md'), renderMarkdown(results));

  // Summary line to stdout for CI hook
  const allCombined = results.flatMap((r) => dedupeByImpactAndRule([...r.axeDesktop, ...r.axeMobile]));
  const totals = countBy(allCombined);
  const overflowRoutes = results.filter((r) => r.overflow).length;
  console.log('');
  console.log(`SUMMARY crit=${totals.critical} serious=${totals.serious} moderate=${totals.moderate} minor=${totals.minor} overflow_routes=${overflowRoutes}`);
  console.log(`Artifacts: ${OUT_DIR}`);

  // Non-zero exit if serious or critical exists OR any route overflows — CI hook.
  if (totals.critical > 0 || totals.serious > 0 || overflowRoutes > 0) {
    if (!process.env.AUDIT_TOLERATE_FINDINGS) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('audit-a11y failed:', err);
  process.exit(1);
});

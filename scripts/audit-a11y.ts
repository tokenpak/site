/*
 * Accessibility + mobile-baseline audit runner (cross-browser).
 *
 * For each (browser, route, viewport):
 *   1. Navigate via headless browser.
 *   2. Run axe-core WCAG 2.1 AA; emit JSON + summary line.
 *   3. Switch viewport to 375 x 667 (iPhone SE / 22 §19 spec).
 *   4. Capture full-page PNG screenshot.
 *   5. Measure document scrollWidth vs clientWidth; flag horizontal overflow.
 *
 * Browser matrix (Phase 4 / D4.a): Chromium, Firefox, WebKit.
 * Restrict to a subset with AUDIT_BROWSERS=chromium,firefox (comma-separated).
 *
 * Emits artifacts under docs/audits/phase-4-cross-browser-YYYY-MM-DD/:
 *   axe-<slug>-<browser>-<viewport>.json   raw axe results per (route,browser,viewport)
 *   mobile-<slug>-<browser>.png            375 px screenshot per (route,browser)
 *   overflow.csv                           route x browser overflow matrix
 *   index.md                               human-readable cross-browser rollup
 */
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const BASE_URL = process.env.AUDIT_BASE_URL ?? 'https://tokenpak.ai';
const OUT_DIR = process.env.AUDIT_OUT_DIR
  ?? path.join(repoRoot, 'docs', 'audits', `phase-4-cross-browser-${new Date().toISOString().slice(0, 10)}`);

const ALL_BROWSERS: Array<{ name: string; launcher: BrowserType }> = [
  { name: 'chromium', launcher: chromium },
  { name: 'firefox',  launcher: firefox  },
  { name: 'webkit',   launcher: webkit   },
];

function resolveBrowsers(): typeof ALL_BROWSERS {
  const raw = process.env.AUDIT_BROWSERS;
  if (!raw || !raw.trim()) return ALL_BROWSERS;
  const wanted = new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const filtered = ALL_BROWSERS.filter((b) => wanted.has(b.name));
  if (filtered.length === 0) {
    throw new Error(`AUDIT_BROWSERS="${raw}" matched none of: ${ALL_BROWSERS.map((b) => b.name).join(', ')}`);
  }
  return filtered;
}

const BROWSERS = resolveBrowsers();

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
  browser: string;
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

async function auditRoute(browser: Browser, browserName: string, route: typeof ROUTES[number]): Promise<RouteResult> {
  const ctx = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page: Page = await ctx.newPage();
  const url = `${BASE_URL}${route.path}`;

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // --- Desktop axe pass ---
  // 05 §5.2 wordmark exception: the split-color 'Pak' span is the one
  // permitted tp-accent-on-tp-paper usage. Parent <a> carries the
  // accessible name; the span is decorative brand typography. Excluded
  // from axe so CI fails on real regressions, not the documented
  // exception.
  const desktopResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-wordmark-accent]')
    .analyze();
  const axeDesktop = toFindings(desktopResults);
  fs.writeFileSync(
    path.join(OUT_DIR, `axe-${route.slug}-${browserName}-desktop.json`),
    JSON.stringify(desktopResults, null, 2) + '\n',
  );

  // --- Mobile viewport pass ---
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.waitForTimeout(250);

  const mobileResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-wordmark-accent]')
    .analyze();
  const axeMobile = toFindings(mobileResults);
  fs.writeFileSync(
    path.join(OUT_DIR, `axe-${route.slug}-${browserName}-mobile.json`),
    JSON.stringify(mobileResults, null, 2) + '\n',
  );

  await page.screenshot({
    path: path.join(OUT_DIR, `mobile-${route.slug}-${browserName}.png`),
    fullPage: true,
  });

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const overflow = scrollWidth > clientWidth + 1;

  await ctx.close();

  return {
    browser: browserName,
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

function dedupeByImpactAndRule(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.id}|${f.impact}`;
    const existing = seen.get(key);
    if (!existing || f.nodes > existing.nodes) seen.set(key, f);
  }
  return Array.from(seen.values());
}

function renderMarkdown(results: RouteResult[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Cross-browser accessibility + mobile-baseline audit (${date})`);
  lines.push('');
  lines.push(`Base URL: \`${BASE_URL}\`  `);
  lines.push(`Tool: Playwright + @axe-core/playwright (WCAG 2.1 AA)  `);
  lines.push(`Browsers: ${BROWSERS.map((b) => b.name).join(', ')}  `);
  lines.push(`Viewports: desktop 1280×800, mobile 375×667`);
  lines.push('');

  // Per-browser rollup
  lines.push('## Per-browser rollup');
  lines.push('');
  lines.push('| Browser | Critical | Serious | Moderate | Minor | Overflow routes |');
  lines.push('|---|---|---|---|---|---|');
  for (const b of BROWSERS) {
    const byBrowser = results.filter((r) => r.browser === b.name);
    const combined = byBrowser.flatMap((r) => dedupeByImpactAndRule([...r.axeDesktop, ...r.axeMobile]));
    const c = countBy(combined);
    const overflowRoutes = byBrowser.filter((r) => r.overflow).length;
    lines.push(`| \`${b.name}\` | ${c.critical} | ${c.serious} | ${c.moderate} | ${c.minor} | ${overflowRoutes} |`);
  }
  lines.push('');

  // Per-route × browser matrix (serious+ only)
  lines.push('## Per-route × browser matrix (serious+)');
  lines.push('');
  lines.push('| Route | ' + BROWSERS.map((b) => b.name).join(' | ') + ' |');
  lines.push('|---' + BROWSERS.map(() => '|---').join('') + '|');
  for (const route of ROUTES) {
    const cells = BROWSERS.map((b) => {
      const r = results.find((x) => x.browser === b.name && x.slug === route.slug);
      if (!r) return 'n/a';
      const combined = dedupeByImpactAndRule([...r.axeDesktop, ...r.axeMobile]);
      const c = countBy(combined);
      const critSerious = c.critical + c.serious;
      const overflowFlag = r.overflow ? ' ❌overflow' : '';
      return `${critSerious === 0 ? '✅' : `❌ ${critSerious}`}${overflowFlag}`;
    });
    lines.push(`| \`${route.path}\` | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // Per-route detail, grouped by route (so cross-browser findings for a single route are adjacent).
  lines.push('## Per-route detail');
  for (const route of ROUTES) {
    lines.push('');
    lines.push(`### ${route.label} — \`${route.path}\``);
    for (const b of BROWSERS) {
      const r = results.find((x) => x.browser === b.name && x.slug === route.slug);
      if (!r) continue;
      lines.push('');
      lines.push(`#### ${b.name}`);
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
      lines.push(`  _Raw:_ [desktop](axe-${r.slug}-${b.name}-desktop.json) · [mobile](axe-${r.slug}-${b.name}-mobile.json) · [screenshot](mobile-${r.slug}-${b.name}.png)`);
    }
  }

  return lines.join('\n') + '\n';
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allResults: RouteResult[] = [];

  for (const b of BROWSERS) {
    let browser: Browser;
    try {
      browser = await b.launcher.launch({ headless: true });
    } catch (err) {
      console.error(`[${b.name}] launch FAILED: ${(err as Error).message}`);
      console.error(`[${b.name}] skipping this browser; 'playwright install ${b.name}' may need --with-deps on Linux.`);
      process.exitCode = 1;
      continue;
    }

    for (const route of ROUTES) {
      process.stdout.write(`[${b.name}] auditing ${route.path} ... `);
      try {
        const r = await auditRoute(browser, b.name, route);
        const desktopCounts = countBy(r.axeDesktop);
        const mobileCounts = countBy(r.axeMobile);
        console.log(
          `desktop crit=${desktopCounts.critical} serious=${desktopCounts.serious} | ` +
          `mobile crit=${mobileCounts.critical} serious=${mobileCounts.serious} | ` +
          `overflow=${r.overflow ? 'YES' : 'no'}`,
        );
        allResults.push(r);
      } catch (err) {
        console.error(`FAILED: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    }

    await browser.close();
  }

  // overflow.csv — route × browser matrix
  const csvHeader = ['route', ...BROWSERS.map((b) => `${b.name}_overflow`)].join(',');
  const csvRows = ROUTES.map((route) => {
    const cells = BROWSERS.map((b) => {
      const r = allResults.find((x) => x.browser === b.name && x.slug === route.slug);
      return r ? String(r.overflow) : 'n/a';
    });
    return [route.path, ...cells].join(',');
  });
  fs.writeFileSync(path.join(OUT_DIR, 'overflow.csv'), [csvHeader, ...csvRows].join('\n') + '\n');

  // index.md
  fs.writeFileSync(path.join(OUT_DIR, 'index.md'), renderMarkdown(allResults));

  // Summary + CI gate
  let hardFindings = 0;
  for (const b of BROWSERS) {
    const byBrowser = allResults.filter((r) => r.browser === b.name);
    const combined = byBrowser.flatMap((r) => dedupeByImpactAndRule([...r.axeDesktop, ...r.axeMobile]));
    const c = countBy(combined);
    const overflowRoutes = byBrowser.filter((r) => r.overflow).length;
    hardFindings += c.critical + c.serious + overflowRoutes;
    console.log(
      `SUMMARY [${b.name}] crit=${c.critical} serious=${c.serious} moderate=${c.moderate} minor=${c.minor} overflow_routes=${overflowRoutes}`,
    );
  }
  console.log(`Artifacts: ${OUT_DIR}`);

  // D3.a strict: any serious+ on any browser OR any overflow on any browser fails CI.
  if (hardFindings > 0 && !process.env.AUDIT_TOLERATE_FINDINGS) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('audit-a11y failed:', err);
  process.exit(1);
});

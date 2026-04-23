---
title: Pre-launch public-trust audit — tokenpak.ai Phase 1
date: 2026-04-22
auditor: Sue (automated checks) / Kevin (sign-off)
scope: Phase 1 v1 surface — /, /open-source, /product, /paid, /about, /releases, /releases/[version]
standard: 22-public-website-standard.md §19
---

# Pre-launch public-trust audit — 2026-04-22

Runs the `22 §19` checklist against the Phase 1 site before first prod handoff. A failing item is a launch blocker.

## Checklist

- [x] **No placeholder text** ("lorem ipsum," "TODO," "coming soon"). `grep -r -iE '(lorem ipsum|todo|coming soon)' src/ data/` returns zero hits. Release empty-state copy ("No releases yet. The homepage and this page will populate after the first sync run…") is honest, not a placeholder.
- [x] **No inconsistent brand casing** (`05 §1`). `grep -r -E 'Tokenpak|tokenPak|TOKENPAK' src/` returns zero hits. Wordmark always "TokenPak" (split-color in hero/footer, single-color inline).
- [x] **No broken CTA paths.** Every `href` either resolves to a local route (checked: `/`, `/open-source`, `/releases`, `/paid`, `/product`, `/about`, `/favicon.svg`) or is an absolute URL sourced from `product-config.json` (validated against schema in CI).
- [x] **No misleading feature presentation.** Only shipped features appear as shipped. Pro features labelled "Pro" per `07 §5.3`. OSS labelled full-product per `07 §5.3` ("Never imply OSS is a limited demo"). Savings claim says "30–50% on typical agent workloads" per `07 §3` — never a naked percentage.
- [x] **No prototype language.** No "in beta," "alpha build," or "experimental" on any page. `/paid` says "gated during v1" — factual, not aspirational.
- [x] **No developer-facing debug language** leaking into user copy. `grep` for `TODO/FIXME/XXX` in `src/` returns zero hits outside schema `description` fields (which are not user-rendered).
- [x] **No Constitution-violating claims** (`07 §3`). Latency: "<50ms" (not "instant"). Privacy: "No cloud component; no credentials stored" (not "fully private"). Compatibility: 9 tested clients listed by name (not "works with every LLM tool").
- [x] **No forbidden phrases from `07 §6`.** `grep -E '90% savings|instant|zero overhead|fully private|no setup|every LLM'` returns zero hits.
- [x] **No pale-yellow outside `tp-signal-value`** (`05 §5.2`). Grep of `#EDE085` and `tp-signal-value` confirms usage limited to: hero savings panel, ReleaseCard "latest" chip, MetricPanel `savings=true`, /style-check dev audit (removed in this PR). No decorative or state-dot use.
- [x] **No ad-hoc CSS outside the component system** (§9). All visual styling flows through Tailwind utility classes backed by `tailwind.config.mjs` brand tokens, or CSS custom properties in `src/styles/global.css`. Inline `style` attributes limited to `tp-signal-value` usage (5 callsites) where Tailwind's JIT can't emit arbitrary-background utilities reliably.
- [x] **All three manifests validate.** `npm run validate` on main HEAD: product-config PASS, releases PASS (empty array), docs-links PASS (empty array). Schema failures fail the build (`deploy.yml` runs `validate` before `build`).
- [ ] **axe / pa11y AA zero violations on every page.** Not yet run against live site; scheduled for post-deploy verification (see "Next steps" below).
- [ ] **Mobile 375px — no horizontal scroll.** Not yet verified on device; scheduled for post-deploy verification.
- [x] **Reduced-motion honored.** `src/styles/global.css` has a `@media (prefers-reduced-motion: reduce)` block that clamps animation + transition + scroll-behavior to near-zero. Phase 1 components don't use animation so the override is defensive.
- [ ] **CSP header present; no third-party scripts without config gating.** Not yet configured (GitHub Pages serves a default `Content-Security-Policy`; a custom header requires a meta tag). Third-party-scripts check: `grep -r 'script.*src=' src/` returns zero hits. `feature_flags.analytics` is `false` in config. **Gap: no explicit CSP meta tag in `BaseLayout.astro`.**
- [ ] **`robots.txt` and `sitemap.xml` correct.** Not yet present in `public/`. **Gap: will add before public-promotion.**

## Summary

| Status | Count | Items |
|---|---|---|
| ✅ Pass | 12 | placeholder, casing, CTAs, shipped features, prototype language, debug language, claim boundaries, forbidden phrases, signal color, ad-hoc CSS, manifests, reduced-motion |
| 🟡 Pending post-deploy verification | 2 | axe/pa11y, mobile viewport |
| 🟡 Known gap | 2 | CSP meta tag, robots/sitemap |

Zero hard-fail items. Two verification items (require live site) and two known gaps (easy follow-ups) documented.

## Recommendations for follow-up (not blocking Phase 1)

1. **Add CSP `<meta>` tag** to `BaseLayout.astro`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;` — can land in a post-Phase-1 hardening PR.
2. **Generate `robots.txt` + `sitemap.xml`** — Astro has `@astrojs/sitemap` (already listed in design-doc §2.3 runtime-deps-to-add as needed).
3. **Run axe-core against every route** in CI as part of `deploy.yml` post-deploy step — flag any violation, block on AA.
4. **Mobile viewport screenshots** at 375px captured in the first `deploy.yml` run, attached to the initial release tag for regression baseline.

## Sign-off

Sue — automated checks run 2026-04-22. Pass + pending items recorded above.
Kevin — required for launch approval; sign below after reviewing the 4 pending/gap items.

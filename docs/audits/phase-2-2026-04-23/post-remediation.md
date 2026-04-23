# Phase 2 — post-remediation audit (2026-04-23, Path 2 final)

> Captured against the **live** site after `85021cc8` (PR#18) deployed — the Path-2 (tp-accent → tp-ink/underline for links) implementation of Kevin's 2026-04-23 `05 §5.2` amendment.
>
> **State: zero findings across every class, every route, every viewport.** `22 §19` accessibility row **flips to ✅ pass**.
>
> Delta vs. the earlier post-PR#16 record (also in this folder's git history): 7 serious `color-contrast` findings on `tp-accent` cleared; the one permitted `tp-accent`-on-`tp-paper` usage (the split-color "Pak" wordmark per `05 §5.2` exception) is excluded from axe via the `data-wordmark-accent` selector in `scripts/audit-a11y.ts` — no blanket rule disable; any new `tp-accent` text anywhere else would still fire.

---

# Phase 2 — accessibility + 375 px mobile baseline (2026-04-23)

Base URL: `https://tokenpak.ai`  
Tool: Playwright + @axe-core/playwright (WCAG 2.1 AA)  
Viewports: desktop 1280×800, mobile 375×667

## Rollup

| Route | Critical | Serious | Moderate | Minor | Overflow@375px |
|---|---|---|---|---|---|
| `/` | 0 | 0 | 0 | 0 | ✅ |
| `/open-source/` | 0 | 0 | 0 | 0 | ✅ |
| `/product/` | 0 | 0 | 0 | 0 | ✅ |
| `/paid/` | 0 | 0 | 0 | 0 | ✅ |
| `/about/` | 0 | 0 | 0 | 0 | ✅ |
| `/releases/` | 0 | 0 | 0 | 0 | ✅ |
| `/releases/1.3.7/` | 0 | 0 | 0 | 0 | ✅ |
| **Total** | **0** | **0** | **0** | **0** | **0 overflow** |

## Per-route detail

### Home — `/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-home-desktop.json`](axe-home-desktop.json) · [`axe-home-mobile.json`](axe-home-mobile.json)  
  _Screenshot (375 px):_ [`mobile-home.png`](mobile-home.png)

### Open Source — `/open-source/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-open-source-desktop.json`](axe-open-source-desktop.json) · [`axe-open-source-mobile.json`](axe-open-source-mobile.json)  
  _Screenshot (375 px):_ [`mobile-open-source.png`](mobile-open-source.png)

### Product — `/product/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-product-desktop.json`](axe-product-desktop.json) · [`axe-product-mobile.json`](axe-product-mobile.json)  
  _Screenshot (375 px):_ [`mobile-product.png`](mobile-product.png)

### Pro — `/paid/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-paid-desktop.json`](axe-paid-desktop.json) · [`axe-paid-mobile.json`](axe-paid-mobile.json)  
  _Screenshot (375 px):_ [`mobile-paid.png`](mobile-paid.png)

### About — `/about/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-about-desktop.json`](axe-about-desktop.json) · [`axe-about-mobile.json`](axe-about-mobile.json)  
  _Screenshot (375 px):_ [`mobile-about.png`](mobile-about.png)

### Releases (index) — `/releases/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-releases-desktop.json`](axe-releases-desktop.json) · [`axe-releases-mobile.json`](axe-releases-mobile.json)  
  _Screenshot (375 px):_ [`mobile-releases.png`](mobile-releases.png)

### Release detail (1.3.7) — `/releases/1.3.7/`

- Desktop violations: 0
- Mobile violations: 0
- 375 px overflow: no
- axe: clean

  _Raw JSON:_ [`axe-release-detail-desktop.json`](axe-release-detail-desktop.json) · [`axe-release-detail-mobile.json`](axe-release-detail-mobile.json)  
  _Screenshot (375 px):_ [`mobile-release-detail.png`](mobile-release-detail.png)

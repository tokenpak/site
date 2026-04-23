# Phase 2 — accessibility + 375 px mobile baseline (2026-04-23)

Base URL: `https://tokenpak.ai`  
Tool: Playwright + @axe-core/playwright (WCAG 2.1 AA)  
Viewports: desktop 1280×800, mobile 375×667

> **This is the pre-remediation baseline** captured against the live site before any fixes. The rollup below is the point-in-time "what was wrong on 2026-04-23" snapshot. See `## Remediation` below for the fix list, what's being landed in this PR, and the hard stop.

## Remediation summary

| Finding | Severity | Count | Fix | Where |
|---|---|---|---|---|
| **A.** 375 px horizontal overflow on every route | n/a (layout) | 7/7 routes | Responsive nav: hide auxiliary nav links below `sm` (640 px) in `Header.astro`; keep wordmark + Get Started CTA always visible. Tighten header padding at `< sm`. | This PR |
| **B.** `scrollable-region-focusable` — overflow containers not keyboard-accessible | serious | 2 routes | Add `role="region"`, `aria-label`, `tabindex="0"` on `ComparisonTable.astro` outer div and `CodeBlock.astro` `<pre>`. | This PR |
| **C.** `color-contrast` — `tp-mute` language label on `tp-ink` (2.98 : 1) | serious | 4 nodes | Remove `text-tp-mute` override in `CodeBlock.astro` figcaption; inherit `text-tp-paper` at 80 % opacity (AA-compliant). | This PR |
| **D.** `color-contrast` — `tp-accent` (`#00C389`) on `tp-paper` (2.13 : 1) | serious | 180 nodes across links + "Pak" wordmark | **HARD STOP.** `05 §5.2` explicitly prescribes `tp-accent` for links + branded accents, and no teal in the same hue family passes WCAG AA small-text 4.5 : 1 against `tp-paper`. Needs a canonical decision on one of: (1) darken `tp-accent` (breaks brand), (2) introduce `tp-accent-ink` for link text (keeps brand, two teals), (3) stop using teal for text; keep it for UI fills + add underline-only `tp-ink` links; wordmark becomes a brand exception, (4) accept as documented AA deviation for marketing surface. | Deferred — Kevin decision |

Expected post-remediation state (A + B + C landed, D open):

| Class | Before | After this PR |
|---|---|---|
| Critical | 0 | 0 |
| Serious — `scrollable-region-focusable` | 2 routes | **0** |
| Serious — `color-contrast` (`tp-mute` on `tp-ink`) | 4 nodes | **0** |
| Serious — `color-contrast` (`tp-accent` on `tp-paper`) | 180 nodes | 180 nodes (deferred — option D) |
| Routes with 375 px horizontal overflow | 7 | **0** |

Post-deploy verification is captured in `post-remediation.md` in this same folder once the deploy following this PR's merge completes.

## Rollup

| Route | Critical | Serious | Moderate | Minor | Overflow@375px |
|---|---|---|---|---|---|
| `/` | 0 | 1 | 0 | 0 | ❌ 474>375 |
| `/open-source/` | 0 | 2 | 0 | 0 | ❌ 474>375 |
| `/product/` | 0 | 1 | 0 | 0 | ❌ 474>375 |
| `/paid/` | 0 | 2 | 0 | 0 | ❌ 474>375 |
| `/about/` | 0 | 1 | 0 | 0 | ❌ 474>375 |
| `/releases/` | 0 | 1 | 0 | 0 | ❌ 474>375 |
| `/releases/1.3.7/` | 0 | 1 | 0 | 0 | ❌ 474>375 |
| **Total** | **0** | **9** | **0** | **0** | **7 overflow** |

## Per-route detail

### Home — `/`

- Desktop violations: 1
- Mobile violations: 1
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 6 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |

  _Raw JSON:_ [`axe-home-desktop.json`](axe-home-desktop.json) · [`axe-home-mobile.json`](axe-home-mobile.json)  
  _Screenshot (375 px):_ [`mobile-home.png`](mobile-home.png)

### Open Source — `/open-source/`

- Desktop violations: 1
- Mobile violations: 2
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 7 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |
  | serious | `scrollable-region-focusable` | 1 | [Scrollable region must have keyboard access](https://dequeuniversity.com/rules/axe/4.11/scrollable-region-focusable?application=playwright) |

  _Raw JSON:_ [`axe-open-source-desktop.json`](axe-open-source-desktop.json) · [`axe-open-source-mobile.json`](axe-open-source-mobile.json)  
  _Screenshot (375 px):_ [`mobile-open-source.png`](mobile-open-source.png)

### Product — `/product/`

- Desktop violations: 1
- Mobile violations: 1
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 3 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |

  _Raw JSON:_ [`axe-product-desktop.json`](axe-product-desktop.json) · [`axe-product-mobile.json`](axe-product-mobile.json)  
  _Screenshot (375 px):_ [`mobile-product.png`](mobile-product.png)

### Pro — `/paid/`

- Desktop violations: 1
- Mobile violations: 2
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 5 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |
  | serious | `scrollable-region-focusable` | 1 | [Scrollable region must have keyboard access](https://dequeuniversity.com/rules/axe/4.11/scrollable-region-focusable?application=playwright) |

  _Raw JSON:_ [`axe-paid-desktop.json`](axe-paid-desktop.json) · [`axe-paid-mobile.json`](axe-paid-mobile.json)  
  _Screenshot (375 px):_ [`mobile-paid.png`](mobile-paid.png)

### About — `/about/`

- Desktop violations: 1
- Mobile violations: 1
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 5 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |

  _Raw JSON:_ [`axe-about-desktop.json`](axe-about-desktop.json) · [`axe-about-mobile.json`](axe-about-mobile.json)  
  _Screenshot (375 px):_ [`mobile-about.png`](mobile-about.png)

### Releases (index) — `/releases/`

- Desktop violations: 1
- Mobile violations: 1
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 60 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |

  _Raw JSON:_ [`axe-releases-desktop.json`](axe-releases-desktop.json) · [`axe-releases-mobile.json`](axe-releases-mobile.json)  
  _Screenshot (375 px):_ [`mobile-releases.png`](mobile-releases.png)

### Release detail (1.3.7) — `/releases/1.3.7/`

- Desktop violations: 1
- Mobile violations: 1
- 375 px overflow: YES (scrollWidth 474, clientWidth 375)

  | Impact | Rule | Nodes | Help |
  |---|---|---|---|
  | serious | `color-contrast` | 6 | [Elements must meet minimum color contrast ratio thresholds](https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright) |

  _Raw JSON:_ [`axe-release-detail-desktop.json`](axe-release-detail-desktop.json) · [`axe-release-detail-mobile.json`](axe-release-detail-mobile.json)  
  _Screenshot (375 px):_ [`mobile-release-detail.png`](mobile-release-detail.png)

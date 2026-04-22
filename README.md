# tokenpak/site

Source of the TokenPak public marketing website at `tokenpak.ai`.

This repo is the fifth public surface in the TokenPak topology. It is **marketing-first**: the homepage, `/open-source`, `/releases`, `/product`, `/paid`, and `/about` live here. Protocol specs, API docs, and operational guides live in `tokenpak/docs` and publish at `docs.tokenpak.ai`.

## Stack

- [Astro](https://astro.build/) (static output)
- [Tailwind CSS](https://tailwindcss.com/) with brand tokens from `05-brand-style-guide.md`
- TypeScript
- GitHub Pages (custom domain: `tokenpak.ai`)

## Status

Phase 1 bootstrap. See the internal kickoff doc for the planned PR sequence.

## Contributing

Before you touch this repo, read — in order:

1. `22-public-website-standard.md` — the authoritative standard for everything here (stack, IA, components, motion, SEO, accessibility, public-trust audit).
2. `05-brand-style-guide.md` — color tokens, typography, spacing, motion.
3. `07-messaging-positioning-guide.md` — voice, CTAs, tier-vs-package naming.
4. `2026-04-22-tokenpak-site-phase-1.md` — the Phase 1 design plan.
5. `2026-04-22-tokenpak-site-phase-1-kickoff.md` — the ordered PR sequence.

All five documents live in the internal tokenpak standards vault. External contributors: please open an issue first — the visual and editorial rules are strict and governed.

### Commit + PR rules

- Branches: `feat/<kebab>` (no `fix/`, `chore/` in Phase 1).
- Commits: imperative mood, `site: <verb> <noun>`.
- Author and committer identity: **`tokenpak <hello@tokenpak.ai>`** (lowercase, per `20-github-governance.md §8.2`). Pre-push hook enforces.
- No `--no-verify`, ever. No force-push to `main`. Squash-merge via PR only.

## Public surfaces

| Surface | Purpose | Lives in |
|---|---|---|
| `tokenpak.ai` | Marketing and product site | this repo |
| `docs.tokenpak.ai` | Docs, protocol, operations | `tokenpak/docs` |
| `github.com/tokenpak/tokenpak` | OSS package and proxy | `tokenpak/tokenpak` |
| `github.com/tokenpak/registry` | Adapter + schema registry | `tokenpak/registry` |
| `github.com/tokenpak/site` | This repo | — |

## License

Apache 2.0. See [LICENSE](LICENSE).

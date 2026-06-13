# tokenpak/site

Source of the TokenPak public marketing website at `tokenpak.ai`.

This repo is the fifth public surface in the TokenPak topology. It is **marketing-first**: the homepage, `/open-source`, `/releases`, `/product`, `/paid`, and `/about` live here. Protocol specs, API docs, and operational guides live in `tokenpak/docs` and publish at `docs.tokenpak.ai`.

## Stack

- [Astro](https://astro.build/) (static output)
- [Tailwind CSS](https://tailwindcss.com/) with the project's brand tokens
- TypeScript
- GitHub Pages (custom domain: `tokenpak.ai`)

## Status

Phase 1 bootstrap — the site is being built out through a planned, governed PR sequence.

## Contributing

This site follows strict, governed rules covering stack, information architecture, components, motion, SEO, accessibility, public-trust, brand tokens (color, typography, spacing, motion), and messaging (voice, CTAs, tier-vs-package naming).

Because those visual and editorial rules are tightly enforced, **external contributors: please open an issue first** to discuss any change before opening a PR.

### Commit + PR rules

- Branches: `feat/<kebab>` (no `fix/`, `chore/` in Phase 1).
- Commits: imperative mood, `site: <verb> <noun>`.
- Author and committer identity: **`tokenpak <hello@tokenpak.ai>`** (lowercase). Pre-push hook enforces.
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

/*
 * Canonical public-safe forbidden-term scrub for release-note content.
 *
 * GitHub Release bodies are authored against internal governance vocabulary
 * and are ingested verbatim into data/releases.json, then rendered to public
 * /releases/<version> pages. The public-safe content policy forbids
 * internal-governance / maintainer-name / private-path tokens from appearing
 * on any public surface. This module is the single source of truth for
 * detecting (`findForbiddenTerms`) and neutralizing (`scrubForbiddenTerms`)
 * those tokens. It is dependency-free (pure string transforms) so it can be
 * imported equally from the Node ingestion script (scripts/sync-releases.ts)
 * and the browser/SSG render path (src/lib/markdown.ts).
 *
 * Scope — the public-leak categories confirmed on the live release pages plus
 * the maintainer/agent and private-path tokens that are never legitimate on
 * the public site:
 *   - private home paths:      ~/vault/…, /home/<user>/…
 *   - maintainer name:         Kevin / Kevin Yang (and embedded decision IDs)
 *   - governance attribution:  Approved-by:/Ratified-by/Signed-off-by lines
 *   - internal reference refs: "Std NN", "Std NN §x.y", "… Decision #N"
 *   - internal author names:   Sue / Cali / Trix / Suki / Aya / Dee / ReiPo
 *   - infra-private tokens:    .claude/projects, host usernames
 *
 * DELIBERATELY OUT OF SCOPE (aligned with the package repo's public-language
 * allowlist so legitimate product vocabulary is not false-flagged):
 *   - the product integration name "OpenClaw" (CamelCase brand) and the
 *     functional lowercase `openclaw` provider-id / config / header tokens,
 *   - the public `tokenpak fleet` / multi-instance "fleet" capability surface,
 *   - legitimate product code paths such as `tokenpak/vault/…`.
 *   These are product surface, not internal leaks, so on the site they stay
 *   verbatim.
 *
 * Replacement style is token-level (never sentence deletion) so a scrubbed
 * release body keeps its structure and never truncates mid-word.
 */

/** A neutral redaction noun substituted for personal maintainer references. */
const MAINTAINER = 'the maintainer';

/** Agent names that are never legitimate on the public release site. */
const AGENT_NAMES = ['Sue', 'Cali', 'Trix', 'Suki', 'Aya', 'Dee', 'ReiPo'];

/**
 * Scrub every forbidden token from `text`, returning public-safe text.
 * Idempotent: scrubbing already-clean text is a no-op.
 */
export function scrubForbiddenTerms(text: string | null | undefined): string {
  if (!text) return text == null ? '' : text;
  let out = text;

  // 1. Governance-attribution header lines (their own line):
  //    "Approved-by: Kevin (PATCH, 2026-05-08)" etc. Drop the whole line.
  out = out.replace(
    /^[ \t]*(?:Approved-by|Ratified-by|Reviewed-by|Signed-off-by|Authorized-by|Acked-by)[ \t]*:[^\n]*\n?/gim,
    '',
  );

  // 2. Private vault paths — backtick-wrapped first, then bare. Genericize to a
  //    neutral phrase. Note: `tokenpak/vault/…` (no leading ~) is a product
  //    code path and is intentionally NOT matched.
  out = out.replace(/`~\/vault\/[^`]*`/g, '`internal docs`');
  out = out.replace(/~\/vault\/\S*/g, 'internal docs');

  // 3. Private home paths (/home/<user>/…). Never a product path.
  out = out.replace(/`\/home\/[A-Za-z0-9._-]+\/[^`]*`/g, '`<path>`');
  out = out.replace(/\/home\/[A-Za-z0-9._-]+\/\S*/g, '<path>');

  // 4. Internal infra tokens.
  out = out.replace(/`?\.claude\/projects\S*`?/g, '<path>');
  out = out.replace(/\btrixxie168\b/g, '<user>');

  // 5. Internal standard references. Drop a parenthetical "(Std 32)" entirely;
  //    replace an inline "Std NN §x.y [Decision #N]" with a neutral noun so the
  //    surrounding sentence stays grammatical.
  out = out.replace(/[ \t]*\((?:per[ \t]+)?Std[ \t]+\d+[^)]*\)/g, '');
  // §-ref uses `\d+(?:\.\d+)*` (not `[\d.]+`) so a trailing sentence period
  // ("§4.4.") is NOT swallowed into the section number.
  out = out.replace(
    /\bStd[ \t]+\d+(?:[ \t]*§\d+(?:\.\d+)*)*(?:[ \t]+Decision[ \t]+#?\d+)?/g,
    'internal policy',
  );

  // 6. Personal / maintainer names (Std 36 §1.1 P0_BLOCKER). Case-insensitive
  //    so "Kevin", "kevin" and the all-caps form are all caught. Internal
  //    decision/task IDs that embed the name ("KEVIN-DECISION-A", "KEVIN-A")
  //    are neutralized to a generic phrase BEFORE the bare-name rule so they
  //    don't degrade into "the maintainer-DECISION-A".
  out = out.replace(/\bKEVIN(?:-[A-Z0-9]+)+\b/g, 'an internal decision');
  out = out.replace(/\bKevin Yang\b/gi, MAINTAINER);
  out = out.replace(/\bKevin's\b/gi, `${MAINTAINER}'s`);
  out = out.replace(/\bKevin\b/gi, MAINTAINER);

  // 7. Fleet agent names (word-boundary; never legit on the site).
  for (const name of AGENT_NAMES) {
    out = out.replace(new RegExp(`\\b${name}'s\\b`, 'g'), `${MAINTAINER}'s`);
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), MAINTAINER);
  }

  // 8. Tidy artifacts left by removals: drop emptied parentheses, collapse
  //    runs of spaces, and fix a space before sentence punctuation — but only
  //    when it follows a word char, so a Markdown list marker ("- ...") keeps
  //    its space.
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/(\w)[ \t]+([.,;:])/g, '$1$2');

  return out;
}

/**
 * Return the list of forbidden tokens still present in `text` (after no
 * scrub). Used by tests and the CI data-scan to assert cleanliness. Empty
 * array == public-safe.
 */
export function findForbiddenTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  const hits: string[] = [];
  const probes: Array<[string, RegExp]> = [
    ['~/vault path', /~\/vault\/\S*/g],
    ['/home path', /\/home\/[A-Za-z0-9._-]+\//g],
    ['.claude/projects', /\.claude\/projects/g],
    ['Approved-by/Ratified-by', /^[ \t]*(?:Approved-by|Ratified-by|Reviewed-by|Signed-off-by|Authorized-by|Acked-by)[ \t]*:/gim],
    ['Kevin', /\bKevin\b/gi],
    ['KEVIN-id', /\bKEVIN-[A-Z0-9-]+\b/g],
    ['Std NN', /\bStd[ \t]+\d+\b/g],
    ['agent name', new RegExp(`\\b(?:${AGENT_NAMES.join('|')})\\b`, 'g')],
    ['trixxie168', /\btrixxie168\b/g],
  ];
  for (const [label, re] of probes) {
    const m = text.match(re);
    if (m) hits.push(`${label}: ${m.slice(0, 3).join(', ')}`);
  }
  return hits;
}

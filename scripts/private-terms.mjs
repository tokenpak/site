/*
 * Private-term register for the public-safe content gate.
 *
 * Personal names and host handles must never appear on the public site, and
 * that includes the checks that keep them out. The register therefore holds
 * salted hashes, not the words: every word in the scanned text is hashed and
 * compared. The hash only keeps the words out of the source; it is not a
 * secret, so never rely on it to protect anything beyond that.
 *
 * Plain JavaScript with no dependencies, so it runs under `node` in CI with no
 * install step and imports from the TypeScript scrub helper and the SSG path.
 *
 * To add a term, compute its hash locally and add the hex value to the right
 * set; do not commit the word itself:
 *   node scripts/check-private-terms.mjs --hash <word>
 */

const SALT = 'tokenpak-site:';

/** FNV-1a (32-bit) over the salted, lower-cased word, as 8 hex digits. */
export function termHash(word) {
  let h = 0x811c9dc5;
  const s = SALT + String(word).toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The register: personal-name parts and private host handles. */
export const PRIVATE_TERMS = {
  name: new Set(['a5e6f69d', '01416b81']),
  handle: new Set(['37ff1c20']),
};

/** Return 'name', 'handle' or null for one word. */
export function classifyTerm(word, terms = PRIVATE_TERMS) {
  const h = termHash(word);
  if (terms.name.has(h)) return 'name';
  if (terms.handle.has(h)) return 'handle';
  return null;
}

const WORD = /[A-Za-z][A-Za-z0-9]*/g;

/** True when the match is a whole word, not the tail of a longer run. */
function isWholeWord(text, start, word) {
  const before = start > 0 ? text[start - 1] : '';
  const after = text[start + word.length] || '';
  return !/[A-Za-z0-9_]/.test(before) && after !== '_';
}

/**
 * Replace every private term in `text`:
 *   - an all-caps name that starts a hyphenated ID ("NAME-DECISION-A") becomes
 *     `decision`, so it doesn't degrade into "the maintainer-DECISION-A";
 *   - a name, together with a following capitalized word (a surname), becomes
 *     `maintainer`;
 *   - a handle becomes `user`.
 */
export function redactPrivateTerms(text, repl, terms = PRIVATE_TERMS) {
  let out = '';
  let last = 0;
  WORD.lastIndex = 0;
  let m;
  while ((m = WORD.exec(text)) !== null) {
    const word = m[0];
    const start = m.index;
    if (!isWholeWord(text, start, word)) continue;
    const kind = classifyTerm(word, terms);
    if (!kind) continue;
    let end = start + word.length;
    let sub;
    if (kind === 'handle') {
      sub = repl.user;
    } else {
      const id = /^(?:-[A-Z0-9]+)+\b/.exec(text.slice(end));
      if (id && word === word.toUpperCase()) {
        end += id[0].length;
        sub = repl.decision;
      } else {
        const surname = /^[ \t]+[A-Z][a-z]+\b/.exec(text.slice(end));
        if (surname) end += surname[0].length;
        sub = repl.maintainer;
      }
    }
    out += text.slice(last, start) + sub;
    last = end;
    WORD.lastIndex = end;
  }
  return out + text.slice(last);
}

/** Return every private term found in `text` as { kind, word, index }. */
export function findPrivateTerms(text, terms = PRIVATE_TERMS) {
  const hits = [];
  WORD.lastIndex = 0;
  let m;
  while ((m = WORD.exec(text)) !== null) {
    if (!isWholeWord(text, m.index, m[0])) continue;
    const kind = classifyTerm(m[0], terms);
    if (kind) hits.push({ kind, word: m[0], index: m.index });
  }
  return hits;
}

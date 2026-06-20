/*
 * Markdown → safe HTML for user-visible content sourced from external
 * surfaces (GitHub Release bodies in /releases/[version], etc.).
 *
 * Safety posture (D2.a, 2026-04-23): render Markdown; sanitize output
 * against an explicit allow-list; no raw <script>, <iframe>, form
 * elements, on* handlers, javascript: URLs. `marked` produces the HTML;
 * `sanitize-html` enforces the allow-list.
 *
 * Trust posture: the same external bodies can carry internal governance
 * vocabulary, maintainer names, or private filesystem paths. Every render and
 * every plaintext summary is passed through scrubForbiddenTerms() as a
 * defense-in-depth layer so such a token cannot reach a public page even if it
 * slipped past the ingestion scrub.
 */
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { scrubForbiddenTerms } from '../../scripts/scrub-forbidden-terms';

// Tight allow-list — covers everything a real release body needs
// (headings, lists, tables, code, links, emphasis, images from safe
// protocols) and nothing that can execute or exfiltrate.
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
  'blockquote',
  'code', 'pre',
  'a',
  'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub',
  'kbd', 'mark',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'], // marked emits `class="language-xyz"` on code blocks
    pre: ['class'],
    th: ['align', 'colspan', 'rowspan', 'scope'],
    td: ['align', 'colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // External links open in a new tab and drop referrer.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        ...(attribs.href && /^https?:/.test(attribs.href) ? { target: '_blank' } : {}),
      },
    }),
  },
};

marked.setOptions({
  gfm: true,       // GitHub-flavored: tables, task lists, strikethrough
  breaks: false,   // Keep paragraph breaks as Markdown intends; don't hard-wrap
});

export function renderMarkdown(source: string): string {
  if (!source || !source.trim()) return '';
  const clean = scrubForbiddenTerms(source);
  const rawHtml = marked.parse(clean, { async: false }) as string;
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

/*
 * Plain-text rendering for <meta description> / Open Graph, where Markdown
 * syntax must not leak as literal `##` / `**` and the text is later sliced to
 * a short length. Scrub forbidden terms first, render to HTML, strip every
 * tag, then collapse whitespace. The caller slices the result.
 */
export function toPlainText(source: string | null | undefined): string {
  if (!source || !source.trim()) return '';
  const clean = scrubForbiddenTerms(source);
  const html = marked.parse(clean, { async: false }) as string;
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return text.replace(/\s+/g, ' ').trim();
}

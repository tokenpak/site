/*
 * Markdown → safe HTML for user-visible content sourced from external
 * surfaces (GitHub Release bodies in /releases/[version], etc.).
 *
 * Safety posture (D2.a, 2026-04-23): render Markdown; sanitize output
 * against an explicit allow-list; no raw <script>, <iframe>, form
 * elements, on* handlers, javascript: URLs. `marked` produces the HTML;
 * `sanitize-html` enforces the allow-list.
 */
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

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
  const rawHtml = marked.parse(source, { async: false }) as string;
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

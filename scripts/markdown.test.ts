import assert from 'node:assert/strict';
import fs from 'node:fs';
import sanitizeHtml from 'sanitize-html';
import { renderMarkdown, type ReleaseMarkdownContext } from '../src/lib/markdown.ts';

const current: ReleaseMarkdownContext = {
  version: '1.28.0',
  github_release_url: 'https://github.com/tokenpak/tokenpak/releases/tag/v1.28.0',
};

// Inspect actual rendered anchors with an HTML parser, including removal of
// unsafe hrefs; checking a resolver alone would miss sanitizer interactions.
function anchors(source: string, context?: ReleaseMarkdownContext) {
  const result: Array<Record<string, string>> = [];
  sanitizeHtml(renderMarkdown(source, context), {
    // Observe parsed output before this inspection pass applies its defaults.
    onOpenTag(name, attribs) {
      if (name === 'a') result.push({ ...attribs });
    },
  });
  return result;
}

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test('the 1.28.0 release notes render their upgrade link at the exact source tag', () => {
  const notes = fs.readFileSync(new URL('./fixtures/release-notes-1.28.0.md', import.meta.url), 'utf8');
  const html = renderMarkdown(notes, current);
  const [link] = anchors(notes, current);
  assert.equal(link.href, 'https://github.com/tokenpak/tokenpak/blob/v1.28.0/docs/release-log/v1.28.0.md');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.ok(html.includes('GHSA-8mgp-746c-j5xp'));
  assert.ok(html.includes('GHSA-4j2p-28q2-5m79'));
  assert.ok(html.includes('CVSS v3.1'));
  assert.ok(html.includes('CVSS v4'));
});

test('older releases resolve against their own tag, retaining query and fragment', () => {
  assert.equal(anchors('[Upgrade](./docs/release-log/v1.27.0.md?plain=1#rollback)', {
    version: '1.27.0', github_release_url: 'https://github.com/tokenpak/tokenpak/releases/tag/v1.27.0',
  })[0].href, 'https://github.com/tokenpak/tokenpak/blob/v1.27.0/docs/release-log/v1.27.0.md?plain=1#rollback');
  assert.equal(anchors('[Readme](README.md)', {
    version: '1.4.0', github_release_url: 'https://github.com/tokenpak/tokenpak/releases/tag/1.4.0',
  })[0].href, 'https://github.com/tokenpak/tokenpak/blob/1.4.0/README.md');
});

test('external, email and page-fragment destinations keep their meaning', () => {
  const links = anchors('[Docs](https://docs.tokenpak.ai/upgrading/) [HTTP](http://example.com/docs) [Email](mailto:hello@tokenpak.ai) [Section](#compatibility)', current);
  assert.deepEqual(links.map(link => link.href), [
    'https://docs.tokenpak.ai/upgrading/', 'http://example.com/docs',
    'mailto:hello@tokenpak.ai', '#compatibility',
  ]);
  assert.equal(links[0].target, '_blank');
  assert.equal(links[2].target, undefined);
  assert.equal(links[3].target, undefined);
});

test('unsafe schemes, protocol-relative URLs and traversal have no rendered href', () => {
  for (const href of [
    'javascript:alert(1)', 'data:text/html,unsafe', 'file:///etc/passwd',
    '//example.com/path', '../main/SECURITY.md', 'docs/../../main/SECURITY.md',
    '%2e%2e/main/SECURITY.md', '%252e%252e/main/SECURITY.md',
    'docs%2f..%2fSECURITY.md', '\\example.com/path', 'docs/%5c../SECURITY.md',
    '/tokenpak/other/blob/main/README.md', 'docs/%zz.md',
    'java&#x09;script:alert(1)',
  ]) {
    const [link] = anchors(`<a href="${href}" onclick="alert(1)">Link</a>`, current);
    assert.equal(link.href, undefined, href);
    assert.equal(link.onclick, undefined, href);
    assert.equal(link.target, undefined, href);
  }
});

test('invalid or mismatched source context cannot produce a repository link', () => {
  for (const context of [
    { version: '1.28.0' },
    { version: '../main', github_release_url: current.github_release_url },
    { version: '1.28.0', github_release_url: 'https://github.com/tokenpak/tokenpak/releases/tag/v1.27.0' },
    { version: '1.28.0', github_release_url: 'https://github.com/other/repo/releases/tag/v1.28.0' },
    { version: '1.28.0', github_release_url: 'https://github.com.example.com/tokenpak/tokenpak/releases/tag/v1.28.0' },
    { version: '1.28.0', github_release_url: current.github_release_url + '?redirect=1' },
  ]) {
    const links = anchors('[Local](docs/guide.md) [External](https://docs.tokenpak.ai/) [Section](#usage)', context);
    assert.equal(links[0].href, undefined);
    assert.equal(links[1].href, 'https://docs.tokenpak.ai/');
    assert.equal(links[2].href, '#usage');
  }
});

test('default rendering preserves safe local links and existing HTML sanitization', () => {
  const source = '[Local](docs/guide.md) [Parent](../guide.md) [Root](/installation/) [Section](#usage) <script>alert(1)</script><img src="https://example.com/image.png" onerror="alert(1)">';
  assert.deepEqual(anchors(source).map(link => link.href), ['docs/guide.md', '../guide.md', '/installation/', '#usage']);
  const html = renderMarkdown(source);
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('onerror'));
  for (const href of ['//example.com', 'javascript:alert(1)']) {
    assert.equal(anchors(`<a href="${href}">Link</a>`)[0].href, undefined);
  }
});

console.log(`\nrelease Markdown: ${passed} tests passed.`);

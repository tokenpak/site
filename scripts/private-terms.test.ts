/*
 * Tests for the hashed private-term register. The real register values are
 * never spelled out here; each test builds a register from placeholder words
 * so the matching and replacement logic is exercised without naming anyone.
 */
import assert from 'node:assert/strict';
import { termHash, redactPrivateTerms, findPrivateTerms } from './private-terms.mjs';

const terms = {
  name: new Set([termHash('zorblax'), termHash('quendle')]),
  handle: new Set([termHash('hostuser42')]),
};
const repl = { maintainer: 'the maintainer', decision: 'an internal decision', user: '<user>' };
const redact = (t: string) => redactPrivateTerms(t, repl, terms);

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

test('hash is case-insensitive and 8 hex digits', () => {
  assert.equal(termHash('Zorblax'), termHash('zorblax'));
  assert.match(termHash('anything'), /^[0-9a-f]{8}$/);
});

test('a bare name becomes the maintainer', () => {
  assert.equal(redact('Approved by Zorblax today.'), 'Approved by the maintainer today.');
});

test('a name with a surname is replaced as one unit', () => {
  assert.equal(redact('Hello Zorblax Smith, thanks.'), 'Hello the maintainer, thanks.');
});

test('a registered surname on its own is replaced', () => {
  assert.equal(redact('signed Quendle'), 'signed the maintainer');
});

test('a possessive keeps its suffix', () => {
  assert.equal(redact("Zorblax's call"), "the maintainer's call");
});

test('a name-embedded decision ID is neutralized whole', () => {
  assert.equal(redact('ZORBLAX-DECISION-A landed'), 'an internal decision landed');
});

test('a handle becomes <user>', () => {
  assert.equal(redact('ssh hostuser42@box'), 'ssh <user>@box');
});

test('fragments of longer words are left alone', () => {
  assert.equal(redact('xzorblax zorblax_x 9zorblax'), 'xzorblax zorblax_x 9zorblax');
});

test('ordinary text is unchanged and reports no hits', () => {
  const t = 'TokenPak records each request and shows a receipt.';
  assert.equal(redact(t), t);
  assert.deepEqual(findPrivateTerms(t, terms), []);
});

test('find reports kind without needing the word in source', () => {
  const hits = findPrivateTerms('Zorblax and hostuser42', terms);
  assert.deepEqual(hits.map((h) => h.kind), ['name', 'handle']);
});

console.log(`\nprivate terms: ${passed} tests passed.`);

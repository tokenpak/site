/*
 * Unit test for sanitizeBody() in sync-releases.ts — the durable recurrence
 * guard that genericizes private home-config paths copied verbatim from
 * upstream GitHub Release bodies, keeping the deployed /releases data
 * public-safe. No framework: run with
 *   tsx scripts/sync-releases.test.ts
 * Wired into `npm run validate`, so it gates every build/PR. Exits non-zero on
 * the first failure.
 *
 * Note: the "leaky" fixtures are assembled from fragments (HOME + DOT + tool)
 * so the very path pattern this guard removes is never embedded verbatim in
 * this public source file.
 */
import assert from 'node:assert/strict';
import { sanitizeBody } from './sync-releases.ts';

const HOME = '~';
const DOT = '/.';
// Reconstruct private home-config prefixes without writing them as literals.
const ocPath = (tail: string) => `${HOME}${DOT}openclaw/${tail}`;
const codexPath = (tail: string) => `${HOME}${DOT}codex/${tail}`;
const unknownToolPath = (tail: string) => `${HOME}${DOT}somefuturetool/${tail}`;
const absHome = (user: string, tail: string) => `/home/${user}${DOT}${tail}`;

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// --- private fleet home-config paths get genericized ---
test('genericizes a nested home-config file path', () => {
  assert.equal(
    sanitizeBody(`reads \`${ocPath('sessions/active.json')}\` for the session`),
    'reads `<config-dir>/sessions/active.json` for the session',
  );
});

test('genericizes a single-segment home-config dir', () => {
  assert.equal(sanitizeBody(`the \`${ocPath('workspace')}\` directory`), 'the `<config-dir>/workspace` directory');
});

test('genericizes a home-config json file', () => {
  assert.equal(sanitizeBody(`installed into \`${ocPath('openclaw.json')}\``), 'installed into `<config-dir>/openclaw.json`');
});

test('genericizes an unknown future tool home-config path (closes the class, not 3 instances)', () => {
  assert.equal(sanitizeBody(`state in \`${unknownToolPath('state.json')}\``), 'state in `<config-dir>/state.json`');
});

test('preserves documented third-party CLI config dirs ~/.codex + ~/.claude (ratified keep)', () => {
  const sc = `token at \`${codexPath('auth.json')}\``;
  assert.equal(sanitizeBody(sc), sc);
  const cl = 'OAuth in `~/.claude/.credentials.json`';
  assert.equal(sanitizeBody(cl), cl);
});

// --- absolute /home/<user>/ fleet form is also genericized ---
test('genericizes /home/<user>/.<tool> absolute form', () => {
  assert.equal(sanitizeBody(`see ${absHome('sue', 'openclaw/.env')}`), 'see <config-dir>/.env');
});

// --- allowlisted product paths are preserved ---
test('preserves ~/.tokenpak product paths', () => {
  const s = 'config at `~/.tokenpak/config.yaml` and `~/.tokenpak/pro/daemon.sock-info`';
  assert.equal(sanitizeBody(s), s);
});

test('preserves ~/.openclaw-governor allowlisted path', () => {
  const s = 'governor reads `~/.openclaw-governor/openclaw.json`';
  assert.equal(sanitizeBody(s), s);
});

test('normalizes /home/<user>/.tokenpak to ~ form (allowlisted, de-identified)', () => {
  assert.equal(sanitizeBody(absHome('sue', 'tokenpak/cache/')), '~/.tokenpak/cache/');
});

// --- the bare integration NAME is allowlisted and must stay readable ---
test('leaves the bare "OpenClaw" integration name untouched', () => {
  const s = 'OpenClaw Path C session-binding via the openclaw-adapter hook';
  assert.equal(sanitizeBody(s), s);
});

// --- robustness ---
test('passes null/empty through unchanged', () => {
  assert.equal(sanitizeBody(null), null);
  assert.equal(sanitizeBody(''), '');
});

test('is idempotent (second pass is a no-op)', () => {
  const once = sanitizeBody(`reads \`${ocPath('sessions/active.json')}\``);
  assert.equal(sanitizeBody(once), once);
  assert.ok(!once!.includes(`${HOME}${DOT}openclaw`));
});

test('a realistic mixed body retains no forbidden private path', () => {
  const body = [
    '## TokenPak v1.4.0',
    `\`_openclaw_extract\` reads OpenClaw's active-session file (\`${ocPath('sessions/active.json')}\`).`,
    `falls back to the \`${ocPath('workspace')}\` directory.`,
    'Pro daemon presence check reads `~/.tokenpak/pro/daemon.sock-info`.',
  ].join('\n');
  const out = sanitizeBody(body)!;
  assert.ok(!out.includes(`${HOME}${DOT}openclaw/`), 'no private openclaw home path may remain');
  assert.ok(!/\/home\/[A-Za-z0-9._-]+\//.test(out), 'no /home/<user>/ path may remain');
  assert.ok(out.includes('~/.tokenpak/pro/daemon.sock-info'), 'product path preserved');
  assert.ok(out.includes('OpenClaw'), 'integration name preserved');
});

console.log(`\nsanitizeBody: ${passed} tests passed.`);

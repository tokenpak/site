/*
 * Regression checks for release-to-site workflow ordering.
 *
 * A release dispatch must refresh data/releases.json before any deploy begins.
 * Keep the checks dependency-free so they run in every npm test/validate job.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const syncPath = path.join(workflowsDir, 'sync-release-data.yml');
const deployPath = path.join(workflowsDir, 'deploy.yml');
const sync = fs.readFileSync(syncPath, 'utf8');
const deploy = fs.readFileSync(deployPath, 'utf8');

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test('only the release-data sync workflow consumes release-synced', () => {
  const consumers = fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .filter((name) =>
      fs.readFileSync(path.join(workflowsDir, name), 'utf8').includes('release-synced'),
    );

  assert.deepEqual(consumers, ['sync-release-data.yml']);
  assert.ok(!deploy.includes('release-synced'));
  assert.ok(deploy.includes('types: [docs-links-synced]'));
});

test('a tagged release dispatch waits before release data is regenerated', () => {
  const waitIndex = sync.indexOf('- name: Wait for dispatched release');
  const regenerateIndex = sync.indexOf('- name: Regenerate data/releases.json');

  assert.ok(waitIndex >= 0, 'release queryability wait step is missing');
  assert.ok(regenerateIndex > waitIndex, 'release data regeneration must follow the wait step');
  assert.ok(sync.includes("github.event_name == 'repository_dispatch'"));
  assert.ok(sync.includes("github.event.client_payload.tag_name != ''"));
  assert.ok(sync.includes('RELEASE_TAG: ${{ github.event.client_payload.tag_name }}'));
});

test('the queryability wait is authenticated and bounded', () => {
  assert.ok(sync.includes('GH_TOKEN: ${{ secrets.MAIN_REPO_TOKEN || secrets.GITHUB_TOKEN }}'));
  assert.ok(sync.includes('repos/tokenpak/tokenpak/releases/tags/$RELEASE_TAG'));
  assert.ok(sync.includes('max_attempts=24'));
  assert.ok(sync.includes('sleep 5'));
  assert.ok(sync.includes('did not become queryable within 120 seconds'));
});

test('changed release data triggers exactly one explicit deploy', () => {
  const commitIndex = sync.indexOf('- name: Commit + push if changed');
  const deployIndex = sync.indexOf('- name: Trigger deploy if data changed');

  assert.equal(sync.match(/gh workflow run deploy\.yml/g)?.length, 1);
  assert.ok(commitIndex >= 0, 'release-data commit step is missing');
  assert.ok(deployIndex > commitIndex, 'the explicit deploy must follow the data commit');
  assert.ok(sync.includes("if: steps.commit.outputs.changed == 'true'"));
});

test('manual and scheduled release sync fallbacks remain enabled', () => {
  assert.ok(sync.includes('workflow_dispatch: {}'));
  assert.ok(sync.includes("- cron: '15 7 * * *'"));
});

console.log(`\nworkflow ordering: ${passed} tests passed.`);

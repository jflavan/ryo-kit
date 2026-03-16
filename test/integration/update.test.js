/**
 * Integration tests for update command logic.
 *
 * Tests that updateAction copies latest templates into the project's
 * .ryo/.ryo-templates/ cache, and that the copied content matches the
 * package templates source.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { updateAction } from '../../src/cli/commands/update.js';
import { exists } from '../../src/utils/fs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'ryo-kit-update-test-'));
}

describe('update integration', () => {
  let tmpBase;
  let updated;

  before(async () => {
    tmpBase = await makeTempDir();
    // Run update with the temp directory as projectDir
    updated = await updateAction({ yes: true, projectDir: tmpBase });
  });

  after(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  it('updateAction returns a list of updated template paths', () => {
    assert.ok(Array.isArray(updated), 'updateAction should return an array');
    assert.ok(updated.length > 0, 'Should have updated at least one template');
  });

  it('creates .ryo/.ryo-templates/ cache directory', async () => {
    const cacheDir = join(tmpBase, '.ryo', '.ryo-templates');
    assert.ok(await exists(cacheDir), '.ryo-templates/ should exist');
  });

  it('cached bootstrap templates exist', async () => {
    const bootstrapDir = join(tmpBase, '.ryo', '.ryo-templates', 'bootstrap');
    assert.ok(await exists(bootstrapDir), 'bootstrap cache should exist');
  });

  it('cached templates match source templates', async () => {
    // Verify that ryo-gen.skill.md in bootstrap cache matches source
    const srcPath = join(TEMPLATES_DIR, 'bootstrap', 'ryo-gen.skill.md');
    const cachedPath = join(tmpBase, '.ryo', '.ryo-templates', 'bootstrap', 'ryo-gen.skill.md');

    const srcContent = await readFile(srcPath, 'utf8');
    const cachedContent = await readFile(cachedPath, 'utf8');
    assert.equal(cachedContent, srcContent, 'Cached template should match source');
  });

  it('running update twice is idempotent', async () => {
    const updated2 = await updateAction({ yes: true, projectDir: tmpBase });
    assert.ok(Array.isArray(updated2));
    // Same number of files updated both times
    assert.equal(updated2.length, updated.length);
  });

  it('update overwrites an older version of a skill', async () => {
    // Simulate an "older" version by writing different content to cached file
    const cachedPath = join(tmpBase, '.ryo', '.ryo-templates', 'bootstrap', 'ryo-gen.skill.md');
    await writeFile(cachedPath, '# old version\n', 'utf8');

    // Run update again
    await updateAction({ yes: true, projectDir: tmpBase });

    // Verify it was overwritten with the real content
    const srcContent = await readFile(join(TEMPLATES_DIR, 'bootstrap', 'ryo-gen.skill.md'), 'utf8');
    const newContent = await readFile(cachedPath, 'utf8');
    assert.equal(newContent, srcContent, 'Update should overwrite older cached version');
  });
});

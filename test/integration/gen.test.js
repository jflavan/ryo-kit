/**
 * Integration tests for gen command logic.
 *
 * Writes an org-context.yaml to a temp .ryo/ directory, then runs genAction
 * with repoOnly:true to scaffold the full .ryo/ structure and install skills.
 * NEVER writes to ~/.ryo/ — all paths are confined to temp directories.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

import { genAction } from '../../src/cli/commands/gen.js';
import { exists } from '../../src/utils/fs.js';

const SOLO_DEV_CONTEXT = {
  methodology: 'none',
  stack: { languages: ['javascript'], frameworks: ['express'], cloud: 'none' },
  team: { size: 'solo' },
  compliance: [],
  tools: { ai: ['claude-code'], scm: 'github' },
};

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'ryo-kit-gen-test-'));
}

describe('gen integration', () => {
  let tmpBase;

  before(async () => {
    tmpBase = await makeTempDir();

    // Pre-write org context so genAction can find it in repo-only mode
    const ryoDir = join(tmpBase, '.ryo');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(ryoDir, { recursive: true });
    await writeFile(
      join(ryoDir, 'org-context.yaml'),
      YAML.stringify(SOLO_DEV_CONTEXT),
      'utf8',
    );
  });

  after(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  it('genAction completes without error in repoOnly mode', async () => {
    await genAction({ yes: true, projectDir: tmpBase, repoOnly: true });
  });

  it('creates .ryo/agents/ directory', async () => {
    assert.ok(await exists(join(tmpBase, '.ryo', 'agents')));
  });

  it('creates .agents/skills/ directory (canonical skill location)', async () => {
    assert.ok(await exists(join(tmpBase, '.agents', 'skills')));
  });

  it('creates .ryo/workflows/ directory', async () => {
    assert.ok(await exists(join(tmpBase, '.ryo', 'workflows')));
  });

  it('creates .ryo/.state/ directory', async () => {
    assert.ok(await exists(join(tmpBase, '.ryo', '.state')));
  });

  it('installs claude-code skills into .claude/skills/', async () => {
    assert.ok(await exists(join(tmpBase, '.claude', 'skills')));
  });
});

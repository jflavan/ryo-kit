/**
 * Integration tests for docs command logic.
 *
 * Writes an org-context.yaml to a temp .ryo/ directory, then runs
 * docsAction to install the docs skill template.
 * NEVER writes to ~/.ryo/ — all paths are confined to temp directories.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

import { docsAction } from '../../src/cli/commands/docs.js';
import { exists } from '../../src/utils/fs.js';

const SOLO_DEV_CONTEXT = {
  methodology: 'none',
  stack: { languages: ['javascript'], frameworks: ['express'], cloud: 'none' },
  team: { size: 'solo' },
  compliance: [],
  tools: { ai: ['claude-code'], scm: 'github' },
};

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'ryo-kit-docs-test-'));
}

describe('docs integration', () => {
  let tmpBase;

  before(async () => {
    tmpBase = await makeTempDir();

    const ryoDir = join(tmpBase, '.ryo');
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

  it('docsAction completes without error', async () => {
    await docsAction({ yes: true, projectDir: tmpBase, repoOnly: true });
  });

  it('installs ryo-docs skill to .agents/skills/', async () => {
    assert.ok(
      await exists(join(tmpBase, '.agents', 'skills', 'ryo-docs', 'SKILL.md')),
    );
  });

  it('installs claude-code skill reference', async () => {
    assert.ok(await exists(join(tmpBase, '.claude', 'skills')));
  });
});

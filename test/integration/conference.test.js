/**
 * Integration tests for conference command logic.
 *
 * Writes an org-context.yaml to a temp .ryo/ directory, then runs
 * conferenceAction to install the conference skill template.
 * NEVER writes to ~/.ryo/ — all paths are confined to temp directories.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

import { conferenceAction } from '../../src/cli/commands/conference.js';
import { exists } from '../../src/utils/fs.js';

const SOLO_DEV_CONTEXT = {
  methodology: 'none',
  stack: { languages: ['javascript'], frameworks: ['express'], cloud: 'none' },
  team: { size: 'solo' },
  compliance: [],
  tools: { ai: ['claude-code'], scm: 'github' },
};

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'ryo-kit-conference-test-'));
}

describe('conference integration', () => {
  let tmpBase;

  before(async () => {
    tmpBase = await makeTempDir();

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

  it('conferenceAction completes without error', async () => {
    await conferenceAction({ yes: true, projectDir: tmpBase, repoOnly: true });
  });

  it('installs ryo-conference skill to .agents/skills/', async () => {
    assert.ok(
      await exists(join(tmpBase, '.agents', 'skills', 'ryo-conference', 'SKILL.md')),
    );
  });

  it('installs claude-code skill reference', async () => {
    assert.ok(await exists(join(tmpBase, '.claude', 'skills')));
  });
});

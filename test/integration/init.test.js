/**
 * Integration tests for init command logic.
 *
 * Tests the writer and scaffolder functions directly (bypassing TUI) to verify
 * that writing org context, constitution, and installing skills works end-to-end.
 * NEVER writes to ~/.ryo/ — all paths are confined to temp directories.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeOrgContext, writeConstitution } from '../../src/context/writer.js';
import { installSkillsForRuntimes } from '../../src/scaffolder/skill-writer.js';
import { readYaml } from '../../src/utils/yaml.js';
import { OrgContextSchema } from '../../src/context/schema.js';
import { exists } from '../../src/utils/fs.js';

const SOLO_DEV_CONTEXT = {
  methodology: 'none',
  stack: { languages: ['javascript'], frameworks: ['express'], cloud: 'none' },
  team: { size: 'solo' },
  compliance: [],
  tools: { ai: ['claude-code'], scm: 'github' },
};

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'ryo-kit-init-test-'));
}

describe('init integration', () => {
  let tmpBase;
  let ryoDir;

  before(async () => {
    tmpBase = await makeTempDir();
    ryoDir = join(tmpBase, '.ryo');
  });

  after(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  it('writeOrgContext writes org-context.yaml to the target dir', async () => {
    await writeOrgContext(ryoDir, SOLO_DEV_CONTEXT);
    const orgContextPath = join(ryoDir, 'org-context.yaml');
    await access(orgContextPath); // throws if missing
  });

  it('written org-context.yaml is valid per OrgContextSchema', async () => {
    const data = await readYaml(join(ryoDir, 'org-context.yaml'));
    const result = OrgContextSchema.safeParse(data);
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  });

  it('writeConstitution writes constitution.md to the target dir', async () => {
    await writeConstitution(ryoDir);
    const constitutionPath = join(ryoDir, 'constitution.md');
    await access(constitutionPath); // throws if missing
  });

  it('installSkillsForRuntimes installs claude-code skills into .claude/skills/', async () => {
    await installSkillsForRuntimes(tmpBase, ['claude-code']);
    const skillsDir = join(tmpBase, '.claude', 'skills');
    const skillsDirExists = await exists(skillsDir);
    assert.ok(skillsDirExists, '.claude/skills/ should exist after install');
  });

  it('at least one ryo-* skill symlink is created for claude-code', async () => {
    const skillsDir = join(tmpBase, '.claude', 'skills');
    const { readdir, lstat } = await import('node:fs/promises');
    const entries = await readdir(skillsDir);
    const ryoEntries = entries.filter(e => e.startsWith('ryo-'));
    assert.ok(ryoEntries.length > 0, 'Expected at least one ryo-* skill entry');
    // Verify it's a symlink
    const stats = await lstat(join(skillsDir, ryoEntries[0]));
    assert.ok(stats.isSymbolicLink(), 'Expected skill entry to be a symlink');
  });
});

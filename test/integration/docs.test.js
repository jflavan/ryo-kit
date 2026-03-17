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

import { readFile } from 'node:fs/promises';

import { docsAction } from '../../src/cli/commands/docs.js';
import { exists } from '../../src/utils/fs.js';
import { parseFrontmatter } from '../../src/context/schema.js';

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

  it('installed SKILL.md contains valid ryo-docs frontmatter', async () => {
    const skillPath = join(tmpBase, '.agents', 'skills', 'ryo-docs', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    const { data } = parseFrontmatter(content);
    assert.equal(data.name, 'ryo-docs');
    assert.equal(data.trigger, '/ryo-docs');
    assert.ok(data.description);
  });

  it('installed SKILL.md contains key orchestrator sections', async () => {
    const skillPath = join(tmpBase, '.agents', 'skills', 'ryo-docs', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assert.ok(content.includes('## Step 1: Load Context'), 'missing Step 1');
    assert.ok(content.includes('## Step 2: Ask the User'), 'missing Step 2');
    assert.ok(content.includes('## Step 3: Scan & Assess'), 'missing Step 3');
    assert.ok(content.includes('## Step 4: Present the Plan'), 'missing Step 4');
    assert.ok(content.includes('## Step 5: Generate Docs'), 'missing Step 5');
    assert.ok(content.includes('## Step 6: Wrap Up'), 'missing Step 6');
    assert.ok(content.includes('## Error Handling'), 'missing Error Handling');
  });
});

describe('docs integration — no runtimes configured', () => {
  let tmpBase;

  const NO_RUNTIME_CONTEXT = {
    methodology: 'none',
    stack: { languages: ['javascript'], frameworks: ['express'], cloud: 'none' },
    team: { size: 'solo' },
    compliance: [],
    tools: { ai: [], scm: 'github' },
  };

  before(async () => {
    tmpBase = await makeTempDir();

    const ryoDir = join(tmpBase, '.ryo');
    await mkdir(ryoDir, { recursive: true });
    await writeFile(
      join(ryoDir, 'org-context.yaml'),
      YAML.stringify(NO_RUNTIME_CONTEXT),
      'utf8',
    );
  });

  after(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  it('completes without error when no runtimes configured', async () => {
    await docsAction({ yes: true, projectDir: tmpBase, repoOnly: true });
  });

  it('does not create .agents/ directory when no runtimes configured', async () => {
    assert.ok(!(await exists(join(tmpBase, '.agents'))));
  });
});

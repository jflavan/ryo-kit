import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, lstat, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

import { syncAction, migrateOldLayout } from '../src/cli/commands/sync.js';
import { AGENT_BLOCK_START } from '../src/utils/agent-block.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-sync-test-'));
}

function makeOrgContext(aiTools) {
  return YAML.stringify({
    name: 'test-org',
    methodology: 'kanban',
    stack: {
      languages: ['typescript'],
      frameworks: ['node'],
      cloud: 'none',
    },
    team: { size: 'solo' },
    compliance: [],
    tools: {
      ai: aiTools,
      scm: 'github',
    },
  });
}

const AGENT_FRONTMATTER = `---
name: builder
description: Builds things
role: Builder Agent
responsibilities:
  - Build stuff
handoff_to: []
---

# Builder

Builds things.
`;

async function setupProject(dir, aiTools) {
  // org-context.yaml (repo-local)
  await mkdir(join(dir, '.ryo', 'agents'), { recursive: true });
  await writeFile(join(dir, '.ryo', 'org-context.yaml'), makeOrgContext(aiTools), 'utf8');

  // Canonical skill
  await mkdir(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true });
  await writeFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen\n\nGenerates things.', 'utf8');

  // Marker file
  await writeFile(join(dir, '.agents', '.ryo-kit'), '', 'utf8');

  // Canonical agent
  await writeFile(join(dir, '.ryo', 'agents', 'builder.agent.md'), AGENT_FRONTMATTER, 'utf8');
}

describe('syncAction', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('creates skill symlinks for claude-code', async () => {
    await setupProject(dir, ['claude-code']);
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('does not create skill symlinks for copilot (auto-discovers from .agents/skills/)', async () => {
    await setupProject(dir, ['copilot']);
    await syncAction({ projectDir: dir });
    // .github/skills/ should not exist since copilot auto-discovers from .agents/skills/
    await assert.rejects(() => access(join(dir, '.github', 'skills')));
  });

  test('creates agent symlinks for claude-code', async () => {
    await setupProject(dir, ['claude-code']);
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.claude', 'agents', 'builder.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('creates agent symlinks for copilot', async () => {
    await setupProject(dir, ['copilot']);
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.github', 'agents', 'builder.agent.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('aborts if org-context.yaml is missing', async () => {
    // Create a bare project dir with no org-context
    await mkdir(join(dir, '.ryo'), { recursive: true });
    await assert.rejects(
      () => syncAction({ projectDir: dir }),
      /org context/i,
    );
  });

  test('aborts if .agents/ exists without marker and no --force', async () => {
    await mkdir(join(dir, '.ryo'), { recursive: true });
    await writeFile(join(dir, '.ryo', 'org-context.yaml'), makeOrgContext(['claude-code']), 'utf8');
    // Create .agents/ without marker
    await mkdir(join(dir, '.agents'), { recursive: true });
    await assert.rejects(
      () => syncAction({ projectDir: dir }),
      /\.agents\//,
    );
  });

  test('proceeds with --force even without marker', async () => {
    await mkdir(join(dir, '.ryo', 'agents'), { recursive: true });
    await writeFile(join(dir, '.ryo', 'org-context.yaml'), makeOrgContext(['claude-code']), 'utf8');
    // Create .agents/ with skill but without marker
    await mkdir(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');
    await writeFile(join(dir, '.ryo', 'agents', 'builder.agent.md'), AGENT_FRONTMATTER, 'utf8');

    // Should not throw with force
    await syncAction({ projectDir: dir, force: true });
    const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('is idempotent — running twice works', async () => {
    await setupProject(dir, ['claude-code', 'copilot']);
    await syncAction({ projectDir: dir });
    await syncAction({ projectDir: dir });

    // Verify claude-code symlinks still exist and are valid
    const claudeSkill = join(dir, '.claude', 'skills', 'ryo-gen');
    assert.ok((await lstat(claudeSkill)).isSymbolicLink());

    // Copilot should NOT have skill symlinks (auto-discovers from .agents/skills/)
    await assert.rejects(() => access(join(dir, '.github', 'skills')));
  });

  test('removes stale symlinks when canonical skill is deleted', async () => {
    await setupProject(dir, ['claude-code']);
    await syncAction({ projectDir: dir });

    // Verify skill was installed
    const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
    assert.ok((await lstat(linkPath)).isSymbolicLink());

    // Remove the canonical skill directory
    await rm(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true, force: true });

    // Re-sync — stale symlink should be removed
    await syncAction({ projectDir: dir });

    // The symlink should no longer exist
    await assert.rejects(() => access(linkPath));
  });

  test('does not duplicate agent blocks on repeated sync', async () => {
    await setupProject(dir, ['cursor']);
    await syncAction({ projectDir: dir });
    await syncAction({ projectDir: dir });

    const agentsMd = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    // Count occurrences of the agent name heading — should appear exactly once
    const matches = agentsMd.match(/### builder/g);
    assert.equal(matches.length, 1, 'Agent should appear exactly once after repeated sync');
  });

  test('handles auto-discovery runtimes (cursor, codex, gemini-cli)', async () => {
    await setupProject(dir, ['cursor', 'codex', 'gemini-cli']);
    await syncAction({ projectDir: dir });

    // Cursor writes agent blocks to AGENTS.md
    const agentsMd = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(agentsMd.includes(AGENT_BLOCK_START));
    assert.ok(agentsMd.includes('builder'));

    // Gemini writes agent blocks to GEMINI.md
    const geminiMd = await readFile(join(dir, 'GEMINI.md'), 'utf8');
    assert.ok(geminiMd.includes(AGENT_BLOCK_START));
    assert.ok(geminiMd.includes('builder'));

    // Codex writes TOML agent files
    const tomlPath = join(dir, '.codex', 'agents', 'builder.toml');
    const tomlContent = await readFile(tomlPath, 'utf8');
    assert.ok(tomlContent.includes('builder'));
  });
});

describe('syncAction migration', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('migrates .ryo/skills/ to .agents/skills/', async () => {
    // Set up old layout: .ryo/skills/ryo-gen/
    await mkdir(join(dir, '.ryo', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.ryo', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');

    await migrateOldLayout(dir);

    // Skills should now be at .agents/skills/ryo-gen/
    const newSkillFile = join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md');
    const content = await readFile(newSkillFile, 'utf8');
    assert.equal(content, '# Gen');

    // Old location should be gone
    await assert.rejects(() => access(join(dir, '.ryo', 'skills')));

    // Marker file should be created
    await access(join(dir, '.agents', '.ryo-kit'));
  });

  test('does not overwrite .agents/skills/ if it already exists', async () => {
    // Set up both old and new layout
    await mkdir(join(dir, '.ryo', 'skills', 'ryo-old'), { recursive: true });
    await writeFile(join(dir, '.ryo', 'skills', 'ryo-old', 'SKILL.md'), '# Old', 'utf8');
    await mkdir(join(dir, '.agents', 'skills', 'ryo-new'), { recursive: true });
    await writeFile(join(dir, '.agents', 'skills', 'ryo-new', 'SKILL.md'), '# New', 'utf8');

    await migrateOldLayout(dir);

    // .agents/skills should be unchanged (ryo-new still there)
    const newContent = await readFile(join(dir, '.agents', 'skills', 'ryo-new', 'SKILL.md'), 'utf8');
    assert.equal(newContent, '# New');

    // .ryo/skills should still exist (not moved)
    await access(join(dir, '.ryo', 'skills'));
  });

  test('removes old .github/prompts/ryo-*.prompt.md files', async () => {
    await mkdir(join(dir, '.github', 'prompts'), { recursive: true });
    // Old ryo prompts (should be removed)
    await writeFile(join(dir, '.github', 'prompts', 'ryo-gen.prompt.md'), '# Ryo Gen', 'utf8');
    await writeFile(join(dir, '.github', 'prompts', 'ryo-review.prompt.md'), '# Ryo Review', 'utf8');
    // Non-ryo prompt (should be kept)
    await writeFile(join(dir, '.github', 'prompts', 'my-custom.prompt.md'), '# Custom', 'utf8');

    await migrateOldLayout(dir);

    // ryo prompts should be gone
    await assert.rejects(() => access(join(dir, '.github', 'prompts', 'ryo-gen.prompt.md')));
    await assert.rejects(() => access(join(dir, '.github', 'prompts', 'ryo-review.prompt.md')));

    // Non-ryo prompt should still exist
    await access(join(dir, '.github', 'prompts', 'my-custom.prompt.md'));
  });

  test('removes old root-level skills/ryo-* directories (Codex)', async () => {
    await mkdir(join(dir, 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, 'skills', 'ryo-gen', 'index.js'), '// gen', 'utf8');
    await mkdir(join(dir, 'skills', 'ryo-review'), { recursive: true });
    await writeFile(join(dir, 'skills', 'ryo-review', 'index.js'), '// review', 'utf8');
    // Non-ryo skill dir (should be kept)
    await mkdir(join(dir, 'skills', 'my-custom'), { recursive: true });
    await writeFile(join(dir, 'skills', 'my-custom', 'index.js'), '// custom', 'utf8');

    await migrateOldLayout(dir);

    // ryo-* skill dirs should be gone
    await assert.rejects(() => access(join(dir, 'skills', 'ryo-gen')));
    await assert.rejects(() => access(join(dir, 'skills', 'ryo-review')));

    // Non-ryo skill dir should still exist
    await access(join(dir, 'skills', 'my-custom'));
  });

  test('does nothing when no migration paths exist', async () => {
    // Empty project dir - should not throw
    await migrateOldLayout(dir);
  });
});

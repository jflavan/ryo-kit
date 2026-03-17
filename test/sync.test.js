import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, lstat, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';

import { syncAction } from '../src/cli/commands/sync.js';
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

  test('creates skill symlinks for copilot', async () => {
    await setupProject(dir, ['copilot']);
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.github', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
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

    // Verify symlinks still exist and are valid
    const claudeSkill = join(dir, '.claude', 'skills', 'ryo-gen');
    const copilotSkill = join(dir, '.github', 'skills', 'ryo-gen');
    assert.ok((await lstat(claudeSkill)).isSymbolicLink());
    assert.ok((await lstat(copilotSkill)).isSymbolicLink());
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

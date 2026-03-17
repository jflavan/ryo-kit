import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, mkdir, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

import { ClaudeCodeRuntime } from '../src/runtimes/claude-code.js';
import { CopilotRuntime } from '../src/runtimes/copilot.js';
import { CursorRuntime } from '../src/runtimes/cursor.js';
import { CodexRuntime } from '../src/runtimes/codex.js';
import { WindsurfRuntime } from '../src/runtimes/windsurf.js';
import { GeminiCliRuntime } from '../src/runtimes/gemini-cli.js';
import { RYO_BLOCK_START, RYO_BLOCK_END } from '../src/runtimes/base.js';
import { AGENT_BLOCK_START, AGENT_BLOCK_END } from '../src/utils/agent-block.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-runtime-test-'));
}

const SKILL_CONTENT = '---\nname: ryo-test\ntrigger: /ryo-test\n---\n\n# My Skill\n\nDoes things.';
const CONTEXT_REF = 'See .ryo/ for context files.';

const AGENT_META = {
  name: 'planner',
  role: 'Planning Agent',
  description: 'Plans things.',
  responsibilities: ['Plan tasks'],
  handoff_to: ['executor'],
};

/**
 * Sets up the canonical skill dir at .agents/skills/{name}/SKILL.md
 * and optionally .ryo/agents/{name}.agent.md for agent tests.
 */
async function setupCanonicalSkill(dir, skillName, content) {
  const canonicalDir = join(dir, '.agents', 'skills', skillName);
  await mkdir(canonicalDir, { recursive: true });
  await writeFile(join(canonicalDir, 'SKILL.md'), content, 'utf8');
  return canonicalDir;
}

async function setupCanonicalAgent(dir, agentName) {
  const agentsDir = join(dir, '.ryo', 'agents');
  await mkdir(agentsDir, { recursive: true });
  const agentFile = join(agentsDir, `${agentName}.agent.md`);
  await writeFile(agentFile, `# ${agentName}\n\nAgent content.`, 'utf8');
  return agentFile;
}

// ---- Claude Code ----

describe('ClaudeCodeRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new ClaudeCodeRuntime(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "claude-code"', () => {
    assert.equal(runtime.name, 'claude-code');
  });

  test('skillsDir points to .claude/skills', () => {
    assert.equal(runtime.skillsDir, join(dir, '.claude', 'skills'));
  });

  test('agentsDir points to .claude/agents', () => {
    assert.equal(runtime.agentsDir, join(dir, '.claude', 'agents'));
  });

  test('agentConfigFile is null (uses symlinks)', () => {
    assert.equal(runtime.agentConfigFile, null);
  });

  test('configFile points to CLAUDE.md', () => {
    assert.equal(runtime.configFile, join(dir, 'CLAUDE.md'));
  });

  test('installSkill creates symlink to canonical dir', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('installSkill symlink resolves to SKILL.md content', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    const content = await readFile(join(dir, '.claude', 'skills', 'ryo-gen', 'SKILL.md'), 'utf8');
    assert.equal(content, SKILL_CONTENT);
  });

  test('installAgent creates symlink to .ryo/agents/', async () => {
    await setupCanonicalAgent(dir, 'planner');
    await runtime.installAgent('planner', AGENT_META);
    const linkPath = join(dir, '.claude', 'agents', 'planner.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('updateConfig creates CLAUDE.md with ryo block if missing', async () => {
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes(RYO_BLOCK_START));
    assert.ok(content.includes(RYO_BLOCK_END));
    assert.ok(content.includes(CONTEXT_REF));
  });

  test('updateConfig appends to existing CLAUDE.md without clobbering', async () => {
    const existing = '# My project\n\nExisting content.\n';
    await writeFile(join(dir, 'CLAUDE.md'), existing, 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes('# My project'));
    assert.ok(content.includes('Existing content.'));
    assert.ok(content.includes(RYO_BLOCK_START));
    assert.ok(content.includes(CONTEXT_REF));
  });

  test('updateConfig replaces existing ryo block', async () => {
    const existing = `# Project\n\n${RYO_BLOCK_START}\nold ref\n${RYO_BLOCK_END}\n`;
    await writeFile(join(dir, 'CLAUDE.md'), existing, 'utf8');
    await runtime.updateConfig('new ref');
    const content = await readFile(join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(!content.includes('old ref'));
    assert.ok(content.includes('new ref'));
    // Should only have one block
    assert.equal(content.indexOf(RYO_BLOCK_START), content.lastIndexOf(RYO_BLOCK_START));
  });

  test('uninstall removes ryo-kit symlinks from skills dir', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.claude', 'skills', 'ryo-gen')));
  });

  test('uninstall removes ryo block from CLAUDE.md', async () => {
    const existing = '# Project\n\nKeep this.\n';
    await writeFile(join(dir, 'CLAUDE.md'), existing, 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    await runtime.uninstall();
    const content = await readFile(join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(!content.includes(RYO_BLOCK_START));
    assert.ok(!content.includes(CONTEXT_REF));
    assert.ok(content.includes('Keep this.'));
  });

  test('uninstall is safe when no skills or config exist', async () => {
    // Should not throw
    await runtime.uninstall();
  });
});

// ---- Copilot ----

describe('CopilotRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new CopilotRuntime(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "copilot"', () => {
    assert.equal(runtime.name, 'copilot');
  });

  test('skillsDir points to .github/skills', () => {
    assert.equal(runtime.skillsDir, join(dir, '.github', 'skills'));
  });

  test('agentsDir points to .github/agents', () => {
    assert.equal(runtime.agentsDir, join(dir, '.github', 'agents'));
  });

  test('agentConfigFile is null (uses symlinks)', () => {
    assert.equal(runtime.agentConfigFile, null);
  });

  test('configFile points to .github/copilot-instructions.md', () => {
    assert.equal(runtime.configFile, join(dir, '.github', 'copilot-instructions.md'));
  });

  test('installSkill creates symlink to canonical dir', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    const linkPath = join(dir, '.github', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('installAgent creates symlink to .ryo/agents/', async () => {
    await setupCanonicalAgent(dir, 'planner');
    await runtime.installAgent('planner', AGENT_META);
    const linkPath = join(dir, '.github', 'agents', 'planner.agent.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('updateConfig creates copilot-instructions.md with ryo block if missing', async () => {
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    assert.ok(content.includes(RYO_BLOCK_START));
    assert.ok(content.includes(CONTEXT_REF));
  });

  test('updateConfig appends without clobbering existing content', async () => {
    await mkdir(join(dir, '.github'), { recursive: true });
    const existing = '# Copilot instructions\n\nExisting content.\n';
    await writeFile(join(dir, '.github', 'copilot-instructions.md'), existing, 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    assert.ok(content.includes('Existing content.'));
    assert.ok(content.includes(RYO_BLOCK_START));
  });

  test('uninstall removes ryo-kit symlinks from skills dir', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.github', 'skills', 'ryo-gen')));
  });

  test('uninstall removes ryo block from copilot-instructions.md', async () => {
    await mkdir(join(dir, '.github'), { recursive: true });
    await writeFile(join(dir, '.github', 'copilot-instructions.md'), '# Keep\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    await runtime.uninstall();
    const content = await readFile(join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    assert.ok(!content.includes(RYO_BLOCK_START));
    assert.ok(content.includes('Keep'));
  });

  test('uninstall is safe when nothing installed', async () => {
    await runtime.uninstall();
  });
});

// ---- Cursor ----

describe('CursorRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new CursorRuntime(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "cursor"', () => {
    assert.equal(runtime.name, 'cursor');
  });

  test('skillsDir is null (auto-discovery)', () => {
    assert.equal(runtime.skillsDir, null);
  });

  test('agentsDir is null', () => {
    assert.equal(runtime.agentsDir, null);
  });

  test('agentConfigFile points to AGENTS.md', () => {
    assert.equal(runtime.agentConfigFile, join(dir, 'AGENTS.md'));
  });

  test('configFile points to .cursorrules', () => {
    assert.equal(runtime.configFile, join(dir, '.cursorrules'));
  });

  test('installSkill is a no-op', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    // Should not throw, should not create any files in .cursor/
    await runtime.installSkill('ryo-gen', canonicalDir);
    await assert.rejects(() => access(join(dir, '.cursor')));
  });

  test('installAgent writes to AGENTS.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('planner'));
    assert.ok(content.includes('Planning Agent'));
  });

  test('updateConfig creates .cursorrules with ryo block if missing', async () => {
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, '.cursorrules'), 'utf8');
    assert.ok(content.includes(RYO_BLOCK_START));
    assert.ok(content.includes(CONTEXT_REF));
  });

  test('updateConfig appends without clobbering existing .cursorrules', async () => {
    await writeFile(join(dir, '.cursorrules'), '# Existing rules\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, '.cursorrules'), 'utf8');
    assert.ok(content.includes('# Existing rules'));
    assert.ok(content.includes(RYO_BLOCK_START));
  });

  test('uninstall removes agent block from AGENTS.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    await runtime.uninstall();
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(!content.includes(AGENT_BLOCK_START));
  });

  test('uninstall removes ryo block from .cursorrules', async () => {
    await writeFile(join(dir, '.cursorrules'), '# Keep\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    await runtime.uninstall();
    const content = await readFile(join(dir, '.cursorrules'), 'utf8');
    assert.ok(!content.includes(RYO_BLOCK_START));
    assert.ok(content.includes('Keep'));
  });

  test('uninstall is safe when nothing installed', async () => {
    await runtime.uninstall();
  });
});

// ---- Codex ----

describe('CodexRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new CodexRuntime(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "codex"', () => {
    assert.equal(runtime.name, 'codex');
  });

  test('skillsDir is null (auto-discovery)', () => {
    assert.equal(runtime.skillsDir, null);
  });

  test('agentsDir points to .codex/agents', () => {
    assert.equal(runtime.agentsDir, join(dir, '.codex', 'agents'));
  });

  test('agentConfigFile points to AGENTS.md', () => {
    assert.equal(runtime.agentConfigFile, join(dir, 'AGENTS.md'));
  });

  test('configFile points to AGENTS.md', () => {
    assert.equal(runtime.configFile, join(dir, 'AGENTS.md'));
  });

  test('installSkill is a no-op', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    // .codex should not be created by installSkill
    await assert.rejects(() => access(join(dir, '.codex')));
  });

  test('installAgent creates TOML at .codex/agents/', async () => {
    await runtime.installAgent('planner', AGENT_META);
    const tomlPath = join(dir, '.codex', 'agents', 'planner.toml');
    const content = await readFile(tomlPath, 'utf8');
    assert.ok(content.includes('name = "planner"'));
    assert.ok(content.includes('Plans things.'));
  });

  test('installAgent also writes to AGENTS.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('planner'));
  });

  test('updateConfig creates AGENTS.md with ryo block if missing', async () => {
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes(RYO_BLOCK_START));
    assert.ok(content.includes(CONTEXT_REF));
  });

  test('updateConfig appends without clobbering existing AGENTS.md', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Agents\n\nExisting.\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes('Existing.'));
    assert.ok(content.includes(RYO_BLOCK_START));
  });

  test('uninstall removes ryo-kit TOML files from .codex/agents/', async () => {
    await runtime.installAgent('planner', AGENT_META);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.codex', 'agents', 'planner.toml')));
  });

  test('uninstall removes ryo block from AGENTS.md', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Keep\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    await runtime.uninstall();
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(!content.includes(RYO_BLOCK_START));
    assert.ok(content.includes('Keep'));
  });

  test('uninstall is safe when nothing installed', async () => {
    await runtime.uninstall();
  });
});

// ---- Windsurf ----

describe('WindsurfRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new WindsurfRuntime(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "windsurf"', () => {
    assert.equal(runtime.name, 'windsurf');
  });

  test('skillsDir points to .windsurf/rules', () => {
    assert.equal(runtime.skillsDir, join(dir, '.windsurf', 'rules'));
  });

  test('agentsDir is null', () => {
    assert.equal(runtime.agentsDir, null);
  });

  test('agentConfigFile points to AGENTS.md', () => {
    assert.equal(runtime.agentConfigFile, join(dir, 'AGENTS.md'));
  });

  test('configFile points to .windsurfrules', () => {
    assert.equal(runtime.configFile, join(dir, '.windsurfrules'));
  });

  test('installSkill copies to .windsurf/rules/ with transformed frontmatter', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    const filePath = join(dir, '.windsurf', 'rules', 'ryo-gen.md');
    const content = await readFile(filePath, 'utf8');
    assert.ok(content.includes('trigger: model_decision'));
    assert.ok(!content.includes('trigger: /ryo-test'));
    assert.ok(content.includes('# My Skill'));
  });

  test('installAgent writes to AGENTS.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('planner'));
  });

  test('updateConfig is a no-op', async () => {
    // Should not throw or write anything
    await runtime.updateConfig(CONTEXT_REF);
    // .windsurfrules should not be created by updateConfig
    await assert.rejects(() => access(join(dir, '.windsurfrules')));
  });

  test('uninstall removes ryo-*.md from .windsurf/rules/', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.windsurf', 'rules', 'ryo-gen.md')));
  });

  test('uninstall removes agent block from AGENTS.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    await runtime.uninstall();
    const content = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.ok(!content.includes(AGENT_BLOCK_START));
  });

  test('uninstall removes legacy .windsurfrules blocks', async () => {
    await writeFile(join(dir, '.windsurfrules'), '# Keep\n<!-- ryo-kit:gen:start -->\ncontent\n<!-- ryo-kit:gen:end -->\n', 'utf8');
    await runtime.uninstall();
    const content = await readFile(join(dir, '.windsurfrules'), 'utf8');
    assert.ok(!content.includes('<!-- ryo-kit:gen:start -->'));
    assert.ok(content.includes('Keep'));
  });

  test('uninstall is safe when nothing installed', async () => {
    await runtime.uninstall();
  });
});

// ---- Gemini CLI ----

describe('GeminiCliRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new GeminiCliRuntime(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "gemini-cli"', () => {
    assert.equal(runtime.name, 'gemini-cli');
  });

  test('skillsDir is null (auto-discovery)', () => {
    assert.equal(runtime.skillsDir, null);
  });

  test('agentsDir is null', () => {
    assert.equal(runtime.agentsDir, null);
  });

  test('agentConfigFile points to GEMINI.md', () => {
    assert.equal(runtime.agentConfigFile, join(dir, 'GEMINI.md'));
  });

  test('configFile points to GEMINI.md', () => {
    assert.equal(runtime.configFile, join(dir, 'GEMINI.md'));
  });

  test('installSkill is a no-op', async () => {
    const canonicalDir = await setupCanonicalSkill(dir, 'ryo-gen', SKILL_CONTENT);
    await runtime.installSkill('ryo-gen', canonicalDir);
    // .gemini should not be created
    await assert.rejects(() => access(join(dir, '.gemini')));
  });

  test('installAgent writes to GEMINI.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    const content = await readFile(join(dir, 'GEMINI.md'), 'utf8');
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('planner'));
    assert.ok(content.includes('Planning Agent'));
  });

  test('updateConfig creates GEMINI.md with ryo block if missing', async () => {
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, 'GEMINI.md'), 'utf8');
    assert.ok(content.includes(RYO_BLOCK_START));
    assert.ok(content.includes(CONTEXT_REF));
  });

  test('updateConfig appends without clobbering existing GEMINI.md', async () => {
    await writeFile(join(dir, 'GEMINI.md'), '# Gemini setup\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    const content = await readFile(join(dir, 'GEMINI.md'), 'utf8');
    assert.ok(content.includes('# Gemini setup'));
    assert.ok(content.includes(RYO_BLOCK_START));
  });

  test('uninstall removes agent block from GEMINI.md', async () => {
    await runtime.installAgent('planner', AGENT_META);
    await runtime.uninstall();
    const content = await readFile(join(dir, 'GEMINI.md'), 'utf8');
    assert.ok(!content.includes(AGENT_BLOCK_START));
  });

  test('uninstall removes ryo block from GEMINI.md', async () => {
    await writeFile(join(dir, 'GEMINI.md'), '# Keep\n', 'utf8');
    await runtime.updateConfig(CONTEXT_REF);
    await runtime.uninstall();
    const content = await readFile(join(dir, 'GEMINI.md'), 'utf8');
    assert.ok(!content.includes(RYO_BLOCK_START));
    assert.ok(content.includes('Keep'));
  });

  test('uninstall is safe when nothing installed', async () => {
    await runtime.uninstall();
  });
});

// ---- BaseRuntime sentinels ----

describe('BaseRuntime sentinels', () => {
  test('RYO_BLOCK_START is correct', () => {
    assert.equal(RYO_BLOCK_START, '<!-- ryo-kit:start -->');
  });

  test('RYO_BLOCK_END is correct', () => {
    assert.equal(RYO_BLOCK_END, '<!-- ryo-kit:end -->');
  });
});

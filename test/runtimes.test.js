import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, mkdir, writeFile } from 'node:fs/promises';
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

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-runtime-test-'));
}

const SKILL_CONTENT = '# My Skill\n\nDoes things.';
const CONTEXT_REF = 'See .ryo/ for context files.';

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

  test('configFile points to CLAUDE.md', () => {
    assert.equal(runtime.configFile, join(dir, 'CLAUDE.md'));
  });

  test('installSkill writes SKILL.md to correct path', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    const skillPath = join(dir, '.claude', 'skills', 'ryo-gen', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assert.equal(content, SKILL_CONTENT);
  });

  test('installSkill creates ryo-<name> directory', async () => {
    await runtime.installSkill('help', SKILL_CONTENT);
    await access(join(dir, '.claude', 'skills', 'ryo-help'));
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

  test('uninstall removes ryo-* skill directories', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.installSkill('help', SKILL_CONTENT);
    await runtime.uninstall();
    const skillsDir = join(dir, '.claude', 'skills');
    // Directories should be gone
    await assert.rejects(() => access(join(skillsDir, 'ryo-gen')));
    await assert.rejects(() => access(join(skillsDir, 'ryo-help')));
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

  test('skillsDir points to .github/prompts', () => {
    assert.equal(runtime.skillsDir, join(dir, '.github', 'prompts'));
  });

  test('configFile points to .github/copilot-instructions.md', () => {
    assert.equal(runtime.configFile, join(dir, '.github', 'copilot-instructions.md'));
  });

  test('installSkill writes ryo-<name>.prompt.md', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    const filePath = join(dir, '.github', 'prompts', 'ryo-gen.prompt.md');
    const content = await readFile(filePath, 'utf8');
    assert.equal(content, SKILL_CONTENT);
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

  test('uninstall removes ryo-*.prompt.md files', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.installSkill('help', SKILL_CONTENT);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.github', 'prompts', 'ryo-gen.prompt.md')));
    await assert.rejects(() => access(join(dir, '.github', 'prompts', 'ryo-help.prompt.md')));
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

  test('skillsDir points to .cursor/rules', () => {
    assert.equal(runtime.skillsDir, join(dir, '.cursor', 'rules'));
  });

  test('configFile points to .cursorrules', () => {
    assert.equal(runtime.configFile, join(dir, '.cursorrules'));
  });

  test('installSkill writes ryo-<name>.md to .cursor/rules', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    const filePath = join(dir, '.cursor', 'rules', 'ryo-gen.md');
    const content = await readFile(filePath, 'utf8');
    assert.equal(content, SKILL_CONTENT);
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

  test('uninstall removes ryo-*.md files from .cursor/rules', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.cursor', 'rules', 'ryo-gen.md')));
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

  test('skillsDir points to skills/', () => {
    assert.equal(runtime.skillsDir, join(dir, 'skills'));
  });

  test('configFile points to AGENTS.md', () => {
    assert.equal(runtime.configFile, join(dir, 'AGENTS.md'));
  });

  test('installSkill writes SKILL.md to skills/ryo-<name>/', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    const skillPath = join(dir, 'skills', 'ryo-gen', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assert.equal(content, SKILL_CONTENT);
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

  test('uninstall removes ryo-* skill dirs from skills/', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, 'skills', 'ryo-gen')));
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

  test('skillsDir is null (skills go inline)', () => {
    assert.equal(runtime.skillsDir, null);
  });

  test('configFile points to .windsurfrules', () => {
    assert.equal(runtime.configFile, join(dir, '.windsurfrules'));
  });

  test('installSkill appends named section to .windsurfrules', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    const content = await readFile(join(dir, '.windsurfrules'), 'utf8');
    assert.ok(content.includes('<!-- ryo-kit:gen:start -->'));
    assert.ok(content.includes('<!-- ryo-kit:gen:end -->'));
    assert.ok(content.includes(SKILL_CONTENT));
  });

  test('installSkill creates .windsurfrules if missing', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await access(join(dir, '.windsurfrules'));
  });

  test('installSkill does not clobber existing content', async () => {
    await writeFile(join(dir, '.windsurfrules'), '# Existing\n', 'utf8');
    await runtime.installSkill('gen', SKILL_CONTENT);
    const content = await readFile(join(dir, '.windsurfrules'), 'utf8');
    assert.ok(content.includes('# Existing'));
    assert.ok(content.includes('<!-- ryo-kit:gen:start -->'));
  });

  test('installSkill replaces existing section for same skill name', async () => {
    await runtime.installSkill('gen', 'old content');
    await runtime.installSkill('gen', 'new content');
    const content = await readFile(join(dir, '.windsurfrules'), 'utf8');
    assert.ok(!content.includes('old content'));
    assert.ok(content.includes('new content'));
    // Only one block
    assert.equal(
      content.split('<!-- ryo-kit:gen:start -->').length - 1,
      1,
    );
  });

  test('updateConfig is a no-op', async () => {
    // Should not throw or write anything
    await runtime.updateConfig(CONTEXT_REF);
    // .windsurfrules should not be created by updateConfig
    await assert.rejects(() => access(join(dir, '.windsurfrules')));
  });

  test('uninstall removes all ryo-kit sections', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.installSkill('help', 'help content');
    await runtime.uninstall();
    const content = await readFile(join(dir, '.windsurfrules'), 'utf8');
    assert.ok(!content.includes('<!-- ryo-kit:gen:start -->'));
    assert.ok(!content.includes('<!-- ryo-kit:help:start -->'));
    assert.ok(!content.includes(SKILL_CONTENT));
  });

  test('uninstall preserves non-ryo content', async () => {
    await writeFile(join(dir, '.windsurfrules'), '# Keep this\n', 'utf8');
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.uninstall();
    const content = await readFile(join(dir, '.windsurfrules'), 'utf8');
    assert.ok(content.includes('Keep this'));
  });

  test('uninstall is safe when .windsurfrules does not exist', async () => {
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

  test('skillsDir points to .gemini/skills', () => {
    assert.equal(runtime.skillsDir, join(dir, '.gemini', 'skills'));
  });

  test('configFile points to GEMINI.md', () => {
    assert.equal(runtime.configFile, join(dir, 'GEMINI.md'));
  });

  test('installSkill writes SKILL.md to .gemini/skills/ryo-<name>/', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    const skillPath = join(dir, '.gemini', 'skills', 'ryo-gen', 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    assert.equal(content, SKILL_CONTENT);
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

  test('uninstall removes ryo-* skill dirs from .gemini/skills/', async () => {
    await runtime.installSkill('gen', SKILL_CONTENT);
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.gemini', 'skills', 'ryo-gen')));
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

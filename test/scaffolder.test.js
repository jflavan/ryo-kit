import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

import { scaffoldProjectDir } from '../src/scaffolder/directory.js';
import { writeDefaultTemplates } from '../src/scaffolder/template-writer.js';
import { getRuntimeForName, installSkillsForRuntimes } from '../src/scaffolder/skill-writer.js';
import { ClaudeCodeRuntime } from '../src/runtimes/claude-code.js';
import { CopilotRuntime } from '../src/runtimes/copilot.js';
import { CursorRuntime } from '../src/runtimes/cursor.js';
import { CodexRuntime } from '../src/runtimes/codex.js';
import { WindsurfRuntime } from '../src/runtimes/windsurf.js';
import { GeminiCliRuntime } from '../src/runtimes/gemini-cli.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-scaffolder-test-'));
}

async function isDir(p) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// ---- scaffoldProjectDir ----

describe('scaffoldProjectDir', () => {
  let tmpBase;
  let ryoDir;

  beforeEach(async () => {
    tmpBase = await makeTempDir();
    ryoDir = join(tmpBase, '.ryo');
  });

  afterEach(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  test('creates .ryo/agents/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, 'agents')));
  });

  test('creates .ryo/skills/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, 'skills')));
  });

  test('creates .ryo/workflows/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, 'workflows')));
  });

  test('creates .ryo/.state/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, '.state')));
  });

  test('creates .ryo/.state/history/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, '.state', 'history')));
  });

  test('creates .ryo/.customize/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, '.customize')));
  });

  test('creates .ryo/.state/current-plan.md as empty stub', async () => {
    await scaffoldProjectDir(ryoDir);
    const planPath = join(ryoDir, '.state', 'current-plan.md');
    await access(planPath);
    const content = await readFile(planPath, 'utf8');
    assert.equal(content, '');
  });

  test('creates .ryo/.customize/README.md with explanation', async () => {
    await scaffoldProjectDir(ryoDir);
    const readmePath = join(ryoDir, '.customize', 'README.md');
    await access(readmePath);
    const content = await readFile(readmePath, 'utf8');
    assert.ok(content.length > 0);
    assert.ok(content.includes('.customize/'));
  });

  test('works when ryoDir does not yet exist (creates it)', async () => {
    const deepRyo = join(tmpBase, 'nested', 'project', '.ryo');
    await scaffoldProjectDir(deepRyo);
    assert.ok(await isDir(join(deepRyo, 'agents')));
  });

  test('is idempotent — can be called twice without error', async () => {
    await scaffoldProjectDir(ryoDir);
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, 'agents')));
  });
});

// ---- writeDefaultTemplates ----

describe('writeDefaultTemplates', () => {
  let tmpBase;

  beforeEach(async () => {
    tmpBase = await makeTempDir();
  });

  afterEach(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  test('creates templates/agent-base.yaml', async () => {
    await writeDefaultTemplates(tmpBase);
    await access(join(tmpBase, 'templates', 'agent-base.yaml'));
  });

  test('creates templates/process-base.yaml', async () => {
    await writeDefaultTemplates(tmpBase);
    await access(join(tmpBase, 'templates', 'process-base.yaml'));
  });

  test('agent-base.yaml contains required fields', async () => {
    await writeDefaultTemplates(tmpBase);
    const content = await readFile(join(tmpBase, 'templates', 'agent-base.yaml'), 'utf8');
    assert.ok(content.includes('name:'));
    assert.ok(content.includes('role:'));
    assert.ok(content.includes('responsibilities:'));
  });

  test('process-base.yaml contains required fields', async () => {
    await writeDefaultTemplates(tmpBase);
    const content = await readFile(join(tmpBase, 'templates', 'process-base.yaml'), 'utf8');
    assert.ok(content.includes('name:'));
    assert.ok(content.includes('phases:'));
  });

  test('creates templates subdirectory if it does not exist', async () => {
    const nested = join(tmpBase, 'a', 'b');
    await writeDefaultTemplates(nested);
    await access(join(nested, 'templates', 'agent-base.yaml'));
    await access(join(nested, 'templates', 'process-base.yaml'));
  });
});

// ---- getRuntimeForName ----

describe('getRuntimeForName', () => {
  test('returns ClaudeCodeRuntime for "claude-code"', () => {
    const r = getRuntimeForName('claude-code', '/tmp/test');
    assert.ok(r instanceof ClaudeCodeRuntime);
  });

  test('returns CopilotRuntime for "copilot"', () => {
    const r = getRuntimeForName('copilot', '/tmp/test');
    assert.ok(r instanceof CopilotRuntime);
  });

  test('returns CursorRuntime for "cursor"', () => {
    const r = getRuntimeForName('cursor', '/tmp/test');
    assert.ok(r instanceof CursorRuntime);
  });

  test('returns CodexRuntime for "codex"', () => {
    const r = getRuntimeForName('codex', '/tmp/test');
    assert.ok(r instanceof CodexRuntime);
  });

  test('returns WindsurfRuntime for "windsurf"', () => {
    const r = getRuntimeForName('windsurf', '/tmp/test');
    assert.ok(r instanceof WindsurfRuntime);
  });

  test('returns GeminiCliRuntime for "gemini-cli"', () => {
    const r = getRuntimeForName('gemini-cli', '/tmp/test');
    assert.ok(r instanceof GeminiCliRuntime);
  });

  test('throws for unknown runtime name', () => {
    assert.throws(() => getRuntimeForName('unknown', '/tmp/test'), /Unknown runtime/);
  });
});

// ---- installSkillsForRuntimes ----

describe('installSkillsForRuntimes', () => {
  let tmpBase;

  beforeEach(async () => {
    tmpBase = await makeTempDir();
  });

  afterEach(async () => {
    await rm(tmpBase, { recursive: true, force: true });
  });

  test('completes without error for claude-code (with or without templates)', async () => {
    // Templates may not exist yet — that's fine, should be skipped gracefully
    await installSkillsForRuntimes(tmpBase, ['claude-code']);
  });

  test('completes without error for all runtimes', async () => {
    await installSkillsForRuntimes(tmpBase, [
      'claude-code', 'copilot', 'cursor', 'codex', 'windsurf', 'gemini-cli',
    ]);
  });

  test('accepts empty runtimes array without error', async () => {
    await installSkillsForRuntimes(tmpBase, []);
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { ClaudeCodeRuntime } from '../src/runtimes/claude-code.js';
import { CursorRuntime } from '../src/runtimes/cursor.js';
import { CodexRuntime } from '../src/runtimes/codex.js';
import { installHooksForRuntimes } from '../src/scaffolder/hook-writer.js';
import { exists } from '../src/utils/fs.js';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, '..', 'templates', 'hooks', 'session-start.js');

describe('session-start hook script', () => {
  let tmp;
  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'ryo-hook-'));
    await mkdir(join(tmp, '.ryo', '.state'), { recursive: true });
    await mkdir(join(tmp, '.ryo', 'workflows'), { recursive: true });
    await mkdir(join(tmp, '.agents', 'skills', 'ryo-session'), { recursive: true });
    await writeFile(join(tmp, '.ryo', 'constitution.md'), '---\nprotected_branches: [main]\n---\n# Constitution\n\n- Never commit secrets\n');
    await writeFile(join(tmp, '.ryo', 'process.md'), '---\nname: p\nphases:\n  - name: plan\n    description: d\n    agents: [builder]\n    artifacts: [a]\n    gate:\n      type: human\n      criteria: [c]\n  - name: implement\n    description: d\n    agents: [builder]\n    artifacts: [a]\n    gate:\n      type: automated\n      criteria: [c]\n---\n# Process\n');
    await writeFile(join(tmp, '.ryo', '.state', 'current-plan.md'), '# Plan\n\n- [x] Phase 1\n- [ ] Phase 2\n');
    await writeFile(join(tmp, '.ryo', '.state', 'ledger.md'), '# Ledger — workflow: new-feature\nStep 1: complete\nRuling: used X — because Y — cost Z\n');
    await writeFile(join(tmp, '.ryo', 'workflows', 'new-feature.workflow.md'), '---\nname: new-feature\n---\n');
    await writeFile(join(tmp, '.agents', 'skills', 'ryo-session', 'SKILL.md'), '---\nname: ryo-session\n---\n\n# ryo-session\n\nClassify first.\n');
  });
  after(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('emits Claude Code hookSpecificOutput with governance context', async () => {
    const { stdout } = await run(process.execPath, [HOOK, '--format', 'claude', '--root', tmp]);
    const payload = JSON.parse(stdout);
    const ctx = payload.hookSpecificOutput.additionalContext;
    assert.equal(payload.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.match(ctx, /RYO_KIT_GOVERNANCE/);
    assert.match(ctx, /Never commit secrets/);
    assert.match(ctx, /Phases: plan → implement/);
    assert.match(ctx, /1 phase\(s\) incomplete/);
    assert.match(ctx, /Ruling: used X/);
    assert.match(ctx, /Classify first/);
    assert.match(ctx, /- new-feature/);
  });

  it('emits Cursor additional_context', async () => {
    const { stdout } = await run(process.execPath, [HOOK, '--format', 'cursor', '--root', tmp]);
    const payload = JSON.parse(stdout);
    assert.ok(payload.additional_context.includes('RYO_KIT_GOVERNANCE'));
    assert.equal(payload.hookSpecificOutput, undefined);
  });

  it('emits nothing for a project without ryo-kit files', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'ryo-hook-empty-'));
    try {
      const { stdout } = await run(process.execPath, [HOOK, '--format', 'claude', '--root', empty]);
      assert.equal(stdout, '');
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe('runtime hook installation', () => {
  let tmp;
  before(async () => { tmp = await mkdtemp(join(tmpdir(), 'ryo-hook-install-')); });
  after(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('copies the hook script and registers it with Claude Code and Cursor, idempotently', async () => {
    await mkdir(join(tmp, '.claude'), { recursive: true });
    await writeFile(join(tmp, '.claude', 'settings.json'), JSON.stringify({
      permissions: { allow: ['Bash(npm test)'] },
      hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'echo other' }] }] },
    }));

    const runtimes = [new ClaudeCodeRuntime(tmp), new CursorRuntime(tmp), new CodexRuntime(tmp)];
    await installHooksForRuntimes(tmp, runtimes);
    await installHooksForRuntimes(tmp, runtimes); // second run must not duplicate

    assert.ok(await exists(join(tmp, '.ryo', 'hooks', 'session-start.js')));

    const settings = JSON.parse(await readFile(join(tmp, '.claude', 'settings.json'), 'utf8'));
    assert.deepEqual(settings.permissions, { allow: ['Bash(npm test)'] }, 'existing settings preserved');
    const entries = settings.hooks.SessionStart;
    assert.equal(entries.length, 2, 'one foreign entry + one ryo entry');
    assert.equal(entries[0].hooks[0].command, 'echo other');
    assert.match(entries[1].hooks[0].command, /\.ryo\/hooks\/session-start\.js" --format claude$/);
    assert.equal(entries[1].matcher, 'startup|clear|compact');

    const cursor = JSON.parse(await readFile(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
    assert.equal(cursor.version, 1);
    assert.equal(cursor.hooks.sessionStart.length, 1);
    assert.match(cursor.hooks.sessionStart[0].command, /--format cursor$/);
    assert.equal(cursor.hooks.beforeShellExecution.length, 1);
    assert.match(cursor.hooks.beforeShellExecution[0].command, /guard\.js" --format cursor$/);

    // PreToolUse guard registered with the project-dir placeholder
    assert.equal(settings.hooks.PreToolUse.length, 1);
    assert.equal(settings.hooks.PreToolUse[0].matcher, 'Bash|Edit|Write|MultiEdit|NotebookEdit');
    assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /^node "\$\{CLAUDE_PROJECT_DIR\}\/\.ryo\/hooks\/guard\.js" --format claude$/);
    assert.match(entries[1].hooks[0].command, /^node "\$\{CLAUDE_PROJECT_DIR\}\//);

    // Guard script and compiled policy are in place
    assert.ok(await exists(join(tmp, '.ryo', 'hooks', 'guard.js')));
    const policy = JSON.parse(await readFile(join(tmp, '.ryo', 'hooks', 'policy.json'), 'utf8'));
    assert.deepEqual(policy.protected_branches, []);
    assert.equal(policy.source, null, 'no constitution in this fixture');
  });

  it('compiles the constitution into the guard policy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ryo-hook-policy-'));
    try {
      await mkdir(join(dir, '.ryo'), { recursive: true });
      await writeFile(join(dir, '.ryo', 'constitution.md'), '---\nprotected_branches: [main, "release/*"]\nforbidden_paths: ["infra/prod/**"]\nstop_conditions: [x]\n---\n# C\n');
      const policy = await installHooksForRuntimes(dir, [], { home: dir });
      assert.deepEqual(policy.protected_branches, ['main', 'release/*']);
      assert.deepEqual(policy.forbidden_paths, ['infra/prod/**']);
      assert.equal(policy.source, '.ryo/constitution.md', 'project-relative, so the file is portable across machines');
      assert.match(policy.source_hash, /^[0-9a-f]{64}$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uninstall removes only the ryo-kit hook entries', async () => {
    await new ClaudeCodeRuntime(tmp).uninstallHooks();
    await new CursorRuntime(tmp).uninstallHooks();
    const settings = JSON.parse(await readFile(join(tmp, '.claude', 'settings.json'), 'utf8'));
    assert.equal(settings.hooks.SessionStart.length, 1);
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, 'echo other');
    assert.equal(settings.hooks.PreToolUse, undefined);
    const cursor = JSON.parse(await readFile(join(tmp, '.cursor', 'hooks.json'), 'utf8'));
    assert.equal(cursor.hooks.sessionStart, undefined);
  });

  it('refuses to clobber a settings file that is not valid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ryo-hook-bad-'));
    try {
      await mkdir(join(dir, '.claude'), { recursive: true });
      await writeFile(join(dir, '.claude', 'settings.json'), '{ not json');
      await assert.rejects(() => new ClaudeCodeRuntime(dir).installHooks({ sessionStart: '.ryo/hooks/session-start.js', guard: '.ryo/hooks/guard.js' }));
      assert.equal(await readFile(join(dir, '.claude', 'settings.json'), 'utf8'), '{ not json');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

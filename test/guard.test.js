import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { checkCommand, checkFileEdit } from '../templates/hooks/guard.js';
import { matchesGlob } from '../src/utils/glob.js';
import { checkFramework } from '../src/cli/commands/check.js';
import { installHooksForRuntimes } from '../src/scaffolder/hook-writer.js';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const GUARD = join(__dirname, '..', 'templates', 'hooks', 'guard.js');

const policy = {
  protected_branches: ['main', 'release/*'],
  forbidden_paths: ['infra/prod/**', 'secrets/**'],
};

describe('guard rules (unit)', () => {
  let repo;
  before(async () => {
    repo = await mkdtemp(join(tmpdir(), 'ryo-guard-repo-'));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  });
  after(async () => { await rm(repo, { recursive: true, force: true }); });

  const onBranch = (name) => execFileSync('git', ['checkout', '-q', '-B', name], { cwd: repo });

  it('denies pushes that target a protected branch, allows feature branches', () => {
    onBranch('feature/x');
    assert.equal(checkCommand('git push origin feature/x', policy, repo), null);
    assert.match(checkCommand('git push origin main', policy, repo), /protected branch "main"/);
    assert.match(checkCommand('git push origin HEAD:main', policy, repo), /protected branch "main"/);
    assert.match(checkCommand('git push -f origin feature/x:refs/heads/release/1.2', policy, repo), /protected branch "release\/1.2"/);
    assert.equal(checkCommand('npm test && git push', policy, repo), null, 'bare push from a feature branch is allowed');
  });

  it('denies a bare push or a merge while on a protected branch, but allows local commits', () => {
    onBranch('main');
    assert.match(checkCommand('git push', policy, repo), /protected branch "main"/);
    assert.match(checkCommand('git merge feature/x', policy, repo), /"git merge" into protected branch/);
    assert.equal(checkCommand('git add -A && git commit -m "x"', policy, repo), null, 'local commits are not integration');
    onBranch('feature/y');
    assert.equal(checkCommand('git merge main', policy, repo), null, 'merging main into a feature branch is fine');
  });

  it('denies deleting a protected branch and merging PRs via forge CLIs', () => {
    onBranch('feature/z');
    assert.match(checkCommand('git branch -D main', policy, repo), /Deleting protected branch/);
    assert.match(checkCommand('git push origin --delete release/2', policy, repo), /Deleting protected branch/);
    assert.match(checkCommand('gh pr merge 12 --squash', policy, repo), /human action/);
    assert.equal(checkCommand('gh pr view 12', policy, repo), null);
  });

  it('denies shell writes to forbidden paths but allows reads', () => {
    assert.match(checkCommand('echo x > infra/prod/main.tf', policy, repo), /forbidden path "infra\/prod\/main.tf"/);
    assert.match(checkCommand('sed -i s/a/b/ ./secrets/key.pem', policy, repo), /forbidden path/);
    assert.equal(checkCommand('cat infra/prod/main.tf', policy, repo), null);
    assert.equal(checkCommand('rm -rf node_modules', policy, repo), null);
  });

  it('denies edits to forbidden paths (absolute or relative) and allows others', () => {
    assert.match(checkFileEdit(join(repo, 'infra', 'prod', 'a.tf'), policy, repo), /forbidden path/);
    assert.match(checkFileEdit('secrets/x', policy, repo), /forbidden path/);
    assert.equal(checkFileEdit('src/app.js', policy, repo), null);
    assert.equal(checkFileEdit('/elsewhere/infra/prod/a.tf', policy, repo), null, 'paths outside the project are not ours to judge');
  });

  it('allows everything when the policy has no rules', () => {
    onBranch('main');
    assert.equal(checkCommand('git push origin main', {}, repo), null);
    assert.equal(checkFileEdit('secrets/x', {}, repo), null);
  });

  it('glob semantics match src/utils/glob.js', () => {
    // Same sample set the shared matcher is tested with; the guard must agree.
    const pairs = [['src/auth/login.js', 'src/**/*.js'], ['release/1.2', 'release/*'], ['auth', 'auth/**'], ['db\\migrations\\1.sql', 'db/migrations/**']];
    for (const [path, glob] of pairs) {
      const viaGuard = checkFileEdit(path, { forbidden_paths: [glob] }, { cwd: '/p', projectDir: '/p' }) !== null;
      assert.equal(viaGuard, matchesGlob(path, glob), `${path} vs ${glob}`);
    }
  });
});

describe('guard hook (process)', () => {
  let project;
  before(async () => {
    project = await mkdtemp(join(tmpdir(), 'ryo-guard-proc-'));
    execFileSync('git', ['init', '-q', '-b', 'feature/a'], { cwd: project });
    await mkdir(join(project, '.ryo', 'hooks'), { recursive: true });
    await writeFile(join(project, '.ryo', 'hooks', 'policy.json'), JSON.stringify(policy));
  });
  after(async () => { await rm(project, { recursive: true, force: true }); });

  async function invoke(format, input) {
    const child = run(process.execPath, [GUARD, '--format', format, '--root', project], { cwd: project });
    child.child.stdin.end(JSON.stringify(input));
    const { stdout } = await child;
    return stdout.trim() === '' ? null : JSON.parse(stdout);
  }

  it('Claude Code: denies with permissionDecision and stays silent when allowing', async () => {
    const denied = await invoke('claude', { tool_name: 'Bash', tool_input: { command: 'git push origin main' }, cwd: project });
    assert.equal(denied.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(denied.hookSpecificOutput.permissionDecisionReason, /protected branch/);
    assert.equal(await invoke('claude', { tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: project }), null);
    const edit = await invoke('claude', { tool_name: 'Write', tool_input: { file_path: join(project, 'secrets', 'k') }, cwd: project });
    assert.equal(edit.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(await invoke('claude', { tool_name: 'Edit', tool_input: { file_path: 'src/a.js' }, cwd: project }), null);
  });

  it('Cursor: returns permission allow/deny', async () => {
    const denied = await invoke('cursor', { command: 'git push origin release/3', cwd: project });
    assert.equal(denied.permission, 'deny');
    assert.match(denied.agentMessage, /protected branch/);
    assert.deepEqual(await invoke('cursor', { command: 'ls', cwd: project }), { permission: 'allow' });
  });

  it('allows when there is no policy file or malformed input', async () => {
    const bare = await mkdtemp(join(tmpdir(), 'ryo-guard-none-'));
    try {
      const child = run(process.execPath, [GUARD, '--format', 'claude', '--root', bare]);
      child.child.stdin.end('not json');
      assert.equal((await child).stdout.trim(), '');
    } finally { await rm(bare, { recursive: true, force: true }); }
  });
});

describe('policy staleness in ryo check', () => {
  it('reports a stale policy after the constitution changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ryo-policy-stale-'));
    try {
      await mkdir(join(dir, '.ryo'), { recursive: true });
      await writeFile(join(dir, '.ryo', 'constitution.md'), '---\nprotected_branches: [main]\n---\n# C\n');
      await installHooksForRuntimes(dir, [], { home: dir });
      assert.deepEqual((await checkFramework(join(dir, '.ryo'))).filter(e => e.file.includes('policy')), []);
      await writeFile(join(dir, '.ryo', 'constitution.md'), '---\nprotected_branches: [main, trunk]\n---\n# C\n');
      const errors = await checkFramework(join(dir, '.ryo'));
      assert.ok(errors.some(e => e.file.includes('policy.json') && /stale/.test(e.message)));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

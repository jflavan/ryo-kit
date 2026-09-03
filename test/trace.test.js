import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { traceBranch, detectBase } from '../src/governance/trace.js';
import { traceAction } from '../src/cli/commands/trace.js';

function git(args, cwd) { return execFileSync('git', args, { cwd, env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).toString().trim(); }

describe('ryo trace', () => {
  let repo, shas;
  before(async () => {
    repo = await mkdtemp(join(tmpdir(), 'ryo-trace-'));
    git(['init', '-q', '-b', 'main'], repo);
    await writeFile(join(repo, 'a.txt'), 'a');
    git(['add', '-A'], repo); git(['commit', '-q', '-m', 'base'], repo);
    git(['checkout', '-q', '-b', 'feature/x'], repo);
    shas = [];
    for (const n of ['one', 'two', 'three']) {
      await writeFile(join(repo, `${n}.txt`), n);
      git(['add', '-A'], repo); git(['commit', '-q', '-m', `feat: ${n}`], repo);
      shas.push(git(['rev-parse', 'HEAD'], repo));
    }
  });
  after(async () => { await rm(repo, { recursive: true, force: true }); });

  it('detects the base from protected branches, then main', () => {
    assert.equal(detectBase({ cwd: repo, protectedBranches: ['release/*', 'nope'] }), 'main');
    assert.equal(detectBase({ cwd: repo, base: 'feature/x' }), 'feature/x');
  });

  it('maps commits to steps, reports uncovered commits and missing evidence', () => {
    const baseSha = git(['rev-parse', 'main'], repo);
    const ledger = [
      '# Ledger — workflow: new-feature — started 2026-03-15 — scope: feature',
      `Step 1: complete (commits ${baseSha.slice(0, 7)}..${shas[0].slice(0, 7)}, gate design passed — evidence: approval in chat)`,
      `Step 2: complete (commits ${shas[0].slice(0, 7)}..${shas[1].slice(0, 7)}, gate testing passed)`,
      'Ruling: kept helper — simpler — cost: dup if wrong',
      'Step 3: complete (gate review passed — evidence: review-report)',
    ].join('\n');
    const r = traceBranch({ cwd: repo, protectedBranches: ['main'], ledgers: [{ path: 'L', content: ledger }] });
    assert.equal(r.base, 'main');
    assert.equal(r.commits.length, 3);
    assert.equal(r.commits[0].step.step, 1);
    assert.equal(r.commits[1].step.step, 2);
    assert.deepEqual(r.uncovered.map(c => c.sha), [shas[2]]);
    assert.ok(r.issues.some(i => /step 2 passed gate "testing" without recorded evidence/.test(i)));
    assert.ok(r.issues.some(i => /step 3 complete but names no commits/.test(i)));
    assert.equal(r.rulings.length, 1);
  });

  it('flags commit ranges that do not exist in the repository', () => {
    const ledger = '# Ledger — workflow: w\nStep 1: complete (commits deadbee..deadbef, gate g passed — evidence: e)\n';
    const r = traceBranch({ cwd: repo, ledgers: [{ path: 'L', content: ledger }] });
    assert.ok(r.issues.some(i => /not found in this repository/.test(i)));
    assert.equal(r.uncovered.length, 3);
  });

  it('traceAction reads the live ledger and retained audit ledgers', async () => {
    await mkdir(join(repo, '.ryo', '.state', 'audit'), { recursive: true });
    await mkdir(join(repo, '.ryo', 'hooks'), { recursive: true });
    await writeFile(join(repo, '.ryo', 'hooks', 'policy.json'), JSON.stringify({ protected_branches: ['main'] }));
    const baseSha = git(['rev-parse', 'main'], repo);
    await writeFile(join(repo, '.ryo', '.state', 'audit', '2026-03-15-new-feature.md'),
      `# Ledger — workflow: new-feature\nStep 1: complete (commits ${baseSha.slice(0, 7)}..${shas[1].slice(0, 7)}, gate g passed — evidence: e)\n`);
    await writeFile(join(repo, '.ryo', '.state', 'ledger.md'),
      `# Ledger — workflow: bug-fix\nStep 1: complete (commit ${shas[2].slice(0, 7)}, gate g passed — evidence: e)\n`);
    const r = await traceAction({ projectDir: repo });
    assert.equal(r.base, 'main');
    assert.equal(r.uncovered.length, 0);
    assert.equal(r.commits[2].step.workflow, 'bug-fix');
    assert.deepEqual(r.issues, []);
  });

  it('reports cleanly outside a git repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ryo-trace-nogit-'));
    try {
      const r = traceBranch({ cwd: dir, ledgers: [] });
      assert.ok(r.issues[0].includes('not a git repository'));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

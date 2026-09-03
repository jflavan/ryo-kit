import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { matchesGlob } from '../src/utils/glob.js';
import { classifyScope, maxScope } from '../src/governance/scope.js';
import { parseConstitution, loadConstitution } from '../src/governance/constitution.js';
import { classifyAction } from '../src/cli/commands/classify.js';

describe('glob matching', () => {
  it('matches ** across segments and * within a segment', () => {
    assert.ok(matchesGlob('src/auth/login.js', 'src/**/*.js'));
    assert.ok(matchesGlob('src/login.js', 'src/**/*.js'));
    assert.ok(matchesGlob('auth/token.ts', 'auth/**'));
    assert.ok(matchesGlob('auth', 'auth/**') === false);
    assert.ok(matchesGlob('release/1.2', 'release/*'));
    assert.ok(!matchesGlob('release/1/2', 'release/*'));
    assert.ok(!matchesGlob('docs/readme.md', 'src/**'));
  });

  it('normalises leading ./ and backslashes', () => {
    assert.ok(matchesGlob('./db/migrations/001.sql', 'db/migrations/**'));
    assert.ok(matchesGlob('db\\migrations\\001.sql', 'db/migrations/**'));
  });

  it('escapes regex metacharacters in literal parts', () => {
    assert.ok(matchesGlob('package.json', 'package.json'));
    assert.ok(!matchesGlob('packagexjson', 'package.json'));
  });
});

describe('scope classification', () => {
  const constitution = {
    scope_overrides: [
      { paths: ['auth/**', 'db/migrations/**'], minimum_scope: 'feature', reason: 'design review' },
      { paths: ['payments/**'], minimum_scope: 'epic' },
    ],
    forbidden_paths: ['infra/prod/**'],
    stop_conditions: ['any migration that drops a column'],
  };

  it('returns the proposed scope when no override matches', () => {
    const r = classifyScope({ paths: ['README.md'], proposed: 'small-change', constitution });
    assert.equal(r.scope, 'small-change');
    assert.equal(r.upgraded, false);
    assert.deepEqual(r.reasons, []);
  });

  it('ratchets up to the override minimum and reports why', () => {
    const r = classifyScope({ paths: ['auth/login.js'], proposed: 'bug-fix', constitution });
    assert.equal(r.scope, 'feature');
    assert.equal(r.upgraded, true);
    assert.equal(r.reasons[0].path, 'auth/login.js');
    assert.equal(r.reasons[0].reason, 'design review');
  });

  it('never downgrades a larger proposed scope', () => {
    const r = classifyScope({ paths: ['auth/login.js'], proposed: 'epic', constitution });
    assert.equal(r.scope, 'epic');
    assert.equal(r.upgraded, false);
  });

  it('takes the largest matching override across paths', () => {
    const r = classifyScope({ paths: ['auth/a.js', 'payments/b.js'], proposed: 'small-change', constitution });
    assert.equal(r.scope, 'epic');
  });

  it('reports forbidden paths and passes stop conditions through', () => {
    const r = classifyScope({ paths: ['infra/prod/main.tf'], proposed: 'bug-fix', constitution });
    assert.deepEqual(r.forbidden, ['infra/prod/main.tf']);
    assert.deepEqual(r.stop_conditions, ['any migration that drops a column']);
  });

  it('defaults to small-change with no proposal and no constitution', () => {
    const r = classifyScope({ paths: ['x.js'] });
    assert.equal(r.scope, 'small-change');
    assert.equal(r.proposed, null);
  });

  it('maxScope ignores labels outside the size order', () => {
    assert.equal(maxScope('hotfix', 'feature'), 'feature');
    assert.equal(maxScope('feature', 'bug-fix'), 'feature');
  });
});

describe('constitution parsing', () => {
  it('accepts a prose-only constitution', () => {
    const { rules, principles, issues } = parseConstitution('# Constitution\n\n- Be good\n');
    assert.deepEqual(rules, {});
    assert.match(principles, /Be good/);
    assert.deepEqual(issues, []);
  });

  it('parses valid frontmatter rules', () => {
    const doc = ['---', 'version: 1', 'protected_branches: [main]', 'scope_overrides:',
      '  - paths: ["auth/**"]', '    minimum_scope: feature', 'audit:', '  retain_ledgers: true', '---', '', '# C', ''].join('\n');
    const { rules, issues } = parseConstitution(doc);
    assert.deepEqual(issues, []);
    assert.deepEqual(rules.protected_branches, ['main']);
    assert.equal(rules.scope_overrides[0].minimum_scope, 'feature');
    assert.equal(rules.audit.retain_ledgers, true);
  });

  it('reports invalid minimum_scope values', () => {
    const doc = ['---', 'scope_overrides:', '  - paths: ["auth/**"]', '    minimum_scope: gigantic', '---', '# C'].join('\n');
    const { rules, issues } = parseConstitution(doc);
    assert.deepEqual(rules, {});
    assert.ok(issues.some(i => i.includes('scope_overrides.0.minimum_scope')));
  });
});

describe('classifyAction (end to end)', () => {
  let tmp;
  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'ryo-classify-'));
    await mkdir(join(tmp, 'project', '.ryo'), { recursive: true });
    await mkdir(join(tmp, 'home'), { recursive: true });
    await writeFile(join(tmp, 'project', '.ryo', 'constitution.md'), [
      '---', 'scope_overrides:', '  - paths: ["db/migrations/**"]', '    minimum_scope: feature',
      'forbidden_paths: ["secrets/**"]', '---', '# C', '',
    ].join('\n'));
  });
  after(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('loads the repo-local constitution and classifies', async () => {
    const r = await classifyAction({ projectDir: join(tmp, 'project'), paths: ['db/migrations/2.sql'], proposed: 'bug-fix', home: join(tmp, 'home') });
    assert.equal(r.scope, 'feature');
    assert.ok(r.constitution.endsWith(join('.ryo', 'constitution.md')));
    assert.deepEqual(r.constitution_issues, []);
  });

  it('reports no constitution when neither location has one', async () => {
    const r = await classifyAction({ projectDir: join(tmp, 'home'), paths: ['a.js'], proposed: 'feature', home: join(tmp, 'home') });
    assert.equal(r.constitution, null);
    assert.equal(r.scope, 'feature');
  });

  it('loadConstitution falls back to the org-wide location', async () => {
    await mkdir(join(tmp, 'home', '.ryo'), { recursive: true });
    await writeFile(join(tmp, 'home', '.ryo', 'constitution.md'), '---\nprotected_branches: [trunk]\n---\n# Org\n');
    const c = await loadConstitution(join(tmp, 'home'), join(tmp, 'home'));
    assert.deepEqual(c.rules.protected_branches, ['trunk']);
  });
});

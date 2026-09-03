import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkFramework, gateErrors } from '../src/cli/commands/check.js';
import { GateSchema, SignalSchema, parseSignalLine } from '../src/context/schema.js';

const agent = (name, handoff = [], gate = '') => `---
name: ${name}
role: r
description: d
responsibilities: [x]
inputs: [a]
outputs: [b]
handoff_to: [${handoff.join(', ')}]
${gate}---
# ${name}
`;

const skill = (name) => `---
name: ${name}
description: d
trigger: t
inputs: [a]
outputs: [b]
runtimes: [claude-code]
---
# ${name}
`;

const processDoc = `---
name: dev
phases:
  - name: implementation
    description: d
    agents: [builder]
    artifacts: [code]
    gate:
      type: automated
      criteria: [tests pass]
  - name: review
    description: d
    agents: [reviewer]
    artifacts: [review-report]
    gate:
      type: hybrid
      criteria: [approved]
      separation_of_duties: true
      evidence: [review-report]
  - name: compliance-review
    description: d
    agents: [reviewer]
    artifacts: [checklist]
    gate:
      type: human
      criteria: [checklist complete]
      skippable_for: []
scale_rules:
  - scope: hotfix
    skip_phases: [compliance-review]
    required_phases: [implementation]
  - scope: bug-fix
    skip_phases: [nonexistent-phase]
    required_phases: [implementation, review]
---
# Process
`;

const workflow = `---
name: new-feature
description: d
trigger: new-feature
steps:
  - phase: implementation
    agent: builder
    skills: [implement]
    inputs: [plan]
    outputs: [code]
  - phase: review
    agent: reviewer
    skills: [review]
    inputs: [code]
    outputs: [review-report]
    gate:
      type: hybrid
      criteria: [approved]
      separation_of_duties: true
      approvers:
        count: 1
        agents: [reviewer]
  - phase: not-a-phase
    agent: builder
    skills: [missing-skill]
    inputs: [x]
    outputs: [y]
---
# Workflow
`;

describe('checkFramework governance rules', () => {
  let tmp, ryoDir;
  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'ryo-check-gov-'));
    ryoDir = join(tmp, '.ryo');
    await mkdir(join(ryoDir, 'agents'), { recursive: true });
    await mkdir(join(ryoDir, 'workflows'), { recursive: true });
    await mkdir(join(ryoDir, '.state'), { recursive: true });
    await mkdir(join(tmp, '.agents', 'skills', 'implement'), { recursive: true });
    await mkdir(join(tmp, '.agents', 'skills', 'review'), { recursive: true });
    await writeFile(join(ryoDir, 'agents', 'builder.agent.md'), agent('builder', ['reviewer']));
    await writeFile(join(ryoDir, 'agents', 'reviewer.agent.md'), agent('reviewer', ['ghost']));
    await writeFile(join(tmp, '.agents', 'skills', 'implement', 'SKILL.md'), skill('implement'));
    await writeFile(join(tmp, '.agents', 'skills', 'review', 'SKILL.md'), skill('review'));
    await mkdir(join(tmp, '.agents', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(tmp, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), '---\nname: ryo-gen\ndescription: d\ntrigger: /ryo-gen\n---\n# meta\n');
    await writeFile(join(ryoDir, 'process.md'), processDoc);
    await writeFile(join(ryoDir, 'workflows', 'new-feature.workflow.md'), workflow);
    await writeFile(join(ryoDir, 'constitution.md'), '---\nscope_overrides:\n  - paths: [a]\n    minimum_scope: huge\n---\n# C\n');
    await writeFile(join(ryoDir, '.state', 'signals.md'), [
      '# Signals', '',
      '- **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%',
      '- **2026-03-15 14:31** | ruling | step-3 | used helper | cost: dup',
      '- **2026-03-15 14:32** | not-a-type | x | y',
      '',
    ].join('\n'));
  });
  after(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('reads skills from .agents/skills/ and flags unknown skills', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(errors.some(e => e.message.includes('unknown skill: "missing-skill"')), JSON.stringify(errors, null, 1));
    assert.ok(!errors.some(e => e.message.includes('unknown skill: "implement"')));
  });

  it('flags workflow steps that reference unknown process phases', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(errors.some(e => e.file.includes('new-feature') && e.message.includes('unknown process phase: "not-a-phase"')));
  });

  it('flags dangling handoff_to targets', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(errors.some(e => e.file.includes('reviewer.agent.md') && e.message.includes('"ghost"')));
  });

  it('flags scale rules that skip a phase whose gate forbids it', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(errors.some(e => e.file === 'process.md' && e.message.includes('skips phase "compliance-review"') && e.message.includes('(none)')));
    assert.ok(errors.some(e => e.file === 'process.md' && e.message.includes('unknown phase: "nonexistent-phase"')));
  });

  it('flags a performer listed as its own approver under separation of duties', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(errors.some(e => e.file.includes('new-feature') && e.message.includes('performer "reviewer" is also listed as an approver')));
  });

  it('validates constitution frontmatter', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(errors.some(e => e.file === 'constitution.md' && e.message.includes('minimum_scope')));
  });

  it('validates signal entries and reports the line number', async () => {
    const errors = await checkFramework(ryoDir);
    const sig = errors.filter(e => e.file.endsWith('signals.md'));
    assert.equal(sig.length, 1);
    assert.match(sig[0].message, /line 5/);
  });

  it('does not report the valid parts of the framework', async () => {
    const errors = await checkFramework(ryoDir);
    assert.ok(!errors.some(e => e.file.includes('ryo-gen')), 'ryo-* meta-skills are not validated as framework skills');
    assert.ok(!errors.some(e => e.message.includes('"builder"')));
    assert.ok(!errors.some(e => e.message.includes('phase "review"')));
  });
});

describe('org-wide constitution validation', () => {
  it('validates ~/.ryo/constitution.md when the repo has none', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'ryo-check-orgwide-'));
    try {
      await mkdir(join(tmp, 'project', '.ryo'), { recursive: true });
      await mkdir(join(tmp, 'home', '.ryo'), { recursive: true });
      await writeFile(join(tmp, 'home', '.ryo', 'constitution.md'), '---\nprotected_branches: main\n---\n# C\n');
      const errors = await checkFramework(join(tmp, 'project', '.ryo'), { home: join(tmp, 'home') });
      assert.ok(errors.some(e => e.file.endsWith(join('.ryo', 'constitution.md')) && /protected_branches/.test(e.message)), JSON.stringify(errors));
    } finally { await rm(tmp, { recursive: true, force: true }); }
  });
});

describe('gateErrors', () => {
  it('rejects automated gates that claim separation of duties or approver roles', () => {
    const errs = gateErrors({ type: 'automated', criteria: [], separation_of_duties: true, approvers: { count: 1, roles: ['security'] } }, 'f', 'builder', 'g');
    assert.equal(errs.length, 2);
  });
  it('accepts a well-formed human gate', () => {
    const errs = gateErrors({ type: 'human', criteria: ['ok'], separation_of_duties: true, approvers: { count: 2, roles: ['security'], agents: ['reviewer'] } }, 'f', 'builder', 'g');
    assert.deepEqual(errs, []);
  });
});

describe('GateSchema and signals', () => {
  it('keeps the original two-field gate valid and defaults approver count', () => {
    assert.ok(GateSchema.safeParse({ type: 'human', criteria: ['x'] }).success);
    const r = GateSchema.parse({ type: 'human', criteria: ['x'], approvers: { roles: ['qa'] } });
    assert.equal(r.approvers.count, 1);
  });
  it('rejects unknown gate types and zero approvers', () => {
    assert.equal(GateSchema.safeParse({ type: 'magic', criteria: [] }).success, false);
    assert.equal(GateSchema.safeParse({ type: 'human', criteria: [], approvers: { count: 0 } }).success, false);
  });
  it('parses signal lines with and without context and accepts the new types', () => {
    const a = parseSignalLine('- **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%, all green');
    assert.deepEqual(a, { timestamp: '2026-03-15 14:30', type: 'gate-outcome', subject: 'testing-gate', outcome: 'passed', context: 'coverage 87%, all green' });
    const b = parseSignalLine('- **t** | scope-classification | new-feature | feature');
    assert.equal(b.context, undefined);
    assert.ok(SignalSchema.safeParse(b).success);
    assert.ok(SignalSchema.safeParse({ ...b, type: 'evidence' }).success);
    assert.equal(parseSignalLine('## Signals'), null);
  });
});

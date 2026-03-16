import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { checkFramework } from '../src/cli/commands/check.js';

/**
 * Build a minimal valid agent frontmatter block.
 */
function agentFrontmatter(overrides = {}) {
  const base = {
    name: 'builder',
    role: 'implementation',
    description: 'Implements features.',
    responsibilities: ['write code'],
    inputs: ['spec.md'],
    outputs: ['implementation'],
    handoff_to: ['verifier'],
    ...overrides,
  };
  const lines = ['---'];
  for (const [k, v] of Object.entries(base)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('# Agent body');
  return lines.join('\n');
}

/**
 * Build a minimal valid skill frontmatter block.
 */
function skillFrontmatter(overrides = {}) {
  const base = {
    name: 'plan',
    description: 'Plans a feature.',
    trigger: 'When a spec is ready.',
    inputs: ['requirements'],
    outputs: ['spec.md'],
    runtimes: ['claude-code'],
    ...overrides,
  };
  const lines = ['---'];
  for (const [k, v] of Object.entries(base)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('# Skill body');
  return lines.join('\n');
}

/**
 * Build a minimal valid workflow frontmatter block.
 */
function workflowFrontmatter(overrides = {}) {
  const base = {
    name: 'feature-workflow',
    description: 'Standard feature delivery workflow.',
    trigger: 'new-feature',
  };
  const steps = overrides.steps ?? [
    { phase: 'planning', agent: 'builder', skills: ['plan'], inputs: ['requirements'], outputs: ['spec.md'] },
  ];
  delete overrides.steps;
  const merged = { ...base, ...overrides };

  const lines = ['---'];
  for (const [k, v] of Object.entries(merged)) {
    lines.push(`${k}: ${v}`);
  }
  lines.push('steps:');
  for (const step of steps) {
    lines.push(`  - phase: ${step.phase}`);
    lines.push(`    agent: ${step.agent}`);
    lines.push(`    skills:`);
    for (const s of step.skills) lines.push(`      - ${s}`);
    lines.push(`    inputs:`);
    for (const i of step.inputs) lines.push(`      - ${i}`);
    lines.push(`    outputs:`);
    for (const o of step.outputs) lines.push(`      - ${o}`);
  }
  lines.push('---');
  lines.push('');
  lines.push('# Workflow body');
  return lines.join('\n');
}

describe('checkFramework', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ryo-check-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns 0 errors for a valid framework', async () => {
    const ryoDir = join(tmpDir, 'valid');
    await mkdir(join(ryoDir, 'agents'), { recursive: true });
    await mkdir(join(ryoDir, 'skills', 'plan'), { recursive: true });
    await mkdir(join(ryoDir, 'workflows'), { recursive: true });

    await writeFile(
      join(ryoDir, 'agents', 'builder.agent.md'),
      agentFrontmatter({ name: 'builder' }),
      'utf8',
    );

    await writeFile(
      join(ryoDir, 'skills', 'plan', 'SKILL.md'),
      skillFrontmatter({ name: 'plan' }),
      'utf8',
    );

    await writeFile(
      join(ryoDir, 'workflows', 'feature.workflow.md'),
      workflowFrontmatter({
        steps: [
          { phase: 'planning', agent: 'builder', skills: ['plan'], inputs: ['req'], outputs: ['spec'] },
        ],
      }),
      'utf8',
    );

    const errors = await checkFramework(ryoDir);
    assert.equal(errors.length, 0, `Expected 0 errors but got: ${JSON.stringify(errors)}`);
  });

  it('reports errors for an invalid agent schema', async () => {
    const ryoDir = join(tmpDir, 'invalid-agent');
    await mkdir(join(ryoDir, 'agents'), { recursive: true });

    // Missing required fields: role, description, responsibilities, inputs, outputs, handoff_to
    await writeFile(
      join(ryoDir, 'agents', 'bad-agent.agent.md'),
      '---\nname: bad-agent\n---\n\n# Bad Agent\n',
      'utf8',
    );

    const errors = await checkFramework(ryoDir);
    assert.ok(errors.length > 0, 'Expected errors for invalid agent');
    assert.ok(
      errors.some(e => e.file.includes('bad-agent.agent.md')),
      'Error should reference the bad agent file',
    );
  });

  it('reports errors for invalid skill schema', async () => {
    const ryoDir = join(tmpDir, 'invalid-skill');
    await mkdir(join(ryoDir, 'skills', 'bad-skill'), { recursive: true });

    // Missing required fields
    await writeFile(
      join(ryoDir, 'skills', 'bad-skill', 'SKILL.md'),
      '---\nname: bad-skill\n---\n\n# Bad Skill\n',
      'utf8',
    );

    const errors = await checkFramework(ryoDir);
    assert.ok(errors.length > 0, 'Expected errors for invalid skill');
    assert.ok(
      errors.some(e => e.file.includes('SKILL.md')),
      'Error should reference the SKILL.md file',
    );
  });

  it('reports errors for invalid workflow schema', async () => {
    const ryoDir = join(tmpDir, 'invalid-workflow');
    await mkdir(join(ryoDir, 'workflows'), { recursive: true });

    // Missing required fields
    await writeFile(
      join(ryoDir, 'workflows', 'bad.workflow.md'),
      '---\nname: bad-workflow\n---\n\n# Bad Workflow\n',
      'utf8',
    );

    const errors = await checkFramework(ryoDir);
    assert.ok(errors.length > 0, 'Expected errors for invalid workflow');
    assert.ok(
      errors.some(e => e.file.includes('bad.workflow.md')),
      'Error should reference the bad workflow file',
    );
  });

  it('reports cross-reference errors when workflow references unknown agent', async () => {
    const ryoDir = join(tmpDir, 'xref-agent');
    await mkdir(join(ryoDir, 'agents'), { recursive: true });
    await mkdir(join(ryoDir, 'skills', 'plan'), { recursive: true });
    await mkdir(join(ryoDir, 'workflows'), { recursive: true });

    // Create a known agent
    await writeFile(
      join(ryoDir, 'agents', 'builder.agent.md'),
      agentFrontmatter({ name: 'builder' }),
      'utf8',
    );

    // Create a known skill
    await writeFile(
      join(ryoDir, 'skills', 'plan', 'SKILL.md'),
      skillFrontmatter({ name: 'plan' }),
      'utf8',
    );

    // Workflow references unknown agent "unknown-agent"
    await writeFile(
      join(ryoDir, 'workflows', 'feature.workflow.md'),
      workflowFrontmatter({
        steps: [
          { phase: 'planning', agent: 'unknown-agent', skills: ['plan'], inputs: ['req'], outputs: ['spec'] },
        ],
      }),
      'utf8',
    );

    const errors = await checkFramework(ryoDir);
    assert.ok(errors.length > 0, 'Expected cross-reference errors');
    assert.ok(
      errors.some(e => e.message.includes('unknown-agent')),
      'Error should mention the unknown agent name',
    );
  });

  it('reports cross-reference errors when workflow references unknown skill', async () => {
    const ryoDir = join(tmpDir, 'xref-skill');
    await mkdir(join(ryoDir, 'agents'), { recursive: true });
    await mkdir(join(ryoDir, 'skills', 'plan'), { recursive: true });
    await mkdir(join(ryoDir, 'workflows'), { recursive: true });

    // Create a known agent
    await writeFile(
      join(ryoDir, 'agents', 'builder.agent.md'),
      agentFrontmatter({ name: 'builder' }),
      'utf8',
    );

    // Create a known skill
    await writeFile(
      join(ryoDir, 'skills', 'plan', 'SKILL.md'),
      skillFrontmatter({ name: 'plan' }),
      'utf8',
    );

    // Workflow references unknown skill "unknown-skill"
    await writeFile(
      join(ryoDir, 'workflows', 'feature.workflow.md'),
      workflowFrontmatter({
        steps: [
          { phase: 'planning', agent: 'builder', skills: ['unknown-skill'], inputs: ['req'], outputs: ['spec'] },
        ],
      }),
      'utf8',
    );

    const errors = await checkFramework(ryoDir);
    assert.ok(errors.length > 0, 'Expected cross-reference errors');
    assert.ok(
      errors.some(e => e.message.includes('unknown-skill')),
      'Error should mention the unknown skill name',
    );
  });

  it('handles empty .ryo/ directory gracefully (no errors)', async () => {
    const ryoDir = join(tmpDir, 'empty');
    await mkdir(ryoDir, { recursive: true });

    const errors = await checkFramework(ryoDir);
    assert.equal(errors.length, 0, 'Empty .ryo/ should produce no errors');
  });

  it('handles non-existent .ryo/ directory gracefully (no errors)', async () => {
    const ryoDir = join(tmpDir, 'does-not-exist');
    const errors = await checkFramework(ryoDir);
    assert.equal(errors.length, 0, 'Non-existent .ryo/ should produce no errors');
  });
});

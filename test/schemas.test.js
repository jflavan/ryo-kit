import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrgContextSchema,
  AgentDefSchema,
  SkillDefSchema,
  ProcessDefSchema,
  WorkflowDefSchema,
  SignalSchema,
  parseFrontmatter,
} from '../src/context/schema.js';

describe('OrgContextSchema', () => {
  it('validates a minimal valid org context', () => {
    const valid = {
      methodology: 'scrum',
      stack: { languages: ['javascript'], frameworks: ['express'], cloud: 'aws' },
      team: { size: 'solo' },
      compliance: [],
      tools: { ai: ['claude-code'], scm: 'github' },
    };
    const result = OrgContextSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('rejects invalid methodology', () => {
    const invalid = {
      methodology: 'waterfall',
      stack: { languages: [], frameworks: [], cloud: 'aws' },
      team: { size: 'solo' },
      compliance: [],
      tools: { ai: ['claude-code'], scm: 'github' },
    };
    const result = OrgContextSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('accepts optional fields', () => {
    const withOptionals = {
      name: 'Acme Corp',
      methodology: 'kanban',
      stack: {
        languages: ['typescript', 'python'],
        frameworks: ['nextjs'],
        cloud: 'gcp',
        cicd: ['github-actions'],
      },
      team: { size: 'medium', roles: ['developers', 'qe'] },
      compliance: ['soc2', 'hipaa'],
      tools: { ai: ['claude-code', 'copilot'], scm: 'github', pm: 'linear' },
      conventions: { branching: 'trunk-based', testing: 'tdd', reviews: 'required' },
    };
    const result = OrgContextSchema.safeParse(withOptionals);
    assert.equal(result.success, true);
  });
});

describe('AgentDefSchema', () => {
  it('validates a minimal valid agent definition', () => {
    const valid = {
      name: 'builder',
      role: 'implementation',
      description: 'Implements features based on approved specs.',
      responsibilities: ['write code', 'write tests'],
      inputs: ['spec.md'],
      outputs: ['implementation'],
      handoff_to: ['verifier'],
    };
    const result = AgentDefSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('rejects missing required fields', () => {
    const invalid = {
      name: 'builder',
      // missing role, description, responsibilities, inputs, outputs, handoff_to
    };
    const result = AgentDefSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('accepts optional fields (tools, gate)', () => {
    const withOptionals = {
      name: 'reviewer',
      role: 'code review',
      description: 'Reviews pull requests for quality and correctness.',
      responsibilities: ['review PRs', 'approve or request changes'],
      inputs: ['pr-diff'],
      outputs: ['review-comments'],
      handoff_to: ['builder'],
      tools: ['code-search', 'linter'],
      gate: {
        type: 'human',
        criteria: ['all comments addressed', 'tests pass'],
      },
    };
    const result = AgentDefSchema.safeParse(withOptionals);
    assert.equal(result.success, true);
  });

  it('accepts optional persona field with all four properties', () => {
    const withPersona = {
      name: 'architect',
      role: 'solution architecture',
      description: 'Designs system architecture.',
      responsibilities: ['define boundaries'],
      inputs: ['requirements'],
      outputs: ['architecture-docs'],
      handoff_to: ['builder'],
      persona: {
        displayName: 'Winston',
        icon: '🏗️',
        communicationStyle: 'Calm, pragmatic.',
        identity: 'Senior architect with 20 years experience.',
      },
    };
    const result = AgentDefSchema.safeParse(withPersona);
    assert.equal(result.success, true);
    assert.equal(result.data.persona.displayName, 'Winston');
    assert.equal(result.data.persona.icon, '🏗️');
    assert.equal(result.data.persona.communicationStyle, 'Calm, pragmatic.');
    assert.equal(result.data.persona.identity, 'Senior architect with 20 years experience.');
  });

  it('still validates without persona (backward compat)', () => {
    const noPersona = {
      name: 'builder',
      role: 'implementation',
      description: 'Implements features.',
      responsibilities: ['write code'],
      inputs: ['spec.md'],
      outputs: ['implementation'],
      handoff_to: ['verifier'],
    };
    const result = AgentDefSchema.safeParse(noPersona);
    assert.equal(result.success, true);
    assert.equal(result.data.persona, undefined);
  });

  it('rejects partial persona (missing required fields)', () => {
    const partial = {
      name: 'builder',
      role: 'implementation',
      description: 'Implements features.',
      responsibilities: ['write code'],
      inputs: ['spec.md'],
      outputs: ['implementation'],
      handoff_to: ['verifier'],
      persona: {
        displayName: 'Bob',
      },
    };
    const result = AgentDefSchema.safeParse(partial);
    assert.equal(result.success, false);
  });

  it('rejects persona with empty object', () => {
    const emptyPersona = {
      name: 'builder',
      role: 'implementation',
      description: 'Implements features.',
      responsibilities: ['write code'],
      inputs: ['spec.md'],
      outputs: ['implementation'],
      handoff_to: ['verifier'],
      persona: {},
    };
    const result = AgentDefSchema.safeParse(emptyPersona);
    assert.equal(result.success, false);
  });
});

describe('SkillDefSchema', () => {
  it('validates a minimal valid skill definition', () => {
    const valid = {
      name: 'implement',
      description: 'Implements a feature from a spec.',
      trigger: 'When a spec is approved and assigned.',
      inputs: ['spec.md', 'architecture.md'],
      outputs: ['implementation files', 'tests'],
      runtimes: ['claude-code'],
    };
    const result = SkillDefSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('rejects invalid runtime value', () => {
    const invalid = {
      name: 'implement',
      description: 'Implements a feature.',
      trigger: 'When spec is ready.',
      inputs: ['spec.md'],
      outputs: ['code'],
      runtimes: ['unknown-runtime'],
    };
    const result = SkillDefSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('accepts optional agent field', () => {
    const withAgent = {
      name: 'review',
      description: 'Reviews code for quality.',
      trigger: 'When implementation is complete.',
      agent: 'reviewer',
      inputs: ['pr-diff'],
      outputs: ['review-comments'],
      runtimes: ['claude-code', 'copilot'],
    };
    const result = SkillDefSchema.safeParse(withAgent);
    assert.equal(result.success, true);
  });
});

describe('ProcessDefSchema', () => {
  it('validates a minimal valid process definition', () => {
    const valid = {
      name: 'feature-delivery',
      phases: [
        {
          name: 'planning',
          description: 'Define the scope and approach.',
          agents: ['architect'],
          artifacts: ['spec.md'],
          gate: {
            type: 'human',
            criteria: ['spec approved'],
          },
        },
      ],
    };
    const result = ProcessDefSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('rejects missing phases', () => {
    const invalid = {
      name: 'feature-delivery',
      // missing phases
    };
    const result = ProcessDefSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('accepts optional scale_rules', () => {
    const withScaleRules = {
      name: 'feature-delivery',
      phases: [
        {
          name: 'planning',
          description: 'Define the scope and approach.',
          agents: ['architect'],
          artifacts: ['spec.md'],
          gate: { type: 'automated', criteria: ['linter passes'] },
        },
      ],
      scale_rules: [
        {
          scope: 'bug-fix',
          skip_phases: ['planning'],
          required_phases: ['implementation', 'testing'],
        },
      ],
    };
    const result = ProcessDefSchema.safeParse(withScaleRules);
    assert.equal(result.success, true);
  });
});

describe('WorkflowDefSchema', () => {
  it('validates a minimal valid workflow definition', () => {
    const valid = {
      name: 'feature-workflow',
      description: 'Standard feature delivery workflow.',
      trigger: 'new-feature',
      steps: [
        {
          phase: 'planning',
          agent: 'architect',
          skills: ['plan'],
          inputs: ['requirements'],
          outputs: ['spec.md'],
        },
      ],
    };
    const result = WorkflowDefSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('rejects missing required fields', () => {
    const invalid = {
      name: 'feature-workflow',
      // missing description, trigger, steps
    };
    const result = WorkflowDefSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('accepts optional scale_rules and step gate', () => {
    const withOptionals = {
      name: 'bug-fix-workflow',
      description: 'Expedited bug fix workflow.',
      trigger: 'bug-fix',
      steps: [
        {
          phase: 'implementation',
          agent: 'builder',
          skills: ['implement', 'test'],
          inputs: ['bug-report'],
          outputs: ['fix', 'test-results'],
          gate: { type: 'automated', criteria: ['tests pass', 'no regressions'] },
        },
      ],
      scale_rules: [
        {
          scope: 'hotfix',
          skip_steps: ['documentation'],
          required_steps: ['implementation', 'deploy'],
        },
      ],
    };
    const result = WorkflowDefSchema.safeParse(withOptionals);
    assert.equal(result.success, true);
  });
});

describe('SignalSchema', () => {
  it('validates a minimal valid signal', () => {
    const valid = {
      timestamp: '2026-03-15T14:30:00Z',
      type: 'gate-outcome',
      subject: 'testing-gate',
      outcome: 'passed',
    };
    const result = SignalSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('rejects invalid signal type', () => {
    const invalid = {
      timestamp: '2026-03-15T14:30:00Z',
      type: 'unknown-type',
      subject: 'testing-gate',
      outcome: 'passed',
    };
    const result = SignalSchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('accepts optional context field', () => {
    const withContext = {
      timestamp: '2026-03-15T16:00:00Z',
      type: 'phase-skip',
      subject: 'pi-planning',
      outcome: 'skipped',
      context: 'scope: bug-fix, too small for PI planning',
    };
    const result = SignalSchema.safeParse(withContext);
    assert.equal(result.success, true);
  });
});

describe('parseFrontmatter', () => {
  it('parses valid frontmatter from content', () => {
    const content = `---\nname: test-skill\ndescription: A test skill\n---\n\n# Test Skill\n\nBody content here.`;
    const { data, content: body } = parseFrontmatter(content);
    assert.equal(data.name, 'test-skill');
    assert.equal(data.description, 'A test skill');
    assert.equal(body, '# Test Skill\n\nBody content here.');
  });

  it('returns empty data and original content when no frontmatter', () => {
    const content = `# Just a heading\n\nNo frontmatter here.`;
    const { data, content: body } = parseFrontmatter(content);
    assert.deepEqual(data, {});
    assert.equal(body, content);
  });
});

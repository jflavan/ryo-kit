import { z } from 'zod';
import YAML from 'yaml';

export const OrgContextSchema = z.object({
  name: z.string().optional(),

  methodology: z.enum([
    'scrum', 'safe', 'kanban', 'hybrid', 'none'
  ]),

  stack: z.object({
    languages: z.array(z.string()),        // e.g. ["csharp", "typescript"]
    frameworks: z.array(z.string()),       // e.g. ["dotnet", "angular"]
    cloud: z.enum(['azure', 'aws', 'gcp', 'multi', 'none']),
    cicd: z.array(z.string()).optional(),   // e.g. ["github-actions", "azure-devops"]
  }),

  team: z.object({
    size: z.enum(['solo', 'small', 'medium', 'large', 'enterprise']),
    roles: z.array(z.string()).optional(),  // e.g. ["developers", "architects", "qe", "pm"]
  }),

  compliance: z.array(z.string()),         // e.g. ["soc2", "hipaa", "internal"]

  tools: z.object({
    ai: z.array(z.enum([
      'claude-code', 'copilot', 'cursor', 'codex', 'windsurf', 'gemini-cli'
    ])),
    scm: z.enum(['github', 'gitlab', 'azure-devops', 'bitbucket']),
    pm: z.enum(['jira', 'linear', 'azure-boards', 'github-issues', 'none']).optional(),
  }),

  conventions: z.object({
    branching: z.string().optional(),      // e.g. "gitflow", "trunk-based"
    testing: z.string().optional(),        // e.g. "tdd", "bdd", "post-hoc"
    reviews: z.string().optional(),        // e.g. "required", "optional"
  }).optional(),
});

export const AgentDefSchema = z.object({
  name: z.string(),
  role: z.string(),
  description: z.string(),
  responsibilities: z.array(z.string()),
  inputs: z.array(z.string()),             // What artifacts this agent reads
  outputs: z.array(z.string()),            // What artifacts this agent produces
  handoff_to: z.array(z.string()),         // Which agents receive outputs
  tools: z.array(z.string()).optional(),   // Allowed tool categories
  gate: z.object({                         // Validation gate before handoff
    type: z.enum(['human', 'automated', 'hybrid']),
    criteria: z.array(z.string()),
  }).optional(),
});

export const SkillDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.string(),                     // When/how this skill is invoked
  agent: z.string().optional(),            // Which agent typically uses this (optional — skills can be agent-independent)
  inputs: z.array(z.string()),             // What context/artifacts the skill reads
  outputs: z.array(z.string()),            // What the skill produces
  runtimes: z.array(z.enum([
    'claude-code', 'copilot', 'cursor', 'codex', 'windsurf', 'gemini-cli'
  ])),                                      // Which runtimes this skill targets
});

export const ProcessDefSchema = z.object({
  name: z.string(),
  phases: z.array(z.object({
    name: z.string(),
    description: z.string(),
    agents: z.array(z.string()),           // Agent names involved
    artifacts: z.array(z.string()),        // Artifacts produced
    gate: z.object({
      type: z.enum(['human', 'automated', 'hybrid']),
      criteria: z.array(z.string()),
    }),
  })),
  scale_rules: z.array(z.object({         // When to skip/add phases
    scope: z.string(),                     // e.g. "bug-fix", "feature", "epic"
    skip_phases: z.array(z.string()).optional(),
    required_phases: z.array(z.string()),
  })).optional(),
});

export const WorkflowDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.string(),                     // e.g. "new-feature", "bug-fix", "hotfix"
  steps: z.array(z.object({
    phase: z.string(),                     // Process phase this step belongs to
    agent: z.string(),                     // Agent performing this step
    skills: z.array(z.string()),           // Skills used in this step
    inputs: z.array(z.string()),           // Artifacts consumed
    outputs: z.array(z.string()),          // Artifacts produced
    gate: z.object({
      type: z.enum(['human', 'automated', 'hybrid']),
      criteria: z.array(z.string()),
    }).optional(),
  })),
  scale_rules: z.array(z.object({         // When to shorten/expand this workflow per scope
    scope: z.string(),                     // e.g. "bug-fix", "feature", "epic"
    skip_steps: z.array(z.string()).optional(),
    required_steps: z.array(z.string()),
  })).optional(),
});

export const SignalSchema = z.object({
  timestamp: z.string(),
  type: z.enum(['gate-outcome', 'phase-skip', 'agent-skip', 'skill-skip', 'manual-override']),
  subject: z.string(),                     // What was affected (agent name, phase name, etc.)
  outcome: z.string(),                     // What happened
  context: z.string().optional(),          // Why, if known
});

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { data: {}, content };
  const data = YAML.parse(match[1]);
  const body = content.slice(match[0].length).trim();
  return { data, content: body };
}

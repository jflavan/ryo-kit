import { z } from 'zod';
import YAML from 'yaml';

export const RUNTIMES = [
  'claude-code', 'copilot', 'cursor', 'codex', 'windsurf', 'gemini-cli',
];

/**
 * Ordered scope labels, smallest to largest. Scope classification never
 * moves left along this list once a workflow has started (the ratchet rule).
 * `hotfix` is a separate, orthogonal label — an emergency path, not a size.
 */
export const SCOPE_ORDER = ['small-change', 'bug-fix', 'feature', 'epic'];
export const SCOPE_LABELS = [...SCOPE_ORDER, 'hotfix'];

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
    ai: z.array(z.enum(RUNTIMES)),
    scm: z.enum(['github', 'gitlab', 'azure-devops', 'bitbucket']),
    pm: z.enum(['jira', 'linear', 'azure-boards', 'github-issues', 'none']).optional(),
  }),

  conventions: z.object({
    branching: z.string().optional(),      // e.g. "gitflow", "trunk-based"
    testing: z.string().optional(),        // e.g. "tdd", "bdd", "post-hoc"
    reviews: z.string().optional(),        // e.g. "required", "optional"
  }).optional(),
});

/**
 * A gate is the governance unit shared by agents, process phases, and
 * workflow steps. `type` and `criteria` are the original fields; everything
 * else is optional so existing frameworks keep validating.
 */
export const GateSchema = z.object({
  type: z.enum(['human', 'automated', 'hybrid']),
  criteria: z.array(z.string()),
  approvers: z.object({
    count: z.number().int().min(1).default(1),
    roles: z.array(z.string()).optional(),   // team roles that may approve, e.g. ["security"]
    agents: z.array(z.string()).optional(),  // agents that may approve (must differ from the performer when separation_of_duties)
  }).optional(),
  evidence: z.array(z.string()).optional(),  // artifacts that must exist before the gate can pass, e.g. ["test-results", "review-report"]
  skippable_for: z.array(z.string()).optional(), // scope labels that may skip this gate; omitted = follows scale rules; [] = never skippable
  separation_of_duties: z.boolean().optional(),  // the approver may not be the agent that performed the work
  record_to: z.string().optional(),          // where the outcome is logged; defaults to .ryo/.state/signals.md
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
  gate: GateSchema.optional(),             // Validation gate before handoff
  persona: z.object({
    displayName: z.string(),
    icon: z.string(),
    communicationStyle: z.string(),
    identity: z.string(),
  }).optional(),
});

export const SkillDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.string(),                     // When/how this skill is invoked
  agent: z.string().optional(),            // Which agent typically uses this (optional — skills can be agent-independent)
  inputs: z.array(z.string()),             // What context/artifacts the skill reads
  outputs: z.array(z.string()),            // What the skill produces
  runtimes: z.array(z.enum(RUNTIMES)),     // Which runtimes this skill targets
});

export const ProcessDefSchema = z.object({
  name: z.string(),
  phases: z.array(z.object({
    name: z.string(),
    description: z.string(),
    agents: z.array(z.string()),           // Agent names involved
    artifacts: z.array(z.string()),        // Artifacts produced
    gate: GateSchema,
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
    gate: GateSchema.optional(),
  })),
  scale_rules: z.array(z.object({         // When to shorten/expand this workflow per scope
    scope: z.string(),                     // e.g. "bug-fix", "feature", "epic"
    skip_steps: z.array(z.string()).optional(),
    required_steps: z.array(z.string()),
  })).optional(),
});

export const SIGNAL_TYPES = [
  'gate-outcome', 'phase-skip', 'agent-skip', 'skill-skip', 'manual-override',
  'ruling',                 // a decision the executor made on the user's behalf (what — why — cost if wrong)
  'scope-classification',   // the scope assigned at workflow start, and any upgrade mid-flight
  'evidence',               // verification evidence captured before a completion claim
];

export const SignalSchema = z.object({
  timestamp: z.string(),
  type: z.enum(SIGNAL_TYPES),
  subject: z.string(),                     // What was affected (agent name, phase name, etc.)
  outcome: z.string(),                     // What happened
  context: z.string().optional(),          // Why, if known
});

/**
 * Structured, machine-checkable rules in the YAML frontmatter of
 * constitution.md. The prose body still carries principles that need
 * judgement; these fields carry the ones a hook or `ryo check` can enforce.
 * Every field is optional so a prose-only constitution remains valid.
 */
export const ConstitutionSchema = z.object({
  version: z.number().int().min(1).optional(),
  protected_branches: z.array(z.string()).optional(),   // globs, e.g. ["main", "release/*"]
  required_reviewers: z.object({
    default: z.number().int().min(0).optional(),
    paths: z.record(z.string(), z.object({             // glob → requirement
      count: z.number().int().min(1),
      roles: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
  forbidden_paths: z.array(z.string()).optional(),      // globs agents must never modify
  stop_conditions: z.array(z.string()).optional(),      // situations where the executor must stop and ask, beyond the defaults
  scope_overrides: z.array(z.object({                   // path-based minimum scope, applied by `ryo classify`
    paths: z.array(z.string()).min(1),
    minimum_scope: z.enum(SCOPE_ORDER),
    reason: z.string().optional(),
  })).optional(),
  evidence: z.object({                                  // org-wide evidence policy
    review: z.enum(['required', 'optional']).optional(),
    tests: z.enum(['required', 'optional']).optional(),
    additional: z.array(z.string()).optional(),         // e.g. ["sast-report", "threat-model"]
  }).optional(),
  audit: z.object({
    retain_ledgers: z.boolean().optional(),             // keep workflow ledgers instead of deleting them on completion
    retain_dir: z.string().optional(),                  // default .ryo/.state/audit
  }).optional(),
});

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { data: {}, content };
  const data = YAML.parse(match[1]) ?? {};
  const body = content.slice(match[0].length).trim();
  return { data, content: body };
}

/**
 * Parse one signals.md entry line of the form
 *   - **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%
 * Returns null for lines that are not signal entries (headers, blanks).
 */
export function parseSignalLine(line) {
  const match = line.match(/^-\s+\*\*(.+?)\*\*\s*\|\s*(.+)$/);
  if (!match) return null;
  const parts = match[2].split('|').map(s => s.trim());
  const [type, subject, outcome, ...rest] = parts;
  const entry = { timestamp: match[1].trim(), type, subject, outcome };
  if (rest.length > 0 && rest.join(' | ').length > 0) entry.context = rest.join(' | ');
  return entry;
}

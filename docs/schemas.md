# Schema Reference

All artifact types in ryo-kit have Zod schemas defined in `src/context/schema.js`. Generated files use YAML frontmatter matching these schemas, followed by markdown content.

The `ryo check` command validates all files against these schemas.

## OrgContextSchema

The org-context.yaml file that drives all generation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Organization or project name |
| `methodology` | enum | Yes | `scrum`, `safe`, `kanban`, `hybrid`, or `none` |
| `stack.languages` | string[] | Yes | Programming languages (e.g., `["typescript", "python"]`) |
| `stack.frameworks` | string[] | Yes | Frameworks (e.g., `["nextjs", "fastapi"]`) |
| `stack.cloud` | enum | Yes | `azure`, `aws`, `gcp`, `multi`, or `none` |
| `stack.cicd` | string[] | No | CI/CD tools (e.g., `["github-actions"]`) |
| `team.size` | enum | Yes | `solo`, `small`, `medium`, `large`, or `enterprise` |
| `team.roles` | string[] | No | Team roles (e.g., `["developers", "qe", "pm"]`) |
| `compliance` | string[] | Yes | Compliance standards (e.g., `["soc2", "hipaa"]`). Empty array for none. |
| `tools.ai` | enum[] | Yes | `claude-code`, `copilot`, `cursor`, `codex`, `windsurf`, `gemini-cli` |
| `tools.scm` | enum | Yes | `github`, `gitlab`, `azure-devops`, or `bitbucket` |
| `tools.pm` | enum | No | `jira`, `linear`, `azure-boards`, `github-issues`, or `none` |
| `conventions.branching` | string | No | Branching strategy (e.g., `"trunk-based"`) |
| `conventions.testing` | string | No | Testing approach (e.g., `"tdd"`) |
| `conventions.reviews` | string | No | Code review policy (e.g., `"required"`) |

## AgentDefSchema

Agent definitions in `.ryo/agents/*.agent.md` (YAML frontmatter).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Agent identifier |
| `role` | string | Yes | Agent role title |
| `description` | string | Yes | What this agent does |
| `responsibilities` | string[] | Yes | List of responsibilities |
| `inputs` | string[] | Yes | Artifacts this agent reads |
| `outputs` | string[] | Yes | Artifacts this agent produces |
| `handoff_to` | string[] | Yes | Agents that receive this agent's outputs |
| `tools` | string[] | No | Allowed tool categories |
| `gate` | Gate | No | Validation gate before handoff (see GateSchema) |
| `persona.displayName` | string | No | Human-friendly name for conference mode |
| `persona.icon` | string | No | Emoji identifier for the agent |
| `persona.communicationStyle` | string | No | How the agent communicates (tone, vocabulary) |
| `persona.identity` | string | No | Grounding statement for the agent's perspective |

## SkillDefSchema

Skill definitions in `.agents/skills/*/SKILL.md` (YAML frontmatter).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill identifier |
| `description` | string | Yes | What this skill does |
| `trigger` | string | Yes | When/how to invoke (e.g., slash command) |
| `agent` | string | No | Which agent typically uses this. Omit for standalone skills. |
| `inputs` | string[] | Yes | Context/artifacts the skill reads |
| `outputs` | string[] | Yes | What the skill produces |
| `runtimes` | enum[] | Yes | Which runtimes this skill targets |

## ProcessDefSchema

Process definition in `.ryo/process.md` (YAML frontmatter).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Process name |
| `phases[].name` | string | Yes | Phase name |
| `phases[].description` | string | Yes | Phase description |
| `phases[].agents` | string[] | Yes | Agents involved in this phase |
| `phases[].artifacts` | string[] | Yes | Artifacts produced |
| `phases[].gate` | Gate | Yes | Exit gate (see GateSchema) |
| `scale_rules[].scope` | string | No | Scope trigger (e.g., `"bug-fix"`, `"feature"`) |
| `scale_rules[].skip_phases` | string[] | No | Phases to skip for this scope |
| `scale_rules[].required_phases` | string[] | No | Phases that cannot be skipped |

## WorkflowDefSchema

Workflow definitions in `.ryo/workflows/*.workflow.md` (YAML frontmatter).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Workflow name |
| `description` | string | Yes | Workflow description |
| `trigger` | string | Yes | Scenario trigger (e.g., `"new-feature"`, `"bug-fix"`) |
| `steps[].phase` | string | Yes | Process phase this step belongs to |
| `steps[].agent` | string | Yes | Agent performing this step |
| `steps[].skills` | string[] | Yes | Skills used in this step |
| `steps[].inputs` | string[] | Yes | Artifacts consumed |
| `steps[].outputs` | string[] | Yes | Artifacts produced |
| `steps[].gate` | Gate | No | Step gate (see GateSchema). May not weaken the process phase gate. |
| `scale_rules[].scope` | string | No | Scope trigger |
| `scale_rules[].skip_steps` | string[] | No | Steps to skip |
| `scale_rules[].required_steps` | string[] | No | Steps that cannot be skipped |

## GateSchema

The shared gate object used by agents, process phases, and workflow steps. Only `type` and `criteria` are required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | Yes | `human`, `automated`, or `hybrid` |
| `criteria` | string[] | Yes | What must be true to pass |
| `evidence` | string[] | No | Artifacts that must exist, freshly produced, before the gate passes (e.g. `test-results`, `review-report`) |
| `approvers.count` | int ≥ 1 | No | Number of approvals required (default 1) |
| `approvers.roles` | string[] | No | Team roles allowed to approve. Not valid on `automated` gates. |
| `approvers.agents` | string[] | No | Agents allowed to approve. Must not include the performer when `separation_of_duties` is set. |
| `skippable_for` | string[] | No | Scope labels that may skip this gate. `[]` means never skippable; omitted means scale rules decide. |
| `separation_of_duties` | boolean | No | The approver may not be the agent that performed the work. Not valid on `automated` gates. |
| `record_to` | string | No | Where outcomes are logged. Defaults to `.ryo/.state/signals.md`. |

## ConstitutionSchema

Optional YAML frontmatter of `constitution.md`. The prose body is free-form. All fields optional.

| Field | Type | Description |
|-------|------|-------------|
| `version` | int | Schema version |
| `protected_branches` | string[] | Globs of branches agents never merge into or push to without a human |
| `required_reviewers.default` | int | Default approver count for review gates |
| `required_reviewers.paths` | map glob → `{count, roles?}` | Per-path approver requirements |
| `forbidden_paths` | string[] | Globs agents must never modify |
| `stop_conditions` | string[] | Situations where the executor stops and asks, beyond the built-in defaults |
| `scope_overrides[].paths` | string[] | Globs |
| `scope_overrides[].minimum_scope` | enum | `small-change`, `bug-fix`, `feature`, or `epic` |
| `scope_overrides[].reason` | string | Shown by `ryo classify` |
| `evidence.review` / `evidence.tests` | enum | `required` or `optional` |
| `evidence.additional` | string[] | Org-specific evidence artifacts |
| `audit.retain_ledgers` | boolean | Keep workflow ledgers after completion (default behaviour: true) |
| `audit.retain_dir` | string | Where to keep them (default `.ryo/.state/audit`) |

## SignalSchema

Usage tracking entries in `.ryo/.state/signals.md`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string | Yes | ISO timestamp |
| `type` | enum | Yes | `gate-outcome`, `phase-skip`, `agent-skip`, `skill-skip`, `manual-override`, `ruling`, `scope-classification`, or `evidence` |
| `subject` | string | Yes | What was affected (agent name, phase name, etc.) |
| `outcome` | string | Yes | What happened |
| `context` | string | No | Why, if known |

## Frontmatter Format

Generated files use YAML frontmatter delimited by `---`:

```markdown
---
name: builder
role: Builder
description: Implements code based on specifications
responsibilities:
  - Write implementation code
  - Follow coding standards
inputs:
  - specification
outputs:
  - implementation
handoff_to:
  - reviewer
---

# Builder Agent

[Markdown content describing the agent's behavior...]
```

The `parseFrontmatter(content)` utility in `src/context/schema.js` extracts the YAML data and markdown body from this format.

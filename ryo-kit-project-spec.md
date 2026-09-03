# ryo-kit — Roll Your Own AI-Driven Development Framework

> **Status note (2026-09):** this is the original design spec, kept for history. Several layout details are superseded: skills live in `.agents/skills/` (not `.ryo/skills/`), Copilot uses `.github/agents/` rather than prompt files, Windsurf uses `.windsurf/rules/`, and 0.3.0 added the governance layer (structured constitution, `ryo classify`, gate governance, ledger, session hook). The `docs/` directory is authoritative; see especially `docs/architecture.md` and `docs/governance.md`.

## Project Overview

ryo-kit is a FOSS meta-framework that generates custom, organization-specific/project-specific AI-driven development frameworks. Unlike BMAD, Spec-Kit, or GSD which ship with fixed agent roles and prescribed workflows, ryo-kit ingests organizational context and generates the agents, skills, processes, and workflows that fit the actual org, team, and project.

The core innovation: a deterministic CLI that scaffolds files and collects context, paired with a multi-phase skill chain that runs through the user's existing AI coding tool (Claude Code, GitHub Copilot, Cursor, Codex, etc.) to generate the full framework. No API keys required. No LLM dependencies in the CLI. The intelligence lives in the prompt engineering of the installed skills.

**License:** MIT
**Package name:** `ryo-kit`
**npm bin commands:** `ryo` and `ryo-kit` (both aliases to the same entry point)
**Repository:** https://github.com/jflavan/ryo-kit

---

## Architecture

### Two-Phase Design

**Phase 1 — CLI (deterministic, zero LLM dependencies)**
- Collects org context via interactive TUI prompts (`@clack/prompts`)
- Auto-detects existing project artifacts (CLAUDE.md, .cursorrules, package.json, etc.)
- Writes structured org context file and constitution template
- Installs bootstrapping skills/commands for all selected AI runtimes simultaneously
- Sets up the `.ryo/` directory structure with persistence layer

**Phase 2 — Multi-phase skill chain (runs in user's AI tool)**
- User opens their AI tool and invokes `/ryo-gen`
- The orchestrator skill reads org context, resumes from any prior session state, and asks clarifying questions conversationally
- Delegates to focused sub-skills for agent generation, skill generation, process generation, and workflow generation
- Each sub-skill writes output immediately (not buffered), enabling cross-session resume
- All intelligence lives in the prompt engineering, not in the CLI

### Why This Approach
- No API key configuration needed
- Works with any subscription the user already has (Claude Pro/Max, Copilot, Cursor, etc.)
- Follows the same pattern proven by BMAD (npx install + slash commands), GSD (npx install + slash commands), and Spec-Kit (CLI + slash commands)
- The CLI stays small, fast, and testable; the LLM does what LLMs are good at
- Multi-phase skill chain keeps each prompt focused (better LLM output) and enables sub-skill reuse across `/ryo-gen`, `/ryo-evolve`, and `/ryo-retro`

---

## CLI Commands

```
npx ryo-kit init                 # Org-level setup: TUI interview, write org context, install bootstrap skills
npx ryo-kit gen                  # Project-level: scaffold .ryo/ for this repo, install project skills
npx ryo-kit evolve               # Re-generate framework from updated org context
npx ryo-kit add agent            # Add a single new agent definition
npx ryo-kit add skill            # Add a single new skill
npx ryo-kit check                # Validate framework files against schemas
npx ryo-kit update               # Pull latest skill templates from the package
```

All commands support a `-y` / `--yes` flag for non-interactive/CI usage.

### CLI Command Details

**`ryo init`** — Org-level setup
- Runs the `@clack/prompts` TUI interview (see TUI Interview Flow)
- Auto-detects existing project artifacts
- Writes `~/.ryo/org-context.yaml` and `~/.ryo/constitution.md`
- Installs bootstrap skills into all selected runtimes simultaneously
- Prints next-step instructions per runtime

**`ryo gen`** — Project-level scaffold
- Reads `~/.ryo/org-context.yaml` (or `.ryo/org-context.yaml` in repo-only mode)
- Creates `.ryo/` directory structure (see Directory Conventions for full structure)
- Writes an empty stub `current-plan.md` in `.ryo/.state/` (the AI skill populates it with real content)
- Installs project-level skills into selected runtimes
- Tells user to invoke `/ryo-gen` in their AI tool

**`ryo evolve`** — Re-generate with updated context
- Re-reads org context, updates installed skill templates
- Installs updated `/ryo-evolve` skill
- Tells user to invoke `/ryo-evolve` in their AI tool (which does the actual regeneration with `.customize/` conflict handling)

**`ryo add agent` / `ryo add skill`** — Add a single definition
- Installs the relevant add skill (`/ryo-add-agent` or `/ryo-add-skill`)
- Tells user to invoke the slash command for the conversational creation flow

**`ryo check`** — Validate framework
- Purely deterministic — no AI needed
- Loads all `.ryo/` files, validates against Zod schemas
- Checks internal consistency (agents referenced in workflows exist, skills referenced by agents exist, workflow steps reference valid process phases and existing skills, etc.)
- Reports errors with file paths and line references

**`ryo update`** — Pull latest skill templates
- Compares installed skill versions against the package's templates
- Updates all package-provided templates: bootstrap skills (`templates/bootstrap/`), sub-skills (`templates/sub-skills/`), core skills (`templates/core-skills/`), and prompt fragments (`templates/fragments/`)
- Does not touch generated content in `.ryo/` — only the meta-skills and templates shipped with the package

## Slash Commands (installed into user's AI tool)

```
/ryo-gen                         # Generate agents, skills, & process definition from org context
/ryo-help                        # Context-aware "what do I do next" guidance
/ryo-add-agent                   # Create a new agent conversationally
/ryo-add-skill                   # Create a new skill conversationally
/ryo-evolve                      # Re-generate framework with updated context
/ryo-retro                       # Retrospective: analyze usage signals & propose improvements
```

---

## Package Structure

```
ryo-kit/
├── bin/
│   └── ryo.js                          # npx entry point (#!/usr/bin/env node)
├── src/
│   ├── cli/
│   │   ├── index.js                    # Commander.js program definition
│   │   ├── commands/
│   │   │   ├── init.js                 # Org-level setup
│   │   │   ├── gen.js                  # Project-level generation scaffold
│   │   │   ├── evolve.js               # Re-scaffold with updated context
│   │   │   ├── add.js                  # Subcommand: add agent | add skill
│   │   │   ├── check.js               # Schema validation
│   │   │   └── update.js              # Pull latest templates
│   │   └── prompts/
│   │       └── org-interview.js        # @clack/prompts TUI flows
│   │
│   ├── context/
│   │   ├── schema.js                   # Zod schemas (org-context, agent-def, skill-def, process-def, workflow-def, signal)
│   │   ├── detector.js                 # Auto-detect stack, tools, existing configs
│   │   └── writer.js                   # Writes org-context.yaml, constitution.md
│   │
│   ├── scaffolder/
│   │   ├── directory.js                # Creates .ryo/ directory structure
│   │   ├── skill-writer.js             # Writes SKILL.md files from templates
│   │   └── template-writer.js          # Writes agent/process templates
│   │
│   ├── runtimes/
│   │   ├── base.js                     # Shared runtime interface
│   │   ├── claude-code.js              # .claude/skills/, CLAUDE.md
│   │   ├── copilot.js                  # .github/prompts/, .github/copilot-instructions.md
│   │   ├── cursor.js                   # .cursor/rules/, .cursorrules
│   │   ├── codex.js                    # skills/*/SKILL.md, AGENTS.md
│   │   ├── windsurf.js                 # .windsurfrules
│   │   └── gemini-cli.js              # .gemini/skills/, GEMINI.md
│   │
│   └── utils/
│       ├── yaml.js                     # YAML read/write helpers
│       ├── fs.js                       # File system helpers
│       └── logger.js                   # @clack/prompts-based logging
│
├── templates/
│   ├── bootstrap/
│   │   └── ryo-gen.skill.md            # Orchestrator: loads context, clarifies, chains sub-skills
│   ├── sub-skills/
│   │   ├── agent-generation.skill.md   # Focused: generate agent definitions
│   │   ├── skill-generation.skill.md   # Focused: generate skill definitions
│   │   ├── process-generation.skill.md # Focused: generate process/phase definitions
│   │   └── workflow-generation.skill.md# Focused: generate workflow definitions
│   ├── core-skills/
│   │   ├── ryo-help.skill.md           # Context-aware guidance skill
│   │   ├── ryo-add-agent.skill.md      # Agent creation skill
│   │   ├── ryo-add-skill.skill.md      # Skill creation skill
│   │   ├── ryo-evolve.skill.md         # Framework evolution skill
│   │   └── ryo-retro.skill.md          # Retrospective & improvement proposals
│   ├── fragments/
│   │   ├── org-context-prompt.md       # Prompt fragment for loading/parsing org context (used by ryo-gen orchestrator and ryo-evolve)
│   │   ├── decision-tree.md            # Agent/skill/process selection heuristics (used by generation sub-skills)
│   │   └── validation.md              # Prompt fragment for validation steps (used by ryo-gen orchestrator and ryo-check)
│   └── defaults/
│       ├── constitution.md             # Default constitution template
│       ├── agent-base.yaml             # Base schema example for agents
│       └── process-base.yaml           # Base schema example for process defs
│
├── test/
│   ├── schemas.test.js                 # Zod schema validation tests
│   ├── detector.test.js                # Context detector tests
│   ├── writer.test.js                  # Context writer tests
│   ├── scaffolder.test.js              # Directory scaffolding tests
│   ├── runtimes.test.js                # Runtime transformer tests
│   ├── check.test.js                   # ryo check consistency tests
│   ├── integration/
│   │   ├── init.test.js                # ryo init end-to-end with mocked prompts
│   │   ├── gen.test.js                 # ryo gen with fixture org-context
│   │   └── update.test.js             # ryo update with version-diffed templates
│   └── fixtures/
│       ├── solo-dev/                   # Sample org context: solo developer
│       ├── small-scrum/                # Sample org context: small scrum team
│       └── enterprise-safe-hipaa/      # Sample org context: SAFe + HIPAA enterprise
│
├── package.json
├── LICENSE                             # MIT
├── README.md
├── CONTRIBUTING.md
└── .gitignore
```

---

## Directory Conventions

### Org-level (created by `ryo init`)

```
~/.ryo/
├── org-context.yaml              # Structured org profile from TUI interview
├── constitution.md               # Org-level non-negotiable principles (user-editable)
└── templates/                    # Cached copies of agent/process base schemas
    ├── agent-base.yaml
    └── process-base.yaml
```

### Project-level (created by `ryo gen`, then populated by `/ryo-gen`)

After `ryo gen` runs the CLI portion, it writes a minimal `.ryo/` scaffold.
After the user runs `/ryo-gen` in their AI tool, the skill populates it fully:

```
.ryo/
├── process.md                    # Generated: phases, gates, artifacts, handoffs
├── agents/
│   ├── [generated-name].agent.md # Generated: one per agent role
│   └── ...
├── skills/
│   ├── [generated-skill]/
│   │   └── SKILL.md              # Generated: one per skill (equal peer to agents)
│   └── ...
├── workflows/
│   ├── [generated-workflow].workflow.md
│   └── ...
├── .state/                       # Cross-session persistence (gitignored by default)
│   ├── current-plan.md           # Active plan with phase checklist (markdown checkboxes)
│   ├── decisions.md              # Clarification answers & user choices
│   ├── signals.md                # Usage tracking (appended entries)
│   ├── retro-[date].md           # Retrospective reports with proposed changes
│   └── history/
│       └── [date]-[operation].md # Completed plan archive
└── .customize/                   # User overrides, preserved on evolve
    └── README.md
```

### Persistence Layer (`.ryo/.state/`)

File-based persistence enables cross-session resume for multi-phase operations. All state files use markdown for natural readability by both humans and AI tools.

**`current-plan.md`** — When `/ryo-gen` or `/ryo-evolve` starts a multi-phase operation, it writes a plan with phases and their status. If a session dies mid-generation, the next invocation reads this file and resumes from the first incomplete phase.

**`decisions.md`** — Stores clarification answers from the conversational phase. If the user answered 5 of 7 questions before a session ended, the skill picks up at question 6.

**`signals.md`** — Append-only usage tracking for the self-improvement system. Skills write lightweight entries during normal operation (gate outcomes, skipped phases, manual overrides). `/ryo-retro` reads these when proposing improvements.

**`history/`** — Completed plans get archived here so `/ryo-retro` can analyze patterns over time.

Every skill reads `.state/` on startup: resume if in-flight, start fresh if not. Each sub-skill in the generator chain maps to a plan phase, making resume logic straightforward.

---

## package.json

```json
{
  "name": "ryo-kit",
  "version": "0.1.0",
  "description": "Roll Your Own AI-driven development framework. A meta-framework that generates custom agents, skills, and processes for your org.",
  "license": "MIT",
  "bin": {
    "ryo": "./bin/ryo.js",
    "ryo-kit": "./bin/ryo.js"
  },
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "files": [
    "bin/",
    "src/",
    "templates/",
    "LICENSE",
    "README.md"
  ],
  "keywords": [
    "ai",
    "agents",
    "skills",
    "sdlc",
    "spec-driven-development",
    "claude-code",
    "copilot",
    "cursor",
    "codex",
    "windsurf",
    "gemini-cli",
    "framework",
    "agentic",
    "development"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/jflavan/ryo-kit"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "@clack/prompts": "^0.10.0",
    "yaml": "^2.7.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {},
  "scripts": {
    "test": "node --test",
    "test:watch": "node --test --watch"
  }
}
```

---

## Schemas (Zod)

All schemas defined in `src/context/schema.js`. The org-context.yaml file captures everything the generator skill needs to produce a tailored framework.

```javascript
import { z } from 'zod';

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
```

---

## TUI Interview Flow (`ryo init`)

The init command walks through an interactive interview. Uses `@clack/prompts` for the TUI. The flow:

1. **Welcome message** — Explain what ryo-kit does in 2 sentences
2. **AI tools** — Multi-select: Which AI coding tools does your team use?
3. **Methodology** — Single select: Scrum, SAFe, Kanban, Hybrid, None
4. **Tech stack** — Multi-select for languages/frameworks, single select for cloud
5. **Team size** — Single select: Solo, Small (2-10), Medium (11-50), Large (50+), Enterprise (200+)
6. **Compliance** — Multi-select: SOC 2, HIPAA, PCI DSS, ISO 27001, FedRAMP, Internal, None
7. **Source control + PM** — Single selects for SCM and project management tools
8. **Conventions** — Branching strategy (gitflow, trunk-based, etc.), testing approach (TDD, BDD, post-hoc), code review policy (required, optional). All optional — gaps can be filled during `/ryo-gen` clarification phase.
9. **Install location** — This repo only or org-wide template:
   - **Repo-only mode:** Writes `org-context.yaml` and `constitution.md` directly into `.ryo/` in the current repo. No `~/.ryo/` directory created. `ryo gen` reads from `.ryo/` instead of `~/.ryo/`. Good for single-repo projects or trying ryo-kit out.
   - **Org-wide mode:** Writes to `~/.ryo/` (shared across repos). Each repo gets its own `.ryo/` project scaffold via `ryo gen`. Good for multi-repo orgs.
10. **Auto-detection** — Scan for existing CLAUDE.md, .cursorrules, package.json, etc. and report findings
11. **Write files** — Write org-context.yaml, constitution.md, install skills for all selected runtimes
12. **Next steps** — Print the `/ryo-gen` command for each selected AI tool

---

## Runtime Integration

Each runtime transformer in `src/runtimes/` implements a common interface:

```javascript
// src/runtimes/base.js
export class BaseRuntime {
  constructor(projectDir) { this.projectDir = projectDir; }

  // Where this runtime stores skills/commands
  get skillsDir() { throw new Error('Not implemented'); }

  // Install a skill from a template
  async installSkill(skillName, skillContent) { throw new Error('Not implemented'); }

  // Update the runtime's main config file (CLAUDE.md, .cursorrules, etc.)
  async updateConfig(contextRef) { throw new Error('Not implemented'); }

  // Remove installed skills
  async uninstall() { throw new Error('Not implemented'); }
}
```

Each runtime transformer also handles:
- Detecting if the runtime is already configured (don't clobber existing files)
- Appending vs overwriting (always append/merge, never replace existing config)
- Clean uninstall (remove only ryo-kit additions)

### Runtime Mapping

| Runtime | Skills Location | Config File | Slash Commands |
|---------|----------------|-------------|----------------|
| Claude Code | `.claude/skills/ryo-*/SKILL.md` | `CLAUDE.md` | Native via skill frontmatter |
| Copilot | `.github/prompts/ryo-*.prompt.md` | `.github/copilot-instructions.md` | Native via prompt files |
| Cursor | `.cursor/rules/ryo-*.md` | `.cursorrules` | No native slash commands — skills installed as rules |
| Codex | `skills/ryo-*/SKILL.md` | `AGENTS.md` | Native via skill files |
| Windsurf | `.windsurfrules` (appended sections) | Same file | No native slash commands — skills installed as rules |
| Gemini CLI | `.gemini/skills/ryo-*/SKILL.md` | `GEMINI.md` | Native via skill files |

4 of 6 runtimes get native slash commands. Cursor and Windsurf get skills installed as rules — the user invokes them by asking the AI to follow the relevant rule.

### Claude Code Runtime
- Skills go to `.claude/skills/ryo-*/SKILL.md` (project) or `~/.claude/skills/ryo-*/SKILL.md` (global)
- CLAUDE.md gets a reference block pointing to `.ryo/` context files
- Skills use the Agent Skills open standard with YAML frontmatter

### Copilot Runtime
- Slash commands go to `.github/prompts/ryo-*.prompt.md`
- Auto-loaded context goes to `.github/copilot-instructions.md`
- Optionally generates agent profiles in `.github/agents/` for Copilot's custom agents feature

### Cursor Runtime
- Rules go to `.cursor/rules/ryo-*.md`
- `.cursorrules` file gets context references

### Codex Runtime
- Skills go to `skills/ryo-*/SKILL.md`
- `AGENTS.md` gets context references

### Windsurf Runtime
- Rules appended to `.windsurfrules`

### Gemini CLI Runtime
- Skills go to `.gemini/skills/ryo-*/SKILL.md`
- `GEMINI.md` gets context references

---

## The Generator Skill Chain (`/ryo-gen`)

This is the product. The generator uses a multi-phase skill chain architecture: an orchestrator skill delegates to focused sub-skills, each writing output immediately for cross-session resilience.

### Flow

```
User invokes /ryo-gen
        │
        ▼
┌─────────────────────┐
│  ryo-gen.skill.md   │  Orchestrator
│  - Load .state/     │
│  - Read org-context  │
│  - Resume or start   │
└────────┬────────────┘
         │
    ┌────▼─────────────┐
    │  Clarification    │  Conversational phase
    │  - Fill gaps      │  (answers saved to decisions.md)
    │  - Project scope  │
    │  - Brownfield?    │
    └────┬─────────────┘
         │
    ┌────▼─────────────┐
    │  agent-generation │  Sub-skill 1
    │  - Decision tree  │
    │  - Org context    │
    │  → agents/*.md    │
    └────┬─────────────┘
         │
    ┌────▼─────────────┐
    │  skill-generation │  Sub-skill 2
    │  - Per agent      │
    │  - Per standalone  │
    │  → skills/*/SKILL │
    └────┬─────────────┘
         │
    ┌────▼──────────────────┐
    │  process-generation    │  Sub-skill 3
    │  - Phases/gates        │
    │  - Scale rules         │
    │  → process.md          │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │  workflow-generation    │  Sub-skill 4
    │  - Ties agents +       │
    │    skills + phases      │
    │  → workflows/*.md       │
    └────┬──────────────────┘
         │
    ┌────▼─────────────┐
    │  Validation       │  Back in orchestrator
    │  - Internal       │
    │    consistency     │
    │  - Install to     │
    │    runtime(s)      │
    └──────────────────┘
```

### Hybrid Decision Tree

The generator uses a hybrid approach: strong defaults via a decision tree, with conversational overrides during the clarification phase. The decision tree lives in `templates/fragments/decision-tree.md`.

Example heuristics (starting points, not hard-coded outputs):

| Org Profile | Likely Agents | Likely Skills |
|-------------|--------------|---------------|
| Solo dev, no compliance | builder, verifier | plan, implement, test, review |
| Small scrum team | architect, builder, reviewer, tester | plan, design, implement, test, review, deploy |
| SAFe + HIPAA | pi-planner, architect, builder, reviewer, compliance-auditor, security-reviewer, tester, release-manager | All above + audit, compliance-check, pi-plan, release |

### Key Behaviors
- For a solo dev, it might produce just 2 agents and a handful of skills
- For a SAFe org with compliance needs, it might produce 6-8 agents with corresponding skills, compliance gates, and audit trail artifacts
- Agent names, count, and responsibilities are NOT predetermined
- Skill names, count, and scope are NOT predetermined — skills are equal peers to agents
- The process phases adapt to methodology (SAFe ceremonies vs Scrum sprints vs Kanban flow)
- Compliance requirements inject review gates and audit trail artifacts

### Sub-Skill Reuse
Each sub-skill is independently useful beyond `/ryo-gen`:
- `/ryo-evolve` can re-run just `agent-generation` if a retro suggests adding a new role
- `/ryo-retro` can invoke `process-generation` to adjust gates based on signal data
- `/ryo-add-agent` and `/ryo-add-skill` use the same generation logic with narrower scope

---

## Self-Improvement System

Two mechanisms feed into the evolution cycle. Both keep a human in the loop.

### A. Retrospectives (`/ryo-retro`)

Invoked after a meaningful chunk of work completes (feature shipped, sprint ended, etc.). The skill:

1. Reads `.ryo/.state/signals.md` for tracked usage data
2. Reads `.ryo/.state/history/` for past generation plans
3. Reads current agent/skill/process definitions in `.ryo/`
4. Analyzes patterns:
   - Agents that are never referenced in workflows
   - Skills that get manually overridden frequently
   - Gates that always pass (too loose?) or always block (too strict?)
   - Phases that get skipped via scale rules every time
5. Produces a retro report in `.ryo/.state/retro-[date].md` with specific proposed changes
6. Asks the user which proposals to accept

Example retro report:

```markdown
## Proposed Changes

### Add: security-reviewer agent
**Why:** 3 of last 5 features had security issues caught late in review.
**Impact:** Adds a gate after implementation, before PR.

### Modify: testing phase gate
**Why:** Gate passed 100% of the time in last 10 runs. Criteria may be too loose.
**Proposed:** Add coverage threshold criterion.

### Remove: pi-planner agent
**Why:** Never invoked in any workflow over 30 days.
**Impact:** Simplifies process definition.
```

### B. Signal Collection

Lightweight, append-only. Skills write entries to `.ryo/.state/signals.md` during normal operation:

```markdown
## Signals

- **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%
- **2026-03-15 16:00** | phase-skip | pi-planning | skipped | scope: bug-fix
- **2026-03-16 09:00** | manual-override | architect-agent | skipped | "too small for architecture review"
```

Skills don't need special instrumentation — the generated workflow skills include signal-logging as part of their gate/handoff prompts. This is baked into `workflow-generation.skill.md` output.

### C. Evolution with `.customize/` Protection

When `/ryo-evolve` applies changes (from retro proposals or updated org context):

1. Reads `.ryo/.customize/` for user overrides
2. Diffs proposed changes against customizations
3. If conflict: warns the user with specifics (e.g., "This will change the testing-gate criteria, which you've customized in `.customize/testing-gate.md`")
4. Prompts: keep customization, accept proposed change, or merge manually
5. Proceeds only with user approval per conflict

---

## Design Principles

1. **The CLI is dumb, the skills are smart.** The CLI never calls an LLM. It scaffolds files and installs prompts. The prompts do the thinking.

2. **BYOT (Bring Your Own Tool).** Works with whatever AI subscription the user already pays for. No vendor lock-in.

3. **Generated, not prescribed.** The framework generates agents, skills, and processes to fit the org. It doesn't ship with "PM Agent" or "Architect Agent" — it produces whatever roles and capabilities make sense for the context.

4. **Agents and skills are equal peers.** Agents define *who* (roles, responsibilities, handoffs). Skills define *how* (the actual prompts/capabilities). Workflows define *when* (sequencing agents using skills through process phases). Neither is subordinate to the other.

5. **Org-level + project-level.** Org context is shared across repos. Project-level config adapts per repo.

6. **Customizations survive evolution.** The `.customize/` directory pattern (borrowed from BMAD) preserves user overrides when the framework is re-generated. Conflicts are surfaced to the user with explicit prompts.

7. **Self-improving.** The framework learns from usage through retrospectives and signal tracking. Improvements are proposed, not applied automatically.

8. **Cross-session resilient.** Multi-phase operations persist state to `.ryo/.state/` in markdown, enabling resume from any point across sessions and AI tools.

9. **Small npm footprint.** No LLM SDKs, no heavy dependencies. Just Commander, @clack/prompts, Zod, and YAML. Zero devDependencies.

---

## Testing Strategy

Uses Node.js built-in test runner (`node:test`, available since Node 20). Zero test dependencies.

### Test Types

**Schema validation tests** — Zod validation of all artifact types (org contexts, agent defs, skill defs, process defs, workflow defs, signals) with valid and invalid inputs.

**Structural consistency tests** — Cross-reference checks that validate `ryo check` itself: agents mentioned in workflows exist, skills referenced by agents exist, process phases reference valid agents, workflow steps reference valid process phases and existing skills, etc.

**Installation tests** — Each runtime transformer writes the right files to the right places, appends without clobbering, and uninstalls cleanly.

**Skill structural validation** — Frontmatter is valid YAML, required content sections present, no broken cross-references in templates.

**Integration tests** — End-to-end CLI command tests using `-y` flag for non-interactive execution with fixture org contexts at different scales.

### Test Fixtures

Three scale fixtures in `test/fixtures/`:
- `solo-dev/` — minimal org context, no compliance
- `small-scrum/` — small team, standard scrum, basic compliance
- `enterprise-safe-hipaa/` — large org, SAFe methodology, HIPAA + SOC 2

### What We Don't Test
- Generator skill output (LLM-dependent, not deterministic)
- Actual AI tool behavior when running skills

---

## Build Order

Recommended implementation sequence:

### Phase 1 — CLI Skeleton + All Runtimes
1. Set up the npm package with bin entry, Commander.js program
2. Wire up `ryo init` with the `@clack/prompts` TUI interview flow
3. Implement Zod schemas for all artifact types (org-context, agent-def, skill-def, process-def, workflow-def, signal)
4. Implement the context writer (org-context.yaml output)
5. Implement auto-detection (scan for existing project artifacts)
6. Implement all 6 runtime transformers (Claude Code, Copilot, Cursor, Codex, Windsurf, Gemini CLI)
7. Implement the skill writer (SKILL.md generation from templates)
8. Wire `ryo init` to install bootstrap skills into all selected runtimes

### Phase 2 — Generator Skill Chain
Note: These are markdown template files and can be written independently. End-to-end testing of the skill chain requires Phase 4's `ryo gen` scaffold to exist; use a manually created `.ryo/` directory for ad-hoc testing during this phase.

9. Write the `ryo-gen.skill.md` orchestrator prompt
10. Write the `agent-generation.skill.md` sub-skill
11. Write the `skill-generation.skill.md` sub-skill
12. Write the `process-generation.skill.md` sub-skill
13. Write the `workflow-generation.skill.md` sub-skill
14. Write the `decision-tree.md` fragment
15. Write the `validation.md` fragment

### Phase 3 — Core Skills
16. Write the `ryo-help.skill.md` guidance prompt
17. Write the `ryo-add-agent.skill.md` prompt
18. Write the `ryo-add-skill.skill.md` prompt
19. Write the `ryo-evolve.skill.md` prompt
20. Write the `ryo-retro.skill.md` retrospective prompt

### Phase 4 — Project-Level Commands + Persistence
21. Implement `ryo gen` (project-level scaffold with `.state/` initialization)
22. Implement `ryo evolve`
23. Implement `ryo add agent` and `ryo add skill`
24. Implement `ryo check` (schema validation + cross-reference consistency)
25. Implement `ryo update`

### Phase 5 — Testing + Polish
26. Schema validation tests
27. Structural consistency tests
28. Installation tests (all runtimes)
29. Integration tests with fixture org contexts
30. README with getting-started guide
31. CONTRIBUTING.md
32. CI/CD (GitHub Actions for npm publish)

---

## Competitive Positioning

| Feature | BMAD | Spec-Kit | GSD | ryo-kit |
|---------|------|----------|-----|---------|
| Agent roles | Fixed (12+) | None (tool-focused) | Fixed (5) | Generated per-org |
| Skills | Fixed per agent | None | Fixed prompts | Generated per-org (first-class) |
| Process | Fixed 4-phase | Fixed 4-phase | Fixed 4-phase | Generated per-org |
| Customization | Override via YAML | Edit templates | Edit prompts | Full regeneration + .customize/ |
| Multi-runtime | 15+ IDEs | 22+ agents | 3 runtimes | 6 major runtimes |
| Compliance support | Via expansion packs | Via constitution | None | Native generation |
| Scale adaptation | Level 0-4 complexity | None | Milestones | Per-project agent/skill selection |
| Self-improvement | None | None | None | Retros + signal tracking |
| Cross-session resume | None | None | None | .state/ persistence |
| LLM dependency in CLI | None | None | None | None |
| Package size target | 555 KB | Python-based | ~1 MB | < 500 KB |

---

## References

Key projects studied during design:
- **BMAD v6**: npmjs.com/package/bmad-method — Agent-as-code paradigm, .agent.yaml schema, customize.yaml overlay, Commander.js CLI, module system, @clack/prompts TUI
- **GitHub Spec-Kit**: github.com/github/spec-kit — Constitution concept, Specify → Plan → Tasks → Implement flow, Python CLI (we chose Node instead)
- **GSD v1/v2**: npmjs.com/package/get-shit-done-cc — Single-package multi-runtime install, context engineering focus, fresh-context-per-task pattern
- **McKinsey/QuantumBlack agentic SDLC pattern**: Deterministic orchestration + bounded agent execution + automated evaluation, specialized agents per task

# ryo-kit — Roll Your Own AI-Driven Development Framework

## Project Overview

ryo-kit is a FOSS meta-framework that generates custom, organization-specific/project-specific AI-driven development frameworks. Unlike BMAD, Spec-Kit, or GSD which ship with fixed agent roles and prescribed workflows, ryo-kit ingests organizational context and generates the agents, skills, processes, and workflows that fit the actual org, team, and project.

The core innovation: a deterministic CLI that scaffolds files and collects context, paired with a bootstrapping skill that runs through the user's existing AI coding tool (Claude Code, GitHub Copilot, Cursor, Codex, etc.) to generate the full framework. No API keys required. No LLM dependencies in the CLI. The intelligence lives in the prompt engineering of the installed skills.

**License:** MIT
**Package name:** `ryo-kit`
**npm bin commands:** `ryo` and `ryo-kit` (both aliases to the same entry point)

---

## Architecture

### Two-Phase Design

**Phase 1 — CLI (deterministic, zero LLM dependencies)**
- Collects org context via interactive TUI prompts
- Auto-detects existing project artifacts (CLAUDE.md, .cursorrules, package.json, etc.)
- Writes structured org context file and constitution template
- Installs bootstrapping skills/commands for the user's chosen AI runtime(s)
- Sets up the `.ryo/` directory structure

**Phase 2 — Bootstrapping skill (runs in user's AI tool)**
- User opens their AI tool and invokes `/ryo-gen`
- The skill reads org context, asks clarifying questions conversationally, and generates the full framework
- Produces custom agents, process definitions, skills, and workflows tailored to the org
- All intelligence lives in the prompt engineering, not in the CLI

### Why This Approach
- No API key configuration needed
- Works with any subscription the user already has (Claude Pro/Max, Copilot, Cursor, etc.)
- Follows the same pattern proven by BMAD (npx install + slash commands), GSD (npx install + slash commands), and Spec-Kit (CLI + slash commands)
- The CLI stays small, fast, and testable; the LLM does what LLMs are good at

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

## Slash Commands (installed into user's AI tool)

```
/ryo-gen                         # Generate agents & process definition from org context
/ryo-help                        # Context-aware "what do I do next" guidance
/ryo-add-agent                   # Create a new agent conversationally
/ryo-add-skill                   # Create a new skill
/ryo-evolve                      # Re-generate framework with updated context
```

---

## Package Structure

```
ryo-kit/
├── bin/
│   └── ryo.js                          # npx entry point
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
│   │       └── org-interview.js        # TUI prompt flows (inquirer)
│   │
│   ├── context/
│   │   ├── schema.js                   # Zod schemas (org-context, process-def, agent-def)
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
│   │   ├── claude-code.js              # .claude/skills/, CLAUDE.md, .claude/agents/
│   │   ├── cursor.js                   # .cursor/rules/
│   │   ├── copilot.js                  # .github/copilot-instructions.md
│   │   ├── codex.js                    # skills/*/SKILL.md
│   │   ├── windsurf.js                 # .windsurfrules
│   │   └── gemini-cli.js              # .gemini/
│   │
│   └── utils/
│       ├── yaml.js                     # YAML read/write helpers
│       ├── fs.js                       # File system helpers
│       └── logger.js                   # Chalk-based console output
│
├── templates/
│   ├── bootstrap/
│   │   └── ryo-gen.skill.md            # THE key skill: the framework generator
│   ├── core-skills/
│   │   ├── ryo-help.skill.md           # Context-aware guidance skill
│   │   ├── ryo-add-agent.skill.md      # Agent creation skill
│   │   ├── ryo-add-skill.skill.md      # Skill creation skill
│   │   └── ryo-evolve.skill.md         # Framework evolution skill
│   ├── fragments/
│   │   ├── org-context-prompt.md       # Prompt fragment for reading org context
│   │   ├── agent-generation.md         # Prompt fragment for generating agents
│   │   ├── process-generation.md       # Prompt fragment for generating process defs
│   │   └── validation.md              # Prompt fragment for validation steps
│   └── defaults/
│       ├── constitution.md             # Default constitution template
│       ├── agent-base.yaml             # Base schema example for agents
│       └── process-base.yaml           # Base schema example for process defs
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
├── process.yaml                  # Generated: phases, gates, artifacts, handoffs
├── agents/
│   ├── [generated-name].agent.md # Generated: one per agent role
│   └── ...
├── skills/
│   ├── [generated-skill]/
│   │   └── SKILL.md
│   └── ...
├── workflows/
│   ├── [generated-workflow].yaml
│   └── ...
└── .customize/                   # User overrides, preserved on evolve
    └── README.md
```

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
    "sdlc",
    "spec-driven-development",
    "claude-code",
    "copilot",
    "cursor",
    "codex",
    "framework",
    "agentic",
    "development"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourorg/ryo-kit"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "@inquirer/prompts": "^7.0.0",
    "yaml": "^2.7.0",
    "zod": "^3.24.0",
    "chalk": "^5.4.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## Org Context Schema (Zod)

The org-context.yaml file captures everything the generator skill needs to produce a tailored framework. This schema should be defined in `src/context/schema.js`:

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
```

---

## TUI Interview Flow (`ryo init`)

The init command walks through an interactive interview. Use `@inquirer/prompts` for the TUI. The flow should be:

1. **Welcome message** — Explain what ryo-kit does in 2 sentences
2. **AI tools** — Multi-select: Which AI coding tools does your team use?
3. **Methodology** — Single select: Scrum, SAFe, Kanban, Hybrid, None
4. **Tech stack** — Multi-select for languages/frameworks, single select for cloud
5. **Team size** — Single select: Solo, Small (2-10), Medium (11-50), Large (50+), Enterprise (200+)
6. **Compliance** — Multi-select: SOC 2, HIPAA, PCI DSS, ISO 27001, FedRAMP, Internal, None
7. **Source control + PM** — Single selects for SCM and project management tools
8. **Install location** — This repo only (.ryo/) or org-wide template (~/.ryo/ + per-repo)
9. **Auto-detection** — Scan for existing CLAUDE.md, .cursorrules, package.json, etc. and report findings
10. **Write files** — Write org-context.yaml, constitution.md, install skills for selected runtimes
11. **Next steps** — Print the `/ryo-gen` command for their AI tool

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

### Claude Code Runtime
- Skills go to `.claude/skills/ryo-*/SKILL.md` (project) or `~/.claude/skills/ryo-*/SKILL.md` (global)
- CLAUDE.md gets a reference block pointing to `.ryo/` context files
- Skills use the Agent Skills open standard with YAML frontmatter

### Copilot Runtime
- Instructions go to `.github/copilot-instructions.md`
- Slash commands map to the same SKILL.md format where supported

### Cursor Runtime
- Rules go to `.cursor/rules/`
- `.cursorrules` file gets context references

### Codex Runtime
- Skills go to `skills/ryo-*/SKILL.md`

### Windsurf Runtime
- Rules go to `.windsurfrules`

### Gemini CLI Runtime
- Config goes to `.gemini/`

---

## The Generator Skill (`/ryo-gen`)

This is the product. The `templates/bootstrap/ryo-gen.skill.md` file is a meticulously engineered prompt that:

1. Reads `~/.ryo/org-context.yaml` and `~/.ryo/constitution.md`
2. Asks clarifying questions conversationally to fill gaps
3. Based on the org profile, generates:
   - A process definition (what phases exist, what gates, what artifacts)
   - An agent team (what roles, what responsibilities, what handoffs)
   - Skills for each agent (the actual prompts that make agents work)
   - Workflows for common scenarios (new feature, bug fix, etc.)
4. Writes everything to `.ryo/` in the project
5. Installs the generated skills into the active runtime

Key behaviors of the generator:
- For a solo dev, it might produce just 2 agents (builder + verifier)
- For a SAFe org with compliance needs, it might produce 6-8 agents including PI planner and compliance reviewer
- Agent names, count, and responsibilities are NOT predetermined
- The process phases adapt to methodology (SAFe ceremonies vs Scrum sprints vs Kanban flow)
- Compliance requirements inject review gates and audit trail artifacts

The skill should be structured with clear sections:
- Context loading (read org-context.yaml, constitution.md, detect project state)
- Clarification dialogue (ask about project scope, brownfield vs greenfield, etc.)
- Agent generation (produce agent definitions based on full context)
- Process generation (produce phase/gate definitions)
- Skill generation (produce the actual SKILL.md files for each agent)
- Workflow generation (produce workflow definitions for common scenarios)
- Installation (write all files to .ryo/, install skills into runtime)
- Validation (verify generated framework is internally consistent)

---

## Design Principles

1. **The CLI is dumb, the skills are smart.** The CLI never calls an LLM. It scaffolds files and installs prompts. The prompts do the thinking.

2. **BYOT (Bring Your Own Tool).** Works with whatever AI subscription the user already pays for. No vendor lock-in.

3. **Generated, not prescribed.** The framework generates agents and processes to fit the org. It doesn't ship with "PM Agent" or "Architect Agent" — it produces whatever roles make sense for the context.

4. **Org-level + project-level.** Org context is shared across repos. Project-level config adapts per repo.

5. **Customizations survive evolution.** The `.customize/` directory pattern (borrowed from BMAD) preserves user overrides when the framework is re-generated.

6. **Small npm footprint.** No LLM SDKs, no heavy dependencies. Just Commander, Inquirer, Zod, YAML, Chalk, and Ora.

---

## Build Order

Recommended implementation sequence:

### Phase 1 — CLI Skeleton
1. Set up the npm package with bin entry, Commander.js program
2. Wire up `ryo init` with the TUI interview flow
3. Implement Zod schemas for org-context
4. Implement the context writer (org-context.yaml output)
5. Implement auto-detection (scan for existing project artifacts)

### Phase 2 — Runtime Integration
6. Implement the Claude Code runtime transformer (primary target)
7. Implement the skill writer (SKILL.md generation from templates)
8. Wire `ryo init` to install bootstrap skills into Claude Code
9. Test the full `ryo init` → open Claude Code → `/ryo-gen` flow

### Phase 3 — Generator Skill
10. Write the `ryo-gen.skill.md` bootstrap prompt
11. Write the `ryo-help.skill.md` guidance prompt
12. Write the `ryo-add-agent.skill.md` prompt
13. Write the `ryo-add-skill.skill.md` prompt
14. Write the `ryo-evolve.skill.md` prompt

### Phase 4 — Project-Level Commands
15. Implement `ryo gen` (project-level scaffold)
16. Implement `ryo evolve`
17. Implement `ryo add agent` and `ryo add skill`
18. Implement `ryo check` (schema validation)
19. Implement `ryo update`

### Phase 5 — Additional Runtimes
20. Copilot runtime
21. Cursor runtime
22. Codex runtime
23. Windsurf runtime
24. Gemini CLI runtime

### Phase 6 — Polish
25. README with getting-started guide
26. CONTRIBUTING.md
27. Tests (Vitest)
28. CI/CD (GitHub Actions for npm publish)

---

## Competitive Positioning

| Feature | BMAD | Spec-Kit | GSD | ryo-kit |
|---------|------|----------|-----|---------|
| Agent roles | Fixed (12+) | None (tool-focused) | Fixed (5) | Generated per-org |
| Process | Fixed 4-phase | Fixed 4-phase | Fixed 4-phase | Generated per-org |
| Customization | Override via YAML | Edit templates | Edit prompts | Full regeneration |
| Multi-runtime | 15+ IDEs | 22+ agents | 3 runtimes | All major runtimes |
| Compliance support | Via expansion packs | Via constitution | None | Native generation |
| Scale adaptation | Level 0-4 complexity | None | Milestones | Per-project agent selection |
| LLM dependency in CLI | None | None | None | None |
| Package size target | 555 KB | Python-based | ~1 MB | < 500 KB |

---

## References

Key projects studied during design:
- **BMAD v6**: npmjs.com/package/bmad-method — Agent-as-code paradigm, .agent.yaml schema, customize.yaml overlay, Commander.js CLI, module system
- **GitHub Spec-Kit**: github.com/github/spec-kit — Constitution concept, Specify → Plan → Tasks → Implement flow, Python CLI (we chose Node instead)
- **GSD v1/v2**: npmjs.com/package/get-shit-done-cc — Single-package multi-runtime install, context engineering focus, fresh-context-per-task pattern
- **McKinsey/QuantumBlack agentic SDLC pattern**: Deterministic orchestration + bounded agent execution + automated evaluation, specialized agents per task

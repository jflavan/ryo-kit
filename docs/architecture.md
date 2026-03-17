# Architecture

ryo-kit uses a two-phase design that separates deterministic scaffolding from AI-powered generation. The CLI never calls an LLM. The intelligence lives entirely in the prompt engineering of the installed skills.

## Design Principles

1. **The CLI is dumb, the skills are smart.** The CLI scaffolds files and installs prompts. The prompts do the thinking.
2. **BYOT (Bring Your Own Tool).** Works with whatever AI subscription the user already pays for. No vendor lock-in, no API keys.
3. **Generated, not prescribed.** The framework generates agents, skills, and processes to fit the org. It doesn't ship with "PM Agent" or "Architect Agent" — it produces whatever roles make sense.
4. **Agents and skills are equal peers.** Agents define *who* (roles, responsibilities, handoffs). Skills define *how* (the actual prompts/capabilities). Workflows define *when* (sequencing agents using skills through process phases).
5. **Org-level + project-level.** Org context is shared across repos. Project-level config adapts per repo.
6. **Customizations survive evolution.** The `.customize/` directory preserves user overrides when the framework is re-generated.
7. **Self-improving.** The framework learns from usage through retrospectives and signal tracking. Improvements are proposed, not applied automatically.
8. **Cross-session resilient.** Multi-phase operations persist state to `.ryo/.state/` in markdown, enabling resume from any point.
9. **Small npm footprint.** Four runtime dependencies: Commander, @clack/prompts, Zod, YAML. Zero devDependencies.

## Phase 1: CLI (Deterministic)

The CLI is a standard Node.js ESM application using Commander.js for command parsing and @clack/prompts for the TUI.

```
User runs CLI command
        │
        ▼
┌─────────────────────────┐
│  Commander.js            │
│  Routes to command       │
│  handler                 │
└────────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  Command handler     │
    │  (init, gen, etc.)   │
    │                      │
    │  - Reads/writes YAML │
    │  - Scaffolds dirs    │
    │  - Installs skills   │
    │  - Validates schemas │
    └─────────────────────┘
```

Key modules:

| Module | Responsibility |
|--------|---------------|
| `src/context/schema.js` | Zod schemas for all artifact types |
| `src/context/detector.js` | Auto-detects project artifacts (CLAUDE.md, package.json, etc.) |
| `src/context/writer.js` | Writes org-context.yaml and constitution.md |
| `src/scaffolder/directory.js` | Creates the `.ryo/` directory tree |
| `src/scaffolder/skill-writer.js` | Writes skills to canonical `.agents/skills/` and installs into runtimes |
| `src/runtimes/*.js` | Runtime-specific symlink/copy placement and config management |
| `src/cli/commands/sync.js` | Syncs skills and agents to all configured runtimes |
| `src/utils/symlink.js` | Cross-platform symlink creation and cleanup |
| `src/utils/agent-block.js` | Managed agent blocks in Markdown config files |
| `src/utils/toml-agent.js` | TOML agent file generation for Codex |
| `src/cli/prompts/org-interview.js` | TUI interview flow |

## Phase 2: Skill Chain (AI-Powered)

The generator uses a multi-phase skill chain. An orchestrator skill delegates to focused sub-skills, each writing output immediately for cross-session resilience.

```
User invokes /ryo-gen
        │
        ▼
┌─────────────────────────┐
│  ryo-gen orchestrator    │
│  - Load .state/          │
│  - Read org context      │
│  - Resume or start fresh │
└────────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  Clarification       │  Conversational phase
    │  - Fill context gaps │  (saved to decisions.md)
    │  - Project scope     │
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  agent-generation    │  → .ryo/agents/*.agent.md
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  skill-generation    │  → .agents/skills/*/SKILL.md
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  process-generation  │  → .ryo/process.md
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  workflow-generation  │  → .ryo/workflows/*.workflow.md
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  Validation          │
    │  - Consistency check │
    └────┬────────────────┘
         │
    ┌────▼────────────────┐
    │  Sync to runtimes    │
    │  - npx ryo-kit sync  │
    └─────────────────────┘
```

### Hybrid Decision Tree

The generator uses a hybrid approach: strong defaults via a decision tree in `templates/fragments/decision-tree.md`, with conversational overrides during the clarification phase.

| Org Profile | Likely Agents | Likely Skills |
|-------------|--------------|---------------|
| Solo dev, no compliance | builder, verifier | plan, implement, test, review |
| Small scrum team | architect, builder, reviewer, tester | plan, design, implement, test, review, deploy |
| SAFe + HIPAA | pi-planner, architect, builder, reviewer, compliance-auditor, security-reviewer, tester, release-manager | All above + audit, compliance-check, pi-plan, release |

These are starting points, not hard-coded outputs. The clarification dialogue can override any default.

### Sub-Skill Reuse

Each sub-skill is independently useful beyond `/ryo-gen`:

- `/ryo-evolve` can re-run just `agent-generation` if a retro suggests adding a new role
- `/ryo-retro` can invoke `process-generation` to adjust gates based on signal data
- `/ryo-add-agent` and `/ryo-add-skill` use the same generation logic with narrower scope

### Cross-Session Persistence

The `.ryo/.state/` directory enables resume across sessions:

| File | Purpose |
|------|---------|
| `current-plan.md` | Active plan with checkbox progress. Skills update checkboxes as phases complete. |
| `decisions.md` | Clarification answers. If a session ends mid-interview, the next invocation picks up where it left off. |
| `signals.md` | Append-only usage tracking. Gate outcomes, skipped phases, manual overrides. |
| `retro-[date].md` | Retrospective reports with proposed changes. |
| `history/` | Archived completed plans for trend analysis. |

Every skill reads `.state/` on startup: resume if in-flight, start fresh if not.

## Directory Structure

### Org-level (`~/.ryo/`)

```
~/.ryo/
├── org-context.yaml        # Structured org profile from TUI interview
├── constitution.md          # Non-negotiable principles (user-editable)
└── templates/
    ├── agent-base.yaml      # Base schema example for agents
    └── process-base.yaml    # Base schema example for processes
```

### Project-level (`.ryo/` and `.agents/`)

```
.agents/                      # Canonical skill location (synced to runtimes)
├── skills/
│   └── [name]/
│       └── SKILL.md          # Generated: one per skill
└── .ryo-kit                  # Marker file — identifies ryo-kit ownership

.ryo/
├── process.md               # Generated: phases, gates, artifacts, handoffs
├── agents/
│   └── [name].agent.md      # Generated: one per agent role
├── workflows/
│   └── [name].workflow.md    # Generated: one per scenario
├── .state/                   # Cross-session persistence
│   ├── current-plan.md
│   ├── decisions.md
│   ├── signals.md
│   ├── retro-[date].md
│   └── history/
└── .customize/               # User overrides, preserved on evolve
    └── README.md
```

The `ryo sync` command reads skills from `.agents/skills/` and agents from `.ryo/agents/`, then creates symlinks (or copies) into each configured runtime's native directory. Runtimes like Cursor, Codex, and Gemini CLI auto-discover skills from `.agents/skills/` and need no symlinks.

## Schemas

All artifact types have Zod schemas in `src/context/schema.js`:

- **OrgContextSchema** — org profile (methodology, stack, team, compliance, tools, conventions)
- **AgentDefSchema** — agent definitions (name, role, responsibilities, inputs, outputs, handoff_to, gate)
- **SkillDefSchema** — skill definitions (name, description, trigger, agent, inputs, outputs, runtimes)
- **ProcessDefSchema** — process definition (phases with gates and artifacts, scale rules)
- **WorkflowDefSchema** — workflow definitions (steps with phase, agent, skills, inputs, outputs, gate, scale rules)
- **SignalSchema** — usage tracking entries (timestamp, type, subject, outcome, context)

Generated files use YAML frontmatter matching these schemas, followed by markdown content.

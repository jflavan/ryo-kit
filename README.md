# ryo-kit

[![npm version](https://img.shields.io/npm/v/ryo-kit)](https://www.npmjs.com/package/ryo-kit)
[![npm downloads](https://img.shields.io/npm/dm/ryo-kit)](https://www.npmjs.com/package/ryo-kit)

Roll Your Own AI-driven development framework.

ryo-kit generates custom agents, skills, processes, and workflows tailored to your organization's team size, methodology, tech stack, and compliance requirements. Unlike frameworks that ship fixed agent roles, ryo-kit produces exactly the roles and capabilities your org needs.

No API keys required. The CLI scaffolds files and installs skills into your existing AI coding tool (Claude Code, Copilot, Cursor, Codex, Windsurf, or Gemini CLI). The intelligence runs through the tool you already pay for.

## Installation

```sh
# Run directly without installing
npx ryo-kit init

# Or install as a dev dependency in your project
npm install --save-dev ryo-kit

# Or install globally
npm install -g ryo-kit
```

## Quick Start

```sh
npx ryo-kit init
```

Answer the interview questions about your org. Then open your AI tool and run:

```
/ryo-gen
```

The skill chain reads your org context and generates a complete framework into `.ryo/`. Skills are written to `.agents/skills/` and synced to each configured runtime.

## What Gets Generated

Depending on your org profile:

| Org Profile | Agents | Skills | Process |
|-------------|--------|--------|---------|
| Solo developer | ~2 (builder, verifier) | ~4 | Lightweight with minimal gates |
| Small scrum team | ~4 (architect, builder, reviewer, tester) | ~6 | Sprint-oriented with review gates |
| SAFe enterprise + HIPAA | 6-8 (includes compliance, security reviewers) | 10+ | PI ceremonies, compliance gates, audit trails |

Agent and skill count, names, and responsibilities are not predetermined. They're generated from your context.

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx ryo-kit init` | Org-level setup: TUI interview, write org context, install skills |
| `npx ryo-kit gen` | Project-level: scaffold `.ryo/`, install project skills, sync to runtimes |
| `npx ryo-kit evolve` | Re-generate framework from updated org context |
| `npx ryo-kit sync` | Sync agents and skills to all configured coding tool runtimes |
| `npx ryo-kit add agent` | Add a new agent definition |
| `npx ryo-kit add skill` | Add a new skill |
| `npx ryo-kit check` | Validate framework files against schemas |
| `npx ryo-kit update` | Pull latest skill templates from the package |

All commands support `-y` / `--yes` for non-interactive usage.

## Slash Commands

Installed into your AI tool by `ryo init` and `ryo gen`.

| Command | Description |
|---------|-------------|
| `/ryo-gen` | Generate agents, skills, process, and workflows from org context |
| `/ryo-help` | Context-aware guidance on what to do next |
| `/ryo-add-agent` | Create a new agent conversationally |
| `/ryo-add-skill` | Create a new skill conversationally |
| `/ryo-evolve` | Re-generate framework with updated context |
| `/ryo-retro` | Analyze usage signals and propose improvements |

## Supported Runtimes

Skills are authored in `.agents/skills/` (the canonical location) and symlinked or copied to each runtime's native directory by `ryo sync`.

| Runtime | Skills Location | Agents Location | Mechanism |
|---------|----------------|-----------------|-----------|
| Claude Code | `.claude/skills/` | `.claude/agents/` | Symlinks |
| Copilot | `.github/skills/` | `.github/agents/` | Symlinks |
| Cursor | Auto-discovers `.agents/skills/` | `AGENTS.md` block | No-op / Config block |
| Codex | Auto-discovers `.agents/skills/` | `.codex/agents/` (TOML) + `AGENTS.md` block | No-op / TOML + Config block |
| Windsurf | `.windsurf/rules/` | `AGENTS.md` block | Copy + transform |
| Gemini CLI | Auto-discovers `.agents/skills/` | `GEMINI.md` block | No-op / Config block |

## How It Works

**Phase 1 (CLI)** collects your org context via a TUI interview, auto-detects project artifacts, and installs bootstrap skills into your AI tools. The CLI is deterministic with zero LLM dependencies.

**Phase 2 (Skill Chain)** runs in your AI tool. `/ryo-gen` is an orchestrator that chains four focused sub-skills: agent generation, skill generation, process generation, and workflow generation. Each writes output immediately, enabling cross-session resume if a session ends mid-generation.

**Sync** distributes skills and agents from the canonical `.agents/skills/` directory to each configured runtime using symlinks (or copies for runtimes that don't support symlinks). Run `npx ryo-kit sync` manually, or let `gen` and `evolve` handle it automatically.

The generator uses a hybrid approach: strong defaults from a decision tree based on your org profile, with conversational overrides during a clarification phase.

## Self-Improvement

Generated workflows log usage signals (gate outcomes, skipped phases, manual overrides) to `.ryo/.state/signals.md`. After a sprint or milestone, run `/ryo-retro` to analyze patterns and get improvement proposals. Apply accepted proposals with `/ryo-evolve`. Files in `.ryo/.customize/` are never silently overwritten.

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Full setup walkthrough |
| [Architecture](docs/architecture.md) | Two-phase design, directory structure, schemas |
| [CLI Reference](docs/cli-reference.md) | All commands with options and examples |
| [Skill Reference](docs/skill-reference.md) | All slash commands and what they do |
| [Runtimes](docs/runtimes.md) | How skills get installed into each AI tool |
| [Customization](docs/customization.md) | Overriding generated content, `.customize/` directory |
| [Self-Improvement](docs/self-improvement.md) | The retro + evolve cycle |
| [Schema Reference](docs/schemas.md) | All Zod schemas and YAML frontmatter fields |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

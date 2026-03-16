# ryo-kit

Roll Your Own AI-driven development framework.

ryo-kit is a Node.js CLI meta-framework that generates custom, org-specific AI development frameworks: agents, skills, processes, and workflows tailored to your team size, methodology, tech stack, and compliance requirements. Unlike frameworks that ship with fixed agent roles, ryo-kit produces exactly the roles and capabilities your org needs. No API keys required — the CLI scaffolds files and installs skills; the intelligence runs through your existing AI coding tool.

---

## Quick start

```sh
npx ryo-kit init
```

Answer the interview questions (methodology, team size, tech stack, AI tools). When it finishes, open your AI coding tool and run:

```
/ryo-gen
```

That's it. The skill chain reads your org context and generates agents, skills, processes, and workflows into `.ryo/`.

---

## CLI commands

| Command | Description |
|---------|-------------|
| `npx ryo-kit init` | Org-level setup: TUI interview, write org context, install bootstrap skills |
| `npx ryo-kit gen` | Project-level: scaffold `.ryo/` for this repo, install project skills |
| `npx ryo-kit evolve` | Re-generate framework from updated org context |
| `npx ryo-kit add agent` | Add a single new agent definition |
| `npx ryo-kit add skill` | Add a single new skill |
| `npx ryo-kit check` | Validate framework files against schemas |
| `npx ryo-kit update` | Pull latest skill templates from the package |

All commands support `-y` / `--yes` for non-interactive/CI usage.

---

## Slash commands

Installed into your AI coding tool by `ryo init` and `ryo gen`.

| Command | Description |
|---------|-------------|
| `/ryo-gen` | Generate agents, skills, and process definition from org context |
| `/ryo-help` | Context-aware "what do I do next" guidance |
| `/ryo-add-agent` | Create a new agent conversationally |
| `/ryo-add-skill` | Create a new skill conversationally |
| `/ryo-evolve` | Re-generate framework with updated context |
| `/ryo-retro` | Retrospective: analyze usage signals and propose improvements |

---

## Supported runtimes

| Runtime | Skills location | Slash command support |
|---------|----------------|-----------------------|
| Claude Code | `.claude/skills/ryo-*/SKILL.md` | Yes — native via skill frontmatter |
| Copilot | `.github/prompts/ryo-*.prompt.md` | Yes — native via prompt files |
| Cursor | `.cursor/rules/ryo-*.md` | No — skills installed as rules |
| Codex | `skills/ryo-*/SKILL.md` | Yes — native via skill files |
| Windsurf | `.windsurfrules` (appended sections) | No — skills installed as rules |
| Gemini CLI | `.gemini/skills/ryo-*/SKILL.md` | Yes — native via skill files |

Cursor and Windsurf users invoke skills by asking the AI to follow the relevant rule.

---

## How it works

ryo-kit uses a two-phase design that keeps the CLI deterministic and dependency-free while delegating all intelligence to your AI tool's prompt execution.

**Phase 1 — CLI (zero LLM dependencies)**

`ryo init` runs an interactive TUI interview using `@clack/prompts`. It collects your org's methodology, tech stack, team composition, compliance requirements, and preferred AI tools. It writes a structured `org-context.yaml`, installs bootstrap skills into every selected runtime simultaneously, and prints next-step instructions per runtime.

`ryo gen` reads the org context and scaffolds the `.ryo/` directory structure in your project, then tells you to invoke `/ryo-gen`.

**Phase 2 — Skill chain (runs in your AI tool)**

`/ryo-gen` is an orchestrator skill that reads your org context, asks clarifying questions, and delegates to four focused sub-skills:

1. `agent-generation` — produces `.ryo/agents/*.agent.md`
2. `skill-generation` — produces `.ryo/skills/*/SKILL.md`
3. `process-generation` — produces `.ryo/process.md`
4. `workflow-generation` — produces `.ryo/workflows/*.workflow.md`

Each sub-skill writes output immediately, enabling cross-session resume. If a session ends mid-generation, the next `/ryo-gen` invocation resumes from the first incomplete phase.

---

## Configuration

`org-context.yaml` (written to `~/.ryo/` in org-wide mode or `.ryo/` in repo-only mode) captures everything the generator needs:

| Field | Description |
|-------|-------------|
| `methodology` | `scrum`, `safe`, `kanban`, `hybrid`, or `none` |
| `stack.languages` | Array of language identifiers, e.g. `["typescript", "python"]` |
| `stack.cloud` | `azure`, `aws`, `gcp`, `multi`, or `none` |
| `team.size` | `solo`, `small`, `medium`, `large`, or `enterprise` |
| `compliance` | Array of compliance standards, e.g. `["soc2", "hipaa"]` |
| `tools.ai` | Array of selected AI runtimes |
| `tools.scm` | Source control: `github`, `gitlab`, `azure-devops`, or `bitbucket` |
| `conventions` | Optional: `branching`, `testing`, `reviews` strategies |

Edit this file directly to update your org profile, then run `ryo evolve` to re-generate.

---

## Self-improvement

ryo-kit includes a retro + evolve cycle so your framework improves over time.

**Signal collection** — Generated workflow skills write lightweight entries to `.ryo/.state/signals.md` during normal operation: gate outcomes, skipped phases, manual overrides.

**`/ryo-retro`** — After a sprint or feature ships, invoke this skill. It reads signal data and generation history, identifies patterns (agents never used, gates that always pass, phases always skipped), and proposes specific changes. You choose which proposals to accept.

**`/ryo-evolve`** — Applies accepted proposals or re-generates after you update `org-context.yaml`. Files in `.ryo/.customize/` are preserved across evolution; conflicts are surfaced to you with explicit prompts before any change is applied.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT

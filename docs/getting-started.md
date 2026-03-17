# Getting Started

This guide walks you through installing ryo-kit, generating your first framework, and using it in your daily workflow.

## Prerequisites

- Node.js 20 or later
- An AI coding tool: Claude Code, GitHub Copilot, Cursor, Codex, Windsurf, or Gemini CLI
- A git repository to work in

## Step 1: Initialize org context

Run the setup interview:

```sh
npx ryo-kit init
```

The TUI walks you through 12 questions about your org:

1. **Organization name** (optional)
2. **AI tools** your team uses (multi-select)
3. **Methodology** (Scrum, SAFe, Kanban, Hybrid, or None)
4. **Tech stack** — languages, frameworks, cloud provider, CI/CD
5. **Team size** (Solo, Small 2-10, Medium 11-50, Large 50+, Enterprise 200+)
6. **Compliance** requirements (SOC 2, HIPAA, PCI DSS, ISO 27001, FedRAMP, Internal, None)
7. **Source control** and **project management** tools
8. **Conventions** — branching strategy, testing approach, code review policy (all optional)
9. **Install location** — org-wide (`~/.ryo/`) or this repo only (`.ryo/`)
10. **Auto-detection** — scans for existing config files and reports findings

After answering, ryo-kit writes your org context and installs bootstrap skills into every AI tool you selected.

For non-interactive/CI usage:

```sh
npx ryo-kit init --yes
```

This uses sensible defaults (solo developer, Claude Code, GitHub, no compliance).

## Step 2: Scaffold a project

If you chose org-wide mode, run this in each repo:

```sh
npx ryo-kit gen
```

This creates the `.ryo/` and `.agents/` directory structures, installs project-level skills to `.agents/skills/`, and syncs them to your configured runtimes. If you chose repo-only mode, `ryo init` already did this.

## Step 3: Generate your framework

Open your AI coding tool and invoke:

```
/ryo-gen
```

The generator skill chain:

1. **Loads** your org context and constitution
2. **Asks clarifying questions** about the specific project (brownfield vs greenfield, scope, etc.)
3. **Generates agents** — the roles in your development process (e.g., builder, reviewer, tester)
4. **Generates skills** — the capabilities each agent uses (e.g., implement, review, test)
5. **Generates a process definition** — phases, gates, and artifacts for your methodology
6. **Generates workflows** — concrete sequences for common scenarios (new feature, bug fix, hotfix)
7. **Validates** internal consistency
8. **Syncs** skills and agents to your configured runtimes via `npx ryo-kit sync`

Everything is written to `.ryo/` immediately as each phase completes. If your session ends mid-generation, the next `/ryo-gen` invocation resumes from where it left off.

## Step 4: Use your framework

Your generated framework is now in `.ryo/`. Depending on your org profile, you might have:

- **A solo developer** — 2 agents (builder + verifier), a handful of skills, a lightweight process
- **A small scrum team** — 3-4 agents, ~6 skills, sprint-oriented process with review gates
- **An enterprise SAFe org with compliance** — 6-8 agents, 10+ skills, PI ceremonies, compliance gates, audit trails

Use `/ryo-help` at any time for context-aware guidance on what to do next.

## Step 5: Evolve over time

As your org changes, update `org-context.yaml` and run:

```sh
npx ryo-kit evolve
```

Then invoke `/ryo-evolve` in your AI tool. It diffs the current framework against what would be generated from the updated context, preserves your customizations in `.ryo/.customize/`, and asks before overwriting anything.

After a sprint or milestone, run `/ryo-retro` to analyze usage signals and get improvement proposals.

## What's next

- [Architecture](./architecture.md) — how the two-phase design works in detail
- [CLI Reference](./cli-reference.md) — all commands and flags
- [Skill Reference](./skill-reference.md) — all slash commands and what they do
- [Runtimes](./runtimes.md) — how skills get installed into each AI tool
- [Customization](./customization.md) — overriding generated content
- [Self-Improvement](./self-improvement.md) — the retro + evolve cycle

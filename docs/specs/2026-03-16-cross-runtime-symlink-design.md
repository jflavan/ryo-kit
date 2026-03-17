# Cross-Runtime Symlink Architecture for Agents & Skills

**Date:** 2026-03-16
**Status:** Approved

## Problem

ryo-kit generates agents and skills into `.ryo/agents/` and `.ryo/skills/`, but each supported coding tool (Claude Code, Copilot, Cursor, Codex, Gemini CLI, Windsurf) expects files in its own directory. The current approach copies full file content into each runtime's directory, creating duplication and drift. Additionally, the Copilot integration writes to `.github/prompts/` (wrong location) — Copilot expects agents in `.github/agents/` and skills in `.github/skills/`.

Users who select multiple coding tools end up with duplicate files that can diverge after manual edits, with no single source of truth.

## Goals

1. Single source of truth for all agent and skill files
2. All six supported runtimes discover and use the files natively
3. Minimize symlinks — leverage auto-discovery where possible
4. Handle runtimes that don't support agents natively (config block fallback)
5. Handle Windsurf's fundamentally different format (inline copies)
6. Work on macOS, Linux, and Windows (with graceful fallback)

## Design

### Canonical File Locations

**Skills** move from `.ryo/skills/` to **`.agents/skills/*/SKILL.md`**.

This leverages the emerging cross-tool standard: Cursor, Codex, and Gemini CLI all auto-discover skills from `.agents/skills/`. Three of six runtimes get zero-configuration discovery.

**Agents** stay at **`.ryo/agents/*.agent.md`**.

There is no cross-tool standard for agent files. Claude Code and Copilot have native agent directories but with different naming (`.md` vs `.agent.md`). Codex uses TOML. The remaining three runtimes have no native agent directory at all.

### Skills: Per-Runtime Strategy

| Runtime | Strategy | Target Path | Detail |
|---|---|---|---|
| Claude Code | symlink (dir) | `.claude/skills/{name}/` → `../../.agents/skills/{name}/` | Directory symlink |
| Copilot | symlink (dir) | `.github/skills/{name}/` → `../../.agents/skills/{name}/` | Directory symlink |
| Cursor | auto-discovery | `.agents/skills/{name}/SKILL.md` | No action needed |
| Codex | auto-discovery | `.agents/skills/{name}/SKILL.md` | No action needed |
| Gemini CLI | auto-discovery | `.agents/skills/{name}/SKILL.md` | No action needed |
| Windsurf | copy (transform) | `.windsurf/rules/{name}.md` | Copy with `trigger: model_decision` frontmatter added |

### Agents: Per-Runtime Strategy

| Runtime | Strategy | Target Path | Detail |
|---|---|---|---|
| Claude Code | symlink (file) | `.claude/agents/{name}.md` → `../../.ryo/agents/{name}.agent.md` | File symlink |
| Copilot | symlink (file) | `.github/agents/{name}.agent.md` → `../../.ryo/agents/{name}.agent.md` | File symlink |
| Codex | generate | `.codex/agents/{name}.toml` | Transform AgentDefSchema YAML → Codex TOML format |
| Cursor | config block | `AGENTS.md` | Upsert ryo-kit block with agent descriptions |
| Gemini CLI | config block | `GEMINI.md` | Upsert ryo-kit block with agent descriptions |
| Windsurf | config block | `AGENTS.md` | Upsert ryo-kit block (Windsurf auto-scopes by directory) |

### Frontmatter Compatibility

Skills use YAML frontmatter with these fields:

```yaml
---
name: implement          # Required. Must match directory name.
description: >           # Required. Describes what the skill does AND when to use it.
  Implements code changes based on design documents and task specifications.
trigger: "When the user needs to implement a feature"
agent: builder           # Optional. Which agent typically uses this skill.
inputs:
  - design documents
  - task specifications
outputs:
  - implemented code
runtimes:
  - claude-code
  - copilot
  - cursor
---
```

All runtimes require `name` + `description`. The ryo-kit-specific fields (`trigger`, `agent`, `inputs`, `outputs`, `runtimes`) are ignored by all runtimes — they skip unknown frontmatter keys. No schema changes needed.

Agent frontmatter similarly carries ryo-kit fields (`responsibilities`, `handoff_to`, `gate`) that Claude Code and Copilot ignore while reading the shared fields (`name`, `description`, `tools`).

### The `ryo sync` Command

New CLI command that creates/updates all runtime links and references.

**What it does:**
1. Reads `org-context.yaml` to determine active runtimes
2. Scans `.agents/skills/` for all skill directories
3. Scans `.ryo/agents/` for all agent files
4. For each active runtime, performs the appropriate action (symlink, generate, config block, or copy) per the tables above
5. Cleans up stale symlinks pointing to files that no longer exist

**When it runs:**
- Explicitly: `ryo sync` (manual invocation)
- After `ryo gen`: automatically after installing bootstrap skills
- After `/ryo-gen` completes: the orchestrator skill instructs the AI to run `npx ryo-kit sync`
- After `ryo evolve`: re-sync after regeneration

**Symlink creation with Windows fallback:**
```
attempt fs.symlink() (relative path)
  → on success: done
  → on EPERM/ENOTSUP: fall back to copying file content
    → log warning: "Symlinks unavailable, using copies. Run ryo sync after edits to re-copy."
```

On Windows, directory symlinks use `fs.symlink(target, path, 'junction')` which works without elevation. File symlinks attempt `'file'` type first, falling back to copy.

### Changes to `installSkillsForRuntimes()`

Currently writes skill content directly to each runtime's directory. Changes to:
1. Write skill content to `.agents/skills/{name}/SKILL.md` (canonical location)
2. Call `sync` to create symlinks/copies for each active runtime

### Changes to Generation Sub-Skills

The `skill-generation.skill.md` template changes its output path:
- **Before:** `.ryo/skills/{name}/SKILL.md`
- **After:** `.agents/skills/{name}/SKILL.md`

The `agent-generation.skill.md` template is unchanged (still writes to `.ryo/agents/`).

The `ryo-gen.skill.md` orchestrator adds a final step: "Run `npx ryo-kit sync` to link generated agents and skills to your coding tools."

### Changes to `scaffoldProjectDir()`

- Stops creating `.ryo/skills/` directory
- Creates `.agents/skills/` directory instead
- `.ryo/agents/`, `.ryo/workflows/`, `.ryo/.state/`, `.ryo/.customize/` unchanged

### Copilot Runtime Overhaul

The `CopilotRuntime` class changes significantly:
- `skillsDir` changes from `.github/prompts` to `.github/skills`
- `installSkill()` creates directory symlinks instead of writing flat `.prompt.md` files
- New `installAgent()` method creates file symlinks in `.github/agents/`
- `uninstall()` removes symlinks instead of deleting content files
- `configFile` stays as `.github/copilot-instructions.md`

### Directory Structure (After)

```
project/
├── .ryo/
│   ├── agents/                         # Canonical agents
│   │   ├── builder.agent.md
│   │   └── reviewer.agent.md
│   ├── workflows/
│   ├── .state/                         # gitignored
│   └── .customize/
├── .agents/
│   └── skills/                         # Canonical skills
│       ├── ryo-gen/SKILL.md            # Bootstrap
│       ├── ryo-help/SKILL.md           # Core
│       ├── implement/SKILL.md          # Generated
│       └── review/SKILL.md             # Generated
├── .claude/
│   ├── skills/
│   │   ├── ryo-gen → ../../.agents/skills/ryo-gen           # symlink
│   │   └── implement → ../../.agents/skills/implement       # symlink
│   └── agents/
│       └── builder.md → ../../.ryo/agents/builder.agent.md  # symlink
├── .github/
│   ├── skills/
│   │   ├── ryo-gen → ../../.agents/skills/ryo-gen           # symlink
│   │   └── implement → ../../.agents/skills/implement       # symlink
│   ├── agents/
│   │   └── builder.agent.md → ../../.ryo/agents/builder.agent.md  # symlink
│   ├── copilot-instructions.md
│   └── workflows/                      # CI/CD, unchanged
├── .codex/
│   └── agents/
│       └── builder.toml                # Generated (TOML transform)
├── .windsurf/
│   └── rules/
│       ├── ryo-gen.md                  # Copy with trigger: frontmatter
│       └── implement.md                # Copy with trigger: frontmatter
├── AGENTS.md                           # Agent block for Cursor/Windsurf
└── GEMINI.md                           # Agent block for Gemini CLI
```

### Git Considerations

- Symlinks are committed to git (stored as symlink entries)
- `.ryo/.state/` remains gitignored
- `.codex/agents/*.toml` and `.windsurf/rules/*.md` are committed (generated but deterministic)
- `AGENTS.md` and `GEMINI.md` use ryo-kit sentinel blocks (`<!-- ryo-kit:start -->` / `<!-- ryo-kit:end -->`) to avoid clobbering user content

### Migration

Since ryo-kit is pre-1.0 (v0.1.0), breaking changes are acceptable.

`ryo sync` detects and migrates the old layout automatically:
1. If `.ryo/skills/` exists and `.agents/skills/` doesn't → move skills to `.agents/skills/`
2. If `.github/prompts/ryo-*.prompt.md` exists → remove old files, create new symlinks in `.github/skills/`
3. If runtime directories contain real files where symlinks are expected → replace with symlinks
4. Print a summary of what was migrated

`ryo gen` on existing projects detects old layout and runs migration before installing new skills.

## Scope of Changes

| File | Change |
|---|---|
| `src/runtimes/base.js` | Add `installAgent()`, `agentsDir` to interface |
| `src/runtimes/copilot.js` | Rewrite: symlinks to `.github/skills/` + `.github/agents/` |
| `src/runtimes/claude-code.js` | Change `installSkill` to create symlinks; add `installAgent` |
| `src/runtimes/codex.js` | Change `installSkill` to auto-discovery (no-op); add `installAgent` (TOML gen) |
| `src/runtimes/cursor.js` | Change `installSkill` to auto-discovery (no-op); add `installAgent` (config block) |
| `src/runtimes/gemini-cli.js` | Change `installSkill` to auto-discovery (no-op); add `installAgent` (config block) |
| `src/runtimes/windsurf.js` | Change `installSkill` to copy with transform; add `installAgent` (config block) |
| `src/scaffolder/directory.js` | Create `.agents/skills/` instead of `.ryo/skills/` |
| `src/scaffolder/skill-writer.js` | Write to `.agents/skills/`; call sync after install |
| `src/cli/commands/sync.js` | New file: `ryo sync` command |
| `src/cli/index.js` | Register `sync` command |
| `src/utils/symlink.js` | New file: cross-platform symlink helpers with fallback |
| `templates/bootstrap/ryo-gen.skill.md` | Add final step: run `npx ryo-kit sync` |
| `templates/sub-skills/skill-generation.skill.md` | Change output path to `.agents/skills/` |
| `test/runtimes.test.js` | Update for symlink behavior |
| `test/scaffolder.test.js` | Update for new directory structure |
| New: `test/sync.test.js` | Tests for sync command |

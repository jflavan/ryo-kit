# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-09-03

Governance release. The generated framework now carries the mechanics that make a process hold, expressed in ryo-kit's own terms and driven by the org's own policy.

### Added

- **Structured constitution** — `constitution.md` gains YAML frontmatter with machine-checkable rules: `protected_branches`, `required_reviewers`, `forbidden_paths`, `stop_conditions`, `scope_overrides`, `evidence`, `audit`. Validated by `ryo check` via the new `ConstitutionSchema`. The default template ships sensible defaults.
- **`ryo classify`** — deterministic scope classification from touched paths. Applies `scope_overrides` (path glob → minimum scope) and `forbidden_paths`; the result never downgrades the proposed scope. `--json` for tooling; exit code 2 when a forbidden path is touched.
- **Governance-grade gates** — shared `GateSchema` used by agents, process phases, and workflow steps adds `evidence`, `approvers` (count, roles, agents), `skippable_for`, `separation_of_duties`, and `record_to`. All optional; existing frameworks keep validating.
- **SessionStart hook** — `ryo sync` installs a dependency-free `.ryo/hooks/session-start.js` and registers it with Claude Code (`.claude/settings.json`) and Cursor (`.cursor/hooks.json`). It injects the constitution, process phases, in-flight plan, ledger tail, workflow list, and the `ryo-session` bootstrap skill on startup, `/clear`, and `/compact`. Idempotent; preserves existing hooks and settings.
- **`/ryo-session`** core skill — the session bootstrap: classify before acting, follow the matching workflow, approval before implementation at every scope, gates pass on evidence, separation of duties, rulings not stalls, never touch forbidden paths, keep the ledger.
- **Fragments** — `scope-classification.md` (classify first, one-way ratchet, red flags), `ledger.md` (`.ryo/.state/ledger.md` format, rulings, stop conditions, audit retention), `verification.md` (evidence before claims, gate function, rationalization table).
- **Signal types** — `ruling`, `scope-classification`, `evidence`. `parseSignalLine` parses `signals.md` entries.
- **`/ryo-retro` analyses** — H: recurring rulings that should become policy; I: scope upgrades that should become `scope_overrides`; J: gates passed without evidence. Reads retained ledgers from `.ryo/.state/audit/`.
- **Generation templates** — workflows open with scope classification, embed ledger, evidence, stop-condition, finishing, and rationalization sections, and enforce separation of duties between implement and review steps. Process compliance gates are `skippable_for: []`. `plan`/`implement`/`test`/`review` skills get structural requirements: plan header with Global Constraints and no placeholders, four-status implementer report contract, fresh-context reviewer with two verdicts, capped fix loop with adjudication.
- **`ryo check` rules** — workflow steps must reference real process phases; `handoff_to` must reference real agents; process phase agents must exist; scale rules may only skip phases/steps their gate's `skippable_for` allows; automated gates cannot claim separation of duties or approver roles; a performer cannot approve its own gate; constitution frontmatter and `signals.md` entries are validated.
- `docs/governance.md` and an enterprise constitution fixture.

### Fixed

- `ryo check` read skills from the pre-0.2.0 `.ryo/skills/` path, so the skill cross-reference check never ran. It now reads `.agents/skills/` (and the legacy path).
- `ryo check` parsed `process.md` but never used it; phase cross-references are now checked.
- `/ryo-gen` had two "Phase 6" sections and its plan template omitted the sync step. Phases are now 1–7 with sync tracked for resume.
- `ryo --version` reported a hard-coded `0.1.0`; it now reads `package.json`.

## [0.2.3] - 2026-03-18

### Fixed

- **Copilot skill duplication** — `ryo sync` no longer creates symlinks in `.github/skills/`; VS Code auto-discovers skills from `.agents/skills/`, so the extra symlinks caused every skill to appear twice
- Migration now cleans up stale `.github/skills/` symlinks left by previous versions

### Changed

- `CopilotRuntime.installSkill` is now a no-op (matching Codex, Cursor, and Gemini CLI runtimes)
- `CopilotRuntime.skillsDir` returns `null` instead of `.github/skills/`

## [0.2.2] - 2026-03-17

### Added

- **Documentation mode** — agent-driven project documentation via `/ryo-docs`
  - `ryo docs` CLI command installs the docs skill to configured runtimes
  - `/ryo-docs` slash command orchestrates a 6-step documentation workflow: load context, ask user, scan & assess, present plan, generate docs, wrap up
  - Supports multiple audiences: onboarding, external developers, internal team, or all
  - Agents write docs from their domain perspective with consistent footer comments
  - Manifest-based staleness detection using git history for refresh cycles
  - Cross-session resilience via `docs-manifest.md` and `docs-progress.md` state files

## [0.2.1] - 2026-03-17

### Added

- **Conference mode** — multi-agent collaborative discussions via `/ryo-conference`
  - `ryo conference` CLI command installs the conference skill to configured runtimes
  - `/ryo-conference` slash command orchestrates multi-agent discussion sessions
  - Selects 2-4 relevant agents per message based on topic and responsibilities
  - Each agent responds in character with structured turn-taking
- `persona` field on `AgentDefSchema` — optional object with `displayName`, `icon`, `communicationStyle`, and `identity` for rich agent personalities
- Persona generation in the agent-generation sub-skill — agents are created with distinct names, icons, and communication styles
- Persona opt-in question in `/ryo-gen` Phase 2 clarification dialogue

## [0.2.0] - 2026-03-16

### Added

- `ryo sync` command — syncs agents and skills to all configured coding tool runtimes
- Symlink-based skill distribution — skills are authored in `.agents/skills/` and symlinked to runtime-native directories (Claude Code, Copilot), with copy fallback for runtimes that require it (Windsurf)
- Agent installation across all runtimes — symlinks for Claude Code/Copilot, TOML files for Codex, managed Markdown blocks for Cursor/Windsurf/Gemini CLI
- `.agents/skills/` as the canonical skill location with `.ryo-kit` marker file for ownership detection
- `agentsDir`, `agentConfigFile`, and `installAgent` to the `BaseRuntime` interface
- Utility modules: `symlink.js` (cross-platform symlinks), `agent-block.js` (managed Markdown blocks), `toml-agent.js` (Codex TOML generation)
- Migration from old layout conventions (`.ryo/skills/` → `.agents/skills/`, old Copilot prompts, old Codex root-level skills)
- Auto-sync wired into `ryo gen` and `ryo evolve`

### Changed

- Skills now live in `.agents/skills/` instead of `.ryo/skills/`
- Copilot skills location changed from `.github/prompts/` to `.github/skills/`
- Cursor, Codex, and Gemini CLI runtimes now auto-discover skills from `.agents/skills/` (no-op `installSkill`)
- Windsurf skills moved from appended `.windsurfrules` sections to `.windsurf/rules/` directory
- `installSkill` signature changed from `(skillName, skillContent)` to `(skillName, canonicalSkillDir)`

### Fixed

- Agent blocks no longer duplicate on repeated `ryo sync` runs
- `createSymlink` now handles upgrading from copy-based layout (removes existing files/directories)
- TOML generation escapes triple-quote sequences in agent body content

## [0.1.0] - 2026-03-16

### Added

- CLI commands: `init`, `generate agent`, `generate skill`, `generate process`
- Runtime support for Claude Code, Copilot, Cursor, Codex, Windsurf, and Gemini CLI
- Interactive prompts for guided setup and generation
- Template-based scaffolding with YAML configuration
- Context detection for existing project structures
- Comprehensive documentation (architecture, CLI reference, customization, schemas)

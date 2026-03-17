# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

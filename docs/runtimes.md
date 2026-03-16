# Runtime Integration

ryo-kit installs skills into 6 AI coding tools. Each runtime has its own conventions for where files go and how slash commands work.

## Supported Runtimes

| Runtime | Skills Location | Config File | Slash Commands |
|---------|----------------|-------------|----------------|
| Claude Code | `.claude/skills/ryo-*/SKILL.md` | `CLAUDE.md` | Native via skill frontmatter |
| Copilot | `.github/prompts/ryo-*.prompt.md` | `.github/copilot-instructions.md` | Native via prompt files |
| Cursor | `.cursor/rules/ryo-*.md` | `.cursorrules` | No — skills installed as rules |
| Codex | `skills/ryo-*/SKILL.md` | `AGENTS.md` | Native via skill files |
| Windsurf | `.windsurfrules` (appended sections) | Same file | No — skills installed as rules |
| Gemini CLI | `.gemini/skills/ryo-*/SKILL.md` | `GEMINI.md` | Native via skill files |

## How Installation Works

When you run `ryo init` or `ryo gen`, the CLI:

1. Creates a runtime instance for each AI tool you selected
2. Reads skill templates from the ryo-kit package's `templates/` directory
3. Calls `installSkill(name, content)` on each runtime to write the skill file
4. Calls `updateConfig(contextRef)` to add a reference block to the runtime's config file

The config file reference block is wrapped in HTML comment sentinels (`<!-- ryo-kit:start -->` / `<!-- ryo-kit:end -->`). This allows ryo-kit to update or remove its additions without affecting your existing config.

## Runtime Details

### Claude Code

Skills are installed as directories under `.claude/skills/`:

```
.claude/skills/
├── ryo-gen/
│   └── SKILL.md
├── ryo-help/
│   └── SKILL.md
└── ...
```

`CLAUDE.md` receives a reference block pointing to `.ryo/` context files. Skills use YAML frontmatter following the Agent Skills open standard.

For org-wide installation, skills go to `~/.claude/skills/`.

### GitHub Copilot

Skills are installed as prompt files in `.github/prompts/`:

```
.github/prompts/
├── ryo-gen.prompt.md
├── ryo-help.prompt.md
└── ...
```

`.github/copilot-instructions.md` receives a reference block. Users invoke skills by typing `/<name>` in the Copilot chat.

Copilot also supports custom agents in `.github/agents/` — ryo-kit can optionally generate agent profiles there.

### Cursor

Skills are installed as rule files in `.cursor/rules/`:

```
.cursor/rules/
├── ryo-gen.md
├── ryo-help.md
└── ...
```

`.cursorrules` receives a reference block. Cursor does not support native slash commands — users invoke skills by asking the AI to follow the relevant rule (e.g., "follow the ryo-gen rule").

### Codex

Skills are installed as directories under `skills/`:

```
skills/
├── ryo-gen/
│   └── SKILL.md
├── ryo-help/
│   └── SKILL.md
└── ...
```

`AGENTS.md` receives a reference block. Skills use native slash commands.

### Windsurf

Windsurf has no separate skills directory. All skills are appended as named sections to `.windsurfrules`:

```
<!-- ryo-kit:ryo-gen:start -->
[skill content]
<!-- ryo-kit:ryo-gen:end -->

<!-- ryo-kit:ryo-help:start -->
[skill content]
<!-- ryo-kit:ryo-help:end -->
```

Each skill gets its own sentinel pair. Users invoke skills by asking the AI to follow the relevant rule.

### Gemini CLI

Skills are installed as directories under `.gemini/skills/`:

```
.gemini/skills/
├── ryo-gen/
│   └── SKILL.md
├── ryo-help/
│   └── SKILL.md
└── ...
```

`GEMINI.md` receives a reference block. Skills use native slash commands.

## The Base Runtime Interface

All runtimes extend `BaseRuntime` in `src/runtimes/base.js`:

```javascript
class BaseRuntime {
  constructor(projectDir) { this.projectDir = projectDir; }
  get name()       // Runtime identifier (e.g., 'claude-code')
  get skillsDir()  // Where skills are stored
  get configFile() // Path to the runtime's config file

  async installSkill(skillName, skillContent)  // Write a skill file
  async updateConfig(contextRef)               // Add reference block to config
  async uninstall()                            // Remove all ryo-kit additions
}
```

Key behaviors:

- **Never clobber existing content.** Config updates append/merge. If a config file already exists, existing content is preserved.
- **Clean uninstall.** `uninstall()` removes only ryo-kit additions (files and config blocks), leaving user content untouched.
- **Sentinel blocks.** Config references use `<!-- ryo-kit:start -->` / `<!-- ryo-kit:end -->` markers for safe insertion and removal.

## Adding a New Runtime

See [CONTRIBUTING.md](../CONTRIBUTING.md) for instructions on extending `BaseRuntime`.

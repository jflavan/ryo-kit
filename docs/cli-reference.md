# CLI Reference

All commands are available via `npx ryo-kit <command>` or, if installed globally, `ryo <command>`.

Every command supports `-y` / `--yes` for non-interactive mode with sensible defaults.

## ryo init

Org-level setup. Runs the TUI interview, writes org context, and installs bootstrap skills.

```sh
npx ryo-kit init [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip interview, use defaults (solo dev, Claude Code, GitHub, no compliance, repo-only mode) |

**What it does:**

1. Runs the 12-step TUI interview (see [Getting Started](./getting-started.md))
2. Writes `org-context.yaml` and `constitution.md` to the chosen location:
   - **Org-wide mode:** `~/.ryo/` — shared across all repos. Also copies default templates to `~/.ryo/templates/`.
   - **Repo-only mode:** `.ryo/` in the current directory — local to this project.
3. Installs bootstrap skills (`/ryo-gen`, `/ryo-help`, etc.) into every selected AI runtime
4. Prints next-step instructions per runtime

**Example:**

```sh
# Interactive
npx ryo-kit init

# Non-interactive (CI, testing)
npx ryo-kit init --yes
```

## ryo gen

Project-level scaffold. Creates the `.ryo/` directory in the current repo and installs project skills.

```sh
npx ryo-kit gen [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip confirmation prompts |

**What it does:**

1. Reads `org-context.yaml` from `~/.ryo/` (org-wide) or `.ryo/` (repo-only)
2. Creates the `.ryo/` directory tree: `agents/`, `skills/`, `workflows/`, `.state/`, `.customize/`
3. Writes an empty `current-plan.md` stub in `.ryo/.state/`
4. Installs project-level skills into the runtimes listed in org context
5. Tells you to invoke `/ryo-gen` in your AI tool

**When to use:** After `ryo init` in org-wide mode, run this in each repo that needs a framework. In repo-only mode, `ryo init` already creates `.ryo/`.

## ryo evolve

Re-generates the framework from updated org context.

```sh
npx ryo-kit evolve [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip confirmation prompts |

**What it does:**

1. Re-reads `org-context.yaml`
2. Updates installed skill templates with latest versions from the package
3. Installs/updates the `/ryo-evolve` skill
4. Tells you to invoke `/ryo-evolve` in your AI tool

The actual framework re-generation happens in your AI tool when you run `/ryo-evolve`. The CLI just prepares the skill.

## ryo add

Add a single agent or skill definition.

```sh
npx ryo-kit add agent [options]
npx ryo-kit add skill [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip confirmation prompts |

**What it does:**

- `add agent` — installs the `/ryo-add-agent` skill and prints instructions
- `add skill` — installs the `/ryo-add-skill` skill and prints instructions

The actual creation is conversational and happens in your AI tool.

## ryo check

Validate framework files against schemas and check internal consistency.

```sh
npx ryo-kit check [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `--dir <path>` | Path to `.ryo/` directory (defaults to `.ryo/` in cwd) |

**What it does:**

1. Reads all `.agent.md` files from `agents/` — validates YAML frontmatter against AgentDefSchema
2. Reads all `SKILL.md` files from `skills/*/` — validates against SkillDefSchema
3. Reads all `.workflow.md` files from `workflows/` — validates against WorkflowDefSchema
4. Reads `process.md` if it exists — validates against ProcessDefSchema
5. Cross-reference checks:
   - Agents referenced in workflow steps must exist in `agents/`
   - Skills referenced in workflow steps must exist in `skills/`
   - Process phases referenced in workflow steps must exist in `process.md`
6. Reports errors with file paths

**This is purely deterministic** — no AI tool needed. Use it in CI to validate framework integrity.

**Example:**

```sh
npx ryo-kit check
npx ryo-kit check --dir ./my-project/.ryo
```

## ryo update

Pull the latest skill templates from the installed ryo-kit package.

```sh
npx ryo-kit update [options]
```

**Options:**

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip confirmation prompts |

**What it does:**

1. Compares installed skill versions against the package's templates
2. Updates all package-provided templates:
   - Bootstrap skills (`templates/bootstrap/`)
   - Sub-skills (`templates/sub-skills/`)
   - Core skills (`templates/core-skills/`)
   - Prompt fragments (`templates/fragments/`)
3. Reports what was updated
4. Does **not** touch generated content in `.ryo/` — only the meta-skills and templates shipped with the package

# Contributing to ryo-kit

Thank you for your interest in contributing. This guide covers development setup, project structure, and the conventions used throughout the codebase.

---

## Development setup

```sh
git clone https://github.com/jflavan/ryo-kit.git
cd ryo-kit
npm install
node --test
```

All tests use Node.js's built-in test runner. No test framework installation required. Node 20 or later is required.

To run tests in watch mode:

```sh
npm run test:watch
```

To test the CLI directly:

```sh
node bin/ryo.js --help
node bin/ryo.js init --yes
```

---

## Project structure

```
bin/
  ryo.js                  # npx entry point
src/
  cli/
    index.js              # Commander.js program definition
    commands/             # One file per CLI command (init, gen, evolve, sync, add, check, update)
    prompts/
      org-interview.js    # @clack/prompts TUI interview flow
  context/
    schema.js             # Zod schemas for all artifact types
    detector.js           # Auto-detects existing project artifacts
    writer.js             # Writes org-context.yaml and constitution.md
  scaffolder/
    directory.js          # Creates .ryo/ and .agents/ directory structure
    skill-writer.js       # Writes SKILL.md files to .agents/skills/ and installs into runtimes
    template-writer.js    # Writes agent/process templates
  runtimes/
    base.js               # BaseRuntime class — shared interface
    claude-code.js        # .claude/skills/ + .claude/agents/ (symlinks), CLAUDE.md
    copilot.js            # .github/skills/ + .github/agents/ (symlinks)
    cursor.js             # Auto-discovers .agents/skills/, AGENTS.md agent blocks
    codex.js              # Auto-discovers .agents/skills/, .codex/agents/ (TOML), AGENTS.md
    windsurf.js           # .windsurf/rules/ (copies), AGENTS.md agent blocks
    gemini-cli.js         # Auto-discovers .agents/skills/, GEMINI.md agent blocks
  utils/
    yaml.js               # YAML read/write helpers
    fs.js                 # File system helpers
    logger.js             # @clack/prompts-based logging
    symlink.js            # Cross-platform symlink creation and cleanup
    agent-block.js        # Managed agent blocks in Markdown config files
    toml-agent.js         # TOML agent file generation for Codex
templates/
  bootstrap/              # ryo-gen orchestrator skill
  sub-skills/             # agent-, skill-, process-, workflow-generation sub-skills
  core-skills/            # ryo-help, ryo-add-agent, ryo-add-skill, ryo-evolve, ryo-retro
  fragments/              # Shared prompt fragments (org-context-prompt, decision-tree, validation)
  defaults/               # Default constitution and base schema examples
test/
  *.test.js               # Unit tests
  integration/            # End-to-end CLI tests
  fixtures/               # Sample org contexts at three scales
```

---

## Adding a new runtime

All runtimes extend `BaseRuntime` in `src/runtimes/base.js`. To add a new runtime:

1. Create `src/runtimes/your-runtime.js` and extend `BaseRuntime`:

```js
import { BaseRuntime } from './base.js';
import path from 'node:path';

export class YourRuntime extends BaseRuntime {
  get skillsDir() {
    // Return the directory where skills should be symlinked/copied,
    // or null if the runtime auto-discovers from .agents/skills/
    return path.join(this.projectDir, '.your-tool', 'skills');
  }

  get agentsDir() {
    // Return the directory for agent symlinks, or null if using config blocks
    return path.join(this.projectDir, '.your-tool', 'agents');
  }

  get agentConfigFile() {
    // Return the config file path for agent blocks, or null if using symlinks
    return null;
  }

  async installSkill(skillName, canonicalSkillDir) {
    // Create a symlink from canonicalSkillDir to this.skillsDir/<skillName>
    // Or copy if symlinks aren't supported
    // No-op if the runtime auto-discovers from .agents/skills/
  }

  async installAgent(agentName, agentMeta) {
    // Create a symlink, write a TOML file, or upsert an agent block
  }

  async updateConfig(contextRef) {
    // Append a reference block to the runtime's config file
    // Must append/merge, never replace existing content
  }

  async uninstall() {
    // Remove only ryo-kit additions — leave user content untouched
  }
}
```

2. Add the runtime identifier to the `tools.ai` enum in `src/context/schema.js`.

3. Register the runtime in `src/cli/commands/init.js` where runtimes are instantiated from the org context.

4. Add tests in `test/runtimes.test.js` covering: install writes the right files, config update appends without clobbering, and uninstall removes only ryo-kit additions.

5. Add the runtime to the supported runtimes table in `README.md`.

---

## Modifying skill templates

Skill templates live in `templates/`. They are markdown files with optional YAML frontmatter. The template files are what get installed into the user's AI tool via `ryo init` and `ryo gen`.

Key files:

- `templates/bootstrap/ryo-gen.skill.md` — The orchestrator skill. Modify this to change how `/ryo-gen` loads context, handles resume, and sequences sub-skills.
- `templates/sub-skills/` — The four focused generation sub-skills. Each sub-skill is independently usable and maps to one phase of the plan written to `.ryo/.state/current-plan.md`.
- `templates/core-skills/` — The remaining slash commands: `/ryo-help`, `/ryo-add-agent`, `/ryo-add-skill`, `/ryo-evolve`, `/ryo-retro`.
- `templates/fragments/` — Shared prompt fragments included by reference in multiple skills. Changes here affect every skill that includes the fragment.

When modifying templates, verify that:
- YAML frontmatter (if present) is valid YAML
- Cross-references to other skills or fragments are still accurate
- The `test/skills.test.js` suite still passes (it validates frontmatter and required sections)

---

## Testing conventions

The project uses `node:test` (built into Node 20+) with zero test dependencies.

**File naming:** `*.test.js` for unit tests, `integration/*.test.js` for end-to-end tests.

**Temp directories:** Integration tests and any test that writes to the filesystem must create an isolated temp directory and clean it up in an `after` hook:

```js
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('my feature', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'ryo-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('does the thing', async () => {
    // use tmpDir
  });
});
```

**TDD:** New behavior should have a failing test first. Bug fixes should have a regression test that reproduces the bug before the fix is applied.

**Integration tests:** Use the `-y` flag to bypass TUI prompts. Use fixtures from `test/fixtures/` as input org contexts:

- `test/fixtures/solo-dev/` — solo developer, no compliance
- `test/fixtures/small-scrum/` — small scrum team, basic compliance
- `test/fixtures/enterprise-safe-hipaa/` — large org, SAFe, HIPAA + SOC 2

**What not to test:** Generator skill output (LLM-dependent), and actual AI tool behavior when running skills.

---

## Pull request process

1. Fork the repository and create a branch from `main`.
2. Add or update tests for any behavior changes.
3. Ensure `node --test` passes with no failures.
4. Keep commits focused. Use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `refactor:`).
5. Open a PR against `main` with a description of what changed and why.
6. PRs require at least one review before merge.

If you are adding a new runtime or modifying the schema, please include a note in the PR description explaining the design decision.

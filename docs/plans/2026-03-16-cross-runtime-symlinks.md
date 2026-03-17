# Cross-Runtime Symlink Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace content-copying runtime integration with symlinks from a single canonical location, fixing Copilot's broken `.github/prompts/` path and enabling all six coding tools to discover agents and skills natively.

**Architecture:** Skills move to `.agents/skills/*/SKILL.md` (auto-discovered by Cursor, Codex, Gemini CLI; symlinked for Claude Code, Copilot; copied for Windsurf). Agents stay at `.ryo/agents/*.agent.md` (symlinked for Claude Code, Copilot; TOML-generated for Codex; config-block for the rest). A new `ryo sync` command manages all linking.

**Tech Stack:** Node.js 20+, ESM modules, node:test runner, no new dependencies.

**Spec:** `docs/specs/2026-03-16-cross-runtime-symlink-design.md`

---

## Chunk 1: Foundation — Symlink Utilities and BaseRuntime Interface

### Task 1: Create cross-platform symlink helper

**Files:**
- Create: `src/utils/symlink.js`
- Create: `test/symlink.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// test/symlink.test.js
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readlink, lstat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

import { createSymlink, isRyoKitSymlink, removeRyoKitSymlinks } from '../src/utils/symlink.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-symlink-test-'));
}

describe('createSymlink', () => {
  let dir;

  beforeEach(async () => { dir = await makeTempDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('creates a file symlink to an existing file', async () => {
    const target = join(dir, 'target.md');
    const link = join(dir, 'link.md');
    await writeFile(target, 'content', 'utf8');
    await createSymlink(target, link);
    const stats = await lstat(link);
    assert.ok(stats.isSymbolicLink());
    const content = await readFile(link, 'utf8');
    assert.equal(content, 'content');
  });

  test('creates a directory symlink to an existing dir', async () => {
    const targetDir = join(dir, 'target-dir');
    await mkdir(targetDir);
    await writeFile(join(targetDir, 'SKILL.md'), 'skill', 'utf8');
    const link = join(dir, 'link-dir');
    await createSymlink(targetDir, link);
    const stats = await lstat(link);
    assert.ok(stats.isSymbolicLink());
    const content = await readFile(join(link, 'SKILL.md'), 'utf8');
    assert.equal(content, 'skill');
  });

  test('uses relative path for the symlink target', async () => {
    const subdir = join(dir, 'sub');
    await mkdir(subdir);
    const target = join(dir, 'target.md');
    const link = join(subdir, 'link.md');
    await writeFile(target, 'content', 'utf8');
    await createSymlink(target, link);
    const linkTarget = await readlink(link);
    assert.ok(!linkTarget.startsWith('/'), `Expected relative path, got: ${linkTarget}`);
  });

  test('replaces existing symlink without error', async () => {
    const target1 = join(dir, 'target1.md');
    const target2 = join(dir, 'target2.md');
    const link = join(dir, 'link.md');
    await writeFile(target1, 'old', 'utf8');
    await writeFile(target2, 'new', 'utf8');
    await createSymlink(target1, link);
    await createSymlink(target2, link);
    const content = await readFile(link, 'utf8');
    assert.equal(content, 'new');
  });

  test('creates parent directories if needed', async () => {
    const target = join(dir, 'target.md');
    const link = join(dir, 'deep', 'nested', 'link.md');
    await writeFile(target, 'content', 'utf8');
    await createSymlink(target, link);
    const content = await readFile(link, 'utf8');
    assert.equal(content, 'content');
  });
});

describe('isRyoKitSymlink', () => {
  let dir;

  beforeEach(async () => { dir = await makeTempDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('returns true for symlink pointing into .agents/skills/', async () => {
    const agentsDir = join(dir, '.agents', 'skills', 'ryo-gen');
    await mkdir(agentsDir, { recursive: true });
    await writeFile(join(agentsDir, 'SKILL.md'), 'content', 'utf8');
    const link = join(dir, '.claude', 'skills', 'ryo-gen');
    await mkdir(join(dir, '.claude', 'skills'), { recursive: true });
    await createSymlink(agentsDir, link);
    assert.ok(await isRyoKitSymlink(link));
  });

  test('returns true for symlink pointing into .ryo/agents/', async () => {
    const agentFile = join(dir, '.ryo', 'agents', 'builder.agent.md');
    await mkdir(join(dir, '.ryo', 'agents'), { recursive: true });
    await writeFile(agentFile, 'content', 'utf8');
    const link = join(dir, '.claude', 'agents', 'builder.md');
    await mkdir(join(dir, '.claude', 'agents'), { recursive: true });
    await createSymlink(agentFile, link);
    assert.ok(await isRyoKitSymlink(link));
  });

  test('returns false for regular file', async () => {
    const file = join(dir, 'regular.md');
    await writeFile(file, 'content', 'utf8');
    assert.ok(!(await isRyoKitSymlink(file)));
  });

  test('returns false for symlink pointing elsewhere', async () => {
    const target = join(dir, 'other', 'file.md');
    await mkdir(join(dir, 'other'), { recursive: true });
    await writeFile(target, 'content', 'utf8');
    const link = join(dir, 'link.md');
    await createSymlink(target, link);
    assert.ok(!(await isRyoKitSymlink(link)));
  });
});

describe('removeRyoKitSymlinks', () => {
  let dir;

  beforeEach(async () => { dir = await makeTempDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('removes ryo-kit symlinks from a directory', async () => {
    const agentsDir = join(dir, '.agents', 'skills', 'ryo-gen');
    await mkdir(agentsDir, { recursive: true });
    await writeFile(join(agentsDir, 'SKILL.md'), 'content', 'utf8');
    const skillsDir = join(dir, '.claude', 'skills');
    await mkdir(skillsDir, { recursive: true });
    await createSymlink(agentsDir, join(skillsDir, 'ryo-gen'));
    await removeRyoKitSymlinks(skillsDir);
    await assert.rejects(() => lstat(join(skillsDir, 'ryo-gen')));
  });

  test('preserves non-ryo-kit files and symlinks', async () => {
    const targetDir = join(dir, '.agents', 'skills', 'ryo-gen');
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'SKILL.md'), 'content', 'utf8');
    const skillsDir = join(dir, '.claude', 'skills');
    await mkdir(skillsDir, { recursive: true });
    await createSymlink(targetDir, join(skillsDir, 'ryo-gen'));
    await writeFile(join(skillsDir, 'user-file.md'), 'user', 'utf8');
    await removeRyoKitSymlinks(skillsDir);
    const content = await readFile(join(skillsDir, 'user-file.md'), 'utf8');
    assert.equal(content, 'user');
  });

  test('is safe when directory does not exist', async () => {
    await removeRyoKitSymlinks(join(dir, 'nonexistent'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/symlink.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/symlink.js
import { symlink, lstat, readlink, unlink, readdir } from 'node:fs/promises';
import { relative, dirname, resolve } from 'node:path';
import { ensureParentDir, exists } from './fs.js';

/**
 * Create a symlink from target to linkPath using a relative path.
 * Replaces existing symlinks. Creates parent directories.
 * Falls back to copy on Windows if symlinks unavailable.
 */
export async function createSymlink(target, linkPath) {
  await ensureParentDir(linkPath);

  // Remove existing symlink if present
  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink()) {
      await unlink(linkPath);
    }
  } catch { /* does not exist */ }

  const relTarget = relative(dirname(linkPath), target);
  const targetStat = await lstat(target);
  const isDir = targetStat.isDirectory();

  try {
    if (process.platform === 'win32' && isDir) {
      // Windows junctions require absolute paths
      await symlink(resolve(target), linkPath, 'junction');
    } else {
      await symlink(relTarget, linkPath, isDir ? 'dir' : 'file');
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'ENOTSUP') {
      // Windows fallback: copy instead
      const { cpSync } = await import('node:fs');
      cpSync(target, linkPath, { recursive: isDir });
    } else {
      throw err;
    }
  }
}

/**
 * Check if a path is a symlink created by ryo-kit (points into .agents/skills/ or .ryo/agents/).
 */
export async function isRyoKitSymlink(linkPath) {
  try {
    const stats = await lstat(linkPath);
    if (!stats.isSymbolicLink()) return false;
    const target = await readlink(linkPath);
    const resolvedTarget = resolve(dirname(linkPath), target);
    return resolvedTarget.includes('.agents/skills/') ||
           resolvedTarget.includes('.agents\\skills\\') ||
           resolvedTarget.includes('.ryo/agents/') ||
           resolvedTarget.includes('.ryo\\agents\\');
  } catch {
    return false;
  }
}

/**
 * Remove all ryo-kit-created symlinks from a directory.
 */
export async function removeRyoKitSymlinks(dirPath) {
  if (!await exists(dirPath)) return;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (await isRyoKitSymlink(fullPath)) {
      await unlink(fullPath);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/symlink.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/symlink.js test/symlink.test.js
git commit -m "feat: add cross-platform symlink utilities"
```

---

### Task 2: Update BaseRuntime interface

**Files:**
- Modify: `src/runtimes/base.js`

- [ ] **Step 1: Add `agentsDir` and `installAgent()` to base class**

```js
// src/runtimes/base.js — full replacement
export class BaseRuntime {
  constructor(projectDir) {
    this.projectDir = projectDir;
  }

  get name() { throw new Error('Not implemented'); }
  get skillsDir() { throw new Error('Not implemented'); }
  get agentsDir() { return null; }
  get configFile() { throw new Error('Not implemented'); }

  async installSkill(skillName, canonicalSkillDir) { throw new Error('Not implemented'); }
  async installAgent(agentName, agentMeta) { throw new Error('Not implemented'); }
  async updateConfig(contextRef) { throw new Error('Not implemented'); }
  async uninstall() { throw new Error('Not implemented'); }
}

export const RYO_BLOCK_START = '<!-- ryo-kit:start -->';
export const RYO_BLOCK_END = '<!-- ryo-kit:end -->';
```

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `node --test test/runtimes.test.js`
Expected: All 85 tests still PASS (agentsDir defaults to null, installAgent throws on call but isn't called yet)

- [ ] **Step 3: Commit**

```bash
git add src/runtimes/base.js
git commit -m "feat: add agentsDir and installAgent to BaseRuntime interface"
```

---

## Chunk 2: Scaffolder and Skill Writer Changes

### Task 3: Update scaffoldProjectDir to create `.agents/skills/` instead of `.ryo/skills/`

**Files:**
- Modify: `src/scaffolder/directory.js`
- Modify: `test/scaffolder.test.js`

- [ ] **Step 1: Update the test for `.ryo/skills/` to expect `.agents/skills/` instead**

In `test/scaffolder.test.js`, change the test at line 51-54:

```js
// Before:
test('creates .ryo/skills/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(ryoDir, 'skills')));
});

// After:
test('creates .agents/skills/ directory', async () => {
    await scaffoldProjectDir(ryoDir);
    assert.ok(await isDir(join(tmpBase, '.agents', 'skills')));
});
```

Also add a test for the marker file:

```js
test('creates .agents/.ryo-kit marker file', async () => {
    await scaffoldProjectDir(ryoDir);
    await access(join(tmpBase, '.agents', '.ryo-kit'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/scaffolder.test.js`
Expected: FAIL — `.agents/skills/` not created yet

- [ ] **Step 3: Update `scaffoldProjectDir` implementation**

In `src/scaffolder/directory.js`, the function currently receives `ryoDir` (path to `.ryo/`). It needs the `projectDir` (parent of `.ryo/`) to create `.agents/skills/`. Change the function signature to accept `projectDir` and derive `ryoDir` internally, OR pass both. The simplest change: derive `projectDir` from `ryoDir`:

```js
// src/scaffolder/directory.js
import { join, dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';

export async function scaffoldProjectDir(ryoDir) {
  const projectDir = dirname(ryoDir);

  // Core .ryo/ subdirectories
  const dirs = [
    join(ryoDir, 'agents'),
    join(ryoDir, 'workflows'),
    join(ryoDir, '.state'),
    join(ryoDir, '.state', 'history'),
    join(ryoDir, '.customize'),
  ];

  // Canonical skills location
  const agentsSkillsDir = join(projectDir, '.agents', 'skills');
  dirs.push(agentsSkillsDir);

  for (const dir of dirs) {
    await ensureDir(dir);
  }

  // Marker file for conflict detection
  await writeFile(join(projectDir, '.agents', '.ryo-kit'), '', 'utf8');

  // Stub files
  await writeFile(join(ryoDir, '.state', 'current-plan.md'), '', 'utf8');

  await writeFile(
    join(ryoDir, '.customize', 'README.md'),
    [
      '# .customize/',
      '',
      'Place your customizations here. Files in this directory are preserved when',
      'the framework is re-generated via `ryo evolve`.',
      '',
      'When a re-generation would overwrite a file you have customized, ryo-kit',
      'will warn you and ask how to resolve the conflict.',
      '',
    ].join('\n'),
    'utf8',
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/scaffolder.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/scaffolder/directory.js test/scaffolder.test.js
git commit -m "feat: scaffold .agents/skills/ instead of .ryo/skills/"
```

---

### Task 4: Update skill-writer to write canonical skills and remove prefix stripping

**Files:**
- Modify: `src/scaffolder/skill-writer.js`
- Modify: `test/scaffolder.test.js`

- [ ] **Step 1: Update test expectations**

The `installSkillsForRuntimes` tests in `test/scaffolder.test.js` (lines 192-217) currently just verify no errors. Add a test that verifies skills land in `.agents/skills/`:

```js
test('writes bootstrap skills to .agents/skills/', async () => {
  await installSkillsForRuntimes(tmpBase, ['claude-code']);
  // ryo-gen is a bootstrap skill
  const skillPath = join(tmpBase, '.agents', 'skills', 'ryo-gen', 'SKILL.md');
  await access(skillPath);
  const content = await readFile(skillPath, 'utf8');
  assert.ok(content.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scaffolder.test.js --test-name-pattern='writes bootstrap'`
Expected: FAIL

- [ ] **Step 3: Update `installSkillsForRuntimes` in `src/scaffolder/skill-writer.js`**

Key changes:
1. Remove the `ryo-` prefix stripping (lines 59-62)
2. Write to `.agents/skills/{name}/SKILL.md` as canonical location
3. Then call each runtime's `installSkill` with the canonical dir path

```js
// src/scaffolder/skill-writer.js — full replacement
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, writeFile } from 'node:fs/promises';
import { readIfExists, exists, ensureDir } from '../utils/fs.js';
import { ClaudeCodeRuntime } from '../runtimes/claude-code.js';
import { CopilotRuntime } from '../runtimes/copilot.js';
import { CursorRuntime } from '../runtimes/cursor.js';
import { CodexRuntime } from '../runtimes/codex.js';
import { WindsurfRuntime } from '../runtimes/windsurf.js';
import { GeminiCliRuntime } from '../runtimes/gemini-cli.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

export function getRuntimeForName(name, projectDir) {
  switch (name) {
    case 'claude-code': return new ClaudeCodeRuntime(projectDir);
    case 'copilot':     return new CopilotRuntime(projectDir);
    case 'cursor':      return new CursorRuntime(projectDir);
    case 'codex':       return new CodexRuntime(projectDir);
    case 'windsurf':    return new WindsurfRuntime(projectDir);
    case 'gemini-cli':  return new GeminiCliRuntime(projectDir);
    default: throw new Error(`Unknown runtime: ${name}`);
  }
}

export async function installSkillsForRuntimes(projectDir, runtimeNames) {
  const runtimes = runtimeNames.map(name => getRuntimeForName(name, projectDir));

  const skillSets = [
    join(TEMPLATES_DIR, 'bootstrap'),
    join(TEMPLATES_DIR, 'core-skills'),
  ];

  const canonicalSkillsDir = join(projectDir, '.agents', 'skills');

  for (const skillSetDir of skillSets) {
    if (!await exists(skillSetDir)) continue;

    const entries = await readdir(skillSetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = join(skillSetDir, entry.name);
      const content = await readIfExists(filePath);
      if (content === null) continue;

      // Derive skill name: ryo-gen.skill.md -> ryo-gen (keep ryo- prefix)
      const skillName = entry.name
        .replace(/\.skill\.md$/, '')
        .replace(/\.md$/, '');

      // Write to canonical location
      const skillDir = join(canonicalSkillsDir, skillName);
      await ensureDir(skillDir);
      await writeFile(join(skillDir, 'SKILL.md'), content, 'utf8');

      // Install into each runtime
      for (const runtime of runtimes) {
        await runtime.installSkill(skillName, skillDir);
      }
    }
  }
}
```

**IMPORTANT: Sequencing note.** This changes `installSkill`'s second argument from `skillContent` (string) to `canonicalSkillDir` (path). All six runtime implementations must be updated in the same commit or the test suite will break. Do NOT commit this task until Tasks 5-9 (all runtime rewrites) are also complete. Commit them together as a single atomic change. If working incrementally, keep changes unstaged until all runtimes are updated.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scaffolder.test.js --test-name-pattern='writes bootstrap'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scaffolder/skill-writer.js test/scaffolder.test.js
git commit -m "feat: write canonical skills to .agents/skills/, remove prefix stripping"
```

---

## Chunk 3: Runtime Implementations — Symlink Runtimes (Claude Code, Copilot)

### Task 5: Rewrite ClaudeCodeRuntime for symlinks

**Files:**
- Modify: `src/runtimes/claude-code.js`
- Modify: `test/runtimes.test.js` (Claude Code section, lines 23-117)

- [ ] **Step 1: Rewrite Claude Code tests for symlink behavior**

Replace the Claude Code test section. Key changes:
- `installSkill` now receives `(skillName, canonicalSkillDir)` and creates a directory symlink
- New `installAgent` method creates a file symlink
- `agentsDir` returns `.claude/agents`
- `uninstall` removes symlinks instead of directories

```js
// Replace ClaudeCodeRuntime describe block in test/runtimes.test.js
describe('ClaudeCodeRuntime', () => {
  let dir;
  let runtime;

  beforeEach(async () => {
    dir = await makeTempDir();
    runtime = new ClaudeCodeRuntime(dir);
    // Set up canonical locations
    await mkdir(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), SKILL_CONTENT, 'utf8');
    await mkdir(join(dir, '.ryo', 'agents'), { recursive: true });
    await writeFile(join(dir, '.ryo', 'agents', 'builder.agent.md'), '# Builder', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('name returns "claude-code"', () => {
    assert.equal(runtime.name, 'claude-code');
  });

  test('skillsDir points to .claude/skills', () => {
    assert.equal(runtime.skillsDir, join(dir, '.claude', 'skills'));
  });

  test('agentsDir points to .claude/agents', () => {
    assert.equal(runtime.agentsDir, join(dir, '.claude', 'agents'));
  });

  test('configFile points to CLAUDE.md', () => {
    assert.equal(runtime.configFile, join(dir, 'CLAUDE.md'));
  });

  test('installSkill creates directory symlink', async () => {
    const canonicalDir = join(dir, '.agents', 'skills', 'ryo-gen');
    await runtime.installSkill('ryo-gen', canonicalDir);
    const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
    const content = await readFile(join(linkPath, 'SKILL.md'), 'utf8');
    assert.equal(content, SKILL_CONTENT);
  });

  test('installAgent creates file symlink', async () => {
    await runtime.installAgent('builder', {
      name: 'builder',
      description: 'Builds things',
      body: '# Builder',
    });
    const linkPath = join(dir, '.claude', 'agents', 'builder.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  // ... keep existing updateConfig tests unchanged ...

  test('uninstall removes ryo-kit symlinks from skills and agents', async () => {
    const canonicalDir = join(dir, '.agents', 'skills', 'ryo-gen');
    await runtime.installSkill('ryo-gen', canonicalDir);
    await runtime.installAgent('builder', { name: 'builder', description: 'test', body: '' });
    await runtime.uninstall();
    await assert.rejects(() => access(join(dir, '.claude', 'skills', 'ryo-gen')));
    await assert.rejects(() => access(join(dir, '.claude', 'agents', 'builder.md')));
  });

  test('uninstall is safe when no skills or config exist', async () => {
    await runtime.uninstall();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/runtimes.test.js --test-name-pattern='ClaudeCode'`
Expected: FAIL

- [ ] **Step 3: Rewrite `src/runtimes/claude-code.js`**

```js
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { BaseRuntime, RYO_BLOCK_START, RYO_BLOCK_END } from './base.js';
import { ensureDir, ensureParentDir, readIfExists, exists } from '../utils/fs.js';
import { createSymlink, removeRyoKitSymlinks } from '../utils/symlink.js';

export class ClaudeCodeRuntime extends BaseRuntime {
  get name() { return 'claude-code'; }

  get skillsDir() {
    return join(this.projectDir, '.claude', 'skills');
  }

  get agentsDir() {
    return join(this.projectDir, '.claude', 'agents');
  }

  get configFile() {
    return join(this.projectDir, 'CLAUDE.md');
  }

  async installSkill(skillName, canonicalSkillDir) {
    const linkPath = join(this.skillsDir, skillName);
    await createSymlink(canonicalSkillDir, linkPath);
  }

  async installAgent(agentName, agentMeta) {
    const canonicalPath = join(this.projectDir, '.ryo', 'agents', `${agentName}.agent.md`);
    const linkPath = join(this.agentsDir, `${agentName}.md`);
    await createSymlink(canonicalPath, linkPath);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeRyoKitSymlinks(this.skillsDir);
    await removeRyoKitSymlinks(this.agentsDir);
    await removeRyoBlock(this.configFile);
  }
}

// ---- Shared helpers (unchanged) ----

export async function upsertRyoBlock(configFile, contextRef) {
  await ensureParentDir(configFile);
  const existing = await readIfExists(configFile) ?? '';
  const block = `${RYO_BLOCK_START}\n${contextRef}\n${RYO_BLOCK_END}`;

  if (existing.includes(RYO_BLOCK_START)) {
    const replaced = existing.replace(
      new RegExp(`${escapeRegex(RYO_BLOCK_START)}[\\s\\S]*?${escapeRegex(RYO_BLOCK_END)}`),
      block,
    );
    await writeFile(configFile, replaced, 'utf8');
  } else {
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
    await writeFile(configFile, existing + separator + block + '\n', 'utf8');
  }
}

export async function removeRyoBlock(configFile) {
  if (!await exists(configFile)) return;
  const content = await readFile(configFile, 'utf8');
  if (!content.includes(RYO_BLOCK_START)) return;
  const cleaned = content
    .replace(
      new RegExp(`\\n?${escapeRegex(RYO_BLOCK_START)}[\\s\\S]*?${escapeRegex(RYO_BLOCK_END)}\\n?`),
      '',
    )
    .trimEnd();
  await writeFile(configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/runtimes.test.js --test-name-pattern='ClaudeCode'`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtimes/claude-code.js test/runtimes.test.js
git commit -m "feat: rewrite ClaudeCodeRuntime to use symlinks"
```

---

### Task 6: Rewrite CopilotRuntime for symlinks

**Files:**
- Modify: `src/runtimes/copilot.js`
- Modify: `test/runtimes.test.js` (Copilot section, lines 119-191)

- [ ] **Step 1: Rewrite Copilot tests**

Replace the Copilot test section. Key changes:
- `skillsDir` now points to `.github/skills` (was `.github/prompts`)
- `installSkill` creates directory symlinks (not flat `.prompt.md` files)
- New `installAgent`, `agentsDir`
- `uninstall` removes symlinks

Tests should mirror the Claude Code pattern but with `.github/skills/` and `.github/agents/` paths, and `.agent.md` extension for agent symlink names.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/runtimes.test.js --test-name-pattern='Copilot'`
Expected: FAIL

- [ ] **Step 3: Rewrite `src/runtimes/copilot.js`**

```js
import { join } from 'node:path';
import { BaseRuntime } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { createSymlink, removeRyoKitSymlinks } from '../utils/symlink.js';

export class CopilotRuntime extends BaseRuntime {
  get name() { return 'copilot'; }

  get skillsDir() {
    return join(this.projectDir, '.github', 'skills');
  }

  get agentsDir() {
    return join(this.projectDir, '.github', 'agents');
  }

  get configFile() {
    return join(this.projectDir, '.github', 'copilot-instructions.md');
  }

  async installSkill(skillName, canonicalSkillDir) {
    const linkPath = join(this.skillsDir, skillName);
    await createSymlink(canonicalSkillDir, linkPath);
  }

  async installAgent(agentName, agentMeta) {
    const canonicalPath = join(this.projectDir, '.ryo', 'agents', `${agentName}.agent.md`);
    const linkPath = join(this.agentsDir, `${agentName}.agent.md`);
    await createSymlink(canonicalPath, linkPath);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeRyoKitSymlinks(this.skillsDir);
    await removeRyoKitSymlinks(this.agentsDir);
    await removeRyoBlock(this.configFile);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/runtimes.test.js --test-name-pattern='Copilot'`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtimes/copilot.js test/runtimes.test.js
git commit -m "feat: rewrite CopilotRuntime with symlinks to .github/skills/ and .github/agents/"
```

---

## Chunk 4: Runtime Implementations — Auto-Discovery and Config-Block Runtimes

### Task 7: Update Cursor, Codex, and Gemini CLI runtimes (auto-discovery skills, config-block agents)

**Files:**
- Modify: `src/runtimes/cursor.js`
- Modify: `src/runtimes/codex.js`
- Modify: `src/runtimes/gemini-cli.js`
- Modify: `test/runtimes.test.js` (Cursor, Codex, Gemini CLI sections)

- [ ] **Step 1: Update tests for all three runtimes**

For each:
- `installSkill` becomes a no-op (skills auto-discovered from `.agents/skills/`)
- `skillsDir` returns `null` (no runtime-specific skills dir needed)
- `installAgent` upserts a sentinel block in the config file (`AGENTS.md` for Cursor/Codex, `GEMINI.md` for Gemini CLI)
- `agentsDir` returns `null`
- `uninstall` removes sentinel blocks from config files

Key test additions for each:

```js
test('installSkill is a no-op (auto-discovery)', async () => {
  // Should not throw, should not create files
  await runtime.installSkill('ryo-gen', join(dir, '.agents', 'skills', 'ryo-gen'));
  // No runtime-specific skill directory should be created
});

test('installAgent upserts agent block in config file', async () => {
  await runtime.installAgent('builder', {
    name: 'builder',
    role: 'Code Builder',
    description: 'Builds things',
    responsibilities: ['implement code'],
    handoff_to: ['reviewer'],
    body: '# Builder',
  });
  const content = await readFile(runtime.configFile, 'utf8');
  assert.ok(content.includes('<!-- ryo-kit:agents:start -->'));
  assert.ok(content.includes('builder'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/runtimes.test.js --test-name-pattern='Cursor|Codex|GeminiCli'`
Expected: FAIL

- [ ] **Step 3: Implement the three runtimes**

For Cursor (`src/runtimes/cursor.js`):
```js
import { join } from 'node:path';
import { BaseRuntime } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';

export class CursorRuntime extends BaseRuntime {
  get name() { return 'cursor'; }
  get skillsDir() { return null; }  // auto-discovery from .agents/skills/
  get agentsDir() { return null; }
  get configFile() { return join(this.projectDir, '.cursorrules'); }
  get agentConfigFile() { return join(this.projectDir, 'AGENTS.md'); }

  async installSkill(_skillName, _canonicalSkillDir) { /* no-op */ }

  async installAgent(agentName, agentMeta) {
    await upsertAgentBlock(this.agentConfigFile, agentMeta);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeAgentBlock(this.agentConfigFile);
    await removeRyoBlock(this.configFile);
  }
}
```

Codex and Gemini CLI follow the same pattern, with different `configFile`/`agentConfigFile` paths. Codex also needs `installAgent` to generate TOML (Task 8).

- [ ] **Step 4: Create `src/utils/agent-block.js`** for shared agent config block helpers

```js
// src/utils/agent-block.js
import { writeFile } from 'node:fs/promises';
import { ensureParentDir, readIfExists } from './fs.js';

const AGENT_BLOCK_START = '<!-- ryo-kit:agents:start -->';
const AGENT_BLOCK_END = '<!-- ryo-kit:agents:end -->';

export { AGENT_BLOCK_START, AGENT_BLOCK_END };

export function formatAgentBlock(agentMeta) {
  const { name, role, description, responsibilities = [], handoff_to = [] } = agentMeta;
  const lines = [
    `### ${name}${role ? ` — ${role}` : ''}`,
    '',
    description,
    '',
  ];
  if (responsibilities.length) {
    lines.push('**Responsibilities:**');
    for (const r of responsibilities) lines.push(`- ${r}`);
    lines.push('');
  }
  if (handoff_to.length) {
    lines.push(`**Hands off to:** ${handoff_to.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function upsertAgentBlock(configFile, agentMeta) {
  await ensureParentDir(configFile);
  const existing = await readIfExists(configFile) ?? '';

  // Build new block content — if there's an existing block, append this agent to it
  let existingAgents = '';
  if (existing.includes(AGENT_BLOCK_START)) {
    const match = existing.match(
      new RegExp(`${escapeRegex(AGENT_BLOCK_START)}\\n([\\s\\S]*?)\\n${escapeRegex(AGENT_BLOCK_END)}`)
    );
    if (match) existingAgents = match[1];
  }

  const agentSection = formatAgentBlock(agentMeta);
  const allAgents = existingAgents
    ? `${existingAgents}\n${agentSection}`
    : agentSection;

  const block = `${AGENT_BLOCK_START}\n# ryo-kit Agents\n\n${allAgents}\n${AGENT_BLOCK_END}`;

  if (existing.includes(AGENT_BLOCK_START)) {
    const replaced = existing.replace(
      new RegExp(`${escapeRegex(AGENT_BLOCK_START)}[\\s\\S]*?${escapeRegex(AGENT_BLOCK_END)}`),
      block,
    );
    await writeFile(configFile, replaced, 'utf8');
  } else {
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
    await writeFile(configFile, existing + separator + block + '\n', 'utf8');
  }
}

export async function removeAgentBlock(configFile) {
  const content = await readIfExists(configFile);
  if (!content || !content.includes(AGENT_BLOCK_START)) return;
  const cleaned = content
    .replace(
      new RegExp(`\\n?${escapeRegex(AGENT_BLOCK_START)}[\\s\\S]*?${escapeRegex(AGENT_BLOCK_END)}\\n?`),
      '',
    )
    .trimEnd();
  await writeFile(configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/runtimes.test.js --test-name-pattern='Cursor|Codex|GeminiCli'`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/runtimes/cursor.js src/runtimes/codex.js src/runtimes/gemini-cli.js src/utils/agent-block.js test/runtimes.test.js
git commit -m "feat: update Cursor, Codex, Gemini CLI for auto-discovery skills and config-block agents"
```

---

### Task 8: Add Codex TOML agent generation

**Files:**
- Modify: `src/runtimes/codex.js`
- Create: `src/utils/toml-agent.js`
- Create: `test/toml-agent.test.js`

- [ ] **Step 1: Write failing tests for TOML generation**

```js
// test/toml-agent.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agentMetaToToml } from '../src/utils/toml-agent.js';

describe('agentMetaToToml', () => {
  test('produces valid TOML with sentinel comment', () => {
    const toml = agentMetaToToml({
      name: 'builder',
      description: 'Builds code',
      body: '# Builder\n\n## Role\nBuilds things.',
    });
    assert.ok(toml.startsWith('# Generated by ryo-kit from'));
    assert.ok(toml.includes('name = "builder"'));
    assert.ok(toml.includes('description = "Builds code"'));
    assert.ok(toml.includes('developer_instructions'));
    assert.ok(toml.includes('# Builder'));
  });

  test('escapes quotes in description', () => {
    const toml = agentMetaToToml({
      name: 'test',
      description: 'Does "things"',
      body: 'body',
    });
    assert.ok(toml.includes('Does \\"things\\"'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/toml-agent.test.js`
Expected: FAIL

- [ ] **Step 3: Implement TOML generator**

```js
// src/utils/toml-agent.js
const SENTINEL = '# Generated by ryo-kit from';

export function agentMetaToToml(agentMeta) {
  const { name, description, body = '' } = agentMeta;
  const escapedDesc = description.replace(/"/g, '\\"');
  return [
    `${SENTINEL} .ryo/agents/${name}.agent.md`,
    `name = "${name}"`,
    `description = "${escapedDesc}"`,
    '',
    `developer_instructions = """`,
    body,
    `"""`,
    '',
  ].join('\n');
}

export function isRyoKitToml(content) {
  return content.startsWith(SENTINEL);
}
```

- [ ] **Step 4: Update Codex `installAgent` to write TOML**

In `src/runtimes/codex.js`, the `installAgent` method should call `agentMetaToToml` and write to `.codex/agents/{name}.toml`.

- [ ] **Step 5: Run all tests**

Run: `node --test test/toml-agent.test.js test/runtimes.test.js`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/toml-agent.js src/runtimes/codex.js test/toml-agent.test.js
git commit -m "feat: add Codex TOML agent generation"
```

---

### Task 9: Rewrite WindsurfRuntime

**Files:**
- Modify: `src/runtimes/windsurf.js`
- Modify: `test/runtimes.test.js` (Windsurf section)

- [ ] **Step 1: Update Windsurf tests**

Key changes:
- `skillsDir` now points to `.windsurf/rules` (was `null`)
- `configFile` stays `.windsurfrules` for backward compat during migration
- `installSkill` copies content to `.windsurf/rules/{name}.md` with `trigger: model_decision` frontmatter transform
- `installAgent` upserts agent block in `AGENTS.md`

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/runtimes.test.js --test-name-pattern='Windsurf'`
Expected: FAIL

- [ ] **Step 3: Implement new WindsurfRuntime**

```js
// src/runtimes/windsurf.js
import { join } from 'node:path';
import { writeFile, readFile, unlink, readdir } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureDir, readIfExists, exists } from '../utils/fs.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';

export class WindsurfRuntime extends BaseRuntime {
  get name() { return 'windsurf'; }

  get skillsDir() {
    return join(this.projectDir, '.windsurf', 'rules');
  }

  get agentsDir() { return null; }

  get configFile() {
    return join(this.projectDir, '.windsurfrules'); // legacy, kept for migration
  }

  get agentConfigFile() {
    return join(this.projectDir, 'AGENTS.md');
  }

  async installSkill(skillName, canonicalSkillDir) {
    await ensureDir(this.skillsDir);
    // Read canonical SKILL.md
    const content = await readFile(join(canonicalSkillDir, 'SKILL.md'), 'utf8');
    // Transform frontmatter: replace ryo-kit trigger with Windsurf trigger
    const transformed = transformForWindsurf(content);
    await writeFile(join(this.skillsDir, `${skillName}.md`), transformed, 'utf8');
  }

  async installAgent(agentName, agentMeta) {
    await upsertAgentBlock(this.agentConfigFile, agentMeta);
  }

  async updateConfig(_contextRef) { /* no-op */ }

  async uninstall() {
    // Remove .windsurf/rules/ ryo-kit files
    if (await exists(this.skillsDir)) {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = join(this.skillsDir, entry.name);
          const content = await readIfExists(filePath);
          if (content && content.includes('trigger: model_decision')) {
            await unlink(filePath);
          }
        }
      }
    }
    // Remove agent block from AGENTS.md
    await removeAgentBlock(this.agentConfigFile);
    // Legacy cleanup: remove ryo-kit blocks from .windsurfrules
    await removeLegacyWindsurfBlocks(this.configFile);
  }
}

function transformForWindsurf(content) {
  // Replace ryo-kit frontmatter trigger (a description string) with
  // Windsurf's trigger enum value
  return content.replace(
    /^(---\n[\s\S]*?)trigger:\s*[^\n]+/m,
    '$1trigger: model_decision',
  );
}

async function removeLegacyWindsurfBlocks(configFile) {
  if (!await exists(configFile)) return;
  const content = await readIfExists(configFile) ?? '';
  const cleaned = content
    .replace(/\n?<!-- ryo-kit:[^:]+:start -->[\s\S]*?<!-- ryo-kit:[^:]+:end -->\n?/g, '')
    .trimEnd();
  await writeFile(configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/runtimes.test.js --test-name-pattern='Windsurf'`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/runtimes/windsurf.js test/runtimes.test.js
git commit -m "feat: rewrite WindsurfRuntime with .windsurf/rules/ and agent config blocks"
```

---

## Chunk 5: The `ryo sync` Command

### Task 10: Create the sync command

**Files:**
- Create: `src/cli/commands/sync.js`
- Modify: `src/cli/index.js`
- Create: `test/sync.test.js`

- [ ] **Step 1: Write failing tests for sync**

```js
// test/sync.test.js — test the core syncAction logic
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, lstat, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import YAML from 'yaml';

import { syncAction } from '../src/cli/commands/sync.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-sync-test-'));
}

describe('syncAction', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
    // Set up minimal org context with claude-code and copilot
    await mkdir(join(dir, '.ryo'), { recursive: true });
    await writeFile(
      join(dir, '.ryo', 'org-context.yaml'),
      YAML.stringify({
        tools: { ai: ['claude-code', 'copilot'], scm: 'github' },
        methodology: 'scrum',
        stack: { languages: ['js'], frameworks: [], cloud: 'none' },
        team: { size: 'solo' },
        compliance: [],
      }),
      'utf8',
    );
    // Set up canonical skill
    await mkdir(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');
    await writeFile(join(dir, '.agents', '.ryo-kit'), '', 'utf8');
    // Set up canonical agent
    await mkdir(join(dir, '.ryo', 'agents'), { recursive: true });
    await writeFile(
      join(dir, '.ryo', 'agents', 'builder.agent.md'),
      '---\nname: builder\ndescription: Builds things\n---\n# Builder',
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('creates skill symlinks for claude-code', async () => {
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('creates skill symlinks for copilot', async () => {
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.github', 'skills', 'ryo-gen');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('creates agent symlinks for claude-code', async () => {
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.claude', 'agents', 'builder.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('creates agent symlinks for copilot', async () => {
    await syncAction({ projectDir: dir });
    const linkPath = join(dir, '.github', 'agents', 'builder.agent.md');
    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('aborts if org-context.yaml is missing', async () => {
    await rm(join(dir, '.ryo', 'org-context.yaml'));
    await assert.rejects(
      () => syncAction({ projectDir: dir }),
      /org context/i,
    );
  });

  test('is idempotent — running twice works', async () => {
    await syncAction({ projectDir: dir });
    await syncAction({ projectDir: dir });
    const stats = await lstat(join(dir, '.claude', 'skills', 'ryo-gen'));
    assert.ok(stats.isSymbolicLink());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/sync.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `syncAction`**

```js
// src/cli/commands/sync.js
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { exists, readIfExists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { getRuntimeForName } from '../../scaffolder/skill-writer.js';
import { parseFrontmatter } from '../../context/schema.js';

export function registerSync(program) {
  program
    .command('sync')
    .description('Sync agents and skills to all configured coding tool runtimes')
    .option('--force', 'overwrite even if .agents/ was not created by ryo-kit')
    .action(async (options) => {
      await syncAction({ projectDir: process.cwd(), force: !!options.force });
    });
}

export async function syncAction({ projectDir, force } = {}) {
  // 1. Read org context
  const contextPath = join(projectDir, '.ryo', 'org-context.yaml');
  if (!await exists(contextPath)) {
    throw new Error('No org context found. Run `ryo init` first.');
  }
  const orgContext = await readYaml(contextPath);
  const runtimeNames = orgContext?.tools?.ai ?? [];

  // 2. Conflict detection
  const agentsDir = join(projectDir, '.agents');
  const markerPath = join(agentsDir, '.ryo-kit');
  if (await exists(agentsDir) && !await exists(markerPath) && !force) {
    throw new Error(
      '.agents/ directory exists but was not created by ryo-kit. Use --force to overwrite.',
    );
  }

  // 3. Scan canonical skills
  const canonicalSkillsDir = join(projectDir, '.agents', 'skills');
  const skillNames = [];
  if (await exists(canonicalSkillsDir)) {
    const entries = await readdir(canonicalSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) skillNames.push(entry.name);
    }
  }

  // 4. Scan canonical agents
  const canonicalAgentsDir = join(projectDir, '.ryo', 'agents');
  const agentFiles = [];
  if (await exists(canonicalAgentsDir)) {
    const entries = await readdir(canonicalAgentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.agent.md')) {
        const content = await readIfExists(join(canonicalAgentsDir, entry.name));
        const { data, content: body } = parseFrontmatter(content);
        agentFiles.push({
          fileName: entry.name,
          name: data.name || entry.name.replace('.agent.md', ''),
          ...data,
          body,
        });
      }
    }
  }

  // 5. Sync to each runtime
  const runtimes = runtimeNames.map(name => getRuntimeForName(name, projectDir));

  for (const runtime of runtimes) {
    // Skills
    for (const skillName of skillNames) {
      const canonicalDir = join(canonicalSkillsDir, skillName);
      await runtime.installSkill(skillName, canonicalDir);
    }

    // Agents
    for (const agent of agentFiles) {
      await runtime.installAgent(agent.name, agent);
    }
  }
}
```

- [ ] **Step 4: Register the command in `src/cli/index.js`**

Add `import { registerSync } from './commands/sync.js';` and `registerSync(program);` alongside the other command registrations.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/sync.test.js`
Expected: All PASS

- [ ] **Step 6: Run ALL runtime and scaffolder tests**

Run: `node --test test/runtimes.test.js test/scaffolder.test.js test/sync.test.js test/symlink.test.js test/toml-agent.test.js`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/sync.js src/cli/index.js test/sync.test.js
git commit -m "feat: add ryo sync command"
```

---

## Chunk 6: Template Updates and Integration

### Task 11: Update all template files to use `.agents/skills/` paths

**Files:**
- Modify: `templates/bootstrap/ryo-gen.skill.md`
- Modify: `templates/sub-skills/skill-generation.skill.md`
- Modify: `templates/core-skills/ryo-help.skill.md`
- Modify: `templates/core-skills/ryo-add-skill.skill.md`
- Modify: `templates/core-skills/ryo-evolve.skill.md`

- [ ] **Step 1: Find all `.ryo/skills/` references in templates**

Run: `grep -rn '.ryo/skills/' templates/`

- [ ] **Step 2: Replace `.ryo/skills/` with `.agents/skills/` in all template files**

In each file, replace every occurrence of `.ryo/skills/` with `.agents/skills/`.

- [ ] **Step 3: Add sync step to ryo-gen.skill.md orchestrator**

At the end of the orchestrator's final phase, add:

```markdown
## Phase 6: Sync to Coding Tools

After all agents, skills, processes, and workflows are generated, run the sync command to link them to your coding tools:

```
npx ryo-kit sync
```

This creates symlinks and configuration so all your coding tools (Claude Code, Copilot, Cursor, etc.) can discover the generated agents and skills natively.
```

- [ ] **Step 4: Verify no `.ryo/skills/` references remain in templates**

Run: `grep -rn '.ryo/skills/' templates/`
Expected: No matches

- [ ] **Step 5: Commit**

```bash
git add templates/
git commit -m "feat: update all templates to use .agents/skills/ and add sync step"
```

---

### Task 12: Wire sync into gen command

**Files:**
- Modify: `src/cli/commands/gen.js`

- [ ] **Step 1: Import syncAction and call it after skill installation**

In `src/cli/commands/gen.js`, after the `installSkillsForRuntimes` call (line 80), add a call to `syncAction`:

```js
import { syncAction } from './sync.js';

// ... inside genAction, after installSkillsForRuntimes:
s.start('Syncing agents and skills to runtimes…');
try {
  await syncAction({ projectDir, force: true });
  s.stop('Runtime sync complete.');
} catch (err) {
  s.stop('Sync encountered an error.');
  p.log.warn(String(err));
}
```

- [ ] **Step 2: Run the gen integration test**

Run: `node --test test/integration/gen.test.js`
Expected: PASS (or pre-existing failures unrelated to this change)

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/gen.js
git commit -m "feat: wire ryo sync into gen command"
```

---

## Chunk 7: Migration, Cleanup, and Polish

### Task 13: Add stale symlink cleanup to sync

**Files:**
- Modify: `src/cli/commands/sync.js`
- Modify: `test/sync.test.js`

- [ ] **Step 1: Add test for stale symlink cleanup**

```js
test('removes stale symlinks when canonical skill is deleted', async () => {
  // First sync creates symlinks
  await syncAction({ projectDir: dir });
  const linkPath = join(dir, '.claude', 'skills', 'ryo-gen');
  const stats = await lstat(linkPath);
  assert.ok(stats.isSymbolicLink());

  // Delete canonical skill
  await rm(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true, force: true });

  // Re-sync should remove dangling symlink
  await syncAction({ projectDir: dir });
  await assert.rejects(() => lstat(linkPath));
});
```

- [ ] **Step 2: Add cleanup logic to syncAction**

Before creating new links for each runtime, call `removeRyoKitSymlinks` on its `skillsDir` and `agentsDir` (if non-null):

```js
for (const runtime of runtimes) {
  // Clean stale symlinks first
  if (runtime.skillsDir) {
    await removeRyoKitSymlinks(runtime.skillsDir);
  }
  if (runtime.agentsDir) {
    await removeRyoKitSymlinks(runtime.agentsDir);
  }

  // Then create fresh links
  // ... existing skill/agent loops ...
}
```

- [ ] **Step 3: Run tests**

Run: `node --test test/sync.test.js`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/sync.js test/sync.test.js
git commit -m "feat: add stale symlink cleanup to ryo sync"
```

---

### Task 14: Wire sync into evolve command

**Files:**
- Modify: `src/cli/commands/evolve.js`

- [ ] **Step 1: Add syncAction call after installSkillsForRuntimes**

Same pattern as Task 12 for gen.js. Import `syncAction` from `./sync.js` and call it after the skill installation step.

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/evolve.js
git commit -m "feat: wire ryo sync into evolve command"
```

---

### Task 15: Migration logic in sync

**Files:**
- Modify: `src/cli/commands/sync.js`
- Modify: `test/sync.test.js`

- [ ] **Step 1: Add migration tests**

```js
describe('syncAction migration', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
    await mkdir(join(dir, '.ryo'), { recursive: true });
    await writeFile(
      join(dir, '.ryo', 'org-context.yaml'),
      YAML.stringify({
        tools: { ai: ['claude-code', 'copilot'], scm: 'github' },
        methodology: 'scrum',
        stack: { languages: ['js'], frameworks: [], cloud: 'none' },
        team: { size: 'solo' },
        compliance: [],
      }),
      'utf8',
    );
    await mkdir(join(dir, '.ryo', 'agents'), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('migrates .ryo/skills/ to .agents/skills/', async () => {
    await mkdir(join(dir, '.ryo', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.ryo', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');
    await syncAction({ projectDir: dir, force: true });
    const content = await readFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), 'utf8');
    assert.equal(content, '# Gen');
    // Old location should be gone
    assert.ok(!(await exists(join(dir, '.ryo', 'skills', 'ryo-gen'))));
  });

  test('removes old .github/prompts/ryo-*.prompt.md files', async () => {
    await mkdir(join(dir, '.github', 'prompts'), { recursive: true });
    await writeFile(join(dir, '.github', 'prompts', 'ryo-gen.prompt.md'), '# Gen', 'utf8');
    await mkdir(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');
    await writeFile(join(dir, '.agents', '.ryo-kit'), '', 'utf8');
    await syncAction({ projectDir: dir });
    assert.ok(!(await exists(join(dir, '.github', 'prompts', 'ryo-gen.prompt.md'))));
  });

  test('removes old root-level skills/ryo-* directories (Codex)', async () => {
    await mkdir(join(dir, 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');
    await mkdir(join(dir, '.agents', 'skills', 'ryo-gen'), { recursive: true });
    await writeFile(join(dir, '.agents', 'skills', 'ryo-gen', 'SKILL.md'), '# Gen', 'utf8');
    await writeFile(join(dir, '.agents', '.ryo-kit'), '', 'utf8');
    await syncAction({ projectDir: dir });
    assert.ok(!(await exists(join(dir, 'skills', 'ryo-gen'))));
  });
});
```

- [ ] **Step 2: Implement migration function**

Add a `migrateOldLayout(projectDir)` function called at the start of `syncAction`:

```js
async function migrateOldLayout(projectDir) {
  const migrations = [];

  // 1. Move .ryo/skills/ -> .agents/skills/
  const oldSkillsDir = join(projectDir, '.ryo', 'skills');
  const newSkillsDir = join(projectDir, '.agents', 'skills');
  if (await exists(oldSkillsDir) && !(await exists(newSkillsDir))) {
    await ensureDir(dirname(newSkillsDir));
    const { rename } = await import('node:fs/promises');
    await rename(oldSkillsDir, newSkillsDir);
    await writeFile(join(projectDir, '.agents', '.ryo-kit'), '', 'utf8');
    migrations.push('Moved .ryo/skills/ → .agents/skills/');
  }

  // 2. Remove old .github/prompts/ryo-*.prompt.md
  const oldPromptsDir = join(projectDir, '.github', 'prompts');
  if (await exists(oldPromptsDir)) {
    const entries = await readdir(oldPromptsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('ryo-') && entry.name.endsWith('.prompt.md')) {
        await unlink(join(oldPromptsDir, entry.name));
        migrations.push(`Removed old Copilot prompt: ${entry.name}`);
      }
    }
  }

  // 3. Remove old root-level skills/ryo-* (Codex)
  const oldCodexSkills = join(projectDir, 'skills');
  if (await exists(oldCodexSkills)) {
    const entries = await readdir(oldCodexSkills, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('ryo-')) {
        await rm(join(oldCodexSkills, entry.name), { recursive: true, force: true });
        migrations.push(`Removed old Codex skill dir: skills/${entry.name}`);
      }
    }
  }

  // 4. Migrate .windsurfrules blocks (handled by WindsurfRuntime.uninstall legacy cleanup)

  return migrations;
}
```

- [ ] **Step 3: Run tests**

Run: `node --test test/sync.test.js`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/sync.js test/sync.test.js
git commit -m "feat: add migration logic for old layout in ryo sync"
```

---

### Task 16: Update remaining template files

**Files:**
- Modify: `templates/core-skills/ryo-add-agent.skill.md`
- Modify: `templates/core-skills/ryo-retro.skill.md`

- [ ] **Step 1: Check for `.ryo/skills/` references**

Run: `grep -rn '.ryo/skills/' templates/`

- [ ] **Step 2: Replace any remaining `.ryo/skills/` references with `.agents/skills/`**

- [ ] **Step 3: Commit**

```bash
git add templates/
git commit -m "feat: update remaining templates to use .agents/skills/"
```

---

### Task 17: Add unit tests for agent-block.js

**Files:**
- Create: `test/agent-block.test.js`

- [ ] **Step 1: Write tests**

```js
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import {
  formatAgentBlock, upsertAgentBlock, removeAgentBlock,
  AGENT_BLOCK_START, AGENT_BLOCK_END,
} from '../src/utils/agent-block.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-agent-block-test-'));
}

describe('formatAgentBlock', () => {
  test('formats agent with role and responsibilities', () => {
    const block = formatAgentBlock({
      name: 'builder',
      role: 'Code Builder',
      description: 'Builds things',
      responsibilities: ['write code', 'run tests'],
      handoff_to: ['reviewer'],
    });
    assert.ok(block.includes('### builder — Code Builder'));
    assert.ok(block.includes('Builds things'));
    assert.ok(block.includes('- write code'));
    assert.ok(block.includes('**Hands off to:** reviewer'));
  });
});

describe('upsertAgentBlock', () => {
  let dir;
  beforeEach(async () => { dir = await makeTempDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('creates config file with agent block', async () => {
    const file = join(dir, 'AGENTS.md');
    await upsertAgentBlock(file, { name: 'builder', description: 'test' });
    const content = await readFile(file, 'utf8');
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('builder'));
    assert.ok(content.includes(AGENT_BLOCK_END));
  });

  test('appends to existing agent block', async () => {
    const file = join(dir, 'AGENTS.md');
    await upsertAgentBlock(file, { name: 'builder', description: 'builds' });
    await upsertAgentBlock(file, { name: 'reviewer', description: 'reviews' });
    const content = await readFile(file, 'utf8');
    assert.ok(content.includes('builder'));
    assert.ok(content.includes('reviewer'));
  });

  test('does not clobber existing content', async () => {
    const file = join(dir, 'AGENTS.md');
    await writeFile(file, '# My Agents\n\nExisting content.\n', 'utf8');
    await upsertAgentBlock(file, { name: 'builder', description: 'test' });
    const content = await readFile(file, 'utf8');
    assert.ok(content.includes('Existing content.'));
    assert.ok(content.includes(AGENT_BLOCK_START));
  });
});

describe('removeAgentBlock', () => {
  let dir;
  beforeEach(async () => { dir = await makeTempDir(); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  test('removes agent block', async () => {
    const file = join(dir, 'AGENTS.md');
    await writeFile(file, '# Keep\n', 'utf8');
    await upsertAgentBlock(file, { name: 'builder', description: 'test' });
    await removeAgentBlock(file);
    const content = await readFile(file, 'utf8');
    assert.ok(!content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('Keep'));
  });

  test('is safe when file does not exist', async () => {
    await removeAgentBlock(join(dir, 'nonexistent.md'));
  });
});
```

- [ ] **Step 2: Run tests**

Run: `node --test test/agent-block.test.js`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add test/agent-block.test.js
git commit -m "test: add unit tests for agent-block utilities"
```

---

### Task 18: Clean up dead code

**Files:**
- Modify: `src/runtimes/claude-code.js`

- [ ] **Step 1: Remove `removeRyoSkillDirs` export** (no longer imported by any runtime)

- [ ] **Step 2: Run all tests to verify nothing depends on it**

Run: `node --test test/runtimes.test.js test/scaffolder.test.js test/sync.test.js test/symlink.test.js test/toml-agent.test.js test/agent-block.test.js`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/runtimes/claude-code.js
git commit -m "chore: remove dead removeRyoSkillDirs function"
```

---

### Task 19: Fix sync to check org-wide context

**Files:**
- Modify: `src/cli/commands/sync.js`

- [ ] **Step 1: Update syncAction to check `~/.ryo/org-context.yaml` as fallback**

Match the same precedence chain used by `gen.js`:

```js
import { homedir } from 'node:os';

// In syncAction:
const orgWideContextPath = join(homedir(), '.ryo', 'org-context.yaml');
const repoContextPath = join(projectDir, '.ryo', 'org-context.yaml');
let contextPath;
if (await exists(repoContextPath)) {
  contextPath = repoContextPath;
} else if (await exists(orgWideContextPath)) {
  contextPath = orgWideContextPath;
} else {
  throw new Error('No org context found. Run `ryo init` first.');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/sync.js
git commit -m "fix: sync checks org-wide context as fallback"
```

---

### Task 20: Final integration test — all tests green

**This is the final task.**

- [ ] **Step 1: Run all tests**

Run: `node --test test/runtimes.test.js test/scaffolder.test.js test/sync.test.js test/symlink.test.js test/toml-agent.test.js`
Expected: All PASS

- [ ] **Step 2: Run the full test suite to check for regressions**

Run: `npm test`
Expected: No new failures beyond the 8 pre-existing ones

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup and integration"
```

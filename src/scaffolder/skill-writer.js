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

/**
 * Returns the correct runtime instance for a given runtime name.
 *
 * @param {string} name - Runtime name (e.g. 'claude-code').
 * @param {string} projectDir - Absolute path to the project directory.
 * @returns {import('../runtimes/base.js').BaseRuntime}
 */
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

/**
 * Install bootstrap and core skills into the given runtimes.
 *
 * Skills are written to the canonical .agents/skills/{name}/SKILL.md location,
 * then each runtime's installSkill is called with the canonical directory path.
 *
 * @param {string} projectDir - Absolute path to the project directory.
 * @param {string[]} runtimeNames - Array of runtime names to install into.
 */
export async function installSkillsForRuntimes(projectDir, runtimeNames) {
  const runtimes = runtimeNames.map(name => getRuntimeForName(name, projectDir));

  const skillSets = [
    join(TEMPLATES_DIR, 'bootstrap'),
    join(TEMPLATES_DIR, 'core-skills'),
  ];

  for (const skillSetDir of skillSets) {
    if (!await exists(skillSetDir)) continue;

    const entries = await readdir(skillSetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = join(skillSetDir, entry.name);
      const content = await readIfExists(filePath);
      if (content === null) continue;

      // Keep the full name (e.g., ryo-gen not gen)
      const skillName = entry.name
        .replace(/\.skill\.md$/, '')
        .replace(/\.md$/, '');

      // Write to canonical location
      const canonicalDir = join(projectDir, '.agents', 'skills', skillName);
      await ensureDir(canonicalDir);
      await writeFile(join(canonicalDir, 'SKILL.md'), content, 'utf8');

      for (const runtime of runtimes) {
        await runtime.installSkill(skillName, canonicalDir);
      }
    }
  }
}

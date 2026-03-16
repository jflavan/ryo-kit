import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { exists } from '../utils/fs.js';

// Map of artifact paths (relative to projectDir) to runtimes they indicate
const RUNTIME_ARTIFACTS = [
  { path: 'CLAUDE.md', runtime: 'claude-code' },
  { path: '.claude', runtime: 'claude-code' },
  { path: '.cursorrules', runtime: 'cursor' },
  { path: '.cursor', runtime: 'cursor' },
  { path: '.github/copilot-instructions.md', runtime: 'copilot' },
  { path: '.github/prompts', runtime: 'copilot' },
  { path: 'AGENTS.md', runtime: 'codex' },
  { path: '.windsurfrules', runtime: 'windsurf' },
  { path: 'GEMINI.md', runtime: 'gemini-cli' },
  { path: '.gemini', runtime: 'gemini-cli' },
];

// Map of artifact paths (relative to projectDir) to languages they indicate
const LANGUAGE_ARTIFACTS = [
  { path: 'package.json', language: 'javascript' },
  { path: 'tsconfig.json', language: 'typescript' },
  { path: 'requirements.txt', language: 'python' },
  { path: 'pyproject.toml', language: 'python' },
  { path: 'go.mod', language: 'go' },
  { path: 'Cargo.toml', language: 'rust' },
  { path: 'pom.xml', language: 'java' },
  { path: 'build.gradle', language: 'java' },
  { path: 'Gemfile', language: 'ruby' },
];

// Glob-style patterns matched via readdir
const GLOB_LANGUAGE_PATTERNS = [
  { suffix: '.csproj', language: 'csharp' },
  { suffix: '.sln', language: 'csharp' },
];

/**
 * Detect project context from the given project directory.
 *
 * @param {string} projectDir - Absolute path to the project directory.
 * @returns {Promise<{ existing: string[], runtimes: string[], languages: string[] }>}
 */
export async function detectProjectContext(projectDir) {
  const existing = [];
  const runtimes = new Set();
  const languages = new Set();

  // Check runtime artifacts
  for (const { path, runtime } of RUNTIME_ARTIFACTS) {
    const fullPath = join(projectDir, path);
    if (await exists(fullPath)) {
      existing.push(path);
      runtimes.add(runtime);
    }
  }

  // Check language artifacts
  for (const { path, language } of LANGUAGE_ARTIFACTS) {
    const fullPath = join(projectDir, path);
    if (await exists(fullPath)) {
      if (!existing.includes(path)) {
        existing.push(path);
      }
      languages.add(language);
    }
  }

  // Check glob patterns via readdir
  let entries = [];
  try {
    entries = await readdir(projectDir);
  } catch {
    // Non-existent or unreadable directory — skip
  }

  for (const entry of entries) {
    for (const { suffix, language } of GLOB_LANGUAGE_PATTERNS) {
      if (entry.endsWith(suffix)) {
        if (!existing.includes(entry)) {
          existing.push(entry);
        }
        languages.add(language);
      }
    }
  }

  return {
    existing,
    runtimes: Array.from(runtimes),
    languages: Array.from(languages),
  };
}

import { join } from 'node:path';
import { homedir } from 'node:os';
import { readIfExists } from '../utils/fs.js';
import { ConstitutionSchema, parseFrontmatter } from '../context/schema.js';

/**
 * Locate constitution.md: repo-local `.ryo/` first, then org-wide `~/.ryo/`.
 * Returns null when neither exists.
 */
export async function findConstitution(projectDir, home = homedir()) {
  const candidates = [
    join(projectDir, '.ryo', 'constitution.md'),
    join(home, '.ryo', 'constitution.md'),
  ];
  for (const path of candidates) {
    const content = await readIfExists(path);
    if (content !== null) return { path, content };
  }
  return null;
}

/**
 * Parse constitution.md into { rules, principles, issues }.
 * `rules` is the validated frontmatter (empty object if none),
 * `principles` is the prose body, `issues` lists schema violations.
 */
export function parseConstitution(content) {
  const { data, content: principles } = parseFrontmatter(content);
  const result = ConstitutionSchema.safeParse(data);
  if (result.success) return { rules: result.data, principles, issues: [] };
  return {
    rules: {},
    principles,
    issues: result.error.issues.map(i => `${i.path.join('.') || 'root'}: ${i.message}`),
  };
}

export async function loadConstitution(projectDir, home) {
  const found = await findConstitution(projectDir, home);
  if (!found) return { path: null, rules: {}, principles: '', issues: [] };
  return { path: found.path, ...parseConstitution(found.content) };
}

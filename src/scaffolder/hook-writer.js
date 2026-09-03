import { join, dirname, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { copyFile, chmod, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ensureDir } from '../utils/fs.js';
import { loadConstitution } from '../governance/constitution.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_TEMPLATE_DIR = join(__dirname, '..', '..', 'templates', 'hooks');

export const SESSION_START_HOOK = 'session-start.js';
export const GUARD_HOOK = 'guard.js';
export const POLICY_FILE = 'policy.json';

/** Project-relative hook paths, as registered with runtimes. */
export const HOOK_PATHS = {
  sessionStart: join('.ryo', 'hooks', SESSION_START_HOOK),
  guard: join('.ryo', 'hooks', GUARD_HOOK),
};

export function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compile the constitution's enforceable rules into a plain JSON policy the
 * dependency-free guard hook can read. Returns the policy object.
 */
/**
 * Portable form of the constitution path: project-relative when inside the
 * project, `~/…` for the org-wide location. Absolute paths would break
 * `ryo check` for teammates on other machines.
 */
export function portableSource(path, projectDir, home = homedir()) {
  if (!path) return null;
  const rel = relative(projectDir, path);
  if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel.split('\\').join('/');
  const relHome = relative(home, path);
  if (relHome && !relHome.startsWith('..') && !isAbsolute(relHome)) return '~/' + relHome.split('\\').join('/');
  return path;
}

export function resolveSource(source, projectDir, home = homedir()) {
  if (!source) return null;
  if (source.startsWith('~/')) return join(home, source.slice(2));
  return isAbsolute(source) ? source : join(projectDir, source);
}

export async function compilePolicy(projectDir, home) {
  const constitution = await loadConstitution(projectDir, home);
  return {
    generated_by: 'ryo sync',
    source: portableSource(constitution.path, projectDir, home),
    source_hash: constitution.path ? hashContent(constitution.raw ?? '') : null,
    protected_branches: constitution.rules.protected_branches ?? [],
    forbidden_paths: constitution.rules.forbidden_paths ?? [],
    stop_conditions: constitution.rules.stop_conditions ?? [],
  };
}

/**
 * Copy the dependency-free hook scripts into <project>/.ryo/hooks/, compile
 * the policy, and ask each runtime to register the hooks. Runtimes without
 * hook support are no-ops.
 *
 * @param {string} projectDir
 * @param {import('../runtimes/base.js').BaseRuntime[]} runtimes
 * @param {{ home?: string }} [opts]
 */
export async function installHooksForRuntimes(projectDir, runtimes, { home } = {}) {
  const hooksDir = join(projectDir, '.ryo', 'hooks');
  await ensureDir(hooksDir);

  for (const name of [SESSION_START_HOOK, GUARD_HOOK]) {
    const dest = join(hooksDir, name);
    await copyFile(join(HOOKS_TEMPLATE_DIR, name), dest);
    try { await chmod(dest, 0o755); } catch { /* best effort on non-POSIX */ }
  }

  const policy = await compilePolicy(projectDir, home);
  await writeFile(join(hooksDir, POLICY_FILE), JSON.stringify(policy, null, 2) + '\n', 'utf8');

  for (const runtime of runtimes) {
    await runtime.installHooks(HOOK_PATHS);
  }
  return policy;
}

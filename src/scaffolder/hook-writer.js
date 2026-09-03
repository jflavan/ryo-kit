import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, chmod } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_TEMPLATE_DIR = join(__dirname, '..', '..', 'templates', 'hooks');

export const SESSION_START_HOOK = 'session-start.js';

/**
 * Copy the dependency-free hook scripts into <project>/.ryo/hooks/ and ask
 * each runtime to register them. Runtimes without hook support are no-ops.
 *
 * @param {string} projectDir
 * @param {import('../runtimes/base.js').BaseRuntime[]} runtimes
 */
export async function installHooksForRuntimes(projectDir, runtimes) {
  const hooksDir = join(projectDir, '.ryo', 'hooks');
  await ensureDir(hooksDir);
  const dest = join(hooksDir, SESSION_START_HOOK);
  await copyFile(join(HOOKS_TEMPLATE_DIR, SESSION_START_HOOK), dest);
  try { await chmod(dest, 0o755); } catch { /* best effort on non-POSIX */ }

  for (const runtime of runtimes) {
    await runtime.installHooks(join('.ryo', 'hooks', SESSION_START_HOOK));
  }
}

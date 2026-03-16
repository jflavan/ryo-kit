import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULTS_DIR = join(__dirname, '..', '..', 'templates', 'defaults');

/**
 * Copies agent-base.yaml and process-base.yaml from the package's
 * templates/defaults/ into targetDir/templates/.
 *
 * @param {string} targetDir - Base directory; files go into targetDir/templates/.
 */
export async function writeDefaultTemplates(targetDir) {
  const outDir = join(targetDir, 'templates');
  await ensureDir(outDir);

  await copyFile(
    join(DEFAULTS_DIR, 'agent-base.yaml'),
    join(outDir, 'agent-base.yaml'),
  );

  await copyFile(
    join(DEFAULTS_DIR, 'process-base.yaml'),
    join(outDir, 'process-base.yaml'),
  );
}

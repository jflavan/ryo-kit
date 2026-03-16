import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';

/**
 * Creates the full .ryo/ directory tree under ryoDir.
 *
 * @param {string} ryoDir - Absolute path to the .ryo/ directory to scaffold.
 */
export async function scaffoldProjectDir(ryoDir) {
  // Core subdirectories
  const dirs = [
    join(ryoDir, 'agents'),
    join(ryoDir, 'skills'),
    join(ryoDir, 'workflows'),
    join(ryoDir, '.state'),
    join(ryoDir, '.state', 'history'),
    join(ryoDir, '.customize'),
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }

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

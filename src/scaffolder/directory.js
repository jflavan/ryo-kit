import { join, dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../utils/fs.js';

/**
 * Creates the full .ryo/ directory tree under ryoDir,
 * plus the shared .agents/skills/ canonical location.
 *
 * @param {string} ryoDir - Absolute path to the .ryo/ directory to scaffold.
 */
export async function scaffoldProjectDir(ryoDir) {
  const projectDir = dirname(ryoDir);

  // Core subdirectories inside .ryo/
  const dirs = [
    join(ryoDir, 'agents'),
    join(ryoDir, 'workflows'),
    join(ryoDir, '.state'),
    join(ryoDir, '.state', 'history'),
    join(ryoDir, '.customize'),
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }

  // Shared canonical skills directory
  await ensureDir(join(projectDir, '.agents', 'skills'));

  // Marker file so tools can detect ryo-kit presence
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

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readdir, copyFile } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { exists, ensureDir, readIfExists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');

/**
 * Register the `ryo update` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerUpdate(program) {
  program
    .command('update')
    .description('Pull latest skill templates from the package')
    .option('-y, --yes', 'non-interactive mode')
    .action(async (options) => {
      await updateAction({ yes: !!options.yes, projectDir: process.cwd() });
    });
}

/**
 * Core update logic, separated for testability.
 *
 * @param {{ yes: boolean, projectDir: string }} opts
 * @returns {Promise<string[]>} List of updated file paths (relative)
 */
export async function updateAction({ yes, projectDir } = {}) {
  const ryoDir = join(projectDir, '.ryo');
  const updated = [];

  const templateSubdirs = ['bootstrap', 'sub-skills', 'core-skills', 'fragments'];
  const s = p.spinner();
  s.start('Updating skill templates from package…');

  for (const subdir of templateSubdirs) {
    const srcDir = join(PACKAGE_TEMPLATES_DIR, subdir);
    if (!await exists(srcDir)) continue;

    let entries = [];
    try {
      entries = await readdir(srcDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const srcFile = join(srcDir, entry.name);
      // Templates go to .ryo/skills/ryo-<name>/ for each skill template
      // For fragments, they go to .ryo/.state/ as reference copies
      // We write them to <ryoDir>/.ryo-templates/<subdir>/ as cached copies
      const destDir = join(ryoDir, '.ryo-templates', subdir);
      await ensureDir(destDir);
      const destFile = join(destDir, entry.name);

      try {
        await copyFile(srcFile, destFile);
        updated.push(join(subdir, entry.name));
      } catch (err) {
        p.log.warn(`Could not update ${join(subdir, entry.name)}: ${err.message}`);
      }
    }
  }

  // Refresh installed hook scripts in place — they are copies, not symlinks.
  const installedHooksDir = join(ryoDir, 'hooks');
  const hooksSrcDir = join(PACKAGE_TEMPLATES_DIR, 'hooks');
  if (await exists(installedHooksDir) && await exists(hooksSrcDir)) {
    for (const entry of await readdir(hooksSrcDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!await exists(join(installedHooksDir, entry.name))) continue;
      try {
        await copyFile(join(hooksSrcDir, entry.name), join(installedHooksDir, entry.name));
        updated.push(join('hooks', entry.name));
      } catch (err) {
        p.log.warn(`Could not update hooks/${entry.name}: ${err.message}`);
      }
    }
  }

  s.stop('Template update complete.');

  if (updated.length === 0) {
    p.log.info('No templates found to update. (Template directories may be empty.)');
  } else {
    p.log.success(`Updated ${updated.length} template(s):`);
    for (const f of updated) {
      p.log.info(`  ${f}`);
    }
  }

  p.outro(
    'Template cache refreshed.\n\n' +
    'Note: This updates the package template copies. Your generated .ryo/ content\n' +
    'is not modified. Run `ryo evolve` to re-generate the framework with updated templates.',
  );

  return updated;
}

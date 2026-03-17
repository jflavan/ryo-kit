import { join } from 'node:path';
import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { exists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { installSkillsForRuntimes } from '../../scaffolder/skill-writer.js';
import { syncAction } from './sync.js';

/**
 * Register the `ryo evolve` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerEvolve(program) {
  program
    .command('evolve')
    .description('Re-generate framework from updated org context')
    .option('-y, --yes', 'non-interactive mode — accept all defaults')
    .action(async (options) => {
      await evolveAction({ yes: !!options.yes, projectDir: process.cwd() });
    });
}

/**
 * Core evolve logic, separated for testability.
 *
 * @param {{ yes: boolean, projectDir: string }} opts
 */
export async function evolveAction({ yes, projectDir } = {}) {
  // 1. Re-read org context (org-wide first, repo-only fallback)
  const orgWideContextPath = join(homedir(), '.ryo', 'org-context.yaml');
  const repoContextPath = join(projectDir, '.ryo', 'org-context.yaml');

  let contextPath;
  if (await exists(orgWideContextPath)) {
    contextPath = orgWideContextPath;
  } else if (await exists(repoContextPath)) {
    contextPath = repoContextPath;
  } else {
    p.log.error(
      'No org context found. Run `ryo init` first to create one at ~/.ryo/ or .ryo/.',
    );
    process.exit(1);
  }

  let orgContext;
  try {
    orgContext = await readYaml(contextPath);
  } catch (err) {
    p.log.error(`Failed to read org context: ${err.message}`);
    process.exit(1);
  }

  const runtimeNames = orgContext?.tools?.ai ?? [];
  const s = p.spinner();

  // 2. Update installed skill templates (re-install bootstrap + core skills)
  if (runtimeNames.length > 0) {
    s.start(`Updating skill templates for: ${runtimeNames.join(', ')}…`);
    try {
      await installSkillsForRuntimes(projectDir, runtimeNames);
      s.stop('Skill templates updated.');
    } catch (err) {
      s.stop('Failed to update skill templates.');
      p.log.warn(String(err));
    }
  }

  // 3. Sync agents and skills to runtimes
  s.start('Syncing agents and skills to runtimes…');
  try {
    await syncAction({ projectDir, force: true });
    s.stop('Runtime sync complete.');
  } catch (err) {
    s.stop('Sync encountered an error.');
    p.log.warn(String(err));
  }

  // 4. Tell user to run /ryo-evolve
  p.outro(
    'Skill templates updated.\n\n' +
    'Next step: open your AI tool and invoke /ryo-evolve\n' +
    '  This will re-generate your framework with the updated org context,\n' +
    '  preserving customizations in .ryo/.customize/.',
  );
}

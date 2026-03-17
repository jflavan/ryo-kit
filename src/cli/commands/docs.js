import { join } from 'node:path';
import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { exists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { installSkillsForRuntimes } from '../../scaffolder/skill-writer.js';
import { syncAction } from './sync.js';

/**
 * Register the `ryo docs` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerDocs(program) {
  program
    .command('docs')
    .description('Install documentation mode for agent-driven doc generation')
    .option('-y, --yes', 'non-interactive mode — accept all defaults')
    .action(async (options) => {
      await docsAction({ yes: !!options.yes, projectDir: process.cwd() });
    });
}

/**
 * Core docs logic, separated for testability.
 *
 * Installs the docs skill template to detected runtimes, then syncs.
 * This is the same pattern as `ryo conference` — install skills + sync.
 *
 * @param {{ yes: boolean, projectDir: string, repoOnly?: boolean }} opts
 */
export async function docsAction({ yes, projectDir, repoOnly } = {}) {
  const orgWideContextPath = join(homedir(), '.ryo', 'org-context.yaml');
  const repoContextPath = join(projectDir, '.ryo', 'org-context.yaml');

  let contextPath;
  if (repoOnly) {
    contextPath = repoContextPath;
  } else if (await exists(orgWideContextPath)) {
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

  if (runtimeNames.length > 0) {
    s.start(`Installing documentation mode for: ${runtimeNames.join(', ')}…`);
    try {
      await installSkillsForRuntimes(projectDir, runtimeNames);
      s.stop('Documentation mode installed.');
    } catch (err) {
      s.stop('Failed to install documentation mode.');
      p.log.warn(String(err));
    }

    s.start('Syncing skills to runtimes…');
    try {
      await syncAction({ projectDir, force: true });
      s.stop('Runtime sync complete.');
    } catch (err) {
      s.stop('Sync encountered an error.');
      p.log.warn(String(err));
    }
  } else {
    p.log.warn('No AI runtimes configured in org context. Nothing to install.');
  }

  p.outro(
    'Documentation mode ready.\n\n' +
    'Next step: open your AI tool and invoke /ryo-docs\n' +
    '  This starts an interactive session where your agents analyze\n' +
    '  the codebase and generate targeted documentation.',
  );
}

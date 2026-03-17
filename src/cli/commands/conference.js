import { join } from 'node:path';
import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { exists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { installSkillsForRuntimes } from '../../scaffolder/skill-writer.js';
import { syncAction } from './sync.js';

/**
 * Register the `ryo conference` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerConference(program) {
  program
    .command('conference')
    .description('Install conference mode skill for multi-agent discussions')
    .option('-y, --yes', 'non-interactive mode — accept all defaults')
    .action(async (options) => {
      await conferenceAction({ yes: !!options.yes, projectDir: process.cwd() });
    });
}

/**
 * Core conference logic, separated for testability.
 *
 * Installs the conference skill template to detected runtimes, then syncs.
 * This is the same pattern as `ryo evolve` — install skills + sync.
 *
 * @param {{ yes: boolean, projectDir: string, repoOnly?: boolean }} opts
 */
export async function conferenceAction({ yes, projectDir, repoOnly } = {}) {
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
    s.start(`Installing conference mode for: ${runtimeNames.join(', ')}…`);
    try {
      await installSkillsForRuntimes(projectDir, runtimeNames);
      s.stop('Conference mode installed.');
    } catch (err) {
      s.stop('Failed to install conference mode.');
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
    'Conference mode ready.\n\n' +
    'Next step: open your AI tool and invoke /ryo-conference\n' +
    '  This starts a multi-agent discussion session where your agents\n' +
    '  collaborate on topics from their unique perspectives.',
  );
}

import { join } from 'node:path';
import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { exists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { installSkillsForRuntimes } from '../../scaffolder/skill-writer.js';

/**
 * Register the `ryo add` command (with subcommands) on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerAdd(program) {
  const add = program
    .command('add')
    .description('Add a single new agent or skill definition');

  add
    .command('agent')
    .description('Install ryo-add-agent skill and print next steps')
    .option('-y, --yes', 'non-interactive mode')
    .action(async (options) => {
      await addAction({ yes: !!options.yes, projectDir: process.cwd(), type: 'agent' });
    });

  add
    .command('skill')
    .description('Install ryo-add-skill skill and print next steps')
    .option('-y, --yes', 'non-interactive mode')
    .action(async (options) => {
      await addAction({ yes: !!options.yes, projectDir: process.cwd(), type: 'skill' });
    });
}

/**
 * Core add logic, separated for testability.
 *
 * @param {{ yes: boolean, projectDir: string, type: 'agent' | 'skill' }} opts
 */
export async function addAction({ yes, projectDir, type } = {}) {
  // Locate org context to determine which runtimes to target
  const orgWideContextPath = join(homedir(), '.ryo', 'org-context.yaml');
  const repoContextPath = join(projectDir, '.ryo', 'org-context.yaml');

  let orgContext = null;
  if (await exists(orgWideContextPath)) {
    try { orgContext = await readYaml(orgWideContextPath); } catch { /* ignore */ }
  } else if (await exists(repoContextPath)) {
    try { orgContext = await readYaml(repoContextPath); } catch { /* ignore */ }
  }

  const runtimeNames = orgContext?.tools?.ai ?? [];
  const s = p.spinner();

  if (runtimeNames.length > 0) {
    s.start(`Installing ryo-add-${type} skill for: ${runtimeNames.join(', ')}…`);
    try {
      await installSkillsForRuntimes(projectDir, runtimeNames);
      s.stop(`ryo-add-${type} skill installed.`);
    } catch (err) {
      s.stop('Skill installation encountered an error.');
      p.log.warn(String(err));
    }
  }

  const slashCommand = `/ryo-add-${type}`;
  p.outro(
    `Ready to add a new ${type}.\n\n` +
    `Next step: open your AI tool and invoke ${slashCommand}\n` +
    `  This will walk you through creating a new ${type} conversationally.`,
  );
}

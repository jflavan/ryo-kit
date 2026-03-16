import { join } from 'node:path';
import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { runInterview } from '../prompts/org-interview.js';
import { writeOrgContext, writeConstitution, writeDefaultTemplates } from '../../context/writer.js';
import { installSkillsForRuntimes } from '../../scaffolder/skill-writer.js';

/**
 * Register the `ryo init` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerInit(program) {
  program
    .command('init')
    .description('Org-level setup: TUI interview, write org context, install bootstrap skills')
    .option('-y, --yes', 'non-interactive mode — accept all defaults')
    .action(async (options) => {
      await initAction({ yes: !!options.yes, projectDir: process.cwd() });
    });
}

/**
 * Core init logic, separated for testability.
 *
 * @param {{ yes: boolean, projectDir: string }} opts
 */
export async function initAction({ yes, projectDir }) {
  // 1. Run the TUI interview (or return defaults in --yes mode)
  const { context, installLocation, detected } = await runInterview({ yes, projectDir });

  // 2. Determine the target directory for org context files
  const targetDir = installLocation === 'org-wide'
    ? join(homedir(), '.ryo')
    : join(projectDir, '.ryo');

  const s = p.spinner();

  // 3. Write org context
  s.start('Writing org context…');
  try {
    await writeOrgContext(targetDir, context);
    await writeConstitution(targetDir);
    s.stop('Org context written.');
  } catch (err) {
    s.stop('Failed to write org context.');
    p.log.error(String(err));
    process.exit(1);
  }

  // 4. Write default templates only in org-wide mode
  if (installLocation === 'org-wide') {
    s.start('Writing default templates…');
    try {
      await writeDefaultTemplates(targetDir);
      s.stop('Default templates written.');
    } catch (err) {
      s.stop('Failed to write default templates.');
      p.log.error(String(err));
      // Non-fatal: templates are optional
    }
  }

  // 5. Install bootstrap + core skills into all selected runtimes
  const runtimeNames = context.tools?.ai ?? [];
  if (runtimeNames.length > 0) {
    s.start(`Installing skills for: ${runtimeNames.join(', ')}…`);
    try {
      await installSkillsForRuntimes(projectDir, runtimeNames);
      s.stop('Skills installed.');
    } catch (err) {
      s.stop('Skill installation encountered an error.');
      p.log.warn(String(err));
      // Non-fatal: user can re-run
    }
  }

  // 6. Print next steps
  p.outro(buildNextSteps(context.tools?.ai ?? [], installLocation, targetDir));
}

/**
 * Build a next-steps message after init.
 *
 * @param {string[]} runtimes
 * @param {string} installLocation
 * @param {string} targetDir
 * @returns {string}
 */
function buildNextSteps(runtimes, installLocation, targetDir) {
  const lines = [
    `Org context written to: ${targetDir}`,
    '',
    'Next steps:',
    '  1. Run `ryo gen` in your project repo to scaffold .ryo/',
    '  2. Open your AI tool and invoke /ryo-gen to generate your framework',
  ];

  if (runtimes.includes('claude-code')) {
    lines.push('     Claude Code: /ryo-gen');
  }
  if (runtimes.includes('copilot')) {
    lines.push('     GitHub Copilot: /ryo-gen');
  }
  if (runtimes.includes('cursor')) {
    lines.push('     Cursor: ask Cursor to "follow the ryo-gen rule"');
  }
  if (runtimes.includes('windsurf')) {
    lines.push('     Windsurf: ask Windsurf to "follow the ryo-gen rule"');
  }
  if (runtimes.includes('codex')) {
    lines.push('     Codex: /ryo-gen');
  }
  if (runtimes.includes('gemini-cli')) {
    lines.push('     Gemini CLI: /ryo-gen');
  }

  return lines.join('\n');
}

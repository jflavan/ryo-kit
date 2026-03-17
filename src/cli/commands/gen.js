import { join } from 'node:path';
import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { exists, readIfExists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { scaffoldProjectDir } from '../../scaffolder/directory.js';
import { installSkillsForRuntimes } from '../../scaffolder/skill-writer.js';
import { syncAction } from './sync.js';

/**
 * Register the `ryo gen` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerGen(program) {
  program
    .command('gen')
    .description('Project-level: scaffold .ryo/ for this repo, install project skills')
    .option('-y, --yes', 'non-interactive mode — accept all defaults')
    .action(async (options) => {
      await genAction({ yes: !!options.yes, projectDir: process.cwd() });
    });
}

/**
 * Core gen logic, separated for testability.
 *
 * @param {{ yes: boolean, projectDir: string, repoOnly?: boolean }} opts
 */
export async function genAction({ yes, projectDir, repoOnly } = {}) {
  // 1. Locate org context — prefer org-wide, fall back to repo-only
  const orgWideContextPath = join(homedir(), '.ryo', 'org-context.yaml');
  const repoContextPath = join(projectDir, '.ryo', 'org-context.yaml');

  let contextPath;
  let resolvedRepoOnly = repoOnly;

  if (repoOnly) {
    contextPath = repoContextPath;
  } else if (await exists(orgWideContextPath)) {
    contextPath = orgWideContextPath;
    resolvedRepoOnly = false;
  } else if (await exists(repoContextPath)) {
    contextPath = repoContextPath;
    resolvedRepoOnly = true;
  } else {
    p.log.error(
      'No org context found. Run `ryo init` first to create one at ~/.ryo/ or .ryo/.',
    );
    process.exit(1);
  }

  // 2. Read org context
  let orgContext;
  try {
    orgContext = await readYaml(contextPath);
  } catch (err) {
    p.log.error(`Failed to read org context from ${contextPath}: ${err.message}`);
    process.exit(1);
  }

  const ryoDir = join(projectDir, '.ryo');
  const s = p.spinner();

  // 3. Scaffold .ryo/ directory structure
  s.start('Scaffolding .ryo/ directory structure…');
  try {
    await scaffoldProjectDir(ryoDir);
    s.stop('.ryo/ directory scaffolded.');
  } catch (err) {
    s.stop('Failed to scaffold .ryo/ directory.');
    p.log.error(String(err));
    process.exit(1);
  }

  // 4. Install project-level skills into runtimes
  const runtimeNames = orgContext?.tools?.ai ?? [];
  if (runtimeNames.length > 0) {
    s.start(`Installing project skills for: ${runtimeNames.join(', ')}…`);
    try {
      await installSkillsForRuntimes(projectDir, runtimeNames);
      s.stop('Project skills installed.');
    } catch (err) {
      s.stop('Skill installation encountered an error.');
      p.log.warn(String(err));
    }
  }

  // 5. Sync agents and skills to runtimes
  s.start('Syncing agents and skills to runtimes…');
  try {
    await syncAction({ projectDir, force: true });
    s.stop('Runtime sync complete.');
  } catch (err) {
    s.stop('Sync encountered an error.');
    p.log.warn(String(err));
  }

  // 6. Tell user to invoke /ryo-gen
  const nextSteps = buildGenNextSteps(runtimeNames);
  p.outro(nextSteps);
}

/**
 * Build next-steps message after gen.
 *
 * @param {string[]} runtimes
 * @returns {string}
 */
function buildGenNextSteps(runtimes) {
  const lines = [
    '.ryo/ directory scaffolded successfully.',
    '',
    'Next step: open your AI tool and invoke /ryo-gen',
    '  This will generate your agents, skills, processes, and workflows.',
  ];

  if (runtimes.includes('claude-code')) {
    lines.push('  Claude Code: type /ryo-gen');
  }
  if (runtimes.includes('copilot')) {
    lines.push('  GitHub Copilot: type /ryo-gen');
  }
  if (runtimes.includes('codex')) {
    lines.push('  Codex: type /ryo-gen');
  }
  if (runtimes.includes('gemini-cli')) {
    lines.push('  Gemini CLI: type /ryo-gen');
  }
  if (runtimes.includes('cursor')) {
    lines.push('  Cursor: ask "follow the ryo-gen rule"');
  }
  if (runtimes.includes('windsurf')) {
    lines.push('  Windsurf: ask "follow the ryo-gen rule"');
  }

  return lines.join('\n');
}

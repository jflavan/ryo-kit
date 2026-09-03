import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { readIfExists, exists } from '../../utils/fs.js';
import { traceBranch } from '../../governance/trace.js';

/**
 * Register `ryo trace`: map the commits on the current branch to the workflow
 * steps that produced them, using the in-flight ledger and retained audit
 * ledgers. Deterministic — git plus markdown parsing, no AI.
 */
export function registerTrace(program) {
  program
    .command('trace')
    .description('Trace branch commits to ledger steps and gate evidence (traceability report)')
    .option('-b, --base <ref>', 'integration base (default: first protected branch that exists, else main/master)')
    .option('--json', 'print machine-readable JSON')
    .option('--strict', 'exit 1 when any commit is not covered by a completed step or a gate lacks evidence')
    .action(async (options) => {
      const result = await traceAction({ projectDir: process.cwd(), base: options.base });
      if (options.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      else printTrace(result);
      if (options.strict && (result.uncovered.length > 0 || result.issues.length > 0)) process.exit(1);
    });
}

export async function traceAction({ projectDir, base } = {}) {
  const stateDir = join(projectDir, '.ryo', '.state');
  const ledgers = [];

  const live = await readIfExists(join(stateDir, 'ledger.md'));
  if (live !== null && live.trim() !== '') ledgers.push({ path: '.ryo/.state/ledger.md', content: live });

  const auditDir = join(stateDir, 'audit');
  if (await exists(auditDir)) {
    for (const file of (await readdir(auditDir)).filter(f => f.endsWith('.md')).sort()) {
      const content = await readIfExists(join(auditDir, file));
      if (content !== null) ledgers.push({ path: `.ryo/.state/audit/${file}`, content });
    }
  }

  let protectedBranches = [];
  const policy = await readIfExists(join(projectDir, '.ryo', 'hooks', 'policy.json'));
  if (policy) { try { protectedBranches = JSON.parse(policy).protected_branches ?? []; } catch { /* ignore */ } }

  return traceBranch({ cwd: projectDir, base, protectedBranches, ledgers });
}

function printTrace(r) {
  if (r.issues.length && !r.base) { for (const i of r.issues) p.log.error(i); return; }
  p.log.info(`Branch ${r.branch ?? '(detached)'} — ${r.commits.length} commit(s) since ${r.base}, ${r.steps.length} completed step(s) in ${new Set(r.steps.map(s => s.ledger)).size} ledger(s)`);
  for (const c of r.commits) {
    const tag = c.step ? `${c.step.workflow ?? 'workflow'} step ${c.step.step}${c.step.gate ? ` (gate ${c.step.gate})` : ''}` : 'NOT TRACED';
    (c.step ? p.log.step : p.log.warn)(`${c.short}  ${c.subject}  →  ${tag}`);
  }
  if (r.uncovered.length) p.log.warn(`${r.uncovered.length} commit(s) not covered by any completed step.`);
  else if (r.commits.length) p.log.success('Every commit traces to a completed step.');
  for (const i of r.issues) p.log.error(i);
  if (r.rulings.length) {
    p.log.info('Rulings:\n' + r.rulings.map(x => `  - ${x.ruling}`).join('\n'));
  }
}

import * as p from '@clack/prompts';
import { SCOPE_ORDER } from '../../context/schema.js';
import { loadConstitution } from '../../governance/constitution.js';
import { classifyScope } from '../../governance/scope.js';

/**
 * Register the `ryo classify` command.
 *
 * Deterministic scope classification: applies the constitution's
 * `scope_overrides` and `forbidden_paths` to a set of touched paths and
 * prints the resulting scope. Workflows call this at their first step so
 * that scope is a policy decision, not a judgement call.
 */
export function registerClassify(program) {
  program
    .command('classify [paths...]')
    .description('Classify the scope of a change from the paths it touches, using constitution scope rules')
    .option('-s, --scope <scope>', `proposed scope (${SCOPE_ORDER.join(', ')}); the result never downgrades it`)
    .option('--json', 'print machine-readable JSON')
    .action(async (paths, options) => {
      const result = await classifyAction({ projectDir: process.cwd(), paths, proposed: options.scope ?? null });
      if (options.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } else {
        printClassification(result);
      }
      if (result.forbidden.length > 0) process.exit(2);
    });
}

export async function classifyAction({ projectDir, paths = [], proposed = null, home } = {}) {
  const constitution = await loadConstitution(projectDir, home);
  const result = classifyScope({ paths, proposed, constitution: constitution.rules });
  return { ...result, constitution: constitution.path, constitution_issues: constitution.issues };
}

function printClassification(result) {
  const header = result.upgraded
    ? `Scope: ${result.scope} (upgraded from ${result.proposed})`
    : `Scope: ${result.scope}`;
  p.log.info(header);
  for (const r of result.reasons) {
    p.log.step(`${r.path} → minimum ${r.minimum_scope}${r.reason ? ` — ${r.reason}` : ''}`);
  }
  if (result.stop_conditions.length > 0) {
    p.log.warn('Stop conditions in force:\n' + result.stop_conditions.map(s => `  - ${s}`).join('\n'));
  }
  if (result.forbidden.length > 0) {
    p.log.error('Forbidden paths touched (agents may not modify these):\n' + result.forbidden.map(f => `  - ${f}`).join('\n'));
  }
  if (result.constitution_issues.length > 0) {
    p.log.warn('Constitution frontmatter has issues (rules ignored):\n' + result.constitution_issues.map(i => `  - ${i}`).join('\n'));
  }
  if (!result.constitution) {
    p.log.info('No constitution.md found; classification used the proposed scope only.');
  }
}

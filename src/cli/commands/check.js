import { join, dirname } from 'node:path';
import { readdir } from 'node:fs/promises';
import * as p from '@clack/prompts';
import {
  AgentDefSchema,
  SkillDefSchema,
  WorkflowDefSchema,
  ProcessDefSchema,
  SignalSchema,
  parseFrontmatter,
  parseSignalLine,
} from '../../context/schema.js';
import { parseConstitution, findConstitution } from '../../governance/constitution.js';
import { parseLedger } from '../../governance/ledger.js';
import { hashContent, resolveSource } from '../../scaffolder/hook-writer.js';
import { readIfExists, exists } from '../../utils/fs.js';

/** Directory-name prefix reserved for ryo-kit's own meta-skills. */
export const RYO_SKILL_PREFIX = 'ryo-';

/**
 * Register the `ryo check` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerCheck(program) {
  program
    .command('check')
    .description('Validate framework files against schemas, cross-references, and governance rules')
    .option('--dir <dir>', 'directory to check (defaults to .ryo/ in cwd)')
    .action(async (options) => {
      const ryoDir = options.dir ?? join(process.cwd(), '.ryo');
      const errors = await checkFramework(ryoDir);

      if (errors.length === 0) {
        p.log.success('No errors found. Framework is valid.');
      } else {
        p.log.error(`Found ${errors.length} error(s):`);
        for (const { file, message } of errors) {
          p.log.warn(`  ${file}: ${message}`);
        }
        process.exit(1);
      }
    });
}

async function listFiles(dir, predicate) {
  if (!await exists(dir)) return [];
  try {
    return (await readdir(dir, { withFileTypes: true })).filter(predicate).map(e => e.name);
  } catch {
    return [];
  }
}

function schemaErrors(result, file) {
  return result.error.issues.map(issue => ({
    file,
    message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
  }));
}

/**
 * Validate all framework files in the given .ryo directory.
 * Returns an array of error objects with `file` and `message` properties.
 *
 * Checks performed:
 *  - schema validation of agents, skills, workflows, process, constitution, signals
 *  - cross-references: workflow → agent / skill / phase, agent handoff_to → agent,
 *    process phase agents → agent
 *  - governance rules on gates: separation of duties, non-skippable gates,
 *    automated gates cannot claim separation of duties
 *
 * @param {string} ryoDir - Absolute path to the .ryo/ directory.
 * @returns {Promise<Array<{ file: string, message: string }>>}
 */
export async function checkFramework(ryoDir, { home } = {}) {
  const errors = [];
  const projectDir = dirname(ryoDir);

  const agentNames = new Set();
  const agents = [];
  const skillNames = new Set();

  // --- Validate agents/ ---
  const agentsDir = join(ryoDir, 'agents');
  for (const file of await listFiles(agentsDir, e => e.isFile() && e.name.endsWith('.agent.md'))) {
    const content = await readIfExists(join(agentsDir, file));
    if (content === null) continue;
    const result = AgentDefSchema.safeParse(parseFrontmatter(content).data);
    if (!result.success) {
      errors.push(...schemaErrors(result, join('agents', file)));
    } else {
      agentNames.add(result.data.name);
      agents.push({ file: join('agents', file), data: result.data });
    }
  }

  // --- Validate skills ---
  // Canonical location is <project>/.agents/skills/ (since 0.2.0). The legacy
  // <ryoDir>/skills/ location is still read so old layouts keep validating.
  const skillRoots = [
    { dir: join(projectDir, '.agents', 'skills'), label: join('.agents', 'skills') },
    { dir: join(ryoDir, 'skills'), label: 'skills' },
  ];
  for (const { dir, label } of skillRoots) {
    for (const skillDir of await listFiles(dir, e => e.isDirectory())) {
      // `ryo-*` is reserved for ryo-kit's own meta-skills (ryo-gen, ryo-help, ...),
      // which use a lighter frontmatter and are not generated framework skills.
      if (skillDir.startsWith(RYO_SKILL_PREFIX)) continue;
      const content = await readIfExists(join(dir, skillDir, 'SKILL.md'));
      if (content === null) continue;
      const result = SkillDefSchema.safeParse(parseFrontmatter(content).data);
      if (!result.success) {
        errors.push(...schemaErrors(result, join(label, skillDir, 'SKILL.md')));
      } else {
        skillNames.add(result.data.name);
      }
    }
  }

  // --- Validate workflows/ ---
  const workflowsDir = join(ryoDir, 'workflows');
  const workflows = [];
  for (const file of await listFiles(workflowsDir, e => e.isFile() && e.name.endsWith('.workflow.md'))) {
    const content = await readIfExists(join(workflowsDir, file));
    if (content === null) continue;
    const result = WorkflowDefSchema.safeParse(parseFrontmatter(content).data);
    if (!result.success) {
      errors.push(...schemaErrors(result, join('workflows', file)));
    } else {
      workflows.push({ file: join('workflows', file), data: result.data });
    }
  }

  // --- Validate process.md ---
  let processDef = null;
  const processContent = await readIfExists(join(ryoDir, 'process.md'));
  if (processContent !== null) {
    const result = ProcessDefSchema.safeParse(parseFrontmatter(processContent).data);
    if (!result.success) {
      errors.push(...schemaErrors(result, 'process.md'));
    } else {
      processDef = result.data;
    }
  }
  const phaseNames = new Set(processDef?.phases.map(ph => ph.name) ?? []);

  // --- Validate constitution.md frontmatter (repo-local, else org-wide) ---
  const constitution = await findConstitution(projectDir, home);
  if (constitution) {
    const { issues } = parseConstitution(constitution.content);
    const label = constitution.path.startsWith(ryoDir) ? 'constitution.md' : constitution.path;
    for (const message of issues) errors.push({ file: label, message });
  }

  // --- Compiled guard policy must match the constitution it was built from ---
  const policyContent = await readIfExists(join(ryoDir, 'hooks', 'policy.json'));
  if (policyContent !== null) {
    try {
      const policy = JSON.parse(policyContent);
      if (policy.source) {
        const source = await readIfExists(resolveSource(policy.source, projectDir, home));
        if (source === null) {
          errors.push({ file: join('hooks', 'policy.json'), message: `source constitution not found at ${policy.source}; run \`npx ryo-kit sync\`` });
        } else if (hashContent(source) !== policy.source_hash) {
          errors.push({ file: join('hooks', 'policy.json'), message: 'stale: the constitution changed since the guard policy was compiled; run `npx ryo-kit sync`' });
        }
      }
    } catch {
      errors.push({ file: join('hooks', 'policy.json'), message: 'not valid JSON; run `npx ryo-kit sync` to regenerate' });
    }
  }

  // --- Validate .state/signals.md entries ---
  const signalsContent = await readIfExists(join(ryoDir, '.state', 'signals.md'));
  if (signalsContent !== null) {
    signalsContent.split('\n').forEach((line, idx) => {
      const entry = parseSignalLine(line);
      if (!entry) return;
      const result = SignalSchema.safeParse(entry);
      if (!result.success) {
        errors.push({
          file: join('.state', 'signals.md'),
          message: `line ${idx + 1}: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        });
      }
    });
  }

  // --- Validate .state/ledger.md shape ---
  const ledgerContent = await readIfExists(join(ryoDir, '.state', 'ledger.md'));
  if (ledgerContent !== null && ledgerContent.trim() !== '') {
    for (const message of parseLedger(ledgerContent).issues) {
      errors.push({ file: join('.state', 'ledger.md'), message });
    }
  }

  // --- Cross-reference checks ---
  for (const { file, data } of agents) {
    for (const target of data.handoff_to) {
      if (!agentNames.has(target)) {
        errors.push({ file, message: `handoff_to references unknown agent: "${target}"` });
      }
    }
    if (data.gate) errors.push(...gateErrors(data.gate, file, data.name, 'agent gate'));
  }

  if (processDef) {
    for (const phase of processDef.phases) {
      for (const agent of phase.agents) {
        if (agentNames.size > 0 && !agentNames.has(agent)) {
          errors.push({ file: 'process.md', message: `phase "${phase.name}" references unknown agent: "${agent}"` });
        }
      }
      errors.push(...gateErrors(phase.gate, 'process.md', null, `phase "${phase.name}" gate`));
    }
    for (const rule of processDef.scale_rules ?? []) {
      for (const name of [...(rule.skip_phases ?? []), ...rule.required_phases]) {
        if (!phaseNames.has(name)) {
          errors.push({ file: 'process.md', message: `scale rule "${rule.scope}" references unknown phase: "${name}"` });
        }
      }
      // A phase whose gate declares skippable_for may only be skipped for those scopes.
      for (const skipped of rule.skip_phases ?? []) {
        const phase = processDef.phases.find(ph => ph.name === skipped);
        const allowed = phase?.gate?.skippable_for;
        if (phase && Array.isArray(allowed) && !allowed.includes(rule.scope)) {
          errors.push({
            file: 'process.md',
            message: `scale rule "${rule.scope}" skips phase "${skipped}" but its gate is only skippable for: ${allowed.length ? allowed.join(', ') : '(none)'}`,
          });
        }
      }
    }
  }

  for (const { file, data } of workflows) {
    data.steps.forEach((step, idx) => {
      if (agentNames.size > 0 && !agentNames.has(step.agent)) {
        errors.push({ file, message: `step ${idx + 1} references unknown agent: "${step.agent}"` });
      }
      for (const skill of step.skills) {
        if (skillNames.size > 0 && !skillNames.has(skill)) {
          errors.push({ file, message: `step ${idx + 1} references unknown skill: "${skill}"` });
        }
      }
      if (phaseNames.size > 0 && !phaseNames.has(step.phase)) {
        errors.push({ file, message: `step ${idx + 1} references unknown process phase: "${step.phase}"` });
      }
      if (step.gate) {
        errors.push(...gateErrors(step.gate, file, step.agent, `step ${idx + 1} gate`));
        const phase = processDef?.phases.find(ph => ph.name === step.phase);
        if (phase) {
          for (const what of gateWeakenings(phase.gate, step.gate)) {
            errors.push({ file, message: `step ${idx + 1} weakens the process gate for phase "${step.phase}": ${what}` });
          }
        }
      }
    });

    for (const rule of data.scale_rules ?? []) {
      for (const skipped of rule.skip_steps ?? []) {
        const step = data.steps.find(s => s.phase === skipped);
        const allowed = step?.gate?.skippable_for;
        if (step && Array.isArray(allowed) && !allowed.includes(rule.scope)) {
          errors.push({
            file,
            message: `scale rule "${rule.scope}" skips step "${skipped}" but its gate is only skippable for: ${allowed.length ? allowed.join(', ') : '(none)'}`,
          });
        }
      }
    }
  }

  return errors;
}

const GATE_STRENGTH = { automated: 0, hybrid: 1, human: 2 };

/**
 * A workflow step gate may specialise its process phase gate but never weaken it.
 * Returns human-readable descriptions of each weakening found.
 */
export function gateWeakenings(phaseGate, stepGate) {
  const found = [];
  if (GATE_STRENGTH[stepGate.type] < GATE_STRENGTH[phaseGate.type]) {
    found.push(`type ${phaseGate.type} → ${stepGate.type}`);
  }
  if (phaseGate.separation_of_duties && stepGate.separation_of_duties === false) {
    found.push('drops separation_of_duties');
  }
  if (Array.isArray(phaseGate.skippable_for) && Array.isArray(stepGate.skippable_for)) {
    const widened = stepGate.skippable_for.filter(sc => !phaseGate.skippable_for.includes(sc));
    if (widened.length) found.push(`widens skippable_for with: ${widened.join(', ')}`);
  }
  if (Array.isArray(phaseGate.evidence) && Array.isArray(stepGate.evidence)) {
    const dropped = phaseGate.evidence.filter(e => !stepGate.evidence.includes(e));
    if (dropped.length) found.push(`drops evidence: ${dropped.join(', ')}`);
  }
  const phaseCount = phaseGate.approvers?.count;
  const stepCount = stepGate.approvers?.count;
  if (phaseCount !== undefined && stepCount !== undefined && stepCount < phaseCount) {
    found.push(`reduces approvers from ${phaseCount} to ${stepCount}`);
  }
  return found;
}

/**
 * Governance rules that apply to any gate, wherever it appears.
 *
 * @param {object} gate - Parsed GateSchema object
 * @param {string} file - File the gate lives in (for error reporting)
 * @param {string|null} performer - Agent performing the gated work, if known
 * @param {string} label - Human-readable location of the gate
 */
export function gateErrors(gate, file, performer, label) {
  const errors = [];
  if (gate.separation_of_duties && gate.type === 'automated') {
    errors.push({ file, message: `${label}: separation_of_duties requires a human or hybrid gate, not automated` });
  }
  if (gate.separation_of_duties && performer && gate.approvers?.agents?.includes(performer)) {
    errors.push({ file, message: `${label}: separation_of_duties is set but performer "${performer}" is also listed as an approver` });
  }
  if (gate.approvers?.roles && gate.type === 'automated') {
    errors.push({ file, message: `${label}: approver roles are declared on an automated gate` });
  }
  return errors;
}

#!/usr/bin/env node
// ryo-kit SessionStart hook.
//
// Injects the governance context an AI coding session needs before its first
// action: the constitution, the process phases, any in-flight plan, the tail
// of the workflow ledger, and the ryo-session bootstrap skill. Runs on session
// start, /clear and /compact so the rules survive context loss.
//
// Zero dependencies — this file is copied into <project>/.ryo/hooks/ and run
// with the system `node`. Output format is selected with --format:
//   claude  → { hookSpecificOutput: { hookEventName, additionalContext } }
//   cursor  → { additional_context }
//   generic → { additionalContext }

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const formatIdx = args.indexOf('--format');
const format = formatIdx >= 0 ? args[formatIdx + 1] : 'generic';
const rootIdx = args.indexOf('--root');
const projectDir = rootIdx >= 0
  ? resolve(args[rootIdx + 1])
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function firstExisting(paths) {
  for (const p of paths) if (existsSync(p)) return p;
  return null;
}

const ryoDir = join(projectDir, '.ryo');
const sections = [];

// 1. Bootstrap skill — how to behave in a ryo-kit governed repo.
const sessionSkill = read(join(projectDir, '.agents', 'skills', 'ryo-session', 'SKILL.md'));
if (sessionSkill) {
  sections.push('## ryo-session (bootstrap skill)\n\n' + sessionSkill.replace(/^---[\s\S]*?---\s*/, ''));
}

// 2. Constitution — repo-local first, then org-wide.
const constitutionPath = firstExisting([
  join(ryoDir, 'constitution.md'),
  join(homedir(), '.ryo', 'constitution.md'),
]);
if (constitutionPath) {
  sections.push(`## Constitution (${constitutionPath})\n\n` + read(constitutionPath));
}

// 3. Process phases — frontmatter only, so the model knows the gates that exist.
const processContent = read(join(ryoDir, 'process.md'));
if (processContent) {
  const fm = processContent.match(/^---\n([\s\S]*?)\n---/);
  const phases = fm
    ? [...fm[1].matchAll(/^\s{2}-\s+name:\s*(.+)$/gm)].map(m => m[1].trim())
    : [];
  sections.push(
    '## Process\n\n' +
    (phases.length ? 'Phases: ' + phases.join(' → ') : 'See .ryo/process.md') +
    '\n\nRead .ryo/process.md before starting any workflow. Workflows live in .ryo/workflows/.',
  );
}

// 4. In-flight plan.
const plan = read(join(ryoDir, '.state', 'current-plan.md'));
if (plan && /- \[ \]/.test(plan)) {
  const open = (plan.match(/- \[ \]/g) || []).length;
  sections.push(`## In-flight plan\n\n${open} phase(s) incomplete in .ryo/.state/current-plan.md. Resume it rather than starting over.\n\n${plan.trim()}`);
}

// 5. Ledger tail — decisions and rulings survive compaction here, not in memory.
const ledger = read(join(ryoDir, '.state', 'ledger.md'));
if (ledger) {
  const lines = ledger.trim().split('\n');
  const tail = lines.slice(-15).join('\n');
  sections.push('## Ledger (last entries of .ryo/.state/ledger.md)\n\nTrust the ledger and git log over your own recollection.\n\n' + tail);
}

// 6. Generated workflows available.
const workflowsDir = join(ryoDir, 'workflows');
if (existsSync(workflowsDir)) {
  const names = readdirSync(workflowsDir)
    .filter(f => f.endsWith('.workflow.md'))
    .map(f => f.replace(/\.workflow\.md$/, ''));
  if (names.length) sections.push('## Workflows\n\n' + names.map(n => `- ${n}`).join('\n'));
}

if (sections.length === 0) process.exit(0);

const context =
  '<RYO_KIT_GOVERNANCE>\n' +
  'This repository is governed by ryo-kit. Before your first action, classify the scope of the request, ' +
  'check the constitution, and follow the matching workflow in .ryo/workflows/. Gates are not optional; ' +
  'record every gate outcome and every ruling you make.\n\n' +
  sections.join('\n\n---\n\n') +
  '\n</RYO_KIT_GOVERNANCE>';

let payload;
if (format === 'claude') {
  payload = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
} else if (format === 'cursor') {
  payload = { additional_context: context };
} else {
  payload = { additionalContext: context };
}
process.stdout.write(JSON.stringify(payload) + '\n');

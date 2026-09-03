import { execFileSync } from 'node:child_process';
import { parseLedger } from './ledger.js';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

function refExists(ref, cwd) {
  try { git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd); return true; } catch { return false; }
}

/**
 * Pick the integration base: an explicit ref, else the first protected branch
 * that exists locally, else main, else master.
 */
export function detectBase({ cwd, base, protectedBranches = [] }) {
  const candidates = [base, ...protectedBranches.filter(b => !b.includes('*')), 'main', 'master'].filter(Boolean);
  for (const ref of candidates) if (refExists(ref, cwd)) return ref;
  return null;
}

const RANGE_RE = /commits?\s+([0-9a-f]{7,40})\.\.\.?([0-9a-f]{7,40})/i;
const SINGLE_RE = /commits?\s+([0-9a-f]{7,40})(?![0-9a-f.])/i;
const EVIDENCE_RE = /evidence:\s*([^)]+)/i;
const GATE_RE = /gate\s+(\S+)\s+passed/i;

function expandRange(a, b, cwd) {
  try {
    const out = git(['rev-list', '--reverse', `${a}..${b}`], cwd);
    const list = out ? out.split('\n') : [];
    // rev-list a..b excludes a itself; the ledger's base is the commit *before* the step, so that is right.
    return { shas: list, ok: true };
  } catch {
    return { shas: [], ok: false };
  }
}

/**
 * Trace branch commits to ledger steps.
 *
 * @param {{ cwd: string, base?: string, protectedBranches?: string[], ledgers: Array<{ path: string, content: string }> }} input
 */
export function traceBranch({ cwd, base, protectedBranches = [], ledgers = [] }) {
  const result = { base: null, head: null, branch: null, commits: [], uncovered: [], steps: [], rulings: [], issues: [] };

  let head;
  try { head = git(['rev-parse', 'HEAD'], cwd); } catch { result.issues.push('not a git repository, or no commits yet'); return result; }
  result.head = head;
  try { result.branch = git(['symbolic-ref', '--short', '-q', 'HEAD'], cwd) || null; } catch { result.branch = null; }

  const baseRef = detectBase({ cwd, base, protectedBranches });
  if (!baseRef) { result.issues.push('no base branch found; pass --base <ref>'); return result; }
  result.base = baseRef;

  let branchShas = [];
  try {
    const out = git(['rev-list', '--reverse', `${baseRef}..HEAD`], cwd);
    branchShas = out ? out.split('\n') : [];
  } catch { result.issues.push(`cannot list commits ${baseRef}..HEAD`); return result; }

  const shaToStep = new Map();

  for (const { path, content } of ledgers) {
    const ledger = parseLedger(content);
    for (const issue of ledger.issues) result.issues.push(`${path}: ${issue}`);
    result.rulings.push(...ledger.rulings.map(r => ({ ledger: path, ruling: r })));

    for (const entry of ledger.entries.filter(e => e.type === 'step-complete')) {
      const stepNo = Number(entry.raw.match(/^Step\s+(\d+)/i)[1]);
      const step = { ledger: path, workflow: ledger.workflow, step: stepNo, commits: [], evidence: null, gate: null, line: entry.line };
      const ev = entry.raw.match(EVIDENCE_RE);
      const gate = entry.raw.match(GATE_RE);
      step.evidence = ev ? ev[1].trim() : null;
      step.gate = gate ? gate[1] : null;

      const range = entry.raw.match(RANGE_RE);
      const single = !range && entry.raw.match(SINGLE_RE);
      if (range) {
        const { shas, ok } = expandRange(range[1], range[2], cwd);
        if (!ok) result.issues.push(`${path} line ${entry.line}: commit range ${range[1]}..${range[2]} not found in this repository`);
        step.commits = shas;
      } else if (single) {
        if (refExists(single[1], cwd)) step.commits = [git(['rev-parse', single[1]], cwd)];
        else result.issues.push(`${path} line ${entry.line}: commit ${single[1]} not found in this repository`);
      } else {
        result.issues.push(`${path} line ${entry.line}: step ${stepNo} complete but names no commits`);
      }
      if (step.gate && !step.evidence) {
        result.issues.push(`${path} line ${entry.line}: step ${stepNo} passed gate "${step.gate}" without recorded evidence`);
      }
      for (const sha of step.commits) if (!shaToStep.has(sha)) shaToStep.set(sha, step);
      result.steps.push(step);
    }
  }

  for (const sha of branchShas) {
    let subject = '';
    try { subject = git(['log', '-1', '--format=%s', sha], cwd); } catch { /* ignore */ }
    const step = shaToStep.get(sha) ?? null;
    const record = { sha, short: sha.slice(0, 7), subject, step: step ? { workflow: step.workflow, step: step.step, gate: step.gate } : null };
    result.commits.push(record);
    if (!step) result.uncovered.push(record);
  }

  return result;
}

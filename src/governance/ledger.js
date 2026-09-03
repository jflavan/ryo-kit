/**
 * Parser for .ryo/.state/ledger.md — the per-workflow-run record.
 *
 * The ledger is written by the AI tool following the ledger fragment, so this
 * parser is deliberately tolerant: it classifies every non-empty, non-heading
 * line into a known entry type and reports the ones it cannot classify.
 */

const IDENTITY_RE = /^#\s*Ledger\s*[—-]+\s*workflow:\s*([^\s—-]+)(?:.*?scope:\s*([a-z-]+))?/i;

const ENTRY_PATTERNS = [
  { type: 'step-complete', re: /^Step\s+(\d+):\s*complete\b(.*)$/i },
  { type: 'step-skipped', re: /^Step\s+(\d+):\s*skipped\b(.*)$/i },
  { type: 'gate-failed', re: /^Step\s+(\d+):\s*gate\s+(\S+)\s+failed\b(.*)$/i },
  { type: 'fix-round', re: /^Step\s+(\d+):\s*fix round\s+(\d+)\/(\d+)(.*)$/i },
  { type: 'step-note', re: /^Step\s+(\d+):\s*(.*)$/i },
  { type: 'ruling', re: /^Ruling:\s*(.+)$/i },
  { type: 'parked', re: /^Parked:\s*(.+)$/i },
  { type: 'scope-upgrade', re: /^Scope:\s*upgraded\s+([a-z-]+)\s*(?:→|->)\s*([a-z-]+)(.*)$/i },
];

/**
 * @param {string} content
 * @returns {{ workflow: string|null, scope: string|null, entries: Array<object>, rulings: string[], completedSteps: number[], issues: string[] }}
 */
export function parseLedger(content) {
  const lines = content.split('\n');
  const result = { workflow: null, scope: null, entries: [], rulings: [], completedSteps: [], issues: [] };

  const first = lines.find(l => l.trim() !== '');
  if (first === undefined) {
    result.issues.push('ledger is empty');
    return result;
  }
  const id = first.match(IDENTITY_RE);
  if (!id) {
    result.issues.push(`line 1 must identify the run: "# Ledger — workflow: <name> — started <date> — scope: <scope>", got "${first.trim()}"`);
  } else {
    result.workflow = id[1];
    result.scope = id[2] ?? null;
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (line === '' || line === first.trim() || line.startsWith('#')) return;
    const text = line.replace(/^[-*]\s+/, '');
    for (const { type, re } of ENTRY_PATTERNS) {
      const m = text.match(re);
      if (!m) continue;
      const entry = { type, line: idx + 1, raw: text };
      if (type === 'step-complete') result.completedSteps.push(Number(m[1]));
      if (type === 'ruling') {
        result.rulings.push(m[1]);
        // Ruling: what — why — cost if wrong
        if (m[1].split(/\s[—-]{1,2}\s/).length < 3) {
          result.issues.push(`line ${idx + 1}: ruling should read "what — why — cost if wrong"`);
        }
      }
      if (type === 'parked') result.rulings.push(m[1]);
      result.entries.push(entry);
      return;
    }
    result.issues.push(`line ${idx + 1}: unrecognised ledger entry "${text}"`);
  });

  return result;
}

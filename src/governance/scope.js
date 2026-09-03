import { SCOPE_ORDER } from '../context/schema.js';
import { matchesAnyGlob } from '../utils/glob.js';

/**
 * Compare two scope labels. Returns >0 when a is larger than b.
 * `hotfix` is orthogonal to size and is never ordered against the size labels.
 */
export function compareScope(a, b) {
  return SCOPE_ORDER.indexOf(a) - SCOPE_ORDER.indexOf(b);
}

export function maxScope(a, b) {
  if (!SCOPE_ORDER.includes(a)) return b;
  if (!SCOPE_ORDER.includes(b)) return a;
  return compareScope(a, b) >= 0 ? a : b;
}

/**
 * Deterministic scope classification.
 *
 * Applies the constitution's `scope_overrides` (path glob → minimum scope) to
 * the touched paths, then ratchets: the result is never smaller than the
 * proposed scope, and never smaller than any matching override.
 *
 * @param {{ paths?: string[], proposed?: string, constitution?: object }} input
 * @returns {{ scope: string, proposed: string|null, upgraded: boolean, reasons: Array<{path: string, minimum_scope: string, reason?: string}>, stop_conditions: string[], forbidden: string[] }}
 */
export function classifyScope({ paths = [], proposed = null, constitution = {} } = {}) {
  const overrides = constitution.scope_overrides ?? [];
  const forbiddenGlobs = constitution.forbidden_paths ?? [];

  let scope = SCOPE_ORDER.includes(proposed) ? proposed : SCOPE_ORDER[0];
  const reasons = [];
  const forbidden = [];

  for (const path of paths) {
    if (matchesAnyGlob(path, forbiddenGlobs)) forbidden.push(path);
    for (const rule of overrides) {
      if (matchesAnyGlob(path, rule.paths)) {
        reasons.push({ path, minimum_scope: rule.minimum_scope, reason: rule.reason });
        scope = maxScope(scope, rule.minimum_scope);
      }
    }
  }

  const upgraded = proposed !== null && SCOPE_ORDER.includes(proposed) && compareScope(scope, proposed) > 0;

  return {
    scope,
    proposed: SCOPE_ORDER.includes(proposed) ? proposed : null,
    upgraded,
    reasons,
    stop_conditions: constitution.stop_conditions ?? [],
    forbidden,
  };
}

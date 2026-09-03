#!/usr/bin/env node
// ryo-kit guard hook.
//
// Deterministic enforcement of the constitution's `protected_branches` and
// `forbidden_paths` at tool-call time. Reads the policy compiled by `ryo sync`
// from `.ryo/hooks/policy.json`; with no policy file it allows everything.
//
// Zero dependencies. Runs with the system `node`. Formats:
//   --format claude   Claude Code PreToolUse: stdin {tool_name, tool_input};
//                     stdout {hookSpecificOutput:{permissionDecision:"deny",...}}
//   --format cursor   Cursor beforeShellExecution: stdin {command, cwd};
//                     stdout {permission:"allow"|"deny", userMessage, agentMessage}
//
// This is a guardrail against a forgetful or over-eager agent, not a security
// boundary: anyone who can edit the constitution can change the policy. Commit
// .ryo/constitution.md and .ryo/hooks/policy.json and review them like code.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const formatIdx = args.indexOf('--format');
const format = formatIdx >= 0 ? args[formatIdx + 1] : 'claude';
const rootIdx = args.indexOf('--root');
const projectDir = rootIdx >= 0
  ? resolve(args[rootIdx + 1])
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- glob matching (mirror of src/utils/glob.js; kept dependency-free) ----
function normalisePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}
function globToRegExp(glob) {
  const g = normalisePath(glob);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}
const matchesAny = (value, globs) => globs.some(g => globToRegExp(g).test(normalisePath(value)));

// ---- policy ----
function loadPolicy() {
  const path = join(projectDir, '.ryo', 'hooks', 'policy.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function currentBranch(cwd) {
  try {
    // symbolic-ref works on an unborn branch (fresh repo, no commits); rev-parse does not.
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch { return null; } // detached HEAD or not a repo
}

function toProjectRelative(filePath, { cwd, projectDir: root }) {
  const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  return normalisePath(relative(root, abs));
}

function normaliseCtx(ctx) {
  const c = typeof ctx === 'string' ? { cwd: ctx } : (ctx ?? {});
  const cwd = c.cwd ?? process.cwd();
  return { cwd, projectDir: c.projectDir ?? cwd };
}

// ---- rules ----
const WRITE_INDICATORS = /(^|\s)(rm|mv|cp|tee|truncate|chmod|chown|sed\s+-i|perl\s+-i)\b|>{1,2}/;

/**
 * Inspect one shell command against the policy.
 * @param {string} command
 * @param {object} policy - compiled policy (protected_branches, forbidden_paths)
 * @param {{ cwd: string, projectDir?: string }} ctx - where the command runs; projectDir defaults to cwd
 * @returns {string|null} reason to deny, or null to allow
 */
export function checkCommand(command, policy, ctx) {
  const c = normaliseCtx(ctx);
  const cwd = c.cwd;
  const protectedGlobs = policy.protected_branches ?? [];
  const forbiddenGlobs = policy.forbidden_paths ?? [];
  const segments = command.split(/&&|\|\||;|\|/).map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const tokens = segment.split(/\s+/).filter(t => !/^[A-Z_][A-Z0-9_]*=/.test(t)); // drop leading VAR=x
    const bin = tokens[0];

    if (bin === 'git' && protectedGlobs.length) {
      const sub = tokens.slice(1).find(t => !t.startsWith('-'));
      const rest = tokens.slice(tokens.indexOf(sub) + 1);
      const positional = rest.filter(t => !t.startsWith('-'));

      if ((sub === 'branch' && (rest.includes('-D') || rest.includes('-d'))) || (sub === 'push' && (rest.includes('--delete') || rest.includes('-d')))) {
        for (const t of positional) {
          if (matchesAny(t, protectedGlobs)) return `Deleting protected branch "${t}" is not allowed.`;
        }
      } else if (sub === 'push') {
        // git push [remote] [refspec...]; refspec src:dst; no refspec → current branch
        const refspecs = positional.slice(1);
        const targets = refspecs.length
          ? refspecs.map(r => r.includes(':') ? r.split(':').pop() : r)
          : [currentBranch(cwd)].filter(Boolean);
        for (const t of targets) {
          const branch = t.replace(/^refs\/heads\//, '');
          if (matchesAny(branch, protectedGlobs)) {
            return `"git push" targets protected branch "${branch}". Pushing to a protected branch is a human action: open a pull request from a feature branch, or ask the user to push.`;
          }
        }
      }
      if (sub === 'merge') {
        // Merging into a protected branch is integration — a human action.
        // Local commits are deliberately allowed: a solo developer on `main`
        // must still be able to work; the push is where the guard applies.
        const branch = currentBranch(cwd);
        if (branch && matchesAny(branch, protectedGlobs)) {
          return `"git merge" into protected branch "${branch}". Integration into "${branch}" is a human action: open a pull request or ask the user to merge.`;
        }
      }
    }

    if ((bin === 'gh' && tokens[1] === 'pr' && tokens[2] === 'merge') || (bin === 'glab' && tokens[1] === 'mr' && tokens[2] === 'merge')) {
      if (protectedGlobs.length) return 'Merging a pull request is a human action under this constitution. Report that the PR is ready and let the user merge.';
    }

    if (forbiddenGlobs.length && WRITE_INDICATORS.test(segment)) {
      for (const t of tokens.slice(1)) {
        if (/^[-<>|&]/.test(t)) continue;
        const rel = toProjectRelative(t.replace(/^['"]|['"]$/g, ''), c);
        if (!rel.startsWith('..') && matchesAny(rel, forbiddenGlobs)) {
          return `Command writes to forbidden path "${rel}". Agents may not modify this path; hand the change to the user.`;
        }
      }
    }
  }
  return null;
}

export function checkFileEdit(filePath, policy, ctx) {
  const forbiddenGlobs = policy.forbidden_paths ?? [];
  if (!forbiddenGlobs.length || !filePath) return null;
  const rel = toProjectRelative(filePath, normaliseCtx(ctx));
  if (!rel.startsWith('..') && matchesAny(rel, forbiddenGlobs)) {
    return `"${rel}" is a forbidden path in the constitution. Agents may not modify it; describe the change and hand it to the user.`;
  }
  return null;
}

// ---- main ----
function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function emit(reason) {
  if (format === 'cursor') {
    process.stdout.write(JSON.stringify(reason
      ? { permission: 'deny', userMessage: `ryo-kit guard: ${reason}`, agentMessage: `ryo-kit guard: ${reason}` }
      : { permission: 'allow' }) + '\n');
  } else if (reason) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `ryo-kit guard: ${reason}` },
    }) + '\n');
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const policy = loadPolicy();
  if (!policy) emit(null);

  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch { emit(null); }
  const ctx = { cwd: input.cwd || process.cwd(), projectDir };

  if (format === 'cursor') {
    emit(typeof input.command === 'string' ? checkCommand(input.command, policy, ctx) : null);
  }

  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  if (tool === 'Bash' && typeof ti.command === 'string') emit(checkCommand(ti.command, policy, ctx));
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) emit(checkFileEdit(ti.file_path ?? ti.notebook_path, policy, ctx));
  emit(null);
}

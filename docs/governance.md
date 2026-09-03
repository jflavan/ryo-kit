# Governance

ryo-kit generates a process, but a process nobody enforces is a suggestion. This document describes the governance mechanics that make the generated framework hold: a structured constitution, scope classification, gates that pass on evidence, separation of duties, a ledger that survives compaction, rulings instead of stalls, and a session hook that re-injects all of it after every `/clear` and `/compact`.

These mechanics are the same for every org. What differs per org is the policy they enforce: which paths are protected, which gates are unskippable, who approves, what counts as evidence. That policy comes from `org-context.yaml` and `constitution.md`, and the generation skills write it into every agent, skill, process phase, and workflow.

## The constitution

`constitution.md` has two halves.

**Frontmatter** is policy the tooling enforces. Every key is optional.

| Key | Enforced by | Meaning |
|-----|-------------|---------|
| `protected_branches` | guard hook, workflows | Branches an agent never pushes to, merges into, or deletes. Globs. |
| `required_reviewers.default` | process-generation | Approver count on review gates. |
| `required_reviewers.paths` | process-generation | Per-path approver count and roles, e.g. two reviewers including security for `payments/**`. |
| `forbidden_paths` | guard hook, `ryo classify` | Paths agents never modify. The guard refuses edits and shell writes; `ryo classify` exits 2 when a touched path matches. |
| `stop_conditions` | workflows, `ryo-session`, `ryo classify` | Situations where the executor stops and asks, beyond the built-in four. Copied verbatim into every generated workflow and printed by `ryo classify`. |
| `scope_overrides` | `ryo classify` | Path glob to minimum scope. A one-line change under `auth/**` can be a `feature`. |
| `evidence` | process-generation | Whether review and tests are required evidence on every gate, plus org-specific artifacts. |
| `audit.retain_ledgers` | workflows | Keep workflow ledgers in `audit.retain_dir` after completion (default true, `.ryo/.state/audit/`). |

**Prose** is policy the model enforces: the non-negotiable principles. They are embedded into every generated agent and skill, and injected into every session by the hook.

`ryo check` validates the frontmatter. `ryo init` writes the default template tuned to the org context: protect `main` and `release/*` with one reviewer and review plus tests as required evidence; for a solo developer without required reviews, no protected branches and review optional (the guard would otherwise block every push); for compliance or large teams, two reviewers, and for compliance a `compliance-checklist` evidence artifact. Ledgers are retained in every case. Edit the file afterwards; it is the org's, and `ryo sync` recompiles the guard policy from it.

## Scope classification

Every workflow starts by classifying the request. Scope decides which path the scale rules take, and it is a policy decision, not a judgement about how small the diff looks.

| Scope | Meaning |
|-------|---------|
| `small-change` | Typos, config, docs. No behaviour change. |
| `bug-fix` | Correct a known defect in an existing flow. |
| `feature` | New behaviour, or a change to an interface others depend on. |
| `epic` | Spans multiple areas. Decompose before planning. |
| `hotfix` | Emergency production fix. Orthogonal to size; `ryo classify --hotfix` still applies size overrides, and gates marked `skippable_for: []` still apply. |
| `none` | A question that ends in an answer, not a change. Said out loud; no workflow applies until an edit is proposed. |

The executor proposes a scope out loud, then confirms it deterministically:

```sh
npx ryo-kit classify src/auth/login.ts --scope bug-fix
# Scope: feature (upgraded from bug-fix)
# src/auth/login.ts → minimum feature — auth changes always get design review
```

The result never downgrades the proposal, and it never comes in under a matching `scope_overrides` rule. Mid-task discoveries only move scope up (the ratchet). The classification is recorded as a `scope-classification` signal so `/ryo-retro` can see which paths keep forcing upgrades and propose new overrides.

Approval before implementation does not scale with scope. A `small-change` gets a two-sentence design in chat and an explicit yes; a `feature` gets a sectioned design. The artifact shrinks; the gate does not.

## Gates

A gate is the unit of governance. The same shape appears on agents (before handoff), process phases (before exit), and workflow steps (before the next step):

```yaml
gate:
  type: hybrid                 # human | automated | hybrid
  criteria: [review approved, no Critical findings]
  evidence: [review-report]    # must exist, freshly produced, before the gate passes
  approvers:
    count: 2
    roles: [security]          # who may approve a human/hybrid gate
    agents: [reviewer]         # never the performer when separation_of_duties is set
  skippable_for: []            # scope labels that may skip; [] = never, omitted = follow scale rules
  separation_of_duties: true   # the approver is not the agent that did the work
```

Rules `ryo check` enforces:

- An `automated` gate cannot claim `separation_of_duties` or name approver roles.
- The performing agent cannot appear in its own gate's `approvers.agents` when `separation_of_duties` is set.
- A scale rule may only skip a phase or step for the scopes its gate's `skippable_for` lists. `skippable_for: []` means every scale rule must require it.
- A workflow step gate may specialise its process phase gate but never weaken it: not a weaker `type`, not dropping `separation_of_duties` or an `evidence` item, not widening `skippable_for`, not fewer approvers.
- Workflow steps reference real phases; scale rules reference real phases; agents hand off to real agents.
- `.ryo/.state/ledger.md` has an identity line and only recognised entry shapes; a `Ruling:` reads "what — why — cost if wrong".

Rules the generation skills apply:

- Compliance gates are `human` or `hybrid`, `skippable_for: []`, `separation_of_duties: true`, with an evidence artifact.
- When `conventions.reviews` is `required`, review gates carry `separation_of_duties`.
- When the constitution's `evidence.review` or `evidence.tests` is `required`, every review or test gate lists that artifact.

## Evidence before claims

No gate passes on assertion. The gate's `evidence` list names what must exist; the executor produces it fresh in that step, reads the output, and only then claims the gate passed. "The tests passed earlier" is not evidence for the tree being handed off now. Each gate outcome is written as a `gate-outcome` signal with an `evidence` signal beside it, and `/ryo-retro` flags any gate that passed without one.

## Separation of duties

Where the org has more than one agent, review is performed by a different agent than implementation, from a fresh context, with three inputs: the task, the implementer's report, and the diff for the exact commit range. The reviewer treats the report as unverified claims and judges the code. The implementer never spawns its own reviewer and never marks its own gate passed. For a solo developer the framework generates a single `verifier` role and the gate passes on fresh evidence rather than on a second agent.

## Rulings, not stalls

A running workflow does not wait on a human for every ambiguity. When the constitution, process, and recorded decisions do not answer a question, the executor decides, records the decision in the ledger as `Ruling: what — why — cost if wrong`, mirrors it as a `ruling` signal, and continues. A wrong ruling costs rework the user can see and undo; a stalled session costs their day.

The executor stops and asks only for:

1. Irreversible or destructive operations.
2. Security-sensitive actions.
3. Side effects outside the working branch: merge, push to a shared or protected branch, publish, deploy.
4. A plan so broken every path forward is a guess.
5. Every gate of `type: human`.
6. Every entry in the constitution's `stop_conditions`.

At the end of a workflow, every ruling is listed under "Rulings I made" in the final message. A ruling that only lives in a deleted scratch file was a decision made in secret.

## The ledger

`.ryo/.state/ledger.md` is the recovery map for the in-flight workflow and, afterwards, the audit record. One line per step completion, gate outcome, fix round, scope change, and ruling. On session start the hook injects its tail; on resume the executor trusts the ledger and `git log` over its own memory.

When the workflow finishes, the ledger is moved to `.ryo/.state/audit/<date>-<workflow>.md` if `audit.retain_ledgers` is true (the default). `/ryo-retro` reads retained ledgers as signal data with full context. Set `retain_ledgers: false` to delete them instead.

## Hooks: injection and enforcement

`ryo sync` installs two dependency-free scripts under `.ryo/hooks/` and registers them with each runtime that supports hooks. Both run with the system `node`.

**`session-start.js`** injects governance context at the start of every session: the `ryo-session` bootstrap skill, the constitution, the process phase list, any in-flight `current-plan.md`, the tail of the ledger, and the list of workflows. On Claude Code it fires on startup, `/clear`, and `/compact`, so the rules survive context loss.

**`guard.js`** enforces the constitution at tool-call time. It reads `.ryo/hooks/policy.json`, compiled by `ryo sync` from the constitution's frontmatter, and refuses:

| Action | Rule |
|--------|------|
| `git push` whose target (explicit refspec or current branch) matches `protected_branches` | Pushing to a protected branch is a human action |
| `git merge` while the current branch is protected | Integration into a protected branch is a human action. Local commits are allowed so a solo developer on `main` can still work; the push is where the guard applies. |
| `git branch -D`, `git push --delete` of a protected branch | Never delete a protected branch |
| `gh pr merge`, `glab mr merge` when any branch is protected | Merging is a human action |
| Edits (Claude Code `Edit`, `Write`, `MultiEdit`, `NotebookEdit`) to a path matching `forbidden_paths` | Agents do not modify these paths |
| Shell commands that write (`>`, `rm`, `mv`, `cp`, `tee`, `sed -i`, ...) to a `forbidden_paths` match | Same rule, for the shell |

A refusal returns the reason to the agent, so it reports the block and hands the action to the user rather than routing around it.

| Runtime | Session injection | Enforcement |
|---------|-------------------|-------------|
| Claude Code | `.claude/settings.json` → `hooks.SessionStart` (`startup\|clear\|compact`) | `hooks.PreToolUse` on `Bash\|Edit\|Write\|MultiEdit\|NotebookEdit`, deny via `permissionDecision` |
| Cursor | `.cursor/hooks.json` → `hooks.sessionStart` | `hooks.beforeShellExecution`, deny via `permission`. Cursor has no pre-edit hook, so `forbidden_paths` are enforced for shell writes only. |
| Copilot, Codex, Windsurf, Gemini CLI | Managed block in `copilot-instructions.md` / `AGENTS.md` / `GEMINI.md` points at `/ryo-session` | None. The constitution is prose here; `ryo check` in CI is the backstop. |

Registration is idempotent (ryo-kit entries are identified by the `.ryo/hooks/` path in their command), preserves existing hooks and settings, and uses `${CLAUDE_PROJECT_DIR}` on Claude Code so the hooks work whatever directory the tool runs from. `uninstall()` removes only the ryo-kit entries.

**Keeping the policy current.** `policy.json` records a hash of the constitution it was compiled from. `ryo check` reports the policy as stale when the constitution has changed since; run `ryo sync` to recompile. Commit both files.

**What the guard is and is not.** It is a guardrail against a forgetful or over-eager agent: the situations where an agent "just pushes" or "quickly fixes" a file it should not touch. It is not a security boundary. Anyone, including the agent, who can edit `constitution.md` and re-run `ryo sync` can change the policy, and shell commands can be obfuscated past a tokenizer. Treat changes to the constitution and the policy as code: commit them, review them in pull requests, and run `npx ryo-kit check` in CI so a stale or invalid policy fails the build.

## Feedback loop

Every mechanism above writes signals, and `/ryo-retro` reads them:

| Signal | Retro analysis |
|--------|----------------|
| `gate-outcome` | Gates that always pass or always block |
| `evidence` | Gates that passed without evidence |
| `ruling` | Recurring ambiguities that should become policy |
| `scope-classification` | Paths that keep forcing upgrades; scopes whose scale rules are too optimistic |
| `manual-override` | Skills and agents the team keeps working around |

Accepted proposals are applied by `/ryo-evolve`, which respects `.customize/`. This is how the org's governance tightens where it is loose and loosens where it only slows work down, with a human deciding each change.

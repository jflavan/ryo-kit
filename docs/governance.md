# Governance

ryo-kit generates a process, but a process nobody enforces is a suggestion. This document describes the governance mechanics that make the generated framework hold: a structured constitution, scope classification, gates that pass on evidence, separation of duties, a ledger that survives compaction, rulings instead of stalls, and a session hook that re-injects all of it after every `/clear` and `/compact`.

These mechanics are the same for every org. What differs per org is the policy they enforce: which paths are protected, which gates are unskippable, who approves, what counts as evidence. That policy comes from `org-context.yaml` and `constitution.md`, and the generation skills write it into every agent, skill, process phase, and workflow.

## The constitution

`constitution.md` has two halves.

**Frontmatter** is policy the tooling enforces. Every key is optional.

| Key | Enforced by | Meaning |
|-----|-------------|---------|
| `protected_branches` | session hook, workflows | Branches an agent never merges into or pushes to without a human. Globs. |
| `required_reviewers.default` | process-generation | Approver count on review gates. |
| `required_reviewers.paths` | process-generation | Per-path approver count and roles, e.g. two reviewers including security for `payments/**`. |
| `forbidden_paths` | `ryo classify`, workflows | Paths agents never modify. `ryo classify` exits 2 when a touched path matches. |
| `stop_conditions` | workflows, `ryo-session` | Situations where the executor stops and asks, beyond the built-in four. Copied verbatim into every generated workflow. |
| `scope_overrides` | `ryo classify` | Path glob to minimum scope. A one-line change under `auth/**` can be a `feature`. |
| `evidence` | process-generation | Whether review and tests are required evidence on every gate, plus org-specific artifacts. |
| `audit.retain_ledgers` | workflows | Keep workflow ledgers in `audit.retain_dir` after completion (default true, `.ryo/.state/audit/`). |

**Prose** is policy the model enforces: the non-negotiable principles. They are embedded into every generated agent and skill, and injected into every session by the hook.

`ryo check` validates the frontmatter. The default template written by `ryo init` includes a starting set: protect `main` and `release/*`, one reviewer, review and tests required as evidence, ledgers retained.

## Scope classification

Every workflow starts by classifying the request. Scope decides which path the scale rules take, and it is a policy decision, not a judgement about how small the diff looks.

| Scope | Meaning |
|-------|---------|
| `small-change` | Typos, config, docs. No behaviour change. |
| `bug-fix` | Correct a known defect in an existing flow. |
| `feature` | New behaviour, or a change to an interface others depend on. |
| `epic` | Spans multiple areas. Decompose before planning. |
| `hotfix` | Emergency production fix. Orthogonal to size; runs the shortest path the constitution allows. |

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
- Workflow steps reference real phases; scale rules reference real phases; agents hand off to real agents.

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

## The session hook

`ryo sync` installs `.ryo/hooks/session-start.js` and registers it with each runtime that supports session hooks:

| Runtime | Registration |
|---------|--------------|
| Claude Code | `.claude/settings.json` → `hooks.SessionStart`, matcher `startup\|clear\|compact` |
| Cursor | `.cursor/hooks.json` → `hooks.sessionStart` |
| Copilot, Codex, Windsurf, Gemini CLI | No hook mechanism used; run `/ryo-session` at the start of a session |

The hook is dependency-free and runs with the system `node`. It injects the `ryo-session` bootstrap skill, the constitution, the process phase list, any in-flight `current-plan.md`, the tail of the ledger, and the list of workflows. Existing hook entries and settings are preserved, and repeated syncs never duplicate the entry. `ryo-session` can also be invoked manually.

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

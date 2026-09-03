# Superpowers vs. ryo-kit: a governance review

**Date:** 2026-09-03
**Status:** Proposal
**Inputs reviewed:** ryo-kit `main` at 0.2.3; [obra/superpowers](https://github.com/obra/superpowers) at v6.3.0 (2026-08-12), with a close read of `using-superpowers`, `brainstorming`, `writing-plans`, `subagent-driven-development` (SDD) and its three prompt templates, `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`, and the SessionStart hook.

---

## 1. Thesis

Superpowers is an excellent **execution engine** with a fixed, single-org set of governance rules baked into the prompts. ryo-kit is a **policy generator** with almost no execution engine and no enforcement. Neither is what an org with real governance needs on its own, and the two overlap almost nowhere that matters.

The opportunity is to stop treating ryo-kit as a competitor to superpowers (or BMAD, GSD, Spec-Kit) and reposition it as the **governance layer that sits on top of whatever execution engine the team already runs**. Concretely: ryo-kit owns the constitution, the gate policy, the scope classifier, the audit trail, the traceability check, and the retro loop. Superpowers owns brainstorm, plan, TDD, subagent dispatch, review, and finish.

That reframing kills roughly half of what ryo-kit currently generates (the commodity `plan`/`implement`/`test`/`review`/`debug` skills, which will never be as good as superpowers' equivalents) and makes the other half far more valuable.

---

## 2. What superpowers does that ryo-kit should not try to replicate

These are the parts to *depend on*, not rebuild:

| Capability | Where | Why it is better than anything ryo-kit generates |
|---|---|---|
| Mandatory skill invocation before any action | `using-superpowers` + SessionStart hook | Injected at session start via a hook, not just a CLAUDE.md pointer. Includes a rationalization table that is empirically tuned. |
| Scope-scaled ceremony with a non-negotiable approval gate | `brainstorming` (spike / bounded / architectural, one-way ratchet) | Exactly the "scale rules" idea in ryo-kit, but with a hard gate and tested wording. |
| Plans a junior can execute without context | `writing-plans` (exact files, code, commands, `Spec:` pointer, `Global Constraints` block, `Interfaces` block, no-placeholder rule) | ryo-kit's `plan` skill is a generic prompt with no such structure. |
| Separation of duties by construction | SDD: fresh implementer per task, reviewer never the implementer, "no subagents" contract for both, controller never fixes code itself | ryo-kit *describes* reviewer and builder agents but nothing stops one agent doing both. |
| Two-stage review per task plus whole-branch review | SDD `task-reviewer-prompt.md`, `re-review-prompt.md`, `code-reviewer.md` | ryo-kit has `gate.criteria: string[]`. |
| Evidence-before-claims | `verification-before-completion` | ryo-kit has no equivalent. |
| Bounded fix loop with a circuit breaker and recorded rulings | SDD (5 rounds, escalate model at round 4, adjudicate at cap, every ruling ledgered) | ryo-kit has nothing like this. |
| Compaction-safe progress ledger | `.superpowers/sdd/<plan>/progress.md` | Conceptually the same as `.ryo/.state/current-plan.md`, but battle-tested across long sessions. |
| Cost/model policy | SDD "Model Selection" (cheapest model that can do the role; always pin the model) | ryo-kit has no notion of model or cost. |
| Distribution | Plugin manifests for 14 harnesses, official marketplaces | ryo-kit symlinks into 6 runtimes and requires `npx` + `sync`. |

---

## 3. Where superpowers has no governance at all

This is the gap the user feels, and it is real. Everything below is either hard-coded to one org's taste or simply absent.

1. **No policy input.** There is no constitution, no org context, no compliance profile. The only inputs are the user's chat and CLAUDE.md. Every rule (TDD always, review after every task, worktree always, the "four stops") is the same for a solo hobby repo and a HIPAA enterprise.
2. **The stop conditions are fixed.** SDD stops for exactly four things: irreversible/destructive ops, security-sensitive actions, side effects outside the worktree, and a plan so broken every path is a guess. An org cannot add "any change to a PHI schema" or "any change under `payments/`" to that list without editing the plugin.
3. **Approvers are undefined.** Every gate is "your human partner says yes". There is no notion of *which* human, no role, no second approver, no evidence requirement.
4. **The audit trail is deleted on success.** SDD's ledger holds every ruling, parked finding, fix round and commit range, and the skill explicitly `rm -rf`s the workspace when the final review is clean. Rulings survive only in the final chat message. For a regulated org that is the wrong default: the ledger is the audit record.
5. **Traceability is implicit, not checked.** Spec → plan → task → commit is a real chain in superpowers (plans carry `Spec:`, briefs carry task text), but nothing verifies a commit on the branch traces to a task, or that every spec requirement landed. The plan's self-review is a one-time checklist the author runs on itself.
6. **Reviewer rubrics are generic.** `task-reviewer-prompt.md` has a `[GLOBAL_CONSTRAINTS]` slot, filled from the plan. There is no way for an org to inject standing review criteria (encryption at rest, audit logging on writes, no new dependencies without approval) into every review.
7. **Scope classification is judgement-only.** Spike / bounded / architectural is decided by the model out loud. An org cannot say "anything touching `auth/` is architectural regardless of size".
8. **Nothing is enforced deterministically.** All governance is prompt text. There is no hook that blocks `git push` to `main`, no check that a review actually happened before merge, no CI-side verification. Superpowers accepts this trade-off knowingly; a governance layer cannot.
9. **No feedback loop.** Nothing observes how the process actually ran over time and proposes changes. Rules change only when Jesse ships a release.

---

## 4. What ryo-kit already has that maps onto those gaps

ryo-kit's design already points at every one of the nine gaps, which is why the repo is worth reviving:

| Superpowers gap | ryo-kit concept that addresses it | Current state |
|---|---|---|
| No policy input | `org-context.yaml`, `constitution.md` | Exists. Constitution is a 12-line stub with no structure. |
| Fixed stop conditions | `gate.type: human` on phases/steps, compliance gate injection in `process-generation` | Exists as generated prose. Not consumable by superpowers. |
| Undefined approvers | `gate` object, `team.roles` | Schema has no `approvers`, `evidence`, or `skippable` fields. |
| Audit trail deleted | `.ryo/.state/signals.md`, `history/` | Append-only log exists. Only written if a *generated* workflow is being followed. |
| Traceability unchecked | Constitution: "All changes must be traceable to a requirement or decision" | Stated, never checked. `ryo check` is the natural home. |
| Generic reviewer rubrics | Constitution principles "embedded into every generated agent and skill" | Only embedded into ryo-kit's own generated skills, which nobody should use over superpowers'. |
| Judgement-only scope | `scale_rules` with `small-change / bug-fix / feature / epic / hotfix` | Exists in process and workflow schemas. Not wired to anything an executor reads. |
| No deterministic enforcement | "The CLI is dumb" principle, `ryo check`, zero-LLM CLI | Right architecture. Currently validates YAML frontmatter and one cross-reference. |
| No feedback loop | `/ryo-retro` + `/ryo-evolve` + `.customize/` | Genuinely unique. Starved of input because signals only come from ryo-kit's own workflows. |

---

## 5. Where ryo-kit falls short today (honest list)

1. **Governance is prompt-only.** Every gate, signal and constitution principle is an instruction to the model. Nothing in the CLI or a hook verifies that a gate was passed or a signal written. The "CLI is dumb" principle is correct, but a dumb CLI can still *verify*.
2. **The gate schema cannot express governance.** `{ type: human|automated|hybrid, criteria: string[] }` has no approver, no evidence, no skip policy, no retention. It cannot express "two approvers, one from security, evidence is a passing SAST run, not skippable for hotfix".
3. **The constitution is unstructured.** It is prose the model is asked to "respect". There is nothing a hook or `ryo check` can evaluate.
4. **Half the generated output is commodity.** `plan`, `implement`, `test`, `review`, `debug`, `refactor`, `document` are generated for every org and will be worse than superpowers', BMAD's, or the harness's own. They also create a "which `/review` do I run" problem when superpowers is installed.
5. **Signals depend on ryo-kit workflows being followed.** If the team runs superpowers (the realistic case), `signals.md` stays empty and `/ryo-retro` has nothing to analyse.
6. **No detection of an existing execution framework.** `detector.js` looks for CLAUDE.md, package.json, etc., but not for superpowers, BMAD, GSD or Spec-Kit, so `/ryo-gen` cannot adapt.
7. **`ryo check` is weaker than documented.** See bugs below. The docs claim it validates that workflow steps reference valid process phases and existing skills; it does neither today.
8. **No session-start injection.** ryo-kit writes a `<!-- ryo-kit -->` block into CLAUDE.md. Superpowers proved that a SessionStart hook injecting the bootstrap skill is what actually makes rules stick, especially after `/compact`.
9. **Not a plugin.** Distribution via `npx ryo-kit init` + symlinks is friction superpowers no longer has.

### Bugs found while reviewing

- `src/cli/commands/check.js` reads skills from `.ryo/skills/`, which 0.2.0 moved to `.agents/skills/`. `skillNames` is therefore always empty and the `skillNames.size > 0` guard means the "step references unknown skill" check never fires. The three fixture-based tests pass because they never exercise a skill mismatch.
- `check.js` parses `process.md` into `processDef` and never uses it. The documented "workflow steps reference valid process phases" check does not exist.
- `templates/bootstrap/ryo-gen.skill.md` has two sections titled "Phase 6" (Install and Archive, then Sync to Coding Tools). The plan template in Phase 3 lists only six phases, so the sync step is never tracked for resume.
- `ryo-kit-project-spec.md` still describes the pre-0.2.0 layout (`.ryo/skills/`, `.github/prompts/`, `.windsurfrules`). It is the first file a contributor opens.
- `test/skills.test.js` asserts only that frontmatter has `name`/`description`/`trigger`. Nothing checks that the sub-skill prose references files that exist (`decision-tree`, `validation`, `org-context-prompt` are referenced by name, never by path, so the "cross-reference" test is a fixed list).

---

## 6. Opportunities, ranked

Ordered by value-to-effort. Items 1 through 4 are small enough for one PR each and together change what ryo-kit *is*.

### 6.1 Structured constitution with machine-checkable rules

**What.** Give `constitution.md` YAML frontmatter that the CLI and hooks can evaluate, keeping the prose body for principles that need judgement.

```yaml
---
version: 1
protected_branches: [main, release/*]
required_reviewers:
  default: 1
  paths:
    "payments/**": { count: 2, roles: [security] }
    "db/migrations/**": { count: 2, roles: [dba] }
forbidden_paths_for_agents: ["infra/prod/**"]
stop_conditions:                      # extends superpowers' four stops
  - "any change under payments/** or auth/**"
  - "any migration that drops or renames a column"
scope_overrides:                      # feeds the classifier (6.3)
  architectural_if_touching: ["auth/**", "db/migrations/**"]
evidence:
  review: required
  tests: required
  sast: required_for: ["payments/**"]
audit:
  retain_ledgers: true
  retain_dir: .ryo/.state/audit
---
# Constitution
(prose as today)
```

**Why.** This is the single input that turns "governance-aware" from a prompt adjective into something a hook can refuse and `ryo check` can fail on. Everything below consumes it.

**How.** New `ConstitutionSchema` in `schema.js`; `writer.js` emits the frontmatter from the interview (compliance selection seeds sensible defaults, e.g. HIPAA → `audit.retain_ledgers: true`, `evidence.review: required`); `ryo check` validates it. Effort: small.

### 6.2 A superpowers-aware mode: generate overlays, not replacements

**What.** Teach `detector.js` to recognise superpowers (a `superpowers` entry under `~/.claude/plugins` or the project `.claude/settings.json`, `docs/superpowers/`, `.superpowers/`, `hooks/session-start` in a plugin dir). When present, `/ryo-gen` skips the commodity skills and instead generates **overlays** that superpowers' skills already have slots for:

- A `Global Constraints` block (from constitution + org context) that `writing-plans` pastes verbatim into every plan header. Superpowers already says "copy exact values from the spec"; ryo-kit supplies the org-wide ones.
- A **reviewer rubric fragment** injected into `[GLOBAL_CONSTRAINTS]` of `task-reviewer-prompt.md` and the final `code-reviewer.md` dispatch. This is where "audit logging on every write to PHI tables" becomes a standing review criterion.
- An **extended stop list** appended to SDD's four stops, drawn from `stop_conditions`.
- A **finish policy** for `finishing-a-development-branch`: which of the three menu options are allowed per branch (e.g. never "merge locally" to `main` in a regulated org; always "push and PR").
- Org-specific skills only: `compliance-check`, `audit`, `release`, `pi-plan`, `security-scan`. These have no superpowers equivalent and are where ryo-kit's generation actually adds value.

**Why.** Removes the duplicate `/review` problem, cuts generation time and output volume by half, and makes ryo-kit useful to the people most likely to try it (superpowers users who want governance). It also gives the retro loop (6.5) real data.

**How.** One new template `templates/overlays/superpowers.md` describing the overlay files, a branch in `ryo-gen` Phase 2 ("Detected superpowers. Generate governance overlays instead of execution skills? [yes]"), and a `.ryo/overlays/` output dir that `sync` links into the places superpowers reads. Effort: medium, mostly prompt text.

### 6.3 Policy-driven scope classification

**What.** Superpowers' brainstorming classifies spike / bounded / architectural by judgement. ryo-kit already has `scale_rules` with five scope labels. Unify them: generate a `classify-scope` fragment that maps ryo-kit scopes onto superpowers' three paths and applies `scope_overrides` from the constitution ("touches `auth/**` → architectural, no matter how small"), plus the one-way ratchet rule.

**Why.** Scope is where governance gets skipped in practice ("it's just a config change"). Making the classifier an org artifact rather than a model instinct is the highest-leverage governance control available.

**How.** Fragment plus a `ryo classify <paths...>` CLI subcommand that applies the path rules deterministically. Cheap, testable, and usable from a PreToolUse hook. Effort: small.

### 6.4 Deterministic enforcement via hooks and `ryo check`

**What.** Ship a `hooks/` directory (same shape as superpowers') installed by `sync` into Claude Code, Cursor and Copilot CLI:

- **SessionStart**: inject the constitution frontmatter, the current `process.md` phase list, and the `.ryo/.state/current-plan.md` status. Superpowers proved this is what survives `/compact`.
- **PreToolUse (Bash)**: refuse `git push` to a `protected_branch` and `git merge` into one unless `ryo check --gates` passes for the current branch. Refuse edits under `forbidden_paths_for_agents`.
- **Stop**: warn if a plan is in flight and no signal was appended this session.

And extend `ryo check` with a `--gates` mode that reads git (branch, merge-base, commit list), the SDD ledger or ryo-kit plan, and the constitution to verify: a review record exists for the range, required evidence files are present, and every commit message references a task or ticket when `traceability` is required.

**Why.** This is the difference between "governance-aware" and "governance-enforced", and it is exactly what the "CLI is dumb, zero LLM" principle is good for. A hook that shells out to `ryo check --gates` is deterministic, testable with fixtures, and works identically across harnesses.

**How.** `hooks/session-start`, `hooks/pre-tool-use`, `hooks/hooks.json`; `installHooks()` on `BaseRuntime`; `check.js` gains a `checkGates(repoDir)` that returns structured results. Effort: medium. The PreToolUse part needs care per harness; start with SessionStart, which is well understood.

### 6.5 Adopt SDD's ledger and rulings as first-class signals

**What.** Superpowers' `progress.md` ledger already contains the exact events ryo-kit wants: task completions with commit ranges, fix rounds, parked findings, and `Ruling:` lines (which are literally `manual-override` signals). Two changes:

1. An **audit retention overlay** (from 6.2) that tells SDD to copy the ledger to `.ryo/.state/audit/<plan>/` before its `rm -rf`, when `audit.retain_ledgers` is set. Until superpowers accepts an upstream hook for this, the overlay is a one-paragraph instruction in the generated `Global Constraints`.
2. A deterministic **`ryo signals import`** that parses retained ledgers (and `docs/superpowers/plans/*.md` checkbox state) into `signals.md` entries. Grammar is stable and documented in SDD's SKILL.md.

**Why.** `/ryo-retro` is ryo-kit's only truly differentiated feature and it is currently starved. This feeds it from the workflow people actually run, and gives regulated orgs the audit record superpowers deletes.

**How.** Small parser in `src/signals/sdd-ledger.js` with fixture ledgers; a new `SignalSchema.type` value `ruling`. Effort: small.

### 6.6 Governance-grade gate schema

**What.** Extend the shared gate object used in `AgentDefSchema`, `ProcessDefSchema` and `WorkflowDefSchema`:

```js
gate: z.object({
  type: z.enum(['human', 'automated', 'hybrid']),
  criteria: z.array(z.string()),
  approvers: z.object({ count: z.number().int().min(1), roles: z.array(z.string()).optional() }).optional(),
  evidence: z.array(z.string()).optional(),        // artifacts that must exist, e.g. "review-report", "test-results"
  skippable_for: z.array(z.string()).optional(),   // scope labels; empty = never skippable
  record_to: z.string().optional(),                // signals.md by default
  separation_of_duties: z.boolean().optional(),    // approver ≠ author
})
```

Then add `ryo check` rules: a gate with `separation_of_duties` must not have the same agent as both step performer and approver; compliance gates (from `process-generation`) must be non-`automated` and must not be `skippable_for: [hotfix]` unless the constitution allows it; `required_phases` must include every phase whose gate has empty `skippable_for`.

**Why.** Today the schema cannot represent the policies that make compliance reviewers sign off. All fields optional, so existing fixtures keep validating.

**How.** Schema change, three `check.js` rules, update `process-generation` and `workflow-generation` templates to emit the new fields when compliance is non-empty. Effort: small.

### 6.7 Traceability report

**What.** `ryo trace` (deterministic): for a branch, walk `git log merge-base..HEAD`, map each commit to a task via the SDD ledger commit ranges or a `Task N` / ticket-key pattern in the message, map each task to a spec requirement via the plan's `Spec:` pointer, and report orphans in both directions (commits with no task, spec sections with no task). Output as markdown into `.ryo/.state/audit/`.

**Why.** Directly implements the constitution line "All changes must be traceable to a requirement or decision", which is currently unverifiable. Superpowers has all the raw material and no checker.

**How.** Pure git + markdown parsing, fixtures with a fake plan and ledger. Effort: small to medium.

### 6.8 Package as a plugin

**What.** Add `.claude-plugin/plugin.json`, `hooks/hooks.json`, and a `skills/` layout so ryo-kit installs via the Claude Code marketplace (and Cursor / Copilot CLI plugin commands), the same way superpowers does. Keep `npx ryo-kit` for the CLI verbs.

**Why.** Distribution is most of adoption. Superpowers' `docs/porting-to-a-new-harness.md` is a ready-made checklist.

**How.** Manifest files, move `templates/bootstrap` and `templates/core-skills` under `skills/ryo-*/SKILL.md` (or generate them there at publish time), reuse the SessionStart hook from 6.4. Effort: small.

### 6.9 Borrow superpowers' skill-writing discipline

**What.** Adopt three superpowers conventions for ryo-kit's own templates: a **rationalization table** in each core skill (superpowers measured a real behaviour drop when they removed them), an explicit **"Announce at start"** line, and the `writing-skills` test harness pattern (probe a skill with a subagent under pressure, assert the behaviour). Also fix the two "Phase 6" sections.

**Why.** ryo-kit's core skills are long, procedural, and untested against models. Superpowers has tested wording for the failure modes ryo-kit will hit (skipping gates, not writing signals, "this is too small for the process").

**How.** Prompt edits plus a `test/skills-behaviour/` directory that is opt-in (needs a harness), mirroring `docs/testing.md` in superpowers. Effort: small for the edits, medium for the harness.

---

## 7. What to drop or de-emphasise

- **Commodity skill generation** (`plan`, `implement`, `test`, `review`, `debug`, `refactor`, `document`) when any execution framework is detected. Keep them only for the "no framework detected" path, and say so in the README.
- **Persona / conference mode** as a headline feature. It is fun, but it has no governance value and it dilutes the positioning. Keep it, stop leading with it.
- **The competitive table in the spec.** Replace "ryo-kit vs BMAD/Spec-Kit/GSD" with "ryo-kit + superpowers/BMAD/GSD". The row that matters is *governance layer*, and no one else has it.

---

## 8. Suggested sequence

1. **Housekeeping PR**: fix `check.js` skills path, implement the process-phase cross-reference, fix the duplicate Phase 6, update the stale spec. Adds tests that would have caught the first two. Half a day.
2. **Constitution schema (6.1) + gate schema (6.6)**: purely additive, all fields optional, fixtures updated. One PR.
3. **Detector + superpowers overlay mode (6.2) + scope classifier (6.3)**: this is the repositioning PR. Update README positioning at the same time.
4. **Ledger import + audit retention (6.5)**: makes `/ryo-retro` useful for superpowers users. Small PR.
5. **SessionStart hook + plugin manifest (6.4 partial, 6.8)**: distribution and stickiness.
6. **`ryo check --gates`, PreToolUse hook, `ryo trace` (6.4 rest, 6.7)**: the enforcement layer. Largest piece; do it once the schema from step 2 has settled.

Each step is independently shippable and keeps all 269 existing tests green.

---

## 9. Upstream opportunities in superpowers

Two small changes upstream would make the integration cleaner and are worth proposing on the superpowers repo, since they are harness- and org-neutral:

- A **`Global Constraints` include mechanism** in `writing-plans`: if `docs/superpowers/global-constraints.md` (or a configurable path) exists, paste it into every plan header. ryo-kit would generate that file.
- A **ledger retention option** in SDD: if `.superpowers/config` or an env var says `RETAIN_LEDGER=1`, move the workspace to an archive dir instead of `rm -rf`. Superpowers already treats the ledger as the recovery record; making it the audit record is a one-line change.

Neither blocks anything above; the overlays can carry the same instructions as prose until they land.

---
name: ryo-retro
description: >
  Retrospective skill that analyzes usage signals, operation history, and
  framework definitions to identify improvements. Produces a retro report
  with specific proposed changes and guides the user to apply them via
  /ryo-evolve.
trigger: /ryo-retro
---

# ryo-retro — Framework Retrospective

You are the retrospective skill for ryo-kit. Your job is to analyze how the framework has been used, identify patterns that suggest improvements, produce a report with concrete proposals, and guide the user through accepting or rejecting each one.

---

## Step 1: Verify Framework Exists

Confirm the framework is in place before analyzing it:

1. Check that `.ryo/agents/` contains at least one `.agent.md` file.
2. Check that `.agents/skills/` contains at least one `SKILL.md` file.
3. Check that `.ryo/process.md` exists.
4. Check that `.ryo/workflows/` contains at least one `.workflow.md` file.

If any of these are missing, stop and tell the user:
> "No generated framework found. Run `/ryo-gen` first to generate the framework, use it for a while, then run `/ryo-retro` to analyze usage patterns."

---

## Step 2: Read Usage Signals

Read `.ryo/.state/signals.md` if it exists. This file contains append-only usage tracking entries. Each entry has:

- **Timestamp** — When the event occurred
- **Type** — One of: `gate-outcome`, `phase-skip`, `agent-skip`, `skill-skip`, `manual-override`, `ruling`, `scope-classification`, `evidence`
- **Subject** — What was affected (agent name, phase name, skill name, gate name)
- **Outcome** — What happened (passed, failed, skipped, overridden)
- **Context** — Why, if recorded

Parse all entries and group them by type and subject.

If `signals.md` does not exist or is empty, note it. The retro can still run using the operation history and framework definitions, but signal-based analysis will be limited. Tell the user:
> "No usage signals found in `.ryo/.state/signals.md`. The retro will analyze framework structure but cannot assess actual usage patterns. As you use the framework, signals will accumulate and future retros will be more insightful."

---

Also read every retained ledger in `.ryo/.state/audit/` (if the directory exists). Ledgers hold `Ruling:`, `Parked:`, `Scope: upgraded`, and per-step gate lines for completed workflow runs; treat them as signal data with full context.

---

## Step 3: Read Operation History

Read all files in `.ryo/.state/history/`. These are archived plans from previous `/ryo-gen`, `/ryo-evolve`, and other operations. Each file contains:

- Operation type and date
- Phases executed and their outcomes
- Decisions made during the operation

Extract patterns from the history:
- How many operations have been run?
- Which types of operations (generation, evolution, etc.)?
- Over what time period?
- Were there repeated failures or retries?

If the history directory is empty or does not exist, note it. Tell the user:
> "No operation history found. The retro will analyze the current framework structure."

---

## Step 4: Read Current Framework Definitions

Read the entire current framework:

### Agents
Read all `.agent.md` files in `.ryo/agents/`. For each, extract:
- `name`, `role`, `description`
- `responsibilities`
- `handoff_to`
- `gate` (type and criteria)

### Skills
Read all `SKILL.md` files in `.agents/skills/*/`. For each, extract:
- `name`, `description`, `trigger`
- `agent` (if present)
- `inputs`, `outputs`

### Process
Read `.ryo/process.md`. Extract:
- All phases with their names, agents, artifacts, and gates
- All scale rules

### Workflows
Read all `.workflow.md` files in `.ryo/workflows/`. Extract:
- All steps with their phase, agent, skills, inputs, outputs, and gates
- All scale rules

---

## Step 5: Analyze Patterns

Run each of the following analyses. For each, compute the evidence and determine whether a proposal is warranted.

### Analysis A: Orphan Agents

Check for agents that are never referenced in any workflow step (the `agent` field of no workflow step matches this agent's name).

**Evidence threshold:** If an agent appears in zero workflow steps, it is an orphan.

**Proposal type:** REMOVE (if agent has been orphaned for a meaningful period) or MODIFY (if a workflow should include it).

### Analysis B: Frequently Overridden Skills

From the signals data, count `manual-override` entries grouped by subject. Look for skills or agents that are manually overridden frequently.

**Evidence threshold:** If a skill or agent has been manually overridden in more than 30% of its invocations (minimum 3 overrides), it may need adjustment.

**Proposal type:** MODIFY — the skill's instructions or the agent's responsibilities may not match what the team actually needs.

### Analysis C: Gates That Always Pass

From the signals data, count `gate-outcome` entries grouped by subject. Look for gates where the outcome is always "passed."

**Evidence threshold:** If a gate has passed 100% of the time over at least 5 invocations, its criteria may be too loose.

**Proposal type:** MODIFY — suggest tightening the gate criteria (add more specific checks, raise thresholds, etc.).

### Analysis D: Gates That Always Block

From the signals data, count `gate-outcome` entries grouped by subject. Look for gates where the outcome is always "failed."

**Evidence threshold:** If a gate has failed 100% of the time over at least 3 invocations, its criteria may be too strict or the upstream work is consistently insufficient.

**Proposal type:** MODIFY — suggest loosening the gate criteria or adding guidance to the upstream agent/skill to meet the criteria.

### Analysis E: Phases Always Skipped via Scale Rules

From the signals data, count `phase-skip` entries grouped by subject. Look for phases that are skipped in every invocation.

**Evidence threshold:** If a phase has been skipped in 100% of invocations over at least 5 invocations, it may not be needed for the current project's scope of work.

**Proposal type:** MODIFY (adjust scale rules so the phase is only present for appropriate scopes) or REMOVE (if the phase serves no purpose for this project).

### Analysis F: Missing Capabilities

Review the signals for patterns that suggest missing agents or skills:
- Repeated `manual-override` entries with similar context descriptions (the team keeps doing something manually that could be automated).
- Workflow gaps where outputs from one step do not connect to inputs of the next.
- Agents with very broad responsibilities that could be split.

**Proposal type:** ADD — new agent or skill to fill the gap.

### Analysis G: Workflow Efficiency

Analyze workflow step sequences:
- Are there steps that always produce the same output regardless of input? (May be redundant.)
- Are there steps that could be parallelized but are currently sequential?
- Are there common patterns across multiple workflows that could be extracted into a shared skill?

**Proposal type:** MODIFY — restructure workflow steps for efficiency.

### Analysis H: Recurring Rulings

From the signals data (`ruling` entries) and any retained ledgers in `.ryo/.state/audit/`, group rulings by subject and by the ambiguity they resolved. A ruling is a decision the executor made because neither the constitution, the process, nor `decisions.md` answered the question.

**Evidence threshold:** If the same kind of ambiguity has been ruled on 3 or more times, the framework is missing a policy.

**Proposal type:** MODIFY — add the missing rule to the constitution (frontmatter or prose), a gate criterion, or a decision in `decisions.md`, so future runs do not have to guess. Quote the rulings verbatim in the proposal.

### Analysis I: Scope Upgrades

From `scope-classification` signals and `Scope: upgraded` ledger lines, count how often work was re-classified upward mid-flight, and on which paths.

**Evidence threshold:** If a path pattern has caused an upgrade 2 or more times, it should be a `scope_overrides` entry in the constitution so classification is right from the start. If a scope label is upgraded in more than 30% of runs, the scale rules for that scope are too optimistic.

**Proposal type:** MODIFY — add a `scope_overrides` rule, or tighten the scale rules for the affected scope.

### Analysis J: Gates Passed Without Evidence

For each `gate-outcome | ... | passed` signal, look for an `evidence` signal with the same subject immediately before it, or a `Step N: complete (... evidence: ...)` line naming the gate in the run's retained ledger.

**Evidence threshold:** Any gate that passed with no evidence entry is a process violation, not a tuning question.

**Proposal type:** MODIFY — add an explicit `evidence` list to the gate, and strengthen the workflow step's instructions. Report the count prominently in the retro summary.

---

## Step 6: Produce the Retro Report

Write the retro report to `.ryo/.state/retro-[date].md` where `[date]` is the current date in `YYYY-MM-DD` format.

### Report format:

```markdown
# Retrospective Report — [YYYY-MM-DD]

## Summary

- **Period analyzed:** [date range of signals/history, or "current state only"]
- **Signals analyzed:** [count] entries
- **Operations in history:** [count]
- **Framework inventory:** [N] agents, [N] skills, [N] process phases, [N] workflows

## Proposed Changes

### [Action]: [subject-name] [entity-type]
**Why:** [Specific evidence. Reference signal counts, percentages, and concrete examples.]
**Impact:** [What changes in the framework. Which files are affected.]
**Status:** [PENDING]

### [Action]: [subject-name] [entity-type]
**Why:** [Specific evidence.]
**Impact:** [What changes.]
**Status:** [PENDING]

...

## Raw Signal Summary

### Gate Outcomes
| Gate | Passed | Failed | Pass Rate |
|------|--------|--------|-----------|
| [gate-name] | [N] | [N] | [N]% |

### Phase Skips
| Phase | Times Skipped | Total Invocations | Skip Rate |
|-------|--------------|-------------------|-----------|
| [phase-name] | [N] | [N] | [N]% |

### Manual Overrides
| Subject | Override Count | Total Invocations | Override Rate |
|---------|--------------|-------------------|---------------|
| [subject] | [N] | [N] | [N]% |

## Observations

[Any additional observations that don't warrant a formal proposal but are worth noting. Examples:
- "The framework has been stable over [N] operations with minimal overrides."
- "Signal collection coverage is low — consider enabling more verbose signal logging."
- "Three new skills were added manually since the last generation; consider running /ryo-evolve to validate."]
```

### Example proposals:

```markdown
### Add: security-reviewer agent
**Why:** 3 of last 5 features had security issues caught late in review. Signals show 3 manual-override entries for the reviewer agent with context mentioning "security concerns."
**Impact:** Adds a new agent with a gate after implementation, before PR. Workflows for feature and epic scopes gain an additional step.
**Status:** [PENDING]

### Modify: testing phase gate
**Why:** Gate passed 100% of the time in last 10 runs (10/10 passed, 0 failed). Criteria may be too loose.
**Proposed:** Add coverage threshold criterion (minimum 80% line coverage).
**Impact:** Modifies the testing phase gate criteria in process.md. May cause the gate to fail for some existing workflows until coverage improves.
**Status:** [PENDING]

### Remove: pi-planner agent
**Why:** Never invoked in any workflow over 30 days. Zero signals referencing pi-planner. No workflow step uses this agent.
**Impact:** Removes .ryo/agents/pi-planner.agent.md and associated skill .agents/skills/pi-plan/SKILL.md. Simplifies process definition by removing the pi-planning phase.
**Status:** [PENDING]
```

---

## Step 7: Present Proposals to the User

After writing the retro report, present each proposal to the user for a decision. Go through them one at a time.

For each proposal:

1. State the action (Add, Modify, Remove), the subject, and the evidence.
2. Explain the impact on the framework.
3. Ask: "Accept this proposal, reject it, or defer for later?"

Based on the user's response, update the proposal's `**Status:**` field in the retro report:
- **Accept:** Change to `[ACCEPTED]`
- **Reject:** Change to `[REJECTED]`
- **Defer:** Leave as `[PENDING]` (will be re-presented in the next retro or when `/ryo-evolve` runs)

Write the updated status to the retro report file after each decision.

---

## Step 8: Summary and Next Steps

After all proposals have been reviewed, present a summary:

```
## Retro Complete

- **Proposals made:** [total count]
- **Accepted:** [count]
- **Rejected:** [count]
- **Deferred:** [count]

### Report saved to: .ryo/.state/retro-[date].md
```

If any proposals were accepted, tell the user:

> **To apply the accepted changes, run `/ryo-evolve`.** The evolution skill will read this retro report, find the accepted proposals, and apply them to your framework with customization conflict handling.

If no proposals were accepted, tell the user:

> "No changes to apply. Your framework will continue operating as-is. Run `/ryo-retro` again after more usage data accumulates for deeper insights."

If signal data was limited or absent, add:

> "This retro was limited by available signal data. As you use the framework more, signals will accumulate in `.ryo/.state/signals.md` and future retros will provide more actionable insights."

---

## Error Handling

- **No signals and no history:** Run the retro anyway using framework structure analysis (orphan agents, workflow gaps, etc.). Note the limited data in the report summary.
- **Malformed signal entries:** Skip malformed entries and note how many were skipped. Suggest the user check `.ryo/.state/signals.md` for formatting issues.
- **File write fails:** Report the exact path and error. If the retro report cannot be written, present the proposals verbally and ask the user to save them manually.
- **No proposals generated:** If all analyses come back clean, tell the user: "No improvement proposals at this time. The framework appears well-tuned for current usage patterns."

---

## Important Behavioral Rules

1. **Base proposals on evidence.** Every proposal must cite specific signal data, operation history, or structural analysis. Never propose changes based on general best practices alone.
2. **Do not apply changes.** The retro skill analyzes and proposes. The `/ryo-evolve` skill applies. Never modify agent, skill, process, or workflow files during a retro.
3. **Read all available data.** Read signals, history, and all framework files before running analyses. Incomplete data leads to incorrect proposals.
4. **Present one proposal at a time.** Do not dump the entire list on the user. Walk through each proposal, explain the evidence, and wait for a decision.
5. **Be quantitative.** Use counts, percentages, and date ranges. "Gate passed frequently" is vague; "Gate passed 10/10 times (100%) over the last 14 days" is actionable.
6. **Write the report immediately.** Write the retro report to `.ryo/.state/` before presenting proposals to the user. The file serves as the persistent record regardless of session interruptions.
7. **Respect the user's decisions.** If a proposal is rejected, do not argue or re-propose it in the same session. It may resurface in a future retro if the evidence strengthens.

# Validation Fragment — Consistency Checks

This fragment provides the validation logic for checking consistency across all generated framework artifacts. Used by the ryo-gen orchestrator (post-generation validation) and ryo-check (standalone validation command).

---

## When to Run

- After all generation sub-skills complete (in the ryo-gen orchestrator)
- When the user runs `npx ryo-kit check` or `/ryo-check`
- After `/ryo-evolve` applies changes

---

## Files to Read

Before running any checks, read all of the following files. If a file does not exist, record it as a validation error (unless marked optional below).

| File/Directory | Required? | Description |
|---------------|-----------|-------------|
| `.ryo/agents/*.agent.md` | Yes (at least 1) | Agent definitions |
| `.ryo/skills/*/SKILL.md` | Yes (at least 1) | Skill definitions |
| `.ryo/process.md` | Yes | Process definition |
| `.ryo/workflows/*.workflow.md` | Yes (at least 1) | Workflow definitions |
| `.ryo/org-context.yaml` or `~/.ryo/org-context.yaml` | Yes | Org context |
| `.ryo/constitution.md` or `~/.ryo/constitution.md` | Optional | Constitution |

---

## Validation Checks

Run each check in order. Collect all errors before reporting (do not stop at the first error).

### Check 1: Agent References in Workflows

For every workflow file in `.ryo/workflows/`:
- Read the YAML frontmatter `steps` array.
- For each step, check that the `agent` field value matches the `name` field in one of the `.agent.md` files in `.ryo/agents/`.

**Error format:** `AGENT_NOT_FOUND: Workflow "[workflow-name]" step [N] references agent "[agent-name]" which does not exist in .ryo/agents/`

### Check 2: Skill References in Workflows

For every workflow file in `.ryo/workflows/`:
- Read the YAML frontmatter `steps` array.
- For each step, check that every value in the `skills` array matches the `name` field in one of the `SKILL.md` files in `.ryo/skills/*/`.

**Error format:** `SKILL_NOT_FOUND: Workflow "[workflow-name]" step [N] references skill "[skill-name]" which does not exist in .ryo/skills/`

### Check 3: Process Phase References in Workflows

For every workflow file in `.ryo/workflows/`:
- Read the YAML frontmatter `steps` array.
- For each step, check that the `phase` field value matches the `name` field of one of the phases in `.ryo/process.md`.

**Error format:** `PHASE_NOT_FOUND: Workflow "[workflow-name]" step [N] references phase "[phase-name]" which does not exist in .ryo/process.md`

### Check 4: Agent Handoff DAG

Read all agent definitions from `.ryo/agents/`. Build a directed graph from the `handoff_to` arrays:
- Each agent is a node.
- Each entry in `handoff_to` is a directed edge from the agent to the target.

Check that this graph is a valid DAG (no cycles).

**How to detect cycles:** For each agent, follow the handoff chain. If you visit the same agent twice, there is a cycle.

**Error format:** `HANDOFF_CYCLE: Agents form a cycle: [agent-a] -> [agent-b] -> ... -> [agent-a]`

Also check that every name in any `handoff_to` array corresponds to an actual agent file:

**Error format:** `HANDOFF_TARGET_NOT_FOUND: Agent "[agent-name]" has handoff_to "[target-name]" which does not exist in .ryo/agents/`

### Check 5: Agent-Skill Coverage

For every agent in `.ryo/agents/`:
- Check that at least one of the following is true:
  - A skill in `.ryo/skills/` has an `agent` field matching this agent's name, OR
  - A workflow step in `.ryo/workflows/` uses this agent (the agent appears in a step's `agent` field)

An agent with no skill association AND no workflow usage is likely dead weight.

**Error format:** `ORPHAN_AGENT: Agent "[agent-name]" has no associated skills and is not used in any workflow`

### Check 6: Skill Runtime Coverage

For every skill in `.ryo/skills/`:
- Check that the `runtimes` array in its frontmatter includes at least one runtime from `tools.ai` in org-context.yaml.

A skill that doesn't target any of the org's active runtimes will never be usable.

**Error format:** `RUNTIME_MISMATCH: Skill "[skill-name]" targets runtimes [list] but org uses [list]. No overlap.`

### Check 7: Process-Agent Consistency

For every phase in `.ryo/process.md`:
- Check that every agent name in the phase's `agents` array corresponds to an actual agent file in `.ryo/agents/`.

**Error format:** `PROCESS_AGENT_NOT_FOUND: Process phase "[phase-name]" references agent "[agent-name]" which does not exist in .ryo/agents/`

### Check 8: Scale Rule Validity

For every scale rule in `.ryo/process.md` and `.ryo/workflows/*.workflow.md`:
- Check that `required_phases` / `required_steps` is non-empty (every scope must have at least one required phase/step).
- Check that phase/step names in `skip_phases` / `skip_steps` reference actual phases/steps.
- Check that no phase/step appears in both `skip_phases`/`skip_steps` and `required_phases`/`required_steps` for the same scope (contradictory).

**Error formats:**
- `EMPTY_REQUIRED: Scale rule for scope "[scope]" in [file] has empty required_phases/required_steps`
- `INVALID_SKIP_REF: Scale rule for scope "[scope]" in [file] references "[name]" in skip list but no such phase/step exists`
- `CONTRADICTORY_SCALE_RULE: Scale rule for scope "[scope]" in [file] lists "[name]" in both skip and required`

### Check 9: Input/Output Chain Validation

For every workflow in `.ryo/workflows/`:
- For each step after the first, check that at least one value in its `inputs` array appears in a previous step's `outputs` array (within the same workflow).

This validates that the workflow steps form a coherent pipeline where each step consumes what a prior step produced.

**Warning format (non-blocking):** `INPUT_CHAIN_GAP: Workflow "[workflow-name]" step [N] input "[input]" is not produced by any prior step`

---

## Reporting Results

After running all checks, report results in this format:

```
Validation Results
==================

Checked:
  - [N] agents
  - [N] skills
  - [N] process phases
  - [N] workflows
  - [N] workflow steps total

Errors: [count]
  [list each error on its own line]

Warnings: [count]
  [list each warning on its own line]

Result: [PASS | FAIL]
```

- **PASS** if there are zero errors (warnings are acceptable).
- **FAIL** if there is at least one error.

---

## Auto-Fix Guidance

When running as part of ryo-gen (not standalone ryo-check), attempt to fix errors automatically:

| Error Type | Auto-Fix Strategy |
|------------|------------------|
| AGENT_NOT_FOUND | Remove the step referencing the missing agent, or ask user which agent to substitute |
| SKILL_NOT_FOUND | Remove the skill from the step's skills array (if other skills remain) or ask user |
| PHASE_NOT_FOUND | Check if the phase name is a close match (typo). If so, fix. Otherwise ask user |
| HANDOFF_CYCLE | Remove the edge that creates the cycle (the last handoff_to entry added). Ask user to confirm |
| HANDOFF_TARGET_NOT_FOUND | Remove the dangling reference from handoff_to. Warn user |
| ORPHAN_AGENT | Warn user. Do not auto-delete agents |
| RUNTIME_MISMATCH | Add the org's runtimes to the skill's runtimes array |
| PROCESS_AGENT_NOT_FOUND | Remove the agent from the phase's agents array. Warn user |
| EMPTY_REQUIRED | Ask user. Cannot auto-fix safely |
| CONTRADICTORY_SCALE_RULE | Remove the entry from skip list (keep it required). Warn user |

After auto-fixes, re-run all checks to confirm the fix resolved the issue without introducing new errors.

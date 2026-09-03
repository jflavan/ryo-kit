---
name: workflow-generation
description: >
  Generates workflow definitions that tie agents, skills, and process phases
  together into concrete step-by-step sequences for different scenarios
  (new feature, bug fix, hotfix, etc.). Produces .workflow.md files with YAML
  frontmatter conforming to the WorkflowDefSchema. Includes signal-logging
  instructions for the self-improvement system.
---

# Workflow Generation Sub-Skill

You are generating workflow definitions for an AI-driven development framework. Workflows are the concrete, executable sequences that tell an AI tool exactly which agent to activate, which skills to use, and in what order — for a specific scenario like "new feature," "bug fix," or "hotfix." Workflows tie together agents, skills, and process phases into actionable step chains.

---

## Inputs

Before generating workflows, read and understand all of the following:

1. **Agent definitions** — Read all `.agent.md` files from `.ryo/agents/`. Note each agent's name, responsibilities, inputs, outputs, handoff_to, and gate.

2. **Skill definitions** — Read all `SKILL.md` files from `.agents/skills/*/`. Note each skill's name, agent association, trigger, inputs, and outputs.

3. **Process definition** — Read `.ryo/process.md`. Note each phase's name, agents, artifacts, gate, and scale_rules.

4. **Org context** — Read `org-context.yaml`. Key fields:
   - `methodology` — Affects which workflow scenarios are relevant
   - `compliance` — Affects which steps include compliance checks
   - `team.size` — Affects workflow complexity
   - `conventions` — Affects review and testing steps

5. **Decisions** — Read `.ryo/.state/decisions.md` for project-specific preferences.

6. **Constitution** — Read `constitution.md` (from `.ryo/` or `~/.ryo/`). Its YAML frontmatter carries `stop_conditions`, `scope_overrides`, `evidence`, and `audit` rules that every workflow must honour; its prose carries principles every step must respect.

7. **Fragments** — Read the **scope-classification**, **ledger**, and **verification** fragments. Every generated workflow embeds their rules.

---

## Workflow Scenarios

Generate workflows for the scenarios that make sense for the org. Not every org needs every scenario.

### Core Scenarios (generate for all orgs):

1. **new-feature** — Full workflow for implementing a new feature, from planning through deployment.
2. **bug-fix** — Shortened workflow for fixing a reported bug.
3. **hotfix** — Emergency fix path with minimal gates.

### Additional Scenarios (generate if applicable):

4. **refactor** — Code improvement without behavior change. Generate if team size is medium+.
5. **documentation** — Documentation-only changes. Generate if org values documentation (check constitution).
6. **spike** — Research/exploration task. Generate if methodology is scrum or safe.
7. **pi-planning** — PI planning ceremony workflow. Generate only if methodology is "safe".
8. **release** — Release coordination workflow. Generate if team size is large+ or methodology is "safe".

---

## Output Format

For each workflow, create a file at `.ryo/workflows/[scenario-name].workflow.md` with the following structure.

### YAML Frontmatter (required fields from WorkflowDefSchema)

```yaml
---
name: [scenario-name]
description: >
  [2-3 sentence description of when this workflow is used]
trigger: [scenario trigger, e.g., "new-feature", "bug-fix", "hotfix"]
steps:
  - phase: [process phase name this step belongs to]
    agent: [agent name performing this step]
    skills:
      - [skill name(s) used in this step]
    inputs:
      - [artifacts consumed by this step]
    outputs:
      - [artifacts produced by this step]
    gate:
      type: [human | automated | hybrid]
      criteria:
        - [criterion that must pass before proceeding to next step]
      evidence:
        - [artifact that must exist before the gate can pass, e.g. test-results, review-report]
      approvers:            # optional — who may pass a human/hybrid gate
        count: 1
        roles: [team roles that may approve]
        agents: [agents that may approve — never the step's own agent when separation_of_duties is set]
      skippable_for: [scope labels that may skip this gate; use [] for gates no scope may skip]
      separation_of_duties: [true when the approver must not be the agent that did the work]
  - phase: [next phase]
    agent: [next agent]
    ...
scale_rules:
  - scope: [e.g., "small-change"]
    skip_steps:
      - [step descriptions or phases to skip]
    required_steps:
      - [steps that must always run]
---
```

### Markdown Body

Below the frontmatter, write a human-readable walkthrough of the workflow:

```markdown
# [Workflow Name]

## Overview

[2-3 sentences explaining when this workflow is triggered and what it accomplishes.]

## Before Step 1: Classify Scope

Follow the **scope-classification** fragment. Run `npx ryo-kit classify <paths> --scope <proposed>`,
announce the resulting scope and which steps the scale rules skip, and append a
`scope-classification` signal. Start the ledger at `.ryo/.state/ledger.md` per the **ledger**
fragment. Approval of the intended approach is required before any implementation step, at
every scope: the design may be two sentences in chat, but the yes is not optional.

## Steps

### Step 1: [Phase Name] — [Agent Name]

**Skills:** [skill-name]
**Inputs:** [what this step reads]
**Outputs:** [what this step produces]
**Gate:** [what must pass]

[1-2 paragraphs explaining what happens in this step. Be specific enough that an
AI tool could follow these instructions.]

**Evidence:** [what must be produced and checked, fresh, before this gate can pass — see the
verification fragment. Name the command or artifact.]

**Signal logging:** At the end of this step, append a signal entry to
`.ryo/.state/signals.md` recording the gate outcome and its evidence, and append
`Step 1: complete (...)` to `.ryo/.state/ledger.md`.

### Step 2: [Phase Name] — [Agent Name]
...

## Scale Rules

[Explain how this workflow shortens or expands based on the scope of the change. Name the
gates that no scope may skip.]

## Stop Conditions

Stop and ask the user for: irreversible or destructive operations; security-sensitive actions;
side effects outside the working branch (merge, push to a shared branch, publish, deploy);
a plan so broken every path forward is a guess; any `type: human` gate; and each condition
listed under `stop_conditions` in the constitution: [copy them here verbatim]. Everything
else is a ruling: decide, record `Ruling: what — why — cost if wrong` in the ledger, continue.

## Finishing

Collect every `Ruling:` and `Parked:` line from the ledger into the final message under
"Rulings I made". Then archive the ledger to `.ryo/.state/audit/` if the constitution's
`audit.retain_ledgers` is true (the default).

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too small to classify" | Classification is one sentence. Say it, then follow the path it names. |
| "The gate is a formality here" | Gates exist for the cases that look like formalities. Produce the evidence. |
| "I'll review my own work, it's faster" | Self-review is not review. Where the process has a reviewer, hand it the diff from a fresh context; where it has none, the gate passes on fresh evidence, not on your reading. |
| "The user obviously wants it merged" | Integration is a stop condition. Present the evidence and wait. |
| "I'll remember where I was" | You will not survive compaction. The ledger will. Write the line. |
| "Recording the ruling is overhead" | An unrecorded ruling is a decision made in secret. |
```

---

## Signal Logging Instructions

Every workflow step that includes a gate MUST include signal-logging instructions in its markdown body. This feeds the self-improvement system.

At each gate/handoff point, the workflow step must instruct the AI tool to append an entry to `.ryo/.state/signals.md` in this format:

```markdown
- **[timestamp]** | [signal-type] | [subject] | [outcome] | [context]
```

Where:
- `timestamp` — Current date and time (ISO 8601 or human-readable)
- `signal-type` — One of: `gate-outcome`, `phase-skip`, `agent-skip`, `skill-skip`, `manual-override`, `ruling`, `scope-classification`, `evidence`
- `subject` — Name of the gate, phase, agent, or skill
- `outcome` — What happened: `passed`, `failed`, `skipped`, `overridden`
- `context` — Brief reason or relevant data (optional)

### Signal logging examples:

```markdown
- **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%, all tests green
- **2026-03-15 16:00** | phase-skip | design | skipped | scope: bug-fix, no architecture change
- **2026-03-16 09:00** | manual-override | security-reviewer | skipped | "user decided: too small for security review"
- **2026-03-16 09:05** | scope-classification | new-feature | feature | proposed bug-fix, upgraded by scope_overrides on auth/**
- **2026-03-16 11:40** | ruling | new-feature/step-3 | used existing retry helper | plan named a new one; cost if wrong: duplicate helper
- **2026-03-16 12:10** | evidence | testing-gate | npm test | 42/42 passed, exit 0
```

Include these instructions directly in the workflow step body. The AI tool executing the workflow will follow them naturally.

---

## Step Design Rules

1. **Every step must reference a valid process phase.** The `phase` field must match a phase name from `.ryo/process.md`.
2. **Every step must reference a valid agent.** The `agent` field must match an agent name from `.ryo/agents/`.
3. **Every step must reference at least one valid skill.** The `skills` array must contain skill names that exist in `.agents/skills/`.
4. **Step ordering must follow the process phase ordering.** Steps should progress through phases in the order defined in `process.md`. A step in phase 3 should not come before a step in phase 2.
5. **Inputs and outputs must chain correctly.** Step N's outputs should appear in Step N+1's inputs (or later steps). The first step's inputs come from the workflow trigger. The last step's outputs are the workflow's deliverable.
6. **Gates at step level override process-level gates** when they are more specific. For example, a hotfix workflow may use `type: "automated"` for a review gate that the process defines as `type: "human"` — unless the process gate has `skippable_for: []` or `separation_of_duties: true`, which a workflow may never weaken.
7. **Separation of duties.** When the org has more than one agent, a review or verification step must be performed by a different agent than the implementation step it reviews, and its gate carries `separation_of_duties: true`. A reviewer reads the diff and the implementer's report; it never inherits the implementer's context and it never trusts the report over the code.
8. **Every gated step names its evidence.** The gate's `evidence` array lists the artifacts (test output, review report, build result) that must exist, freshly produced in that step, before the gate can pass. Follow the **verification** fragment.
9. **Compliance gates are never skippable.** Steps whose gate the process marks `skippable_for: []` appear in every scale rule's `required_steps`.

---

## Scale Rules Design

Each workflow should have scale rules that adapt it to different scopes of work:

1. **required_steps** — Steps that ALWAYS execute regardless of scope. Every workflow must have at least 2 required steps (implementation + verification).
2. **skip_steps** — Steps to skip for a given scope. Reference steps by their phase name.
3. **Scope values** should be consistent across workflows: use `small-change`, `bug-fix`, `feature`, `epic` as standard scope labels.

Example scale rules for a new-feature workflow:
```yaml
scale_rules:
  - scope: small-change
    skip_steps:
      - design
      - integration
    required_steps:
      - implementation
      - testing
      - review
  - scope: epic
    required_steps:
      - planning
      - design
      - implementation
      - testing
      - review
      - integration
      - release
```

---

## Writing Instructions

1. **Write each workflow file immediately after designing it.** Do not batch writes.
2. **Read `.ryo/workflows/` before writing** to check for existing workflows (relevant when resuming). Do not overwrite unless regenerating.
3. **Use kebab-case for file names.** Example: `new-feature.workflow.md`, not `NewFeature.workflow.md`.
4. **Validate all references before writing:**
   - Every `phase` value exists in `process.md`
   - Every `agent` value exists in `.ryo/agents/`
   - Every skill in `skills` arrays exists in `.agents/skills/`
5. **Include signal logging in every gated step.** This is not optional. The self-improvement system depends on it.
6. **Include the classification, ledger, evidence, stop-condition, finishing, and rationalization sections** in every workflow body, filled in for this workflow (not left as placeholders). Copy the constitution's `stop_conditions` verbatim into the Stop Conditions section.
6. **Report what you created.** After writing all workflows, list them: "Created N workflows: [name] (M steps), ..."

---

## Error Handling

- **No agent definitions found:** Stop. Agents must exist before workflows can reference them.
- **No skill definitions found:** Stop. Skills must exist before workflows can reference them.
- **No process definition found:** Stop. The process definition must exist before workflows can reference phases.
- **Agent referenced in process but not in `.ryo/agents/`:** Skip that agent in workflow steps. Report the inconsistency.
- **Skill does not exist for a workflow step:** Either omit the step or create a placeholder note indicating a skill needs to be created. Report the gap.
- **`.ryo/workflows/` directory does not exist:** Create it.
- **`.ryo/.state/signals.md` does not exist:** The workflow instructions should tell the AI tool to create it on first write. Include a header: `# Signals\n\n`.

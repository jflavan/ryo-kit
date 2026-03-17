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

## Steps

### Step 1: [Phase Name] — [Agent Name]

**Skills:** [skill-name]
**Inputs:** [what this step reads]
**Outputs:** [what this step produces]
**Gate:** [what must pass]

[1-2 paragraphs explaining what happens in this step. Be specific enough that an
AI tool could follow these instructions.]

**Signal logging:** At the end of this step, append a signal entry to
`.ryo/.state/signals.md` recording the gate outcome.

### Step 2: [Phase Name] — [Agent Name]
...

## Scale Rules

[Explain how this workflow shortens or expands based on the scope of the change.]
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
- `signal-type` — One of: `gate-outcome`, `phase-skip`, `agent-skip`, `skill-skip`, `manual-override`
- `subject` — Name of the gate, phase, agent, or skill
- `outcome` — What happened: `passed`, `failed`, `skipped`, `overridden`
- `context` — Brief reason or relevant data (optional)

### Signal logging examples:

```markdown
- **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%, all tests green
- **2026-03-15 16:00** | phase-skip | design | skipped | scope: bug-fix, no architecture change
- **2026-03-16 09:00** | manual-override | security-reviewer | skipped | "user decided: too small for security review"
```

Include these instructions directly in the workflow step body. The AI tool executing the workflow will follow them naturally.

---

## Step Design Rules

1. **Every step must reference a valid process phase.** The `phase` field must match a phase name from `.ryo/process.md`.
2. **Every step must reference a valid agent.** The `agent` field must match an agent name from `.ryo/agents/`.
3. **Every step must reference at least one valid skill.** The `skills` array must contain skill names that exist in `.agents/skills/`.
4. **Step ordering must follow the process phase ordering.** Steps should progress through phases in the order defined in `process.md`. A step in phase 3 should not come before a step in phase 2.
5. **Inputs and outputs must chain correctly.** Step N's outputs should appear in Step N+1's inputs (or later steps). The first step's inputs come from the workflow trigger. The last step's outputs are the workflow's deliverable.
6. **Gates at step level override process-level gates** when they are more specific. For example, a hotfix workflow may use `type: "automated"` for a review gate that the process defines as `type: "human"`.

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

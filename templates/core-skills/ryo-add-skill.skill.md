---
name: ryo-add-skill
description: >
  Conversational skill creation tool. Walks the user through defining a new
  skill, generates a SKILL.md file conforming to SkillDefSchema with a full
  prompt body, and updates agent definitions and workflows as needed.
trigger: /ryo-add-skill
---

# ryo-add-skill — Conversational Skill Creation

You are creating a new skill definition for the user's AI-driven development framework. You will gather requirements conversationally, check for conflicts with existing skills, generate the skill file with a complete prompt body, and wire it into the relevant agents and workflows.

---

## Step 1: Verify Framework Exists

Before starting, confirm the framework is in place:

1. Check that `.agents/skills/` exists.
2. Check that `.ryo/agents/` exists and contains at least one `.agent.md` file.
3. Check that `.ryo/process.md` exists.

If any of these are missing, stop and tell the user:
> "No generated framework found. Run `/ryo-gen` first to generate the base framework, then use `/ryo-add-skill` to add new skills."

---

## Step 2: Inventory Existing Skills and Agents

### Skills

Read all `SKILL.md` files in `.agents/skills/*/`. For each, extract from the YAML frontmatter:
- `name`
- `description`
- `trigger`
- `agent` (if present)
- `inputs`
- `outputs`

Build a list of existing skills and their purposes.

### Agents

Read all `.agent.md` files in `.ryo/agents/`. For each, extract:
- `name`
- `role`
- `responsibilities`

Build a list of agents for the user to choose from when assigning the skill.

---

## Step 3: Gather Requirements Conversationally

Ask the user the following questions. Adapt based on their responses.

### Required questions:

1. **"What should this skill do?"**
   Get a clear description of the skill's purpose and behavior. Push for specifics — "test" is too vague; "run unit tests, report coverage, and flag untested critical paths" is actionable.

2. **"What does this skill need as input?"**
   Examples: "source code files," "test results," "architecture document," "PR diff."

3. **"What does this skill produce as output?"**
   Examples: "test report," "review comments," "deployment manifest," "security audit log."

### Agent assignment:

4. **"Should this skill be associated with a specific agent, or is it standalone?"**
   Present the list of existing agents with their roles. Options:
   - Associate with an existing agent (skill's `agent` field is set)
   - Standalone (skill's `agent` field is omitted — any agent or the user can invoke it)
   - Associate with multiple agents (create the skill as standalone but note the intended agents)

   If the user picks an agent, verify the skill's purpose aligns with that agent's responsibilities. If it does not, note the mismatch and ask the user to confirm.

### Overlap detection:

After hearing the skill's purpose, check against existing skills:

- If the new skill overlaps significantly with an existing skill, **warn the user**:
  > "The existing [skill-name] skill already does [overlapping capability]. Options:
  > 1. Proceed anyway (both skills exist; useful if they serve different contexts)
  > 2. Extend the existing skill instead (modify [skill-name] to cover this use case)
  > 3. Cancel"

- Wait for the user's choice before proceeding.

### Conditional questions:

5. **"What trigger should invoke this skill?"**
   Suggest a convention-following name: `/[skill-name]` for slash-command runtimes, or a descriptive rule name for rule-based runtimes (Cursor, Windsurf). Default to the skill name in kebab-case.

6. **"Which AI runtimes should this skill target?"**
   Read `tools.ai` from org-context.yaml (check `.ryo/org-context.yaml` first, then `~/.ryo/org-context.yaml`). Default to all runtimes listed there. Ask the user if they want to limit it.

7. **"Are there any specific behavioral rules or constraints for this skill?"**
   Examples: "must not modify files outside the `src/` directory," "must ask for confirmation before deleting anything," "must respect the testing conventions in constitution.md."

---

## Step 4: Generate the Skill Definition

Create the directory `.agents/skills/[skill-name]/` and write the file `.agents/skills/[skill-name]/SKILL.md`.

### File format:

```markdown
---
name: [skill-name]
description: >
  [2-3 sentence description of what this skill does and when to use it.]
trigger: [trigger-command]
agent: [agent-name]  # omit this line entirely if standalone
inputs:
  - [input 1]
  - [input 2]
outputs:
  - [output 1]
  - [output 2]
runtimes:
  - [runtime-1]
  - [runtime-2]
---

# [Skill Name]

[Full prompt body that instructs the AI how to execute this skill. This is
the actual prompt that runs when the skill is invoked.]

## Purpose

[What this skill accomplishes and why it exists.]

## Inputs

[Detailed description of each input — where to find it, how to read it,
what to look for.]

## Steps

[Step-by-step instructions for executing the skill. Be specific about:]

### Step 1: [Name]
[What to do, what to read, what to check.]

### Step 2: [Name]
[What to do next. Include decision points and branching logic.]

### Step N: [Name]
[Final steps, output writing, and handoff.]

## Output Format

[Exact format of what the skill produces. Include a template or example
if the output is structured (e.g., markdown report, YAML file, etc.).]

## Error Handling

[What to do when things go wrong:]
- [Scenario 1]: [How to handle it]
- [Scenario 2]: [How to handle it]

## Behavioral Rules

1. [Rule 1 — e.g., "Read files before modifying them."]
2. [Rule 2 — e.g., "Do not invent data. If information is missing, ask."]
3. [Rule 3 — e.g., "Write outputs immediately, do not batch."]
```

### YAML frontmatter rules:

- All fields must conform to the SkillDefSchema (see project spec).
- `name` must be unique across all skills in `.agents/skills/`.
- `trigger` should follow the project's naming convention (typically `/[kebab-case-name]`).
- `agent` is optional. Omit the field entirely (do not set it to null or empty string) if the skill is standalone.
- `runtimes` must include at least one runtime from the org's `tools.ai` list.

### Prompt body guidelines:

The prompt body (everything below the YAML frontmatter) is the actual instruction set that runs when the skill is invoked. It must be:

- **Self-contained:** The AI executing this skill should not need external context beyond what's specified in the inputs.
- **Specific:** Use concrete file paths, artifact names, and format descriptions. Avoid vague instructions.
- **Structured:** Use labeled sections (Purpose, Inputs, Steps, Output Format, Error Handling, Behavioral Rules).
- **Runtime-agnostic:** Do not reference specific AI tools or their features. The skill runs identically across all target runtimes.
- **Actionable:** Every step should result in a concrete action (read a file, write a file, ask the user a question, make a decision).

---

## Step 5: Update Agent Definitions

If the skill is associated with an agent (has an `agent` field):

1. Read the agent's `.agent.md` file from `.ryo/agents/`.
2. Check if the agent's `responsibilities` already cover what this skill does. If not, consider whether the agent's responsibilities should be updated to include the new capability.
3. Present any proposed changes to the user for confirmation before writing.

Note: The agent's `.agent.md` does not have a `skills` array in its frontmatter (skills reference agents via the skill's `agent` field, not the other way around). However, the agent's prose body may list skills it works with. If it does, update that section to include the new skill.

---

## Step 6: Update Workflows

Read all workflow files in `.ryo/workflows/`. Check if any workflow steps involve the agent this skill is associated with.

For each relevant workflow step:

1. Check the step's `skills` array.
2. If the new skill is relevant to what that step does, suggest adding it to the `skills` array.
3. Show the user the proposed change and get confirmation before writing.

If the skill is standalone (no agent), ask the user if it should be added to any workflow steps. Show the list of existing workflows and their steps.

Tell the user which workflows were updated and what changed.

---

## Step 7: Summary and Next Steps

Present a summary of everything that was created and modified:

```
## Skill Created

- File: .agents/skills/[skill-name]/SKILL.md
- Trigger: [trigger]
- Agent: [agent-name or "standalone"]
- Runtimes: [list]

## Files Modified

- .ryo/workflows/[workflow-name].workflow.md — added [skill-name] to step [N]

## Recommended Next Steps

1. To install this skill into your AI tool(s), run: `npx ryo-kit gen`
2. Run `npx ryo-kit check` to validate the updated framework.
3. Test the skill by invoking [trigger] in your AI tool.
```

---

## Error Handling

- **Skill name already exists:** Tell the user the name conflicts with `.agents/skills/[name]/SKILL.md`. Ask them to choose a different name or modify the existing skill.
- **Agent does not exist:** If the user specifies an agent that does not exist in `.ryo/agents/`, list the available agents and ask them to choose one, make it standalone, or create the agent first with `/ryo-add-agent`.
- **Runtime not in org context:** If the user specifies a runtime not listed in `tools.ai`, warn them. The skill will not be installable for that runtime unless the org context is updated.
- **File write fails:** Report the exact path and error. Do not proceed to subsequent steps.

---

## Important Behavioral Rules

1. **Read existing files first.** Always read the current state of skills, agents, and workflows before making changes.
2. **Confirm before modifying existing files.** Never silently update an agent definition or workflow. Show the user what will change and get confirmation.
3. **Write the skill file immediately.** Write it as soon as the definition is finalized. Do not wait for workflow updates.
4. **Respect the SkillDefSchema.** Every field in the YAML frontmatter must conform to the schema.
5. **Write a complete prompt body.** The skill is useless without detailed instructions below the frontmatter. Do not generate a skeleton — generate a fully functional prompt.
6. **Use kebab-case for directory and file names.** Convert skill names like "Security Scan" to `.agents/skills/security-scan/SKILL.md`.

---
name: ryo-add-agent
description: >
  Conversational agent creation skill. Walks the user through defining a new
  agent role, generates an .agent.md file conforming to AgentDefSchema, and
  updates relevant workflows to include the new agent.
trigger: /ryo-add-agent
---

# ryo-add-agent — Conversational Agent Creation

You are creating a new agent definition for the user's AI-driven development framework. You will gather requirements conversationally, check for conflicts with existing agents, generate the agent file, and wire it into the framework.

---

## Step 1: Verify Framework Exists

Before starting, confirm the framework is in place:

1. Check that `.ryo/agents/` exists and contains at least one `.agent.md` file.
2. Check that `.ryo/process.md` exists.
3. Check that `.agents/skills/` exists.

If any of these are missing, stop and tell the user:
> "No generated framework found. Run `/ryo-gen` first to generate the base framework, then use `/ryo-add-agent` to add new agents."

---

## Step 2: Inventory Existing Agents

Read all `.agent.md` files in `.ryo/agents/`. For each, extract from the YAML frontmatter:
- `name`
- `role`
- `description`
- `responsibilities`
- `handoff_to`

Build a list of existing agents and their responsibilities. You will use this to detect overlap with the new agent.

---

## Step 3: Gather Requirements Conversationally

Ask the user the following questions. Adapt based on their responses — skip questions that become irrelevant based on earlier answers.

### Required questions:

1. **"What role should this agent fill?"**
   Listen for the core responsibility. Examples: "security review," "documentation," "database administration," "API design."

2. **"What specific responsibilities should it have?"**
   Get a concrete list. Push back on vague answers — responsibilities should be actionable (e.g., "review code for SQL injection vulnerabilities" not just "security").

3. **"What artifacts does this agent consume (inputs) and produce (outputs)?"**
   Examples of inputs: "pull request code," "architecture docs," "test results."
   Examples of outputs: "security review report," "approved/rejected status," "remediation list."

### Overlap detection:

After hearing the role and responsibilities, check against existing agents:

- If the new agent's responsibilities overlap significantly with an existing agent, **warn the user**:
  > "The existing [agent-name] agent already handles [overlapping responsibility]. Adding this new agent would create overlap. Options:
  > 1. Proceed anyway (both agents cover this area)
  > 2. Split responsibilities (modify the existing agent to remove the overlap)
  > 3. Cancel and modify the existing agent instead"

- Wait for the user's choice before proceeding.

### Conditional questions:

4. **"Which agents should hand off to this one?"** (upstream)
   Show the user the current agent pipeline. Ask where in the flow this agent sits.

5. **"Which agents should this one hand off to?"** (downstream)
   Based on what the agent produces, suggest logical handoff targets from existing agents.

6. **"Should this agent have a validation gate before handoff?"**
   If yes, ask:
   - Gate type: human, automated, or hybrid?
   - What criteria must pass?

7. **"Does this agent need specific tool access?"** (optional)
   Examples: file system, web search, code execution, external APIs.

---

## Step 4: Reference the Decision Tree

Consult the **decision-tree** fragment heuristics to validate the agent design:

- Does the org profile support this agent? (e.g., a compliance-auditor makes sense only if compliance requirements exist)
- Is the agent count getting too high for the team size? (solo dev with 6+ agents is unusual)
- Does the agent fill a gap identified by the heuristics?

If the decision tree suggests the agent may not be needed, share this observation with the user but respect their decision.

---

## Step 5: Generate the Agent Definition

Write the agent file to `.ryo/agents/[agent-name].agent.md` where `[agent-name]` is a kebab-case version of the agent name.

### File format:

```markdown
---
name: [agent-name]
role: [one-line role description]
description: >
  [2-3 sentence description of what this agent does, when it's involved,
  and what value it provides to the development process.]
responsibilities:
  - [responsibility 1]
  - [responsibility 2]
  - [responsibility 3]
inputs:
  - [input artifact 1]
  - [input artifact 2]
outputs:
  - [output artifact 1]
  - [output artifact 2]
handoff_to:
  - [downstream-agent-name]
tools:
  - [tool-category]
gate:
  type: [human | automated | hybrid]
  criteria:
    - [criterion 1]
    - [criterion 2]
---

# [Agent Name]

[Detailed prompt instructions for this agent. This section tells the AI
how to behave when operating as this agent. Include:]

## Role

[What this agent does and why it exists in the process.]

## Responsibilities

[Expanded description of each responsibility with examples and guidelines.]

## Inputs

[What artifacts to read and how to interpret them.]

## Outputs

[What artifacts to produce, with format expectations.]

## Handoff Protocol

[When and how to hand off to downstream agents. What must be true before handoff.]

## Quality Criteria

[Standards this agent must meet. Gate criteria expanded with examples.]
```

### YAML frontmatter rules:

- All fields must conform to the AgentDefSchema (see project spec).
- `name` must be unique across all agents in `.ryo/agents/`.
- `handoff_to` must reference only agents that exist (or will be created).
- `gate` is optional. Omit it entirely if the user does not want a gate.
- `tools` is optional. Omit if not applicable.

---

## Step 6: Update Upstream Agent Handoffs

For each existing agent that should hand off to the new agent (identified in Step 3, question 4):

1. Read the upstream agent's `.agent.md` file.
2. Add the new agent's name to the upstream agent's `handoff_to` array in the YAML frontmatter.
3. Write the updated file.

Tell the user which files were modified.

---

## Step 7: Update Workflows

Read all workflow files in `.ryo/workflows/`. For each workflow that involves the upstream or downstream agents:

1. Determine where the new agent should be inserted in the workflow steps.
2. Ask the user to confirm the insertion point.
3. Add a new step for the new agent at the confirmed position. The step should include:
   - `phase` — The process phase this step belongs to (check `.ryo/process.md` for valid phases)
   - `agent` — The new agent's name
   - `skills` — Leave as an empty array `[]` for now (the user can add skills with `/ryo-add-skill` or the skill can be created later)
   - `inputs` — The new agent's input artifacts
   - `outputs` — The new agent's output artifacts
   - `gate` — The new agent's gate (if defined)

4. Write the updated workflow file.

Tell the user which workflows were updated and what changed.

---

## Step 8: Summary and Next Steps

Present a summary of everything that was created and modified:

```
## Agent Created

- File: .ryo/agents/[agent-name].agent.md
- Role: [role]
- Responsibilities: [count] defined
- Gate: [type] ([count] criteria)

## Files Modified

- .ryo/agents/[upstream-agent].agent.md — added handoff to [agent-name]
- .ryo/workflows/[workflow-name].workflow.md — inserted step at position [N]

## Recommended Next Steps

1. Create skills for this agent: invoke `/ryo-add-skill` and specify [agent-name] as the owning agent.
2. Run `npx ryo-kit check` to validate the updated framework.
3. Review the updated workflow(s) to confirm the new agent is positioned correctly.
```

---

## Error Handling

- **Agent name already exists:** Tell the user the name conflicts with `.ryo/agents/[name].agent.md`. Ask them to choose a different name or modify the existing agent.
- **Handoff target does not exist:** If the user specifies a handoff target that does not exist, warn them. Offer to create the agent file anyway with the dangling reference, or to change the handoff target.
- **Process phase not found:** If the workflow step references a phase not in `process.md`, list available phases and ask the user to choose one.
- **File write fails:** Report the exact path and error. Do not proceed to subsequent steps.

---

## Important Behavioral Rules

1. **Read existing files first.** Always read the current state of agents, skills, and workflows before making changes.
2. **Confirm before modifying existing files.** Never silently update an existing agent's handoffs or a workflow's steps. Show the user what will change and get confirmation.
3. **Write outputs immediately.** Write the agent file as soon as the definition is finalized. Do not wait until all updates are done.
4. **Respect the AgentDefSchema.** Every field in the YAML frontmatter must conform to the schema. Do not add fields that are not in the schema.
5. **Use kebab-case for file names.** Convert agent names like "Security Reviewer" to `security-reviewer.agent.md`.

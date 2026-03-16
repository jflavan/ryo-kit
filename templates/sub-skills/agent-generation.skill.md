---
name: agent-generation
description: >
  Generates agent definitions tailored to the organization's context, team size,
  methodology, and compliance requirements. Produces .agent.md files with YAML
  frontmatter conforming to the AgentDefSchema.
---

# Agent Generation Sub-Skill

You are generating agent definitions for an AI-driven development framework. Each agent represents a distinct role in the development process. The number, names, and responsibilities of agents are determined entirely by the organizational context — they are NOT predetermined.

---

## Inputs

Before generating any agents, read and understand all of the following:

1. **Org context** — Read `org-context.yaml` (from `.ryo/` or `~/.ryo/`). Pay special attention to:
   - `team.size` — Determines agent count. Solo = fewer agents; enterprise = more.
   - `methodology` — Shapes which process-oriented roles exist (e.g., SAFe needs PI planning).
   - `compliance` — Determines whether dedicated compliance/security agents are needed.
   - `team.roles` (if present) — Map agents to actual team roles where possible.

2. **Constitution** — Read `constitution.md` (from `.ryo/` or `~/.ryo/`). Agents must respect all non-negotiable principles listed here.

3. **Decisions** — Read `.ryo/.state/decisions.md`. This contains user answers from the clarification phase. Look for:
   - Project type (greenfield vs brownfield)
   - Specific agent requests or exclusions
   - Constraints that affect role design

4. **Decision-tree heuristics** — Use the decision-tree fragment as your starting point for agent selection. The heuristics there map org profiles to likely agent sets. Use them as defaults, not hard constraints.

---

## Decision Logic

### Agent Count Guidelines

These are starting points. Adjust based on the full org context.

| Team Size | Methodology | Compliance | Typical Agent Count |
|-----------|-------------|------------|-------------------|
| solo      | any         | none       | 2                 |
| solo      | any         | any        | 3                 |
| small     | scrum/kanban| none       | 3-4               |
| small     | scrum/kanban| any        | 4-5               |
| medium    | scrum       | none       | 4-5               |
| medium    | scrum       | any        | 5-6               |
| large     | safe        | none       | 5-7               |
| large     | safe        | any        | 6-8               |
| enterprise| safe        | multiple   | 7-10              |

### Common Agent Patterns

**Minimal set (solo dev, no compliance):**
- `builder` — Plans and implements code changes
- `verifier` — Reviews code, runs tests, validates quality

**Small scrum team:**
- `architect` — Designs solutions, makes technical decisions
- `builder` — Implements code changes
- `reviewer` — Reviews code for quality, consistency, standards
- `tester` — Writes and maintains tests, validates behavior

**SAFe + compliance (enterprise):**
- `pi-planner` — Manages PI planning ceremonies and cross-team coordination
- `architect` — System design and technical decisions
- `builder` — Implementation
- `reviewer` — Code review and standards enforcement
- `compliance-auditor` — Validates compliance requirements are met
- `security-reviewer` — Security-focused review and threat modeling
- `tester` — Test strategy, test implementation, quality validation
- `release-manager` — Release coordination, deployment gating

### Additional Agent Triggers

- If `compliance` includes "hipaa" or "pci-dss": Add a `compliance-auditor` agent if not already present.
- If `compliance` includes any value: Add a `security-reviewer` agent if not already present.
- If `methodology` is "safe": Add a `pi-planner` agent if not already present.
- If `team.size` is "large" or "enterprise": Consider a `release-manager` agent.
- If the user requested specific agents in decisions.md, honor those requests.
- If the user excluded specific agents in decisions.md, omit them.

---

## Output Format

For each agent, create a file at `.ryo/agents/[agent-name].agent.md` with the following structure.

### YAML Frontmatter (required fields from AgentDefSchema)

```yaml
---
name: [agent-name]
role: [short role title, e.g., "Code Builder"]
description: >
  [2-3 sentence description of what this agent does and when it is active]
responsibilities:
  - [specific responsibility 1]
  - [specific responsibility 2]
  - [specific responsibility 3]
inputs:
  - [artifact or context this agent reads, e.g., "design documents", "task specifications"]
outputs:
  - [artifact this agent produces, e.g., "implemented code", "test results"]
handoff_to:
  - [agent-name that receives this agent's outputs]
tools:
  - [tool category, e.g., "code-editor", "terminal", "browser"]
gate:
  type: [human | automated | hybrid]
  criteria:
    - [criterion that must pass before handoff]
---
```

### Markdown Body

Below the frontmatter, write a brief section explaining the agent's role in plain language:

```markdown
# [Agent Name]

## Role

[1-2 paragraphs explaining what this agent does, when it activates, and how it
interacts with other agents. Write as if explaining to a human team member.]

## Handoff Protocol

[Describe what must be true before this agent hands off to the next agent.
Reference the gate criteria from the frontmatter.]
```

---

## Handoff Chain Rules

1. **Every agent must have at least one entry in `handoff_to`**, except terminal agents (agents that produce final deliverables like deployment artifacts).
2. **Handoff chains must form a directed acyclic graph (DAG).** No cycles. Agent A cannot hand off to Agent B if Agent B (directly or indirectly) hands off back to Agent A.
3. **The first agent in the chain** should be the one that initiates work (typically a planner or architect).
4. **The last agent(s) in the chain** should be the ones that produce validated, deployable output.
5. **Inputs and outputs must align across handoffs.** If Agent A lists "design document" in `outputs` and hands off to Agent B, then Agent B must list "design document" (or a superset) in `inputs`.

---

## Writing Instructions

1. **Write each agent file immediately after designing it.** Do not design all agents first and write them all at the end.
2. **Read `.ryo/agents/` before writing** to check for existing agent files (relevant when resuming a partial generation). Do not overwrite existing agents unless the user explicitly asks for regeneration.
3. **Use kebab-case for file names.** Example: `security-reviewer.agent.md`, not `SecurityReviewer.agent.md`.
4. **Validate handoff consistency** after writing all agents. Every name in any `handoff_to` array must correspond to an actual agent file.
5. **Report what you created.** After writing all agents, list them with a one-line summary: "Created N agents: [name] (role), [name] (role), ..."

---

## Error Handling

- **No org-context.yaml found:** Stop. Report the error. Do not generate agents without org context.
- **Conflicting user decisions:** If the user requested an agent but also excluded a role that overlaps, ask for clarification. Do not guess.
- **`.ryo/agents/` directory does not exist:** Create it.
- **Existing agent files present:** Read them. If this is a resume, skip agents that already exist. If this is a regeneration (user explicitly requested), overwrite them.

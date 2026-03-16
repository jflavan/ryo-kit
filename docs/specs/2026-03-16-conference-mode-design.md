# Conference Mode Design Spec

## Overview

Conference mode brings all of a project's ryo-kit agents into a single collaborative conversation, inspired by BMAD-method's Party Mode. Instead of interacting with agents one at a time, users can pose questions or topics and get responses from multiple relevant agents per message, each responding in character with structured turn-taking.

## Goals

- Let users get multi-perspective input from their agent team in a single session
- Make agent responses feel distinct via persona data (name, icon, communication style, identity)
- Integrate naturally into existing ryo-kit flows (CLI install + slash command invocation)
- Keep it conversational — the discussion is the output, no formal artifacts produced

## Non-Goals

- Free-form agent-to-agent discussion (structured turns only — each agent responds independently to the user's message, not to each other)
- Formal summary/recommendation documents
- Runtime orchestration in the CLI (CLI only installs the skill)

---

## 1. Agent Schema Extension

Add an optional `persona` object to `AgentDefSchema` in `src/context/schema.js`:

```javascript
persona: z.object({
  displayName: z.string(),
  icon: z.string(),
  communicationStyle: z.string(),
  identity: z.string(),
}).optional()
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Human-friendly name (e.g., "Winston") |
| `icon` | string | Emoji identifier (e.g., "🏗️") |
| `communicationStyle` | string | How the agent communicates (e.g., "Calm, pragmatic. Weighs trade-offs explicitly.") |
| `identity` | string | Grounding statement for the agent's perspective (e.g., "Senior architect with 20 years of experience.") |

### Example Agent Frontmatter

```yaml
name: architect
role: Solution Architect
description: Designs system architecture and makes technical decisions
persona:
  displayName: Winston
  icon: "\U0001F3D7"
  communicationStyle: "Calm, pragmatic. Speaks in measured terms. Weighs trade-offs explicitly."
  identity: "Senior architect with 20 years of experience. Values simplicity and maintainability."
responsibilities:
  - Define system boundaries and integration points
  - Evaluate technology choices
inputs:
  - requirements
outputs:
  - architecture-decision-records
handoff_to:
  - builder
```

### Backward Compatibility

`persona` is optional. Existing agents without it continue to validate and function. Conference mode falls back to inferring personality from `role` and `description` when persona is absent.

---

## 2. Conference Skill Template

New file: `templates/core-skills/ryo-conference.skill.md`

This is placed in `core-skills/` so it is always installed by `ryo gen` and `ryo evolve` — conference mode is a core capability available to all projects. The ryo-gen clarification question (Section 4a) asks whether the user wants agents generated with persona data, not whether the skill itself should be installed.

### Skill Frontmatter

```yaml
---
name: ryo-conference
description: >
  Multi-agent collaborative discussion skill. Reads all agent definitions
  from .ryo/agents/, selects the most relevant agents for each user message,
  and presents structured responses from each agent's perspective using their
  persona data.
trigger: /ryo-conference
---
```

### Skill Template Structure

The skill template follows the same pattern as `ryo-help.skill.md` — a multi-section prompt with numbered steps:

**Step 1: Load Agent Roster**
- Read all `.ryo/agents/*.agent.md` files
- Parse frontmatter including `persona` fields
- Build an internal roster of available agents with their roles, responsibilities, inputs, outputs, and persona data
- If zero agents found: tell user to run `/ryo-gen` first and stop
- If one agent found: tell user conference mode works best with multiple agents, but proceed with single-agent responses

**Step 2: Frame the Topic**
- If the user provided a topic with their invocation (e.g., "/ryo-conference should we use GraphQL or REST?"), use that
- Otherwise, ask: "What would you like to discuss with your agent team?"

**Step 3: Per-Message Orchestration**
- For each user message, analyze the topic and select agents:
  - With 2-3 total agents: include all agents
  - With 4-6 agents: select 2-3 most relevant
  - With 7+ agents: select 3-4 most relevant
- Selection criteria:
  - Topic relevance to the agent's `responsibilities`
  - Whether the agent's `inputs` or `outputs` relate to the subject
  - Diversity of perspective (avoid selecting agents with overlapping roles)
- Present each agent's response under a header: `### {icon} {displayName} ({role})`
- Each response must reflect the agent's `communicationStyle` and `identity`
- Responses should be substantive (2-5 paragraphs) but focused

**Step 4: Fallback for Missing Persona**
- When an agent lacks `persona` data:
  - Use `name` (title-cased) as `displayName`
  - Assign a generic icon: 🔧 for builder/developer roles, 🏗️ for architect, 🔍 for reviewer/tester, 📋 for manager/planner, 💡 for analyst/designer
  - Infer communication style from `role` and `description`

**Step 5: Continuation**
- After presenting agent responses, wait for the user's next message
- Recalculate agent selection per message — different topics surface different agents
- The user can redirect discussion, ask follow-ups, or push back on any agent's position
- If the user says "end conference", "done", or moves to a different topic, exit conference mode gracefully

**Behavioral Rules:**
1. Never break character mid-response. Each agent section is written entirely from that agent's perspective.
2. Agents may reach different conclusions — this is valuable, not a bug. Present disagreements clearly.
3. Do not invent agents that don't exist in `.ryo/agents/`.
4. Keep the conference focused on the user's topic. Don't let agents wander into unrelated territory.

---

## 3. CLI Command

New file: `src/cli/commands/conference.js`

### Usage

```
ryo conference
```

### Behavior

The CLI command installs the skill template — it does **not** run a conference session. The pattern matches `ryo gen` and `ryo evolve`: CLI scaffolds, user invokes the slash command in their AI tool.

1. Resolve org context (same pattern as `ryo gen`)
2. Detect installed runtimes from org context
3. Install the `ryo-conference` skill template to each runtime
4. Print usage instructions:
   ```
   ◇ Conference mode installed. Use /ryo-conference in your AI tool to start a session.
   ```

### Registration

Added to `src/cli/index.js` via `registerConference(program)` (following the existing naming convention: `registerGen`, `registerEvolve`, `registerAdd`, etc.).

### Flags

- `-y, --yes` — Skip confirmation (consistent with other commands)

---

## 4. Planning Flow Integration

### 4a. ryo-gen Clarification Dialogue

Add a new question to Phase 2 of `templates/bootstrap/ryo-gen.skill.md`:

> "Would you like agents generated with persona data (displayName, icon, communication style, identity)? This enriches agent definitions and enables conference mode for multi-agent discussions."

Save the answer to `.ryo/.state/decisions.md`. This controls whether agent-generation produces persona fields — the conference skill itself is always installed as a core skill.

### 4b. Agent Generation Sub-Skill

Update `templates/sub-skills/agent-generation.skill.md` to generate `persona` data when the user opted in (or always, if no preference was recorded). Add to the agent output format template:

```yaml
persona:
  displayName: [A distinct first name that fits the agent's role]
  icon: [A unique emoji reflecting the role]
  communicationStyle: [2-3 sentences describing how this agent communicates — tone, vocabulary, tendencies]
  identity: [1-2 sentences grounding the agent's perspective and experience level]
```

Guidelines for the sub-skill:
- Each agent must have a unique `displayName` and `icon` within the project
- Communication styles should be distinct enough that responses feel different
- Identity should ground the agent's perspective without being a full biography

---

## 5. Validation

### Schema Validation

- `persona` is optional in the Zod schema — `ryo check` validates it when present, ignores when absent
- When `persona` is present, all four string fields are required
- No cross-reference concerns — conference mode reads whatever agents exist at runtime

### Edge Cases

- **Zero agents:** Conference skill tells user to run `/ryo-gen` first
- **One agent:** Conference skill proceeds but notes that multiple agents work better
- **Agents without persona:** Fallback behavior infers personality from role/description
- **All agents have overlapping roles:** Selection still works; the skill picks the best matches and notes the overlap

---

## 6. Testing

### Schema Tests
- `AgentDefSchema` validates with `persona` present (all four fields)
- `AgentDefSchema` validates without `persona` (backward compat)
- `AgentDefSchema` rejects partial `persona` (e.g., `displayName` only)

### CLI Command Tests
- `conferenceAction()` installs skill to detected runtimes
- `conferenceAction()` handles missing org context gracefully

### Validation Tests
- `ryo check` passes agents with and without persona data
- `ryo check` rejects agents with malformed persona (missing required fields within the object)

---

## Files Changed

| File | Change |
|------|--------|
| `src/context/schema.js` | Add `persona` to `AgentDefSchema` |
| `src/cli/commands/conference.js` | New CLI command |
| `src/cli/index.js` | Register conference command via `registerConference` |
| `templates/core-skills/ryo-conference.skill.md` | New conference skill template |
| `templates/defaults/agent-base.yaml` | Add `persona` fields to base agent template |
| `templates/bootstrap/ryo-gen.skill.md` | Add persona opt-in question to Phase 2 |
| `templates/sub-skills/agent-generation.skill.md` | Generate persona data in agent output format |
| `docs/schemas.md` | Document persona fields |

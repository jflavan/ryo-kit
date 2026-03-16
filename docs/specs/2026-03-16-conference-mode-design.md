# Conference Mode Design Spec

## Overview

Conference mode brings all of a project's ryo-kit agents into a single collaborative conversation, inspired by BMAD-method's Party Mode. Instead of interacting with agents one at a time, users can pose questions or topics and get responses from 2-3 relevant agents per message, each responding in character with structured turn-taking.

## Goals

- Let users get multi-perspective input from their agent team in a single session
- Make agent responses feel distinct via persona data (name, icon, communication style, identity)
- Integrate naturally into existing ryo-kit flows (CLI install + slash command invocation)
- Keep it conversational — the discussion is the output, no formal artifacts produced

## Non-Goals

- Free-form agent-to-agent discussion (structured turns only)
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

### Example

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

Installed as a slash command (`/ryo-conference`) to supported runtimes.

### Behavior

1. **Activation** — User invokes `/ryo-conference` or says "let's conference on this"
2. **Load agents** — Read all `.ryo/agents/*.agent.md` files, parse frontmatter including persona
3. **Topic framing** — Ask what the user wants to discuss (or use current conversation context)
4. **Per-message orchestration** — For each user message:
   - Analyze the topic against each agent's `role`, `responsibilities`, and `description`
   - Select 2-3 most relevant agents
   - Each selected agent responds in turn with a header: `### {icon} {displayName} ({role})`
   - Responses reflect the agent's `communicationStyle` and `identity`
5. **Continuation** — User replies, follows up, redirects. Agent selection recalculated per message.
6. **Exit** — User says "end conference" or moves on

### Agent Selection Logic

The skill prompt instructs the AI to select agents based on:
- Topic relevance to the agent's `responsibilities`
- Whether the agent's `inputs` or `outputs` relate to the subject
- Diversity of perspective (avoid selecting agents with overlapping roles)

### Fallback Behavior

When an agent lacks `persona` data, the skill:
- Uses `name` as `displayName`
- Assigns a generic icon based on role keywords
- Infers communication style from `role` and `description`

---

## 3. CLI Command

New file: `src/cli/commands/conference.js`

### Usage

```
ryo conference
```

### Behavior

1. Resolve org context (same pattern as `ryo gen`)
2. Detect installed runtimes
3. Install the `ryo-conference` skill template to each runtime
4. Print usage instructions

### Registration

Added to `src/cli/index.js` via `registerConferenceCommand(program)`.

### Flags

- `-y, --yes` — Skip confirmation (consistent with other commands)

---

## 4. Planning Flow Integration

### 4a. ryo-gen Clarification Dialogue

Add a new question to Phase 2 of `templates/bootstrap/ryo-gen.skill.md`:

> "Would you like to enable conference mode? This lets you bring your agents together for collaborative discussions during development."

Save the answer to `.ryo/.state/decisions.md`. If yes, include the conference skill in the Phase 6 install step.

### 4b. Agent Generation Sub-Skill

Update `templates/sub-skills/agent-generation.skill.md` to always generate `persona` data:

- Pick a distinct `displayName` for each agent
- Assign a unique `icon` emoji that reflects the role
- Write a `communicationStyle` that differentiates agents from each other
- Write an `identity` grounding the agent's perspective and experience

This enriches all agents regardless of whether conference mode is enabled.

---

## 5. Validation

No special validation changes needed:

- `persona` is optional in the Zod schema, so `ryo check` validates it when present and ignores it when absent
- All four `persona` fields are required strings when the object is provided
- No cross-reference concerns — conference mode reads whatever agents exist at runtime

---

## Files Changed

| File | Change |
|------|--------|
| `src/context/schema.js` | Add `persona` to `AgentDefSchema` |
| `src/cli/commands/conference.js` | New CLI command |
| `src/cli/index.js` | Register conference command |
| `templates/core-skills/ryo-conference.skill.md` | New conference skill template |
| `templates/bootstrap/ryo-gen.skill.md` | Add conference mode question to Phase 2 |
| `templates/sub-skills/agent-generation.skill.md` | Generate persona data for agents |
| `docs/schemas.md` | Document persona fields |

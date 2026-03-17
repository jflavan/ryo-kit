---
name: skill-generation
description: >
  Generates skill definitions based on agent definitions and organizational context.
  Skills are EQUAL PEERS to agents — some are agent-specific, others are standalone.
  Produces SKILL.md files with YAML frontmatter conforming to the SkillDefSchema.
---

# Skill Generation Sub-Skill

You are generating skill definitions for an AI-driven development framework. Skills define *how* work gets done — the actual prompts and capabilities that run in the user's AI tool. Skills are **equal peers** to agents, not subordinate to them. Some skills are used by specific agents; others are standalone and agent-independent.

---

## Inputs

Before generating any skills, read and understand all of the following:

1. **Agent definitions** — Read all `.agent.md` files from `.ryo/agents/`. For each agent, note its:
   - `name` — To link agent-specific skills
   - `responsibilities` — Skills should cover these capabilities
   - `inputs` and `outputs` — Skills transform inputs into outputs
   - `tools` — Skills may reference allowed tool categories

2. **Org context** — Read `org-context.yaml` (from `.ryo/` or `~/.ryo/`). Pay attention to:
   - `tools.ai` — Determines which runtimes skills must target
   - `stack` — Skills reference the actual tech stack
   - `conventions` — Testing approach, branching, reviews shape skill behavior
   - `compliance` — Compliance skills may be needed

3. **Constitution** — Read `constitution.md` if it exists. Skills must embed constitutional principles in their prompt instructions.

4. **Decisions** — Read `.ryo/.state/decisions.md` for project-specific constraints and user preferences.

---

## Skill Design Principles

1. **Skills are prompt engineering artifacts.** Each skill's markdown body IS the prompt that runs in the user's AI tool. Write it as a clear, actionable instruction set.

2. **Skills are not just wrappers around agents.** An agent may use multiple skills. A skill may be used by multiple agents. Some skills have no agent association at all.

3. **Every skill must be independently invocable.** Even agent-specific skills should make sense when invoked on their own (the AI tool doesn't "know" about agents — it just reads the skill prompt).

4. **Skills must be runtime-agnostic.** Do not embed instructions specific to Claude Code, Copilot, Cursor, or any other tool. Write universal prompts.

---

## Skill Categories

Generate skills from these categories as appropriate for the org context. Not all categories are needed for every org.

### Agent-Specific Skills
For each agent, generate at least one skill that covers the agent's primary capability. Examples:
- `architect` agent gets a `design` skill
- `builder` agent gets an `implement` skill
- `reviewer` agent gets a `review` skill
- `tester` agent gets a `test` skill
- `compliance-auditor` agent gets an `audit` skill

### Standalone Skills (Agent-Independent)
These skills serve the overall process, not a specific agent:
- `plan` — Break down work into tasks (useful for any team size)
- `deploy` — Deployment procedures (if the org deploys software)
- `document` — Generate or update documentation
- `refactor` — Code improvement without behavior change
- `debug` — Systematic debugging workflow

### Compliance Skills (if compliance requirements exist)
- `compliance-check` — Verify compliance criteria for the specific standards
- `security-scan` — Security-focused code review
- `audit-trail` — Generate audit documentation

### Methodology-Specific Skills
- SAFe: `pi-plan` — PI planning ceremony support
- Scrum: `sprint-plan` — Sprint planning support
- Any: `retrospective` — Team retrospective facilitation

---

## Output Format

For each skill, create a directory and file at `.agents/skills/[skill-name]/SKILL.md` with the following structure.

### YAML Frontmatter (required fields from SkillDefSchema)

```yaml
---
name: [skill-name]
description: >
  [2-3 sentence description of what this skill does]
trigger: [how this skill is invoked, e.g., "When the user needs to implement a feature" or "When starting a new sprint"]
agent: [agent-name, or omit entirely for standalone skills]
inputs:
  - [artifact or context this skill reads]
outputs:
  - [artifact this skill produces]
runtimes:
  - [list all runtimes from org-context tools.ai]
---
```

### Markdown Body — The Skill Prompt

Below the frontmatter, write the actual skill prompt. This is the content that runs in the user's AI tool. Structure it with clear sections:

```markdown
# [Skill Name]

## Context

[What this skill does and when to use it. 2-3 sentences.]

## Inputs

[What files or context to read before starting. Be specific about file paths.]

## Steps

[Numbered steps the AI tool should follow. Be specific and actionable.]

1. Read [specific file or directory].
2. [Analyze/evaluate/generate] based on [specific criteria].
3. Write output to [specific file path].
4. [Validate/verify] the output by [specific check].

## Output Format

[Exact format of the output, including file structure, frontmatter fields, etc.]

## Constraints

[Rules that must be followed. Reference constitution principles if applicable.]

## Error Handling

[What to do if inputs are missing or steps fail.]
```

---

## Skill Count Guidelines

These are starting points. Adjust based on the full org context.

| Team Size | Compliance | Typical Skill Count |
|-----------|------------|-------------------|
| solo      | none       | 4-6               |
| solo      | any        | 6-8               |
| small     | none       | 6-8               |
| small     | any        | 8-10              |
| medium    | none       | 8-10              |
| medium    | any        | 10-14             |
| large+    | none       | 10-14             |
| large+    | any        | 14-18             |

The minimum set for any org is: `plan`, `implement`, `test`, `review`. Every org gets at least these four.

---

## Writing Instructions

1. **Write each skill directory and file immediately after designing it.** Do not design all skills first and batch-write at the end.
2. **Read `.agents/skills/` before writing** to check for existing skill directories (relevant when resuming). Do not overwrite existing skills unless the user explicitly asks for regeneration.
3. **Use kebab-case for directory names.** Example: `.agents/skills/compliance-check/SKILL.md`, not `.agents/skills/ComplianceCheck/SKILL.md`.
4. **The SKILL.md body must be a complete, self-contained prompt.** An AI tool reading only the SKILL.md file (without any other context) should understand what to do. Include file paths, format specifications, and constraints directly in the prompt.
5. **Reference the org's actual tech stack in skill prompts.** If the org uses TypeScript and React, the `implement` skill should mention TypeScript and React conventions. If the org uses Python and Django, reference those instead. Pull this from org-context.yaml's `stack` field.
6. **Embed constitution principles** in relevant skill constraints sections. For example, if the constitution says "all public APIs must have OpenAPI specs," the `implement` skill's constraints should include that rule.
7. **Report what you created.** After writing all skills, list them: "Created N skills: [name] (agent: [agent-name] or standalone), ..."

---

## Error Handling

- **No agent definitions found in `.ryo/agents/`:** You can still generate standalone skills (plan, implement, test, review, deploy). Warn that agent-specific skills cannot be created without agent definitions.
- **No org-context.yaml found:** Stop. Report the error.
- **`.agents/skills/` directory does not exist:** Create it.
- **Existing skill directories present:** Read them. If resuming, skip skills that already exist. If regenerating, overwrite.
- **A skill references an agent that does not exist:** This is an error. Either create the skill as standalone (remove the `agent` field) or skip it and report the issue.

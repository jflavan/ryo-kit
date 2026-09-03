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

5. **Fragments** — Read the **scope-classification**, **ledger**, and **verification** fragments. The `plan`, `implement`, `test`, and `review` skills embed their rules (see Structural Requirements below).

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

## Structural Requirements for the Core Skills

Every org gets `plan`, `implement`, `test`, and `review`. These four carry the governance mechanics, so their prompts must contain the following, adapted to the org's stack and conventions.

### `plan`
- Opens with scope classification per the **scope-classification** fragment, and stops for the user's approval of the approach before any plan is written.
- Produces a plan file (`.ryo/.state/plans/YYYY-MM-DD-<topic>.md`) with a header: **Goal** (one sentence), **Approach** (2-3 sentences), **Spec or requirement** (path or ticket — the plan argues from it, so it travels with it), and **Global Constraints**: the constitution's frontmatter rules and prose principles that bind this work, copied verbatim, plus any stack-specific constraints from org context.
- Breaks work into tasks sized to a review gate: each task is the smallest unit with its own test cycle that a reviewer could reject while approving its neighbour. Each task lists exact files to create or modify, the interfaces it consumes from earlier tasks and produces for later ones, the tests to write first (when `conventions.testing` is tdd), the command to run, and the commit.
- Forbids placeholders: no "TBD", "add error handling", "similar to task N", or "write tests for the above" without the test. Every step shows how, not just what.
- Ends with a self-review against the spec: every requirement maps to a task, names and signatures agree across tasks, no placeholders remain.

### `implement`
- Reads one task from the plan, not the whole plan, plus the Global Constraints.
- Announces the task, asks any blocking questions before starting, follows the org's testing convention (red-green when tdd), runs the focused tests while iterating and the full suite once before committing.
- Reports with one of four statuses: `DONE`, `DONE_WITH_CONCERNS` (done, with doubts listed), `NEEDS_CONTEXT` (a question that blocks), `BLOCKED` (cannot complete; says why). The report goes to a file the reviewer will read; the chat gets only status, commits, a one-line test summary, and concerns.
- Never claims completion without the evidence in the **verification** fragment, and never reviews its own work in place of the review step.
- Records a `Ruling:` in the ledger for every ambiguity it resolved.

### `review`
- Runs from a fresh context with three inputs: the task text, the implementer's report, and the diff for the exact commit range (base recorded before implementation, never `HEAD~1`). It reads the diff as its view of the change and does not crawl the codebase except to check one named risk.
- Treats the report as unverified claims. A stated rationale never downgrades a finding.
- Returns two verdicts: **spec compliance** (missing, extra, misunderstood, and items it cannot verify from the diff) and **quality** (findings by severity: Critical, Important, Minor, each with file:line, what, why, how to fix), and a clear ready / not-ready assessment.
- Applies the constitution: every principle and every `evidence` requirement of the gate is a review criterion.
- Never edits code. Never approves work it wrote (`separation_of_duties`).

### `test`
- Verifies against the plan's stated behaviour, not against the implementation.
- Produces test output as an artifact the gate's `evidence` can name, and reports counts, not adjectives.

### Fix loop (in `implement` and `review`)
When a review returns Critical or Important findings: the implementer fixes and re-runs the covering tests; the reviewer re-checks only the findings and the fix diff, marking each ADDRESSED or NOT ADDRESSED. Cap the loop (five rounds by default; the process may set fewer). At the cap, the workflow step's owner adjudicates each open finding with a recorded `Ruling:` or `Parked:` line rather than continuing to churn. Minor findings are ledgered as deferred and triaged at the final review, never silently dropped.

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

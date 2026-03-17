---
name: ryo-gen
description: >
  Orchestrator skill that generates a complete AI-driven development framework
  from organizational context. Chains sub-skills for agent, skill, process,
  and workflow generation, with cross-session resume support.
trigger: /ryo-gen
---

# ryo-gen — Framework Generator Orchestrator

You are the orchestrator for ryo-kit's framework generation pipeline. Your job is to read organizational context, clarify gaps with the user, then chain through four generation sub-skills to produce a complete, tailored AI-driven development framework.

---

## Phase 0: Load State and Check for Resume

Before doing anything else, check for an in-flight plan.

1. Read the file `.ryo/.state/current-plan.md`.
   - If the file exists and contains unchecked phases (lines with `- [ ]`), you are **resuming** a previous session. Tell the user: "Found an in-flight plan. Resuming from the first incomplete phase." Skip to the first unchecked phase.
   - If the file exists and all phases are checked (`- [x]`), this is a completed plan. Archive it (see Phase 6) and start fresh.
   - If the file does not exist or is empty, start fresh from Phase 1.

2. Read `.ryo/.state/decisions.md` if it exists. These are answers from a prior clarification session. Do not re-ask questions that already have answers recorded there.

---

## Phase 1: Load Organizational Context

Follow the instructions in the **org-context-prompt** fragment for this phase.

Specifically:

1. Check for `org-context.yaml` in these locations, in order:
   - `.ryo/org-context.yaml` (repo-local, takes precedence)
   - `~/.ryo/org-context.yaml` (org-wide)
   - If neither exists, stop and tell the user: "No org-context.yaml found. Run `npx ryo-kit init` first to create one."

2. Read the org-context.yaml file. Parse and understand its contents. The file contains these top-level fields:
   - `name` (optional) — org or project name
   - `methodology` — one of: scrum, safe, kanban, hybrid, none
   - `stack` — languages, frameworks, cloud, cicd
   - `team.size` — solo, small, medium, large, enterprise
   - `team.roles` (optional) — specific roles present
   - `compliance` — array of compliance standards (may be empty)
   - `tools.ai` — which AI runtimes are in use
   - `tools.scm` — source control platform
   - `tools.pm` (optional) — project management tool
   - `conventions` (optional) — branching, testing, reviews

3. Check for `constitution.md` in these locations:
   - `.ryo/constitution.md` (repo-local)
   - `~/.ryo/constitution.md` (org-wide)
   - If neither exists, proceed without it but note that no constitution was found.

4. Read `constitution.md` if found. This contains non-negotiable principles that all generated artifacts must respect.

5. Summarize the org profile to the user in 3-5 sentences. Example: "You're a small scrum team using TypeScript and Angular on Azure, with SOC 2 compliance requirements. Your team uses Claude Code and Copilot, GitHub for SCM, and Jira for PM. You follow trunk-based branching with required code reviews."

6. Identify any gaps in the org context that will affect generation quality. Common gaps:
   - No `conventions` section (branching, testing, reviews unknown)
   - No `team.roles` (can't tailor agents to existing roles)
   - `methodology` is "none" or "hybrid" (need clarification on actual workflow)
   - `compliance` is empty but `team.size` is "large" or "enterprise" (unusual)

---

## Phase 2: Clarification Dialogue

Ask the user targeted questions to fill gaps and establish project-specific context. Save every answer to `.ryo/.state/decisions.md` immediately after the user responds (do not batch saves).

### Questions to ask (skip any already answered in decisions.md):

**Always ask:**
1. "What kind of project is this? (new greenfield, existing brownfield, library/package, monorepo, etc.)"
2. "What is the primary deliverable? (web app, API, mobile app, CLI tool, infrastructure, etc.)"
3. "Are there any project-specific constraints beyond the org-level constitution?"

**Ask if gaps exist:**
4. If `conventions` is missing or incomplete: "What is your branching strategy? (gitflow, trunk-based, GitHub flow, other)" / "What is your testing approach? (TDD, BDD, post-hoc, minimal)" / "Are code reviews required before merge?"
5. If `methodology` is "hybrid" or "none": "Describe your typical workflow when starting a new feature — from idea to production."
6. If `compliance` is empty and team is medium+: "Confirm: this project has no compliance requirements?"

**Ask if useful for tailoring:**
7. "Are there any agent roles you specifically want or don't want? (e.g., 'we don't need a separate architect role' or 'we need a dedicated security reviewer')"
8. "Any existing process documents, runbooks, or workflow diagrams I should know about?"

### decisions.md format

Write answers to `.ryo/.state/decisions.md` in this format:

```markdown
# Decisions

## Project Type
greenfield web application

## Primary Deliverable
SaaS platform with REST API and React frontend

## Project Constraints
Must support multi-tenancy from day one

## Branching Strategy
trunk-based with feature flags

...
```

Each answer gets its own `## Heading` and the user's response as the body. Append new answers without overwriting existing ones.

---

## Phase 3: Write the Plan

After clarification is complete, write the generation plan to `.ryo/.state/current-plan.md`:

```markdown
# Generation Plan

Created: [current date/time]
Org Context: [path to org-context.yaml used]
Constitution: [path to constitution.md used, or "none"]

## Phases

- [ ] Phase 1: Agent Generation
- [ ] Phase 2: Skill Generation
- [ ] Phase 3: Process Generation
- [ ] Phase 4: Workflow Generation
- [ ] Phase 5: Validation
- [ ] Phase 6: Archive
```

---

## Phase 4: Execute Generation Sub-Skills

Run each sub-skill in order. After each sub-skill completes, update `current-plan.md` by changing `- [ ]` to `- [x]` for the completed phase.

### 4a: Agent Generation

Follow the instructions in the **agent-generation** sub-skill template.

Inputs to provide:
- The parsed org context
- The constitution (if found)
- All decisions from `.ryo/.state/decisions.md`
- The decision-tree fragment heuristics

The sub-skill will write agent definition files to `.ryo/agents/`. Wait for it to finish and confirm the agent files exist before proceeding.

After completion, update current-plan.md: check off "Phase 1: Agent Generation".

### 4b: Skill Generation

Follow the instructions in the **skill-generation** sub-skill template.

Inputs to provide:
- The parsed org context and constitution
- All decisions
- The agent definitions just created in `.ryo/agents/`

The sub-skill will write skill definitions to `.agents/skills/`. Wait for it to finish before proceeding.

After completion, update current-plan.md: check off "Phase 2: Skill Generation".

### 4c: Process Generation

Follow the instructions in the **process-generation** sub-skill template.

Inputs to provide:
- The parsed org context (especially methodology, compliance, team size)
- The agent definitions from `.ryo/agents/`
- The skill definitions from `.agents/skills/`

The sub-skill will write `.ryo/process.md`. Wait for it to finish before proceeding.

After completion, update current-plan.md: check off "Phase 3: Process Generation".

### 4d: Workflow Generation

Follow the instructions in the **workflow-generation** sub-skill template.

Inputs to provide:
- The parsed org context
- Agent definitions, skill definitions, and process definition
- All decisions

The sub-skill will write workflow files to `.ryo/workflows/`. Wait for it to finish before proceeding.

After completion, update current-plan.md: check off "Phase 4: Workflow Generation".

---

## Phase 5: Validation

Follow the instructions in the **validation** fragment to perform a consistency check across all generated artifacts.

Specifically, verify:
1. Every agent referenced in any workflow step exists as a file in `.ryo/agents/`.
2. Every skill referenced in any workflow step exists as a directory in `.agents/skills/` with a `SKILL.md` file.
3. Every process phase referenced in any workflow step exists in `.ryo/process.md`.
4. Agent `handoff_to` references form a valid directed acyclic graph (no cycles).
5. Every agent has at least one skill that references it (via the skill's `agent` field) OR is used in at least one workflow step.
6. Constitution principles are not violated by any generated artifact.

If validation finds issues:
- List each issue with the specific file path and field that caused it.
- Attempt to fix issues automatically (e.g., add a missing skill reference, remove a dangling agent reference).
- If an issue cannot be auto-fixed, report it to the user and ask how to proceed.

After validation passes, update current-plan.md: check off "Phase 5: Validation".

---

## Phase 6: Install and Archive

### Install generated skills into the active runtime(s)

Read the `tools.ai` field from org-context.yaml to determine which runtimes to target. For each runtime, the generated skills in `.agents/skills/` need to be accessible as slash commands or rules. Tell the user:

"Generation complete. To install the generated skills into your AI tool(s), run: `npx ryo-kit gen`"

### Archive the plan

1. Copy `.ryo/.state/current-plan.md` to `.ryo/.state/history/[date]-ryo-gen.md` (use the current date in YYYY-MM-DD format).
2. Clear or delete `.ryo/.state/current-plan.md` so the next invocation starts fresh.

After completion, update current-plan.md: check off "Phase 6: Archive" (before archiving it).

---

## Phase 6: Sync to Coding Tools

After all agents, skills, processes, and workflows are generated, run the sync command to link them to your coding tools:

```
npx ryo-kit sync
```

This creates symlinks and configuration so all your coding tools (Claude Code, Copilot, Cursor, etc.) can discover the generated agents and skills natively.

---

## Error Handling

- **Missing org-context.yaml:** Stop immediately. Tell user to run `npx ryo-kit init`.
- **Missing .ryo/ directory:** Stop immediately. Tell user to run `npx ryo-kit gen` to scaffold the project.
- **Missing .ryo/.state/ directory:** Create it. This is safe to do.
- **Sub-skill produces no output:** Report which sub-skill failed and what inputs it received. Ask the user if they want to retry or skip.
- **File write fails:** Report the exact file path and error. Do not proceed to the next phase.
- **Session ends mid-generation:** No special handling needed. The plan checkboxes and decisions.md ensure the next invocation resumes correctly.

---

## Important Behavioral Rules

1. **Read files before acting.** Always read a file's current contents before writing to it. Never assume a file is empty or has specific contents.
2. **Write outputs immediately.** Each sub-skill writes its outputs as soon as they are ready. Do not accumulate outputs and write them all at the end.
3. **Update the plan after each phase.** The `current-plan.md` checkboxes are the resume mechanism. Keep them accurate.
4. **Do not invent context.** If you need information that is not in org-context.yaml, constitution.md, or decisions.md, ask the user. Do not guess.
5. **Respect the constitution.** Every generated artifact must be consistent with the principles in constitution.md.
6. **Be runtime-agnostic.** The generated agents, skills, processes, and workflows are abstract definitions. They work across all AI runtimes. Do not embed runtime-specific instructions in the generated artifacts.
7. **Reference the decision-tree fragment** when making choices about agent count, skill selection, process phases, or scale rules. The heuristics there are your starting point, not hard constraints.

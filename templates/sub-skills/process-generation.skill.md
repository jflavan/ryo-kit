---
name: process-generation
description: >
  Generates a process definition that maps agents and skills into phases with
  gates, artifacts, and scale rules. Adapts to methodology (Scrum, SAFe, Kanban)
  and compliance requirements. Produces process.md conforming to ProcessDefSchema.
---

# Process Generation Sub-Skill

You are generating a process definition for an AI-driven development framework. The process defines the phases of work, which agents participate in each phase, what artifacts are produced, and what gates must pass before moving to the next phase. The process adapts to the org's methodology, compliance needs, and team size.

---

## Inputs

Before generating the process, read and understand all of the following:

1. **Agent definitions** — Read all `.agent.md` files from `.ryo/agents/`. Note each agent's name, role, responsibilities, and handoff relationships.

2. **Skill definitions** — Read all `SKILL.md` files from `.agents/skills/*/`. Note each skill's name, associated agent (if any), inputs, and outputs.

3. **Org context** — Read `org-context.yaml` (from `.ryo/` or `~/.ryo/`). Critical fields:
   - `methodology` — Determines the overall phase structure
   - `compliance` — Determines whether review/audit gates are needed
   - `team.size` — Affects how many phases and how strict the gates are
   - `conventions.testing` — Affects the testing phase design
   - `conventions.reviews` — Affects whether review gates are human, automated, or hybrid

4. **Decisions** — Read `.ryo/.state/decisions.md` for project-specific workflow preferences.

5. **Decision-tree heuristics** — Use the decision-tree fragment for methodology-to-phase mapping defaults.

6. **Constitution** — Read `constitution.md` (from `.ryo/` or `~/.ryo/`). Its frontmatter `evidence`, `required_reviewers`, and `stop_conditions` shape the gates; its prose principles must hold in every phase.

---

## Methodology-to-Phase Mapping

Use these as starting points. Adjust based on full org context.

### Scrum

Typical phases:
1. **Sprint Planning** — Break down backlog items, assign work
2. **Design** — Architecture and technical design (skip for small items via scale rules)
3. **Implementation** — Write code
4. **Testing** — Verify behavior and quality
5. **Review** — Code review, standards check
6. **Integration** — Merge, resolve conflicts, integration testing
7. **Demo/Review** — Sprint review, stakeholder feedback

### SAFe

Typical phases:
1. **PI Planning** — Cross-team planning, dependency mapping
2. **Iteration Planning** — Break down features into stories
3. **Design** — Architecture review, technical design
4. **Implementation** — Write code
5. **Testing** — Unit, integration, system testing
6. **Compliance Review** — Audit, security review (if compliance requirements exist)
7. **Code Review** — Peer review, standards enforcement
8. **Integration** — Cross-team integration, system testing
9. **Release** — Release coordination, deployment

### Kanban

Typical phases:
1. **Triage** — Prioritize and size work
2. **Design** — Technical design (skip for small items)
3. **Implementation** — Write code
4. **Testing** — Verify behavior
5. **Review** — Code review
6. **Deploy** — Ship to production

### Hybrid / None

If methodology is "hybrid" or "none", check decisions.md for the user's described workflow. Map their described steps to phases. If no workflow was described, use a minimal set:
1. **Plan** — Define what to build
2. **Implement** — Build it
3. **Verify** — Test and review
4. **Ship** — Deploy

---

## Compliance Gate Injection

If the `compliance` array in org-context.yaml is non-empty, inject compliance-related gates:

- **SOC 2:** Add a review gate that checks for access control documentation and change management records.
- **HIPAA:** Add a compliance review phase before deployment that verifies PHI handling, encryption, and audit logging.
- **PCI DSS:** Add a security review gate that checks for payment data handling compliance.
- **ISO 27001:** Add an information security review gate.
- **FedRAMP:** Add a security authorization review phase.
- **Internal:** Add a gate matching whatever internal compliance policies are described in the constitution.

Compliance gates should use `type: "human"` or `type: "hybrid"` — never `type: "automated"` alone, since compliance decisions require human judgment. They also carry `skippable_for: []` (no scope, including hotfix, may skip them), `separation_of_duties: true`, and an `evidence` list naming the artifact that proves the check ran (e.g. `compliance-checklist`, `phi-handling-review`). Where the constitution's `required_reviewers.paths` names roles for a path, put those roles in the gate's `approvers.roles`.

---

## Output Format

Write the process definition to `.ryo/process.md` with the following structure.

### YAML Frontmatter (required fields from ProcessDefSchema)

```yaml
---
name: [process-name, e.g., "development-process"]
phases:
  - name: [phase-name]
    description: >
      [2-3 sentence description of what happens in this phase]
    agents:
      - [agent-name involved in this phase]
    artifacts:
      - [artifact produced in this phase, e.g., "design-document", "implemented-code", "test-results"]
    gate:
      type: [human | automated | hybrid]
      criteria:
        - [criterion that must pass to exit this phase]
      evidence:
        - [artifact that must exist, freshly produced, before the gate passes]
      skippable_for: [scope labels that may skip this phase; [] = never; omit to defer to scale rules]
      separation_of_duties: [true for review, verification, and compliance gates when the org has more than one agent]
      approvers:                    # optional
        count: 1
        roles: [team roles allowed to approve]
  - name: [next-phase-name]
    ...
scale_rules:
  - scope: bug-fix
    skip_phases:
      - [phase names to skip for bug fixes]
    required_phases:
      - [phase names that are always required for bug fixes]
  - scope: feature
    required_phases:
      - [phase names always required for features]
  - scope: hotfix
    skip_phases:
      - [phase names to skip for hotfixes]
    required_phases:
      - [minimum required phases for hotfixes]
---
```

### Markdown Body

Below the frontmatter, write a human-readable description of the process:

```markdown
# [Process Name]

## Overview

[2-3 paragraphs explaining the overall process flow, how it maps to the org's
methodology, and how agents and skills fit into each phase.]

## Phase Details

### [Phase 1 Name]

**Purpose:** [What this phase accomplishes]
**Agents:** [Which agents participate and what they do]
**Artifacts:** [What gets produced]
**Gate:** [What must be true to proceed]

### [Phase 2 Name]
...

## Scale Rules

[Explain how the process adapts for different scopes of work. When are phases
skipped? What is the minimum path for a hotfix vs. the full path for a major
feature?]
```

---

## Scale Rules Design

Scale rules determine which phases to skip based on the scope of work. Design them so that:

1. **Hotfixes** take the shortest path. Typically: implement, test, deploy. Skip design, planning, and non-critical reviews.
2. **Bug fixes** skip design/planning phases but include testing and review.
3. **Features** go through most or all phases.
4. **Epics** (large features) go through all phases with no skips.
5. **Small changes** (docs, config, typos) may skip most phases.

Every scale rule must have a `required_phases` array that is never empty. Even the most minimal path must include at least implementation and one verification step.

A phase whose gate has `skippable_for` may only appear in `skip_phases` for the scopes it lists. A phase with `skippable_for: []` appears in every scale rule's `required_phases`. `ryo check` enforces both.

Scope labels are fixed: `small-change`, `bug-fix`, `feature`, `epic`, and the orthogonal `hotfix`. Classification happens at the start of every workflow via the **scope-classification** fragment, and the constitution's `scope_overrides` can force a minimum scope by path — design the scale rules knowing that a "small" diff in a protected area will run the larger path.

---

## Writing Instructions

1. **Read `.ryo/process.md` before writing** to check if a process definition already exists (relevant when resuming). Do not overwrite unless regenerating.
2. **Validate agent references.** Every agent name in the `agents` arrays must correspond to an actual agent file in `.ryo/agents/`. If an agent doesn't exist, do not reference it.
3. **Validate phase-to-skill mapping is plausible.** For each phase, at least one skill in `.agents/skills/` should be relevant to the phase's purpose. You don't need to list skills in the process definition (that's the workflow's job), but verify the mapping makes sense.
4. **Gate types should match org conventions:**
   - If `conventions.reviews` is "required": review gates should be `type: "human"` or `type: "hybrid"`, with `separation_of_duties: true`
   - If `conventions.testing` is "tdd": testing gates should include test-first criteria and `evidence: [test-results]`
   - If compliance requirements exist: compliance gates must be `type: "human"` or `type: "hybrid"`, `skippable_for: []`
   - If the constitution's `evidence.review` or `evidence.tests` is `required`: every review or testing gate lists the corresponding evidence artifact
5. **Every gate names its evidence.** No gate passes on assertion; see the **verification** fragment.
6. **Report what you created.** After writing, summarize: "Created process definition with N phases: [phase1], [phase2], ... and M scale rules."

---

## Error Handling

- **No agent definitions found:** Stop. Agents must be generated before the process. Report the error.
- **No skill definitions found:** You can still generate the process (skills are not directly referenced in process.md), but warn that workflow generation will need skills.
- **No org-context.yaml found:** Stop. Report the error.
- **`.ryo/` directory does not exist:** Stop. Report the error.
- **Methodology is "none" and no workflow described in decisions.md:** Use the minimal 4-phase process (Plan, Implement, Verify, Ship) and tell the user they can customize it later.

# Decision Tree — Agent, Skill, Process, and Scale Heuristics

This fragment provides the hybrid decision tree used by all generation sub-skills. These heuristics are **starting points, not hard constraints**. The clarification phase and user decisions always override these defaults.

---

## Agent Selection Heuristics

### Primary factors: team size, methodology, compliance

| Org Profile | Likely Agents | Likely Skills |
|-------------|--------------|---------------|
| Solo dev, no compliance | builder, verifier | plan, implement, test, review |
| Small scrum team | architect, builder, reviewer, tester | plan, design, implement, test, review, deploy |
| SAFe + HIPAA | pi-planner, architect, builder, reviewer, compliance-auditor, security-reviewer, tester, release-manager | All above + audit, compliance-check, pi-plan, release |

### Agent selection decision flow

```
START
  │
  ├─ team.size == "solo"
  │   ├─ compliance is empty → builder, verifier (2 agents)
  │   └─ compliance is non-empty → builder, verifier, compliance-auditor (3 agents)
  │
  ├─ team.size == "small"
  │   ├─ methodology is "scrum" or "kanban"
  │   │   ├─ compliance is empty → architect, builder, reviewer, tester (4 agents)
  │   │   └─ compliance is non-empty → above + compliance-auditor (5 agents)
  │   └─ methodology is "none" or "hybrid"
  │       └─ builder, reviewer, tester (3 agents) + ask user if architect is needed
  │
  ├─ team.size == "medium"
  │   ├─ methodology is "scrum"
  │   │   ├─ compliance is empty → architect, builder, reviewer, tester, deployer (5 agents)
  │   │   └─ compliance is non-empty → above + compliance-auditor (6 agents)
  │   └─ methodology is "safe"
  │       └─ pi-planner, architect, builder, reviewer, tester, deployer (6 agents) + compliance as needed
  │
  ├─ team.size == "large" or "enterprise"
  │   ├─ methodology is "safe"
  │   │   ├─ compliance is empty → pi-planner, architect, builder, reviewer, tester, release-manager (6-7 agents)
  │   │   └─ compliance includes "hipaa" or "pci-dss"
  │   │       → above + compliance-auditor, security-reviewer (8+ agents)
  │   └─ methodology is "scrum" or "kanban"
  │       → architect, builder, reviewer, tester, deployer, release-manager (6 agents) + compliance as needed
  │
  └─ ALWAYS: if user requested specific agents in decisions.md, add them
     ALWAYS: if user excluded specific agents in decisions.md, remove them
```

### Agent role definitions (reference)

| Agent Name | Role | When to Include |
|------------|------|----------------|
| builder | Implements code changes | Always |
| verifier | Reviews and tests (combined role) | Solo dev only (replaces separate reviewer + tester) |
| architect | Technical design and decisions | Team size small+ |
| reviewer | Code review, standards enforcement | Team size small+ (separate from tester) |
| tester | Test strategy, test writing, quality validation | Team size small+ (separate from reviewer) |
| deployer | Deployment and release procedures | Team size medium+ or when CI/CD is configured |
| compliance-auditor | Compliance validation and audit trail | When compliance array is non-empty |
| security-reviewer | Security-focused review, threat modeling | When compliance includes security-related standards (hipaa, pci-dss, soc2, fedramp) |
| pi-planner | PI planning, cross-team coordination | SAFe methodology only |
| release-manager | Release coordination, version management | Team size large+ or SAFe methodology |

---

## Skill Selection Heuristics

### Derive skills from agents and conventions

```
For each agent:
  → Generate at least one primary skill matching the agent's core responsibility
  → If agent has multiple distinct responsibilities, generate one skill per responsibility

Always generate these standalone skills:
  → plan (work breakdown, task planning)
  → implement (code writing — may overlap with builder agent's skill but is also standalone)
  → test (test execution and validation)
  → review (code review)

Conditionally generate:
  → deploy — if team.size is medium+ OR stack.cicd is non-empty
  → design — if architect agent exists
  → refactor — if team.size is medium+
  → debug — if team.size is small+ (solo devs debug without a skill)
  → document — if constitution mentions documentation requirements
  → audit — if compliance is non-empty
  → compliance-check — if compliance is non-empty
  → security-scan — if compliance includes security-related standards
  → pi-plan — if methodology is "safe"
  → sprint-plan — if methodology is "scrum"
  → release — if release-manager agent exists
```

### Skill-to-agent mapping

Skills with an `agent` field are associated with that agent but can still be invoked independently. Skills without an `agent` field are standalone.

| Skill | Typical Agent | Standalone? |
|-------|--------------|-------------|
| plan | none (standalone) | Yes |
| design | architect | No |
| implement | builder | No |
| test | tester (or verifier for solo) | No |
| review | reviewer (or verifier for solo) | No |
| deploy | deployer or release-manager | No |
| refactor | builder | Yes (can be used without builder context) |
| debug | builder | Yes |
| document | none (standalone) | Yes |
| audit | compliance-auditor | No |
| compliance-check | compliance-auditor | No |
| security-scan | security-reviewer | No |
| pi-plan | pi-planner | No |
| sprint-plan | none (standalone) | Yes |
| release | release-manager | No |

---

## Process Phase Selection Heuristics

### Map methodology to phases

| Methodology | Phases |
|-------------|--------|
| scrum | sprint-planning, design, implementation, testing, review, integration, demo |
| safe | pi-planning, iteration-planning, design, implementation, testing, compliance-review, code-review, integration, release |
| kanban | triage, design, implementation, testing, review, deploy |
| hybrid | plan, design, implementation, testing, review, deploy (ask user to customize) |
| none | plan, implement, verify, ship (minimal set) |

### Phase modifiers

- **Compliance is non-empty:** Insert a compliance-review phase before the final deployment/release phase.
- **Team size is solo:** Collapse review + testing into a single "verify" phase.
- **Team size is enterprise:** Add integration and release phases if not already present.
- **Conventions.reviews is "required":** Review phase gate type must be "human" or "hybrid".
- **Conventions.testing is "tdd":** Testing phase gate must include "tests written before implementation" criterion.

---

## Scale Rules Heuristics

Scale rules determine which phases/steps to skip based on the scope of work.

### Standard scope definitions

| Scope | Description | Typical Path |
|-------|-------------|-------------|
| small-change | Typos, config changes, doc updates | implement, verify |
| bug-fix | Fix a known defect | implement, test, review |
| feature | New feature or enhancement | All phases |
| epic | Large feature spanning multiple areas | All phases, no skips |
| hotfix | Emergency production fix | implement, test, deploy (minimal gates) |

### Scale rule principles

1. **Never skip implementation.** Every scope requires at least an implementation step.
2. **Never skip all verification.** Every scope requires at least one of: testing, review, or verify.
3. **Design and planning phases** are the most commonly skipped for small scopes.
4. **Compliance phases** should only be skipped for small-change scope, and only if the change does not affect compliance-relevant code.
5. **Hotfix scope** should skip planning and design but keep testing and deployment gates.

---

## Using These Heuristics

When generating agents, skills, processes, or workflows:

1. Start with the heuristic that matches the org profile.
2. Check decisions.md for user overrides or preferences.
3. Check constitution.md for principles that add or remove requirements.
4. Adjust the heuristic output accordingly.
5. When in doubt, ask the user rather than guessing.

These heuristics exist to provide sensible defaults. They should never produce an incorrect result because the clarification phase exists to catch mismatches between defaults and reality.

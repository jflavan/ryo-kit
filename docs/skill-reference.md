# Skill Reference

Skills are markdown prompt files installed into your AI coding tool. They run inside your AI tool's context — ryo-kit's CLI just installs them.

## /ryo-gen

**Purpose:** Generate a complete framework (agents, skills, process, workflows) from org context.

**When to use:** After running `npx ryo-kit gen` to scaffold `.ryo/`.

**What it does:**

1. Loads org context and constitution from `~/.ryo/` or `.ryo/`
2. Checks `.ryo/.state/current-plan.md` for in-flight operations — resumes if found
3. Asks clarifying questions about the project (saved to `.ryo/.state/decisions.md`)
4. Chains four sub-skills in order:
   - **agent-generation** — writes `.ryo/agents/*.agent.md`
   - **skill-generation** — writes `.agents/skills/*/SKILL.md`
   - **process-generation** — writes `.ryo/process.md`
   - **workflow-generation** — writes `.ryo/workflows/*.workflow.md`
5. Runs validation (consistency check across all generated artifacts)
6. Syncs skills and agents to configured runtimes (`npx ryo-kit sync`)
7. Archives the completed plan to `.ryo/.state/history/`

**Cross-session resume:** If your session ends during generation, invoke `/ryo-gen` again. It reads `current-plan.md` and picks up from the first incomplete phase. Decisions and partial outputs are preserved.

**Output adapts to your org:**

| Org Profile | Typical Output |
|-------------|---------------|
| Solo dev, no compliance | 2 agents, ~4 skills, lightweight process |
| Small scrum team | 3-4 agents, ~6 skills, sprint process with review gates |
| SAFe enterprise with HIPAA | 6-8 agents, 10+ skills, PI ceremonies, compliance gates |

---

## /ryo-help

**Purpose:** Context-aware guidance. Tells you what to do next.

**When to use:** Any time you're unsure about your next step.

**What it does:**

1. Reads `.ryo/.state/current-plan.md` for in-flight operations
2. Reads `.ryo/process.md` for the development process
3. Reads agent and skill definitions to know what's available
4. Provides targeted advice based on your question or current state
5. Recommends which agent/skill to invoke for a given task
6. If no framework exists yet, guides you to run `/ryo-gen`

---

## /ryo-add-agent

**Purpose:** Add a new agent to an existing framework through a conversational flow.

**When to use:** When you need a role that your generated framework doesn't have.

**What it does:**

1. Reads existing agents from `.ryo/agents/` to understand current roles
2. Asks what role the new agent should fill
3. References the decision tree for best practices
4. Checks for overlap with existing agents
5. Generates a `.agent.md` file with YAML frontmatter matching AgentDefSchema
6. Updates workflows that should involve the new agent
7. Installs the agent into the runtime

---

## /ryo-add-skill

**Purpose:** Add a new skill to an existing framework through a conversational flow.

**When to use:** When you need a capability that your generated framework doesn't have.

**What it does:**

1. Reads existing skills and agents to understand current capabilities
2. Asks what the skill should do
3. Asks which agent(s) use it, or whether it's standalone
4. Checks for overlap with existing skills
5. Generates a `SKILL.md` file with YAML frontmatter matching SkillDefSchema, plus a complete prompt body
6. Updates agent definitions that should reference the new skill
7. Installs the skill into the runtime

---

## /ryo-evolve

**Purpose:** Re-generate the framework after changes to org context or retro proposals.

**When to use:** After updating `org-context.yaml` or accepting retro proposals.

**What it does:**

1. Loads updated org context
2. Reads retro reports from `.ryo/.state/retro-*.md` for accepted proposals
3. Reads the current framework (all agents, skills, process, workflows)
4. Diffs current state against what would be generated from updated context
5. Checks `.ryo/.customize/` for user overrides
6. For each conflict with a customization:
   - Warns with specifics (which file, what would change)
   - Asks: keep customization, accept proposed change, or merge manually
7. Applies approved changes
8. Can delegate to generation sub-skills for new artifacts
9. Runs validation after all changes

**Customization protection:** Files in `.ryo/.customize/` are never silently overwritten. Every conflict requires explicit user approval.

---

## /ryo-retro

**Purpose:** Analyze framework usage and propose improvements.

**When to use:** After a sprint, milestone, or when you suspect the framework needs tuning.

**What it does:**

1. Reads `.ryo/.state/signals.md` for usage tracking data
2. Reads `.ryo/.state/history/` for past operation history
3. Reads all current agent, skill, process, and workflow definitions
4. Analyzes patterns:
   - Agents never referenced in any workflow
   - Skills that get manually overridden frequently
   - Gates that always pass (criteria may be too loose)
   - Gates that always block (criteria may be too strict)
   - Phases always skipped via scale rules
5. Produces a retro report at `.ryo/.state/retro-[date].md`
6. Presents proposals one at a time, asking which to accept
7. Tells you to run `/ryo-evolve` to apply accepted changes

**Example retro output:**

```markdown
## Proposed Changes

### Add: security-reviewer agent
**Why:** 3 of last 5 features had security issues caught late in review.
**Impact:** Adds a gate after implementation, before PR.

### Modify: testing phase gate
**Why:** Gate passed 100% of the time in last 10 runs. Criteria may be too loose.
**Proposed:** Add coverage threshold criterion.

### Remove: pi-planner agent
**Why:** Never invoked in any workflow over 30 days.
**Impact:** Simplifies process definition.
```

---

## /ryo-conference

**Purpose:** Multi-agent collaborative discussion. Brings your agent team together to discuss topics from their unique perspectives.

**When to use:** When you want input from multiple agents on a decision, design question, or tradeoff.

**What it does:**

1. Reads all agent definitions from `.ryo/agents/`
2. Asks what you'd like to discuss (or uses the topic from your invocation)
3. For each message, selects 2-4 relevant agents based on topic and their responsibilities
4. Each agent responds in turn under a clear header with their name, icon, and role
5. Uses `persona` data (displayName, icon, communicationStyle, identity) for distinct voices
6. Falls back to inferring personality from role/description if persona data is missing
7. Continues until you say "end conference" or move on

**Agent selection scales with team size:**

| Team Size | Agents Per Message |
|-----------|-------------------|
| 2-3 agents | All agents respond |
| 4-6 agents | 2-3 most relevant |
| 7+ agents | 3-4 most relevant |

**Example:**

```
/ryo-conference should we use GraphQL or REST for the public API?
```

Each selected agent responds from their domain — the architect might weigh scalability, the builder might discuss developer experience, and the security reviewer might flag authentication concerns.

---

## /ryo-docs

**Purpose:** Generate and maintain project documentation by leveraging your agent team's domain expertise.

**When to use:** When your project needs documentation — architecture overviews, API references, onboarding guides, or any docs that agents can derive from the codebase.

**What it does:**

1. Reads all agent definitions from `.ryo/agents/` and org context
2. Asks who the documentation is for (onboarding, external devs, internal team, or all)
3. Scans the codebase and existing docs to identify gaps, staleness, and coverage
4. Presents a documentation plan — which docs to create or update, assigned to which agents
5. Generates each doc from the assigned agent's perspective, pausing for review after each
6. Tracks generated docs in a manifest for future staleness detection and refresh

**Supports refresh:** Run `/ryo-docs` again after codebase changes. It detects which docs are stale based on git history and proposes updates.

**Example:**

```
/ryo-docs
```

The skill walks you through audience selection, plan review, and doc generation interactively.

---

## Sub-Skills (Internal)

These are invoked by `/ryo-gen` and `/ryo-evolve`, not directly by users:

| Sub-Skill | Output | Schema |
|-----------|--------|--------|
| `agent-generation` | `.ryo/agents/*.agent.md` | AgentDefSchema |
| `skill-generation` | `.agents/skills/*/SKILL.md` | SkillDefSchema |
| `process-generation` | `.ryo/process.md` | ProcessDefSchema |
| `workflow-generation` | `.ryo/workflows/*.workflow.md` | WorkflowDefSchema |

## Prompt Fragments (Internal)

Shared fragments referenced by multiple skills:

| Fragment | Used By | Purpose |
|----------|---------|---------|
| `org-context-prompt.md` | ryo-gen, ryo-evolve | Load and parse org context |
| `decision-tree.md` | All generation sub-skills | Heuristics for agent/skill/process selection |
| `validation.md` | ryo-gen, ryo-check | Consistency validation rules |

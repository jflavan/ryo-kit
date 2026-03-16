# Self-Improvement

ryo-kit includes a feedback loop so your framework gets better over time. Two mechanisms feed into the evolution cycle, both keeping a human in the loop.

## Signal Collection

During normal workflow execution, generated skills write lightweight entries to `.ryo/.state/signals.md`. This happens automatically — the workflow skills include signal-logging as part of their gate and handoff prompts.

**Signal format:**

```markdown
- **2026-03-15 14:30** | gate-outcome | testing-gate | passed | coverage 87%
- **2026-03-15 16:00** | phase-skip | pi-planning | skipped | scope: bug-fix
- **2026-03-16 09:00** | manual-override | architect-agent | skipped | "too small for architecture review"
```

**Signal types:**

| Type | What It Tracks |
|------|---------------|
| `gate-outcome` | Whether a gate passed or failed, with details |
| `phase-skip` | When a process phase is skipped via scale rules |
| `agent-skip` | When an agent is bypassed during a workflow |
| `skill-skip` | When a skill is not used in a step |
| `manual-override` | When a user manually overrides a framework decision |

No special instrumentation is needed. The generated workflow definitions include signal-logging instructions. Skills append entries during execution.

## Retrospectives (`/ryo-retro`)

After a meaningful chunk of work completes (feature shipped, sprint ended, milestone reached), invoke `/ryo-retro` in your AI tool.

The skill:

1. **Reads signals** from `.ryo/.state/signals.md`
2. **Reads history** from `.ryo/.state/history/` for past operation plans
3. **Reads current definitions** — all agents, skills, process, workflows
4. **Analyzes patterns:**
   - Agents never referenced in any workflow (unused roles)
   - Skills that get manually overridden frequently (poorly calibrated prompts)
   - Gates that always pass (criteria too loose — not catching problems)
   - Gates that always block (criteria too strict — slowing work without adding value)
   - Phases that get skipped via scale rules every time (may not be needed)
   - Missing capabilities (gaps in agent/skill coverage)
5. **Produces a retro report** at `.ryo/.state/retro-[date].md`
6. **Presents proposals** one at a time, asking which to accept or reject

### Example Retro Report

```markdown
## Proposed Changes

### Add: security-reviewer agent
**Why:** 3 of last 5 features had security issues caught late in review.
**Impact:** Adds a gate after implementation, before PR.
**Status:** PENDING

### Modify: testing phase gate
**Why:** Gate passed 100% of the time in last 10 runs. Criteria may be too loose.
**Proposed:** Add coverage threshold criterion.
**Status:** PENDING

### Remove: pi-planner agent
**Why:** Never invoked in any workflow over 30 days.
**Impact:** Simplifies process definition.
**Status:** PENDING
```

## Evolution (`/ryo-evolve`)

After accepting retro proposals, or after updating `org-context.yaml`, run `/ryo-evolve` to apply changes.

The evolution skill:

1. **Loads updated context** — re-reads `org-context.yaml` and constitution
2. **Reads retro reports** — picks up accepted proposals
3. **Diffs current state** against what would be generated from updated context
4. **Checks customizations** — reads `.ryo/.customize/` for user overrides
5. **Resolves conflicts** — for each proposed change that conflicts with a customization:
   - Shows what would change
   - Offers three options: keep customization, accept change, merge manually
6. **Applies changes** — removals first, then modifications, then additions
7. **Validates** — runs consistency checks after all changes
8. **Delegates** to generation sub-skills for new artifacts (can run agent-generation, skill-generation, etc. independently)

## The Full Cycle

```
Normal work → signals accumulate in .state/signals.md
                        │
                        ▼
              /ryo-retro analyzes patterns
                        │
                        ▼
              Retro report with proposals
              User accepts/rejects each
                        │
                        ▼
              /ryo-evolve applies changes
              Respects .customize/ overrides
                        │
                        ▼
              Updated framework in .ryo/
              New signals start accumulating
```

## When to Run Retros

There's no fixed schedule. Good triggers:

- **End of a sprint** — natural reflection point
- **After shipping a feature** — evaluate whether the process helped
- **When something went wrong** — signals will show where the process failed
- **When the team grows** — new roles may be needed
- **Quarterly** — catch slow-moving trends

## Tips

- **Start with signals.** Don't run `/ryo-retro` until you have a few weeks of signal data. Early retros won't have enough data to find patterns.
- **Accept selectively.** You don't have to accept every proposal. The retro surfaces patterns — you decide which ones to act on.
- **Use `.customize/`** for deliberate divergences. If you reject a retro proposal because your situation is unique, add a customization so future retros don't keep proposing the same thing.
- **Review history.** The `.ryo/.state/history/` directory shows how your framework has evolved. Use it to understand trends.

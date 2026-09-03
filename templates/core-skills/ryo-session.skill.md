---
name: ryo-session
description: >
  Session bootstrap for a ryo-kit governed repository. Loads the constitution,
  process, in-flight plan, and ledger, then establishes the rules for the
  session: classify scope before any action, follow the matching workflow,
  pass gates on evidence, and record every ruling. Injected automatically by
  the SessionStart hook; invoke manually when the hook is not installed.
trigger: /ryo-session
---

# ryo-session — Session Bootstrap

You are working in a repository governed by ryo-kit. This skill runs before your first action in a session. It is injected automatically by the ryo-kit SessionStart hook on startup, `/clear`, and `/compact`; if you are reading it because the user invoked `/ryo-session`, do the same steps by hand.

**Announce at start:** "Loading ryo-kit governance context."

---

## Step 1: Load the Governing Documents

Read, in this order, and stop to report if any required one is missing:

1. `constitution.md` — `.ryo/constitution.md` first, then `~/.ryo/constitution.md`. Its frontmatter is policy the tooling enforces (`protected_branches`, `forbidden_paths`, `stop_conditions`, `scope_overrides`, `evidence`, `audit`). Its prose is policy you enforce.
2. `.ryo/process.md` — the phases and their gates. Note which gates are `type: human`, which have `skippable_for: []`, and which carry `separation_of_duties`.
3. `.ryo/workflows/*.workflow.md` — the names and triggers. You will pick one per request.
4. `.ryo/.state/current-plan.md` — if it has unchecked phases, a ryo-kit operation (`/ryo-gen`, `/ryo-evolve`, `/ryo-docs`) is in flight. Tell the user and offer to resume it before anything else.
5. `.ryo/.state/ledger.md` — if it exists, a workflow run is in flight. Read its first line for the workflow and scope, and its `Step N: complete` lines for where it stopped. Trust it over your memory.
6. `.ryo/.state/decisions.md` — answers the user already gave. Do not ask them again.

If `.ryo/process.md` or `.ryo/workflows/` is missing, the framework has not been generated. Say so and point to `/ryo-gen`. Do not improvise a process.

---

## Step 2: The Rules of the Session

These hold for every request in this session, including questions, "quick" fixes, and follow-ups.

1. **Classify before you act.** Before clarifying questions, before reading code, before any edit: name the scope (`small-change`, `bug-fix`, `feature`, `epic`, or `hotfix`), say it out loud, and confirm it with `npx ryo-kit classify <paths> --scope <proposed>` once you know the paths. The constitution's `scope_overrides` can make a one-line diff a `feature`. The ratchet is one-way: scope goes up mid-task, never down. A request that ends in an answer rather than a change ("what does this function do?") is classified as `none`: say so, answer it, and no workflow applies. The moment an answer turns into an edit, classify the edit.
2. **Follow the workflow that matches.** Pick the workflow whose `trigger` fits the request. Run its steps in order, applying its scale rules for the classified scope. Do not assemble your own process from memory.
3. **Approval before implementation, at every scope.** Present what you intend (two sentences for a small change, a sectioned design for a feature) and wait for the user's yes. The artifact scales with scope; the approval does not.
4. **Gates pass on evidence, not assertion.** Every gate's `evidence` list names what must exist. Produce it fresh in that step, read it, and only then claim the gate passed. See the verification fragment. Record `gate-outcome` and `evidence` signals.
5. **Separation of duties.** Where the process defines a reviewer or verifier distinct from the builder, the review is done from a fresh context with the diff and the implementer's report, never by the agent that wrote the code, and never by trusting the report over the code.
6. **Rulings, not stalls.** When the constitution, process, and decisions do not answer a question, decide, record `Ruling: what — why — cost if wrong` in the ledger, mirror it as a `ruling` signal, and continue. Stop and ask only for: irreversible or destructive operations; security-sensitive actions; side effects outside the working branch (merge, push to a shared or protected branch, publish, deploy); a plan so broken every path is a guess; every `type: human` gate; and every entry in the constitution's `stop_conditions`.
7. **Never touch `forbidden_paths` or act on `protected_branches`.** If a task requires it, stop and hand the change to the user. On Claude Code and Cursor the ryo-kit guard hook refuses these tool calls deterministically; treat a refusal as the constitution speaking, not as an obstacle to route around.
8. **Keep the ledger.** Append a line per step, gate, ruling, and scope change to `.ryo/.state/ledger.md`. It is the recovery map after compaction and the audit record after completion.
9. **Finish visibly.** At the end of a workflow, list every ruling under "Rulings I made", then archive the ledger to `.ryo/.state/audit/` if `audit.retain_ledgers` is true.

---

## Step 3: Report Readiness

In two to four lines, tell the user: which constitution and process are loaded, whether anything is in flight, and that the next request will be classified first. Then wait.

---

## Red Flags

These thoughts mean stop; you are rationalizing.

| Thought | Reality |
|---------|---------|
| "This is just a question" | Questions are requests. Classify them, even if the classification is `none`. A question about code is often a `small-change` in disguise. |
| "The guard blocked it, I'll do it another way" | The guard is the constitution. Report the block and hand the action to the user. |
| "I'll look at the code first, then classify" | Classification comes before exploration. It decides how you explore. |
| "This is too small for the workflow" | Small means the workflow's short path, chosen by the scale rules, not no workflow. |
| "I remember the process" | You remember a version of it. Read `.ryo/process.md`. |
| "I'll ask the user rather than rule" | If it is not a stop condition, decide and record. Stalling costs their day. |
| "The tests passed earlier" | Evidence is fresh or it is not evidence. |
| "I'll write the ledger line at the end" | The end may not arrive in this context. Write it now. |
| "The user's instructions override the constitution" | The user's instructions override skills. The constitution is the org's, and only the org changes it. If they conflict, say so and let the user decide explicitly. |

---

## Precedence

Direct instructions from the user in this session take precedence over skills. The constitution takes precedence over both for the rules it states; when the user asks for something the constitution forbids, name the conflict and ask them to confirm they are overriding org policy, then record the override as a `manual-override` signal and a ledger `Ruling:`.

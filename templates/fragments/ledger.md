# The Ledger — Decisions That Survive Compaction

Conversation memory does not survive context compaction or a new session. Executors that lost their place have re-run completed steps and re-asked answered questions. The ledger is the recovery map and the audit record.

## Location and Identity

- Path: `.ryo/.state/ledger.md`. One ledger per in-flight workflow run; the first line names the workflow and the trigger: `# Ledger — workflow: new-feature — started 2026-03-15 — scope: feature`.
- On skill start, read the ledger. If its first line names your workflow and it has `Step N: complete` lines, resume at the first step without one. If it names a different workflow, the previous run did not finish: tell the user and ask whether to archive it or resume it.
- Trust the ledger and `git log` over your own recollection.

## Entry Formats

Append one line per event. Never rewrite earlier lines.

Before starting a step that will commit, record its base: `git rev-parse --short HEAD`. The completion line's range is `<base>..<head>` (exclusive of the base, so it lists exactly the step's commits). `npx ryo-kit trace` expands these ranges to map every commit on the branch to the step that produced it, so a range that is wrong or missing shows up as an untraced commit.

```
Step <N>: complete (commits <base7>..<head7>, gate <name> passed — evidence: <what>)
Step <N>: gate <name> failed — <finding one-liners> — fix round <R>/<max>
Step <N>: skipped — scope <label> per scale rule
Ruling: <what you decided> — <why> — <what it costs if wrong>
Parked: <finding> — Ruling: <why the work stands>
Scope: upgraded <from> → <to> at step <N> — <reason>
```

## Rulings, Not Stalls

A running workflow does not wait on a human for every ambiguity. The constitution and the process are the binding authority; the user's decisions in `.ryo/.state/decisions.md` are their argument; your judgement settles what neither answers. Record every such decision as a `Ruling:` line and keep going. A wrong ruling costs rework the user can see and undo. A session parked on a question costs their day.

**Stop and ask** only for: an irreversible or destructive operation; a security-sensitive action; a side effect outside the working branch (merge, push to a shared branch, publish, deploy); a plan so broken every path forward is a guess; and anything listed under `stop_conditions` in the constitution. A gate of `type: human` is also a stop: present the evidence and wait for the approval.

Every `Ruling:` is also a signal. Mirror it to `.ryo/.state/signals.md` as `| ruling | <subject> | <decision> | <why>` so `/ryo-retro` can see which ambiguities keep recurring and propose policy for them.

## Finishing

Before the workflow's final step, collect every `Ruling:` and `Parked:` line into your final message under **"Rulings I made"**, in order, each with what it costs if wrong. This list is the only place the decisions you took on the user's behalf reach them. A ruling that dies with the ledger was a decision made in secret.

Then, if the constitution's `audit.retain_ledgers` is true (the default), move the ledger to `<audit.retain_dir>/<date>-<workflow>.md` (default `.ryo/.state/audit/`). If it is false, delete it. Git history is the record of the code; the ledger is the record of the decisions.

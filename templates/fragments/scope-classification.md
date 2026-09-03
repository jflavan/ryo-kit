# Scope Classification — Classify First, Ratchet Up, Never Down

Every workflow begins by classifying the scope of the request. Scope is a policy decision, not a feeling about how small the diff looks.

## The Rule

1. **Classify before any other action** — before clarifying questions, before exploring the codebase, before writing code. Say the classification out loud so the user can override it: *"This looks like a bug-fix, so I'll run the bug-fix path and skip design."*
2. **Apply the constitution.** Run `npx ryo-kit classify <paths...> --scope <proposed>` with the paths you expect to touch. The constitution's `scope_overrides` set a minimum scope per path; the command never returns a scope smaller than the one you proposed. If it reports `forbidden` paths, stop: those files are not yours to modify. If you cannot run commands in this environment, apply `scope_overrides` and `forbidden_paths` from the constitution's frontmatter by hand and say that you did.
3. **Announce the path.** State which workflow you are following and which steps the scale rules skip for this scope.
4. **The ratchet is one-way.** Hidden complexity discovered mid-task upgrades the scope. Stop, say so, re-classify, and follow the larger path from the current step. Nothing downgrades mid-task.
5. **Record it.** Append a `scope-classification` signal: `- **[timestamp]** | scope-classification | [workflow] | [scope] | proposed [x], overrides [paths]`.

## Scope Labels

| Scope | Meaning | Typical path |
|-------|---------|--------------|
| `small-change` | Typos, config, docs. No behaviour change. | implement, verify |
| `bug-fix` | Correct a known defect in an existing flow. | implement, test, review |
| `feature` | New behaviour or a change to an interface others depend on. | all phases |
| `epic` | Spans multiple areas or subsystems. Decompose first. | all phases, no skips |
| `hotfix` | Emergency production fix. Orthogonal to size. | implement, test, deploy — with the gates the constitution refuses to skip |
| `none` | A question whose answer changes nothing. | no workflow; re-classify the moment an edit is proposed |

Approval before implementation does not scale down with scope. A `small-change` gets a two-sentence design in chat and an explicit yes. The artifact shrinks; the gate does not.

## Red Flags

| Thought | Reality |
|---------|---------|
| "This is too small to classify" | Classification takes one sentence. Say it. |
| "I'll call it small-change and skip the gate" | Reaching for a label to skip work is the doubt. Take the larger scope. |
| "I understand this kind of change, so it's bounded" | Scope measures the repo and the constitution, not your familiarity. |
| "It grew, but I'm nearly done" | Hidden complexity upgrades the path now, not after. |
| "The user approved the spike, so the follow-up is approved" | Each request gets its own classification and its own approval. |

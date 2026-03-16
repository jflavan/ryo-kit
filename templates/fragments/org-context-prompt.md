# Org Context Loading Fragment

This fragment provides reusable instructions for loading and parsing organizational context. Include these steps in any skill that needs org context (ryo-gen, ryo-evolve, sub-skills, etc.).

---

## Step 1: Locate org-context.yaml

Search for the org context file in this order. Use the first one found:

1. `.ryo/org-context.yaml` — Repo-local context (takes precedence)
2. `~/.ryo/org-context.yaml` — Org-wide context (shared across repos)

If neither file exists, stop and tell the user:
> "No org-context.yaml found. Run `npx ryo-kit init` to create one."

Do not proceed without org context. Do not invent or assume context values.

---

## Step 2: Parse org-context.yaml

Read the file and extract the following fields. Note which fields are present and which are missing.

**Required fields** (generation cannot proceed without these):
- `methodology` — One of: scrum, safe, kanban, hybrid, none
- `stack.languages` — Array of programming languages
- `stack.frameworks` — Array of frameworks
- `stack.cloud` — Cloud provider: azure, aws, gcp, multi, none
- `team.size` — One of: solo, small, medium, large, enterprise
- `compliance` — Array of compliance standards (may be empty array)
- `tools.ai` — Array of AI runtimes in use
- `tools.scm` — Source control platform

**Optional fields** (useful but generation can proceed without them):
- `name` — Org or project name
- `stack.cicd` — CI/CD tools
- `team.roles` — Specific roles present on the team
- `tools.pm` — Project management tool
- `conventions.branching` — Branching strategy
- `conventions.testing` — Testing approach
- `conventions.reviews` — Code review policy

If any required field is missing, stop and tell the user which field is missing. Suggest they re-run `npx ryo-kit init` to regenerate the context file.

---

## Step 3: Locate and Read constitution.md

Search for the constitution in this order:

1. `.ryo/constitution.md` — Repo-local constitution
2. `~/.ryo/constitution.md` — Org-wide constitution

If neither file exists, note it and proceed. The constitution is optional. Tell the user: "No constitution.md found. Generated artifacts will not include org-level principles. You can create one later with `npx ryo-kit init`."

If found, read the full contents. The constitution contains non-negotiable principles (e.g., "all public APIs must have OpenAPI specs," "no direct database access from controllers"). These principles must be embedded as constraints in every generated artifact.

---

## Step 4: Summarize the Org Profile

After reading both files, produce a concise summary of the organizational profile. Cover:

1. **Team shape** — Size, roles, methodology
2. **Tech stack** — Languages, frameworks, cloud, CI/CD
3. **Compliance posture** — What standards apply, or "no compliance requirements"
4. **Tooling** — AI runtimes, SCM, PM
5. **Conventions** — Branching, testing, reviews (or "not specified")
6. **Constitutional principles** — Key rules from constitution.md (or "no constitution")

Present this summary to the user for confirmation before proceeding with generation.

---

## Step 5: Identify Gaps

Compare the org context against what is needed for high-quality generation. Flag gaps that should be addressed in the clarification phase:

| Missing Field | Impact | Recommendation |
|--------------|--------|---------------|
| `conventions.branching` | Cannot tailor branch-related workflow steps | Ask user for branching strategy |
| `conventions.testing` | Cannot tailor testing phase gates | Ask user for testing approach |
| `conventions.reviews` | Cannot set review gate types correctly | Ask user if reviews are required |
| `team.roles` | Cannot map agents to existing team roles | Ask user what roles exist |
| `methodology` is "hybrid" | Cannot determine phase structure | Ask user to describe their workflow |
| `compliance` is empty + large team | Unusual; may be an oversight | Ask user to confirm no compliance needs |
| No constitution | Generated artifacts lack org principles | Note it; suggest creating one later |

Return the list of identified gaps so the calling skill can address them in its clarification phase.

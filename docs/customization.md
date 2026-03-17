# Customization

ryo-kit generates a framework tailored to your org, but you'll want to customize it further. The `.customize/` directory and org-editable files make this safe and sustainable.

## What You Can Customize

### Constitution (`constitution.md`)

The constitution file contains non-negotiable principles that apply to all generated agents and skills. Edit it directly:

```
~/.ryo/constitution.md       # org-wide mode
.ryo/constitution.md          # repo-only mode (inside .ryo/ if ryo init wrote it there)
```

Add your org's coding standards, security requirements, architectural principles, or anything that should be embedded into every generated prompt. Changes take effect the next time you run `/ryo-gen` or `/ryo-evolve`.

### Org Context (`org-context.yaml`)

Update this file when your org changes — new team members, different methodology, added compliance requirements, new AI tools. Then run:

```sh
npx ryo-kit evolve
```

And invoke `/ryo-evolve` in your AI tool.

### Generated Artifacts

You can edit any file in `.ryo/` directly:

- **Agent definitions** (`.ryo/agents/*.agent.md`) — adjust responsibilities, gate criteria, handoff rules
- **Skill definitions** (`.agents/skills/*/SKILL.md`) — modify the actual prompts
- **Process definition** (`.ryo/process.md`) — change phases, gates, scale rules
- **Workflows** (`.ryo/workflows/*.workflow.md`) — adjust step sequences

Direct edits work immediately — your AI tool reads these files each time a skill is invoked.

## The `.customize/` Directory

The `.customize/` directory at `.ryo/.customize/` preserves your overrides across re-generation. When `/ryo-evolve` runs, it:

1. Reads all files in `.ryo/.customize/`
2. Compares proposed changes against your customizations
3. For each conflict, warns you with specifics:
   - Which file would change
   - What the proposed change is
   - What your customization currently says
4. Asks you to choose: **keep your customization**, **accept the proposed change**, or **merge manually**
5. Only applies changes you approve

### How to Use `.customize/`

Place override files in `.ryo/.customize/` that mirror the structure of `.ryo/`:

```
.ryo/.customize/
├── agents/
│   └── reviewer.agent.md      # Your custom reviewer agent overrides
├── skills/
│   └── deploy/
│       └── SKILL.md            # Your custom deploy skill overrides
└── process-gates.md            # Your custom gate criteria
```

When `/ryo-evolve` proposes changes to `reviewer.agent.md`, it detects your override and asks before proceeding.

### What Goes in `.customize/` vs. Direct Edits

- **`.customize/`** — for overrides you want to protect during evolution. Put files here when you've deliberately diverged from what ryo-kit would generate.
- **Direct edits to `.ryo/`** — for quick adjustments. These may be overwritten during evolution if you don't also protect them in `.customize/`.

## Persistence Across Evolution

The evolution cycle (`/ryo-evolve`) is designed to be non-destructive:

1. **`.customize/` is never modified** by ryo-kit — only you edit files there
2. **Conflicts require explicit approval** — nothing is silently overwritten
3. **Archives are kept** — completed evolution plans go to `.ryo/.state/history/`
4. **Rollback is possible** — since everything is in git, you can revert any evolution

## Gitignore Recommendations

The `.ryo/.state/` directory contains session state (plan progress, signals, retro reports). You may want to:

- **Gitignore `.state/`** if the state is per-developer (default recommendation)
- **Commit `.state/signals.md`** if you want team-wide retro analysis
- **Commit `.state/history/`** if you want a shared record of framework evolution

The `.customize/` directory should always be committed — it represents deliberate team decisions.

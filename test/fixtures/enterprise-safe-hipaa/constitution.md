---
version: 1
protected_branches: [main, release/*]
required_reviewers:
  default: 2
  paths:
    "src/phi/**": { count: 2, roles: [security, compliance] }
    "db/migrations/**": { count: 2, roles: [dba] }
forbidden_paths: ["infra/prod/**"]
stop_conditions:
  - any change to PHI storage, encryption, or audit logging
  - any migration that drops or renames a column
scope_overrides:
  - paths: ["src/phi/**", "src/auth/**"]
    minimum_scope: feature
    reason: PHI and auth changes always get design and compliance review
  - paths: ["db/migrations/**"]
    minimum_scope: feature
evidence:
  review: required
  tests: required
  additional: [compliance-checklist]
audit:
  retain_ledgers: true
  retain_dir: .ryo/.state/audit
---

# MegaCorp Health Constitution

- PHI is encrypted at rest and in transit; every write to a PHI table is audit-logged.
- Two reviewers on every change to production code; one must be from security for PHI paths.
- No completion claim without fresh verification evidence.

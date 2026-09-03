# Verification Before Completion — Evidence Before Claims

No gate passes, no step completes, and no completion claim is made without fresh verification evidence produced in the current step.

## The Gate Function

Before claiming any status, passing any gate, or expressing satisfaction:

1. **Identify** the command or check that proves the claim. The gate's `evidence` list names what must exist.
2. **Run** it, fresh and complete, now. A run from earlier in the session proves only the tree it ran on.
3. **Read** the full output. Check the exit code. Count the failures.
4. **Verify** the output supports the claim. If not, state the actual status with the evidence.
5. **Only then** make the claim, with the evidence, and record it: `- **[timestamp]** | evidence | <gate> | <command or artifact> | <result>`.

Skipping a step is asserting, not verifying.

## What Counts

| Claim | Requires | Not sufficient |
|-------|----------|----------------|
| Tests pass | Test command output with 0 failures | A previous run, "should pass" |
| Linter clean | Linter output with 0 errors | A partial check |
| Build succeeds | Build command exit 0 | Linter passing, logs look fine |
| Bug fixed | Test of the original symptom passes | Code changed, assumed fixed |
| Regression test works | Red then green: revert the fix, watch it fail, restore, watch it pass | The test passes once |
| Delegated work done | The diff shows the change | The delegate said "done" |
| Requirements met | Line-by-line checklist against the plan or spec | Tests passing |
| Review passed | The reviewer's written verdict, by a reviewer who did not write the code | Self-review |

## Red Flags

Stop when you notice any of these:

- "should", "probably", "seems to" in a status statement
- Satisfaction before verification: "Great!", "Done!", "Perfect!"
- About to commit, push, open a PR, or pass a gate without running the check
- Trusting a delegate's or sub-agent's success report without reading the diff
- A partial check standing in for the full one
- "Just this once"

| Excuse | Reality |
|--------|---------|
| "It worked earlier this session" | Run it on the tree you are about to hand off. |
| "I'm confident" | Confidence is not evidence. |
| "The linter passed" | The linter is not the compiler, and neither is the test suite. |
| "The sub-agent said it passed" | Read the diff and the output yourself. |
| "Different words, so the rule doesn't apply" | The rule covers implications of success, not phrases. |

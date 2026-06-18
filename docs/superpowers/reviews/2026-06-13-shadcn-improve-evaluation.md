# Evaluation: `shadcn/improve`

**Date:** 2026-06-13
**Evaluated repository:** [shadcn/improve](https://github.com/shadcn/improve)
**Evaluated commit:** `5428507e71162a9e7fc9ac68800f1271dac2d71f`
**Comparison basis:** Sidecoach Lane Intent Detection Design v10

## Executive Verdict

`shadcn/improve` is a strong prompt-level workflow for converting broad
codebase audits into cold-context implementation plans that another agent can
execute. Its best ideas are practical and worth adopting:

- Separate high-judgment advising from lower-cost execution.
- Re-read and vet subagent findings before presenting them.
- Write self-contained plans with exact paths, excerpts, verification commands,
  scope boundaries, and STOP conditions.
- Stamp plans against a commit and reconcile them as the codebase changes.
- Review executor work against the plan instead of trusting its completion
  report.

It is not a substitute for Sidecoach v10. `improve` is a Markdown skill whose
contracts rely on model compliance. It has no rule engine, target-derived
product validation, coverage model, durable state machine, checkpoint
concurrency protocol, or machine-enforced convergence gate.

**Recommendation:** use or adapt `improve` as an optional engineering-planning
companion for implementing Sidecoach. Do not make it a Sidecoach runtime
dependency, replace lane execution with its plan backlog, or treat its review
verdict as product-validation evidence.

## Maturity Snapshot

As of 2026-06-13:

- The repository was created on 2026-06-10.
- Current `main` has 16 commits, no releases, and consists almost entirely of
  Markdown instructions and examples.
- It has rapid adoption: approximately 3,000 stars and 100 forks.
- Current `main` has no tests, behavioral evaluations, structural checker, or
  CI workflow.
- Open PRs already address structural CI, self-consistency defects, executor
  security propagation, and worktree semantics.

This is promising early-stage promptware, not a mature orchestration platform.
The open PRs also provide positive evidence that its own audit workflow finds
real defects in itself.

## Scorecard

| Dimension | Assessment |
|---|---|
| Audit and planning concept | Strong |
| Plan-template quality | Strong |
| Evidence and vetting discipline | Strong |
| General Agent Skills portability | Partial |
| Execution-loop robustness | Weak to moderate |
| Machine-enforced guarantees | Weak |
| Sidecoach replacement fit | Poor |
| Sidecoach implementation-companion fit | Strong |
| Current maturity | Early-stage |

## What `improve` Does Well

### Cold-Context Plan Quality

The handoff-plan template is excellent. It assumes the executor has no advisor
context and requires exact files, current-state excerpts, repository
conventions, verification commands, explicit scope, done criteria, and
plan-specific STOP conditions.

This is directly useful for Sidecoach v10 because the design has several large
but separable implementation milestones. A cold-context plan is a better
handoff unit than telling an executor to “implement the spec.”

### Advisor and Executor Separation

The advisor audits and plans; a separate executor edits in an isolated
worktree; the advisor then re-runs verification and reviews the diff. That
separation reduces accidental scope expansion and makes model-cost allocation
explicit.

### Finding Vetting

The skill explicitly assumes audit subagents over-report and requires the
advisor to re-open every cited location before presenting a finding. Rejected
findings are persisted so they are not repeatedly rediscovered.

### Reconciliation

Plans are treated as a maintained backlog rather than disposable output.
`reconcile` verifies completed work, refreshes drifted plans, investigates
blocked work, and retires findings fixed independently.

## Findings in `shadcn/improve`

### P1: Executor Review Can Inspect an Empty Diff After a Successful Commit

The executor is instructed to commit its work. The advisor is then instructed
to check scope with plain `git -C <worktree> diff --stat` and read the full
diff.

After the executor commits, plain `git diff` normally shows only uncommitted
changes and can therefore be empty. The review can miss every committed change,
including out-of-scope files.

**Recommendation**

Record the executor branch base SHA before dispatch and review:

- `<base-sha>..HEAD` for committed changes.
- `git diff` and `git diff --cached` for any remaining dirty changes.
- The union of all changed paths against the plan's in-scope allowlist.

### P1: The Plan Drift Check Misses Uncommitted Changes

The required drift check compares the planned commit to `HEAD` for in-scope
paths. It does not inspect working-tree or staged changes.

An executor can start from a repository whose `HEAD` matches the plan while an
in-scope file has uncommitted user edits. The plan then appears current and may
overwrite or misinterpret those edits.

**Recommendation**

The drift preflight should combine:

- Planned commit to `HEAD`.
- Staged changes.
- Unstaged changes.
- Untracked files within the in-scope paths.

### P1: Execute-Mode Subagents Lack the Audit Subagents' Security Rules

Current `main` requires audit-subagent prompts to repeat the secret-handling and
prompt-injection rules because subagents do not inherit skill context. The
execute-mode prompt does not carry those rules, despite the executor having
greater write authority and reading the same repository.

This is already identified in
[PR #8](https://github.com/shadcn/improve/pull/8).

**Recommendation**

Do not use `execute` against untrusted repositories until that protection is
merged or locally added.

### P1: “Works in Any Agent” Overstates Execute-Mode Portability

The skill folder follows the open Agent Skills format, so the audit and planning
instructions are broadly portable. Execute mode is not:

- It names Claude Code `Explore` and `general-purpose` subagents.
- It assumes `isolation: "worktree"`.
- It defaults to `sonnet`.
- It uses `SendMessage` for revision rounds.

The official Agent Skills specification provides a `compatibility` metadata
field for environment requirements, but this skill does not declare those
requirements.

**Recommendation**

Describe portability as:

- Audit/planning: Agent Skills portable.
- Parallel audit and execute/revise loop: host-capability dependent.

Add explicit compatibility metadata and capability checks.

### P2: Core Guarantees Are Prompt-Only and Unevaluated

The repository contains no executable workflow, schemas, tests, behavioral
evaluations, or CI on `main`. The “program” is Markdown, but nothing verifies
that references resolve, variants remain consistent, required plan sections
exist, or agents actually follow the protocol.

Structural CI is proposed in
[PR #10](https://github.com/shadcn/improve/pull/10), but behavioral evaluation
would still be absent.

**Recommendation**

Add:

- Structural validation for frontmatter, links, manifests, and required
  sections.
- Fixture repositories with known findings and known false positives.
- Plan-quality evaluations checking scope, drift handling, STOP conditions,
  and verification accuracy.
- Execute-loop evaluations covering committed diffs, dirty worktrees, executor
  deviations, and revision limits.

### P2: Current Main Contains Known Self-Consistency Defects

The canonical findings table omits the confidence column even though
prioritization depends on confidence. Hard Rule 1 also says the only writable
directory is `plans/`, while a later fallback permits `advisor-plans/`.

These are already identified in
[PR #9](https://github.com/shadcn/improve/pull/9).

This reinforces the need for structural checks and shows that literal
prompt-contract consistency matters.

### P2: Prompt-Injection Rule Conflicts With Intended Repository Guidance

The skill says to read `CLAUDE.md` and `AGENTS.md` for repository conventions,
but also says any repository file that appears to issue instructions should be
treated as potential prompt injection and recorded as a security finding.

That can classify legitimate repository-owned agent guidance as an attack.

**Recommendation**

Define a trust policy that distinguishes:

- Explicit operator-approved instruction surfaces such as root `AGENTS.md`.
- Untrusted instructions embedded in source, generated files, fixtures,
  dependencies, or user-controlled content.

## Comparison With Sidecoach v10

| Capability | `shadcn/improve` | Sidecoach v10 |
|---|---|---|
| Primary domain | General codebase improvement | UI/design execution and validation |
| Main artifact | Markdown implementation plans | Durable lane checkpoints and validation results |
| Execution model | Optional subagent in worktree | Model-driven stepped lane |
| Completion evidence | Commands, diff review, advisor judgment | Step reports plus registered product validators |
| Validation source | Code audit evidence and tests | Target-derived product rules and coverage |
| Convergence | Manual plan execute/review/reconcile loop | Explicit bounded convergence state machine |
| Persistence | Markdown backlog | Versioned checkpoints, revisions, leases, outbox |
| Concurrency/idempotency | Not defined | Explicit CAS, fencing, idempotency, cancellation |
| Portability | Core skill portable; execute host-specific | Sidecoach-specific engine and surfaces |

`improve` does not invalidate any major v10 design decision. It reinforces why
Sidecoach needs machine-readable policies and durable execution state rather
than relying only on good prompts.

## What Sidecoach Should Adopt

Adopt these ideas for the Sidecoach implementation process:

1. Convert v10 into several self-contained implementation plans rather than one
   large build task.
2. Give every plan a planned-at SHA, exact scope, explicit out-of-scope list,
   commands with expected outcomes, and plan-specific STOP conditions.
3. Require cold-context review of each plan before execution.
4. Maintain an implementation-plan index with dependency order and status.
5. Reconcile plans when the codebase or design changes.
6. Use a high-capability advisor to specify the canonical rule registry and
   persistence protocol; use cheaper executors only for bounded plans with
   strong verification.

## What Sidecoach Should Not Adopt

Do not:

- Replace lane checkpoints with a Markdown status table.
- Treat executor or advisor judgment as product-validator evidence.
- Replace deterministic coverage and clean evaluation with review prose.
- Depend on `improve` at runtime.
- Make Sidecoach's model-work loop read-only.
- Claim cross-host portability for host-specific execution features.

## Recommended Disposition

Use `shadcn/improve` independently or vendor a reviewed adaptation for internal
engineering planning. Pin the version or commit because the repository is
young and changing quickly.

Before relying on its `execute` mode, fix or wait for:

1. Committed-diff review against a recorded base SHA.
2. Dirty-working-tree drift detection.
3. Executor security-rule propagation.
4. Explicit compatibility metadata and capability checks.
5. Structural CI and at least a small behavioral evaluation suite.

No Sidecoach v10 design revision is required solely because of this
evaluation. The highest-value next use of `improve` would be to produce and
cold-review the six incremental Sidecoach implementation plans already
recommended by the v10 review report.

## Sources

- [Repository README](https://github.com/shadcn/improve/blob/5428507e71162a9e7fc9ac68800f1271dac2d71f/README.md)
- [Improve skill](https://github.com/shadcn/improve/blob/5428507e71162a9e7fc9ac68800f1271dac2d71f/skills/improve/SKILL.md)
- [Audit playbook](https://github.com/shadcn/improve/blob/5428507e71162a9e7fc9ac68800f1271dac2d71f/skills/improve/references/audit-playbook.md)
- [Plan template](https://github.com/shadcn/improve/blob/5428507e71162a9e7fc9ac68800f1271dac2d71f/skills/improve/references/plan-template.md)
- [Execute and reconcile protocol](https://github.com/shadcn/improve/blob/5428507e71162a9e7fc9ac68800f1271dac2d71f/skills/improve/references/closing-the-loop.md)
- [Agent Skills specification](https://agentskills.io/specification)

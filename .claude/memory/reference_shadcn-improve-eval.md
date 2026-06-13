---
name: shadcn/improve evaluation
description: Evaluated shadcn/improve audit-plan-execute skill; it packages a loop Jonah already runs; steal 3 ideas, don't adopt wholesale
type: reference
relates_to: [session_2026-06-12_external-skill-eval-six-skills.md, feedback_multiagent_verified_implementation_mandate.md, reference_claude-mem-vs-beats-eval.md]
---

Evaluated https://github.com/shadcn/improve at Jonah's request (2026-06-13). Created 2026-06-10, MIT, ~3k stars, v1.0.0.

**What it is:** a Claude Code SKILL (prompt-ware, not code - primaryLanguage null; SKILL.md + references/audit-playbook.md + examples). Install `npx skills add shadcn/improve`. Thesis = model stratification: expensive model audits/judges/specifies, cheap model executes, expensive model reviews the diff.
Loop:
- `/improve` (variants quick/standard/deep, or focused security/perf/tests/bugs): fan out parallel read-only subagents (Explore agents), one per 9 categories (correctness, security, perf, tests, tech debt, deps, DX, docs, strategy). Findings ranked by leverage = impact / effort, weighted by confidence.
- `/improve plan <x>`: write self-contained markdown spec to plans/ (exact paths, current-state excerpts, exemplar file for conventions, ordered steps w/ verify commands, machine-checkable done criteria, STOP conditions). Plan stamps `git rev-parse --short HEAD` for drift.
- `/improve execute <plan>`: dispatch cheaper executor subagent in isolated git worktree; advisor reviews diff like a tech lead, re-runs done criteria, rejects out-of-scope. Advisor NEVER edits source (writes only plans/, read-only cmds). `/improve reconcile` refreshes backlog. `--issues` publishes to GitHub.

**Smartest design decisions:** (1) verification-baseline-as-finding-#1 - if repo has no working tests/typecheck/lint it refuses risky plans and makes establishing a baseline finding #1; (2) read-only advisor boundary (planner never touches code, executor in disposable worktree, human merges); (3) commit-hash drift stamping on plans.

**Key honest point - it packages a loop Jonah already runs with more rigor.** Overlaps: superpowers writing-plans/executing-plans/subagent-driven-development/brainstorming (the spine); Explore/Plan agents (the fan-out); Codex GPT-5.4 cross-model review (a STRONGER review step - cross-model beats improve's same-model advisor); the produce-and-verify-with-agents mandate (execute-in-isolation-then-verify). Lane P1 was exactly audit->plan->execute->verify done by hand. So improve introduces no capability Jonah lacks. It is prompt-ware, 3 days old, unproven at depth; "cheap model executes" is aspirational unless the executor subagent's model is explicitly wired. Orthogonal to the design stack (sidecoach/Justify/tilt-lab) - its safety model is never-touch-code, so it can't do live visual iteration. Also orthogonal to memory (beats/claude-mem).

**Worth stealing (borrow-selectively):** (1) leverage scoring as an explicit rubric in audit/critique flows; (2) verification-baseline-as-finding-#1 gate into produce-and-verify mandate + sidecoach QA gate; (3) commit-hash drift stamping on docs/superpowers/plans/*.md files.

**Verdict:** well-designed, validates Jonah's instincts, but no new capability. Lift the 3 ideas, don't adopt wholesale.

Collaborator: Jonah.

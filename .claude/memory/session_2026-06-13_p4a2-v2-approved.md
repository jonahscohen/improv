---
name: P4a-2 v2 (Codex-authored) reviewed+APPROVED; executing
description: Codex authored P4a-2 v2 closing all 11 findings; I reviewed (integrity + deep-fix correctness + scope honesty) and approved; committing + executing
type: project
relates_to: [session_2026-06-13_p4a2-codex-review-handoff.md, session_2026-06-13_p4a1-COMPLETE.md]
supersedes: session_2026-06-13_lane-p4a2-plan.md
---

Role inversion applied proactively to P4a-2 (deeply spec-bound): Codex authored v2
(task-mqd30ph5; --write; session 019ec3a8) closing all 8 P1 + 3 P2, I reviewed.

**My review:** integrity 1603 lines, 0 NUL/dashes/non-ascii, v2, no git add -A.
Deep-fix correctness confirmed by reading the sections:
- per-file execution: validateProduct runs scope:'file' rules per applicable
  inspected file + aggregates; scope:'project' only for the 3 markup ban
  heuristics; browser-only scope:'component'; registry test pins every scope.
- measuredScope from conclusive sufficiently-covered executions; unverifiedScope =
  registryScope minus measured; test rejects an inconclusive rule claiming scope.
- coverage collector returns unreadable/skipped/unsupported; root failure -> error;
  per-file gap -> affected required rules inconclusive.
- applicability probes (true|false|'unknown'): unknown->inconclusive,
  false->not_applicable, true->feature check (kills the presence-rule false fails).
- faithful ports: extract static predicates into shared exported helpers in
  polish-standard-validator.ts, reuse from polish-checks.ts; preserve every
  precondition (identical-card-grids repeat(...), Tailwind/shadcn carve-outs);
  repeat-grid + Tailwind regression tests.
- SCOPE HONESTY: relabeled "STATIC-DETERMINABLE PARTIAL floor, not the full release
  floor"; browser-evidence rules owned-but-non-required -> inconclusive until P4b;
  copy/linguistic gating deferred to P4e (Codex named the new phase). Tests assert
  ad-hoc browser/contrast evidence does NOT bypass the P4b collector. Honest.
- exact 30-def + 22-alias table assertions; throwing-proxy rule_exception test;
  one shared supported-source matrix (collector+registry+generator) + Sass/mixed
  tests; path-specific staging + allowlist/preexisting-dirty guard.

**VERDICT: APPROVED** (I am the reviewer; my approval gates the plan). Committed;
executing P4a-2 via fresh team. Codex will CODE-review the executed branch.

**Phase map now:** P4a-1 done; P4a-2 (this, partial static floor); P4b (async exec
+ durability + browser collector); P4c (loops+convergence); P4d (MCP+cleanup);
P4e (copy/linguistic gating). The role inversion is the working pattern for the
spec-bound sub-plans.

Collaborator: Jonah.

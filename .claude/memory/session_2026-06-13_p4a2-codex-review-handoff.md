---
name: P4a-2 plan review NEEDS-FIXES (11 deep findings) -> Codex authors v2, I review
description: agent-authored P4a-2 hit 11 Codex findings (deep validator semantics) on round 1; applying the role-inversion lesson proactively - Codex authors v2; I made the full-vs-partial-floor scope call (partial, spec-consistent)
type: project
relates_to: [session_2026-06-13_p4a1-COMPLETE.md, feedback_codex_takeover_on_round_fail.md]
---

Codex P4a-2 plan review (task-mqd2twag; session 019ec3a4) = NEEDS-FIXES (no P0,
8 P1 + 3 P2). Round 1 of the agent-authored plan; the findings are deep
validator-semantics issues (like P4a-1). Per the recorded role-inversion lesson
([[feedback_codex_takeover_on_round_fail.md]]) - apply proactively to deeply
spec-bound sub-plans - I go STRAIGHT to Codex authoring v2 (it just produced the
surgical review), I review.

**11 findings for Codex to fix in v2:**
- P1-1 coverage false-clean: collector silently discards unreadable/oversized
  files; observationFor declares all inspected, skippedFiles/unsupported empty. A
  readable-clean file hides an unreadable-violating one. Collector must return
  discovered/inspected/skipped/unreadable/unsupported; root failure -> validator
  error; per-file gap -> affected required rules inconclusive.
- P1-2 file-scoped checks on AGGREGATED text: one file's presence passes another;
  coverage claims both inspected. Execute file-scoped checks PER applicable file +
  aggregate; coverage reflects files actually evaluated by that rule.
- P1-3 measuredScope fabricated from registryScope: derive only from
  sufficiently-covered non-inconclusive executions; unverifiedScope = registryScope
  minus measured.
- P1-4 not_applicable not implemented: presence rules FAIL when CSS exists but
  feature absent + no applicable target. Define applicability detection per
  applicability:not_applicable rule; if applicability undeterminable from evidence
  -> inconclusive, not fail.
- P1-5 ports not faithful: identical-card-grids drops the repeat(...) precondition;
  theming drops Tailwind/shadcn detection + token carve-outs. Extract/reuse the
  existing scanners or preserve every precondition/option; regression tests.
- P1-6 polish clean/findings fixtures unachievable: animatepresence-initial is a
  required MARKUP rule, fixtures are CSS-only -> inconclusive. Add non-Framer
  markup so it is not_applicable, or revise its evidence/applicability.
- P1-7 SCOPE - claimed "full floor" but defers copy/bans + static-a11y has only
  focus-visible required. DECISION (mine, spec-consistent): P4a-2 is the
  STATIC-DETERMINABLE PARTIAL floor - browser-evidence (dom/computed/contrast)
  rules stay owned-but-non-required and surface inconclusive until P4b's browser
  collector (the spec itself models this, 610-612); copy/linguistic gating rules
  are DEFERRED to a named phase (avoid inventing ~38 per-pattern rules). The plan
  must LABEL this honestly (partial floor + named deferrals), not claim "full
  floor." Amend the phase acceptance accordingly.
- P1-8 git add -A in tasks (dirty-worktree trap): path-specific staging every
  task; compare committed paths to an allowlist + the preexisting-dirty snapshot.
- P2-1 registry tests assert only representative rows: add table-driven EXACT
  assertions over all 30 defs + all 22 alias pairs.
- P2-2 thrown-check test passes null (doesn't throw) + omits category assert: use a
  throwing proxy/injectable check; assert normalizedErrorCategory==='rule_exception'.
- P2-3 collector vs registry source-support mismatch (collector takes Sass/JSX/Vue/
  Svelte; CSS-rule support block omits them): ONE shared supported-source matrix
  for collection + generation; test Sass-only + mixed projects.

**Action:** codex task --write to author P4a-2 v2 closing all 11 + the scope
relabel. Then I verify+review (integrity, spec-fidelity spot-checks, scope honesty,
internal consistency), commit, gate, execute.

Collaborator: Jonah.

---
name: Lane P1 classifier tier COMPLETE - built, verified, awaiting Codex + merge
description: All 13 P1 tasks implemented + independently verified (per-task) + whole-branch final review READY-TO-FINISH; branch lane-p1-classifier-tier; Codex secondary still owed (env down); merge/PR pending Jonah
type: project
relates_to: [feedback_multiagent_verified_implementation_mandate.md, session_2026-06-13_p1-plan-verification.md, session_2026-06-13_lane-v10-review-repair-read.md]
---

P1 (the lane registry + generation + classifier/hook tier of the frozen v10
spec) is FUNCTIONALLY COMPLETE on branch `lane-p1-classifier-tier`, built under
the produce-with-agents / verify-with-SEPARATE-agents regime Jonah mandated.

**Verified at THREE levels:** each of the 13 tasks implemented by impl-t1 and
independently verified by vfy-t1 with REAL execution; then a fresh whole-branch
final-reviewer returned READY-TO-FINISH (integration coherent, 3 classifier
copies agree, full test surface green, zero unrelated drift, deferrals
intentional). No open P0/P1.

**Deliverable:** six mode words removed; a Python hook classifier
(claude/hooks/sidecoach_lanes.py + sidecoach-lanes.json) + a TS mirror (mcp
keyword-resolver.ts + engine lane-classifier.ts) with VERIFIED cross-language
parity (19-case corpus run against all 3 copies); the hook no longer
false-fires on quoted/pasted content; /sidecoach <phrase> resolver +
Levenshtein near-miss; a build-time generator (lanes.generated.ts + --check
drift guard, 3 drift types); scoped npm-test runner; install deploys all hook
runtime inputs (verbs+lanes+intent+module).

**~5 real defects caught+fixed by the regime (not by single-pass):**
conjunction-prefix over-segmentation (", butter"), unpinned route_margin==2
boundary, quoted-verb false-fire leak (the spec's core motivation), the
tsc-rootDir cross-package parity divergence (3-copy fallback + corpus guard),
the install runtime-deploy gap (sidecoach_lanes.py / intent.json never
deployed -> silent degradation).

**Full test surface GREEN:** python test_sidecoach_lanes.py 35/0;
test_classifier_parity.py 19; bash test-sidecoach-keyword.sh 110/0; sidecoach
npm test 5 suites; both npm run build exit 0; generate-lanes --check clean.

**Commit chain (19, branch lane-p1-classifier-tier):** 3a3e99c de653a6 3ecda53
2fdfb89 0c723d7 88b0d98 a77e0c2 c2d8182 cc9c378 a69b9c4 3168d5b e3e85f8 4767a36
aa931fd 3b74aa0 bb2c2fa 3c9755a 57b9110 12565b8 (+ team task beats + the
checkpoint/verified-plan commits on top).

**OPEN GATES / DECISIONS (Jonah's call):**
1. CODEX SECONDARY - OWED, persistently DOWN the entire build: codex-companion
   setup keeps returning "failed to resolve feature override precedence:
   Operation not permitted" (the macOS-temp-purge/EPERM residual on Codex's
   runtime, independent of the healthy Claude shell). The mandated Codex pass
   never ran. Decision: clear Codex's runtime (temp/restart) and run the
   secondary pass before finishing, OR finish on the two-agent + whole-branch
   coverage.
2. BRANCH FINISH - merge lane-p1-classifier-tier to main / open a PR / keep the
   branch. Jonah's call (outward-facing).

**RECORDED FOLLOW-UPS (deferred, not lost):**
- CALIBRATION (P1-later, spec sec 3): single-word verbs layout/live/audit
  double as common English -> verb-tier false-fire surface; harden the verb
  lexicon (design-context qualifier or drop riskiest bare verbs).
- MINOR cleanup (vfy-t1 sign-off #5): test-sidecoach-keyword.sh has two
  now-unused helper defs (assert_mode_fires line 97, assert_tiebreak line 115)
  left from the mode-word era - harmless dead code, drop on next touch.
  (vfy-t1 sign-off #1 "route_margin boundary unpinned" was a STALE note - the
  boundary IS pinned: test_route_margin_boundary_exactly_two_routes line 323.)
- P2: resolveSidecoachPhrase is built+tested but NOT wired into
  parseSlashCommand - a real user typing `/sidecoach <phrase>` won't resolve
  end-to-end until P2 wires the dispatch.
- P2/P3/P4 per the spec: lane execution API (startLane/advanceLane), checkpoints
  + lease/outbox, product validators + convergence floor, MCP
  list-modes->list-lanes rename, modes.ts + dist/modes.js deletion (the FROZEN
  banner names it), SKILL.md/CHEATSHEET.md generated markers + marketing regen.
- PRE-EXISTING (not ours): mcp-server's OWN npm test has 1 failing test
  (python_repl OOM fault-injection, env-dependent) - unrelated to the lane work.
- UNRELATED working-tree drift (marketing-site/index.html localhost:9223
  justify dev-script, justify/tilt-lab/dist) is NOT on the branch; flagged
  twice for the marketing-site workstream (strip before any deploy).

Collaborator: Jonah.

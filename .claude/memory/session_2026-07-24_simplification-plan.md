---
name: Sidecoach simplification plan - verified the 06-23 maintainability/vocabulary claims + wrote the risk-sequenced consolidation plan
description: READ-ONLY audit teammate (Wave 1 simplify-audit). Re-measured the year-old 2026-06-23 GAP3/GAP5 claims against HEAD e378a632 (they hold, routing understated), found ~22 dead/orphaned src modules (~3.7k non-test lines, 16% of files) the tsc+75-suite gate can prove safe to delete, plus 86 never-run test files (11k lines, 63% of test SLOC). Wrote docs/superpowers/plans/2026-07-24-simplification-plan.md with per-step runnable verifies + quantified prize + 3 costed vocabulary options (recommend B). No code changed.
type: project
relates_to: [session_2026-07-23_borrow-list-reconciliation.md, session_2026-07-24_autonomous-wave1-dispatched.md, decision_sidecoach_mcpserver_fate.md, session_2026-06-23_sidecoach-oracle-gap-analysis.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: static analysis (grep/import-graph/git ls-files); no npm test/build run (concurrent teammates + read-only constraint)
confidence: high
---

# Sidecoach simplification plan (Wave 1 simplify-audit, READ-ONLY)

Owned the two MISSION-PRIMARY gaps the 2026-07-23 upgrade plan is blind to:
maintainability/complexity (rubric GAP3) and workflow simplicity (GAP5).
Distributability (GAP4) owned by the `distrib` teammate. Read-only on code; only writes
were the plan doc + this beat. Audited against HEAD `e378a632`.

## Claim verification (the 06-23 hypothesis re-measured, not trusted)

- **"6+ routing implementations" -> STILL TRUE, understated.** Counted 9 LIVE routing
  modules (slash-command-router, verb-command-registry, lane-classifier, intent-detector,
  lane-derivation, sidecoach-orchestrator, orchestrator, flow-conditional-router, the
  Python hook) + 4 DEAD (sidecoach-entry-point, command-routing-adapter, sidecoach-command,
  mcp-server keyword-resolver) = 13. The June engine convergence unified DETECTION, not
  routing. Key proof: `processWithEntryPoint` (the only caller of the whole
  SidecoachEntryPoint parallel router) has ZERO call sites.
- **"triplicated classifier" -> STILL TRUE verbatim.** lane-classifier.ts (LIVE engine) /
  keyword-resolver.ts (DEAD mcp-server) / sidecoach_lanes.py (LIVE hook), kept in lockstep
  by parity/classifier-corpus.json (23 cases) + 3 parity tests. The dead 3rd copy is
  tethered to the tree by ONE required-suite line (run-tests.ts:40).
- **"138 files / ~40k SLOC" -> STILL TRUE.** Measured 143 non-test .ts files / 38,282 lines
  in sidecoach/src. Within noise of the claim. Not fixed.
- **"4 parallel vocabularies" -> STILL TRUE (arguably 5).** phase commands (15 keys, `craft`
  shadowed dead, 12 reachable) / 21 verbs / 5 lanes (DERIVED from verb chains, NL-only) / NL
  intent. Plus a 5th: modes.ts is "retired" for the engine but bin/sidecoach.js STILL
  surfaces 5 modes (forge/kiln/bloom/trim/ralph) in `sidecoach list` - a live CLI/skill
  drift. Only lane_live was ever removed. 35 distinct command words across phases+verbs.

## The prize (quantified)

- **Dead/orphaned src modules: ~22 files, ~3.7k non-test lines (16% of the 143-file non-test
  surface, ~10% of non-test SLOC)** removable with the tsc(include:src/**/*) + 75-suite gate
  proving each safe. Tiered by risk: (1) dead handler DUPLICATES whose live twin is in
  flow-handlers-tier3-tier4.ts (flow-handlers-new-tiers.ts 416 lines is a dead parallel copy
  of FlowA-I; the standalone flow-handler-{rapid-iteration,clone-match,constraint-design,
  migration}.ts are dupes), (2) dead routers (sidecoach-entry-point+cache,
  command-routing-adapter, sidecoach-skill+sidecoach-command pair), (3) superseded
  convergence-loop.ts (374, superseded by lane-convergence+lane-runner), (4) orphaned
  built-never-wired (reference-update-service, flow-domain-integration, project-drift-detector),
  (5) abandoned phase*/dogfood* dev harnesses.
- **86 of 153 test files (11,066 lines, 63% of test SLOC) never run** in the default
  `npm test` - run-tests.ts is an explicit 75-suite ALLOWLIST, not a glob. Half the test
  tree is coverage theatre. Step 6 triages: promote live ones into the gate, delete
  dead-code ones.
- **mcp-server = 4,156 tracked files** (largest single prize) but retirement is a PRODUCT
  reversal (decision_sidecoach_mcpserver_fate.md ruled WIRE-UP 2026-07-15, unexecuted) -
  surfaced as Decision B, not a step. Retiring it also collapses classifier TRIPLICATED ->
  DUPLICATED (the irreducible floor: the Python hook can't import TS).

## Vocabulary options (Jonah's call, not the agent's)

- **A** verbs+NL only, cut phases+modes (breaking).
- **B (RECOMMENDED)** same collapse but with PHASE_ALIASES back-compat map -> 5 surfaces to
  2 typed (verbs+NL, lanes as the one preset), zero breaking change, resolves the modes
  drift. Smallest diff that actually lowers the count.
- **C** doc-only relabel, no code cut (relabels GAP5, doesn't satisfy it).

## Why / How

**Why static-only:** three teammates were editing sidecoach/ concurrently and the task
forbade `npm test`/`npm run build` (concurrent builds race the tracked dist). Verified
via import-graph greps, git ls-files, and reading the routing cascade in
sidecoach-orchestrator.ts process() (Step 2 parseSlashCommand -> Step 2.5
resolveSidecoachInput/lane -> Step 1 intentDetector.detect).

**How the plan stays safe:** tsc has include:["src/**/*"] so every file compiles - a
secretly-imported "dead" file fails the build loudly; no barrel/index re-export exists in
src/ so single-module deletion can't break an `export *`. Every step's verify is
`grep the import graph -> expect only self/test` then `cd sidecoach && npm test -> exit 0,
run-tests: 75 suite(s) passed`. The certified taste gate (generate-validators --check +
absolute-ban-detector BAN_SCANNERS + classifier-parity suites) is in the preserve-set and
untouched by every dead-code step.

## Could-not-determine-statically (flagged in the plan)

Behavioural line-diff of the dead duplicate class bodies (irrelevant for delete, needed for
merge); whether the 86 orphaned tests pass if re-added (must run them, couldn't); exact
post-delete suite count for flow-handler-migration's tests; model-routing infra liveness
(different axis, out of scope).

## Files touched
- docs/superpowers/plans/2026-07-24-simplification-plan.md (NEW - the deliverable)
- .claude/memory/session_2026-07-24_simplification-plan.md (this beat)
- .claude/memory/MEMORY.md (index pointer)

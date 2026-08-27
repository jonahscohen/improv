---
name: Builder-A drive-to-green - items 1 (consolidate wiring), 5 (dead-weight wire), 7 (drift lens active)
description: Wired consolidate+mine into the slash router + bin resolver front-door; wired sidecoach-artifacts/build-report reachable; folded the token-drift lens into the ACTIVE flowK handler so a real drift escalates Theming. tsc clean, 2 new tests green, doctor 24->21, no affected-test regressions.
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tsc + 2 new ts-node suites + item VERIFY commands + 8 affected existing suites (all green); engine (sidecoach-consolidate.js) untouched/frozen
confidence: high
relates_to: [session_2026-08-25_consolidation-map-built.md]
---

Builder-A in the parallel drive-to-green campaign (map engine FROZEN at ecef379c - did NOT edit
bin/sidecoach-consolidate.js). Shared tree; edited only my files. Did NOT commit (lead integrates).

ITEM 1 - consolidation map wiring.
- src/slash-command-router.ts: added a `mine || consolidate` maintenance branch beside `doctor`
  (isCommand:true, flowIds:[], no fabricated verb-registry chain). Router now recognizes both; an unknown
  command still returns isCommand:false.
- bin/sidecoach.js: added a `consolidate` front-door (bare -> resolveAndPrint plan exit 0; a real
  subcommand distill-corpus/map delegates to the engine via spawn) + a helpForTarget('consolidate') block.
  Mirrors the existing `mine` front-door EXACTLY.
- Why NOT STANDALONE_BINS: adding consolidate to STANDALONE_BINS would push the bin count 7->8 and break
  skill-surface-parity (which asserts SKILL.md states "seven self-contained CLIs" + names every bin).
  SKILL.md is a shared file not in my item list. The GREEN criterion is capability-unreached (cleared by
  the spawn reference via doctor probe-2), NOT tool-not-in-resolver. So I mirrored the mine pattern
  (front-door, not resolver-listed) - consolidate's tool-not-in-resolver finding remains, exactly like mine.
- VERIFY: `node bin/sidecoach.js consolidate` -> plan, exit 0, no "Unknown command"; router recognizes
  consolidate+mine; doctor no capability-unreached for consolidate.

ITEM 5 - dead weight wired.
- bin/sidecoach.js: added `artifacts` and `build-report` front-door commands that spawn
  sidecoach-artifacts.js / sidecoach-build-report.js. This is real reachability (they are now invocable
  from the resolver) and the spawn reference clears doctor's capability-unreached (probe-2) WITHOUT
  touching doctor. Did not add to STANDALONE_BINS (parity, as above). Did not retire (removal would
  cascade to generate-tool-index DESCRIPTIONS, a shared file).
- VERIFY: doctor total findings 24 -> 21; capability-unreached cleared for sidecoach-artifacts,
  sidecoach-build-report, AND sidecoach-consolidate.

ITEM 7 - drift lens into the active audit path.
- Root cause: TWO classes named FlowKMultiLensAuditHandler exist. The orchestrator registers the one in
  flow-handlers-tier3-tier4.ts (NO drift); the drift-enabled one in flow-handler-multi-lens-audit.ts is
  imported only by tests. So the audit that actually runs never checked token drift.
- Fix (port, not swap - lower risk than re-registering, which would change flowK's whole output shape):
  exported runTokenDriftCheck + DriftOutcome from flow-handler-multi-lens-audit.ts; imported it into the
  ACTIVE handler (flow-handlers-tier3-tier4.ts) and folded a real fail-closed verdict into the Theming
  dimension - a proven drift rewrites the "Dimension 3: Theming" line to [FAIL - token drift], surfaces the
  drifted tokens, sets customData['theming-drift']='fail', and adds a required remediation checklist item.
  Fully contained (null on any failure keeps the static line). Single source of the lens - no duplication.
- VERIFY: grep sidecoach-drift/runTokenDriftCheck in the active handler = 5 hits; new test runs the ACTIVE
  handler over committed fixtures (fixtures/drift/drift-project -> a REAL drift verdict escalates Theming;
  clean-project -> no escalation).

NEW TEST FILES (lead wires run-tests.ts centrally):
- { rel: 'src/__tests__/consolidate-mine-router.test.ts', required: true },
- { rel: 'src/__tests__/flowk-drift-theming-escalation.test.ts', required: true },

VERIFICATION: `npx tsc --noEmit` -> 0. Both new suites green (13 + 13 assertions). `npm run build` clean
(generate-tool-index --check OK). Affected existing suites re-run green: slash-command,
orchestrator-slash-command, skill-surface-parity (still "seven"), sprint8-list-and-help, sprint8-verb-parity,
t9-retry-control, t12-model-routing, qa-gate. Engine test (bin/__tests__/sidecoach-consolidate.test.js)
untouched (frozen).

CODEX FOLD (items 1/5/7 review):
- F2 (real bug, FIXED): the `consolidate` front-door only delegated when the first arg did NOT start with
  `-`, so `consolidate --bogus` DROPPED the flag and exited 0 with the resolver plan. Fix: ONLY bare
  `consolidate` (zero args) prints the plan; ANY arg (subcommand OR flag) delegates to the engine. New test
  bin/__tests__/consolidate-frontdoor.test.js (13 assertions): bare -> exit 0 plan; --bogus -> exit 2 engine
  usage; map/distill-corpus -> delegate exit 0; --help -> engine help. `mine` already always delegates
  (no bare-plan path), so no change there.
- F1 (CONFIRM, KEPT): the drift port adds a clean-case pass line + customData theming-drift=pass. Confirmed
  it breaks NO consumer: the clean line only fires with a real DESIGN.md baseline (no existing test project
  has one); craft-corpus (the only other flowK executor, asserts cleanLen < brokenLen) uses two no-DESIGN.md
  temp dirs that both get the SAME 'not assessed' warning line, so the inequality is preserved (re-ran
  green). t9/t12 use nonexistent /tmp dirs -> runTokenDriftCheck returns null -> no change. Kept the pass
  line as intended (green-means-checked coverage).
New test file (add to run-tests.ts): { rel: 'bin/__tests__/consolidate-frontdoor.test.js', runner: 'node', required: true },

DOCTOR __tests__ FOLLOW-UP (lead approved as a real correctness fix, not weakening).
- bin/sidecoach-doctor.js: filtered binFiles (the capability inventory) to exclude bin/__tests__/ and any
  *.test.{js,mjs}. collectSource walks bin/ recursively, so it was treating test files as phantom
  capabilities. Only test files stop being counted; every real bin is still inventoried (generate-tool-index
  already excludes them the same way, being non-recursive).
- Result: doctor findings 21 -> 15 (the *.test phantoms + their tool-not-in-resolver entries gone).
  toolsInventoried 23 (all real). Only real capability-unreached left is sidecoach-taste-check (pre-existing,
  not my scope). No real finding suppressed; doctor --quiet still exits 1 (real findings remain, fail-closed).
- New test: bin/__tests__/sidecoach-doctor.test.js (15 assertions) - asserts no *.test file is inventoried or
  flagged, that the known phantoms (consolidate.test/mine.test/doctor.test) are absent, and that real tools
  (sidecoach/-consolidate/-doctor/-mine/-drift) are STILL inventoried (not over-excluded). The test file is
  itself under bin/__tests__/ so it is correctly excluded - a self-proof of the fix. tsc clean, build clean.
  run-tests.ts line: { rel: 'bin/__tests__/sidecoach-doctor.test.js', runner: 'node', required: true },

(historical) FLAG (now FIXED above): doctor inventories bin/__tests__/ (collectSource on bin/
is recursive, unlike generate-tool-index which is non-recursive), so it treats TEST files as phantom
capabilities - sidecoach-consolidate.test + sidecoach-mine.test show as capability-unreached/unnamed. My
consolidate.test.js added one. The clean fix is a one-line __tests__ exclusion in doctor's collectSource(bin)
call, but bin/sidecoach-doctor.js is not my file and the lead said don't weaken it. Left for the lead.

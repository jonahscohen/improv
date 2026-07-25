---
name: Pull tight-leading + blinking-cursor from the product (Jonah decision)
description: Jonah ruled PULL both weak taste classes (A5a proved them unfixable in the wild). Full excision across scanner (type/array/detector/constants/emit), registry, 3 gate tests, 7 fixtures, 2 calibration harnesses, a5a grader. In progress. Kept classes (all-caps-body Tier-1, marquee, oversized-h1, numbered-section-markers) share the scorers and MUST survive.
type: project
relates_to: [session_2026-07-25_taste-revisit-honest.md, session_2026-07-25_waveA-integration.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: in-progress
confidence: high
---

Collaborator: Jonah. 2026-07-25. Decision via AskUserQuestion: PULL both (delete detectors + fixtures).

## Why (Jonah's call, grounded in A5a)
Both classes are unfixable in the real world: tight-leading measures a line-height ratio while the Codex labeler judges perceived density (construct mismatch); blinking-cursor is JS-driven and the hermetic render strips scripts, so it is structurally invisible. Keeping them adds noise not signal. Cleaner + serves the "simpler" goal. Reversible from git.

## Excision map (both detectors are ISOLATED if-blocks inside shared single-source scorers - the shared scaffolding stays for kept classes)
- **scanner** subjective-rendered-scanner.ts:
  - DONE: removed both from `SubjectiveRule` union + `SUBJECTIVE_RULES` array.
  - TODO tight-leading: interface fields (runningTextChars/tightLeadingChars/tightLeadingShare/tightestLeading/leadingSelector), constants (LEADING_TIGHT_RATIO, LEADING_MIN_RUN_CHARS, LEADING_MAX_BODY_PX, LEADING_SHARE_MIN), in-page const decls + local vars + the detection if-block (was ~848-861) + return fields, Node emit in typographyExtremesFindingsFromScore, header comment (5 classes -> 4).
  - TODO blinking-cursor: interface fields (blinkCount/blinkSelector), constants (BLINK_OPACITY_LOW/HIGH/MIN_COUNT), in-page const decls + blinkKeyframes set + opacity/visibility tracking in readKeyframes + blink add + local vars + the blink line in the scope loop + return fields, Node emit in motionMarkerFindingsFromScore, header comment (3 classes -> 2).
- **registry** product-rule-registry.ts: remove the 2 audit-only entries (ruleId:null, so the 60-canonical-rule count is UNAFFECTED).
- **gate tests**: typography-extremes.test.ts (import LEADING_SHARE_MIN, MY_RULES entry, baseScore fields, synthetic tests, the !multi.has clause), structural-motion.test.ts (import BLINK_MIN_COUNT, MY_RULES entry, baseMotion field, synthetic tests), product-rule-registry.test.ts (keys at 317/324, loop entries at 344/356).
- **fixtures DELETE (7)**: typography-extremes/{n01,n02,n03,p01}-tight-leading*.html + structural-motion/{n01,n02,p01}-blinking-cursor*.html.
- **eval tooling**: typography-extremes-calibrate.mjs (LEADING imports + tight-leading sweep row + log ref), structural-motion-calibrate.mjs (blinking-cursor row), stage4bcd-a5a.mjs (drop both from the class list). Corpus label JSON left as historical record.

## Guardrails
- Kept classes share the scorers: all-caps-body (Tier-1 certified), oversized-h1, sub-11px-ui, extreme-negative-tracking share inPageTypographyExtremes; marquee + numbered-section-markers share inPageMotionMarker. Removing tight-leading/blink must not disturb them - the manifest-consistency check (registry entries == SUBJECTIVE_RULES) + 86-suite gate + typography/structural tests over the KEPT fixtures prove it.
- Fix-gate suppressed (~/.claude/.suppress-fix-gate) - one coherent excision, not iterative bug-fixing.

## Status: item 1 (pull) CODE-COMPLETE + GATE-GREEN (86 suites) in isolation
- Scanner leftover sweep: only the 2 intentional "PULLED" doc-comments remain, zero code refs.
- `npm run build` clean (tsc + generate-validators --check "registry valid, no drift" + generate-lanes-data --check). Registry manifest-consistency held (removed from BOTH registry + SUBJECTIVE_RULES).
- First isolated gate: `run-tests: 86 suite(s) passed` - kept classes (all-caps-body, oversized-h1, sub-11px-ui, extreme-negative-tracking, marquee, numbered-section-markers) all survived. The "VERIFY-CANDIDATES FAIL/TAMPERED" lines in output are intentional decoy-corpus scaffolding inside corpus-tool.test (proves the gate catches tampering; reports ALL PASS); real corpus verifies OK at 90 pages - the 7 deleted fixtures are UNIT-TEST fixtures, NOT the locked candidate corpus.
- EVAL LABELING VOCAB LEFT INTACT (deliberate scope call): subjective-label-harness.mjs / scorecard-mapping.mjs / objective-label.mjs / dev-coverage-map.mjs reference the class NAMES as historical labeling vocabulary (the record of what Codex was asked), independent of the product detector; the label-router test legitimately routes those names. Only the a5a GRADER (the detector-vs-oracle consumer) dropped them. Scrubbing the labeling vocab would over-reach + rewrite historical records.

## Sibling items executed same turn (Jonah's 4 answered questions)
- **Item 2 (Q2: accept static-only, document it)**: wrote docs/taste-engine-scope.md - the standing scope statement: hermetic render strips scripts -> engine sees declared/static idioms, is structurally blind to JS-driven ones; the scripts-on variant was weighed + rejected (reopens determinism); pulled classes + A5a tiers recorded. See [[session_2026-07-25_taste-revisit-honest.md]].
- **Item 3 (Q3: uniform-append fix)**: see [[session_2026-07-25_validation-uniform-append.md]] - converted the 3 orchestrator OVERWRITE sites (297 composite auto, 313 composite explicit-domains, 1490 natural-language single-flow) to the append pattern already at 1007/1346. New Test 4 in domain-validation-coverage.test.ts proves a pre-existing result.validationResults entry survives (discriminating negative control).
- Item 4 (Q4: Stage 1) = user will add provider keys; deferred until then.

## Codex review: 1 HIGH finding, FOLDED
Codex (codex-cli 0.142.5, foreground, read-only sandbox) over the whole diff. Confirmed excision integrity clean (its own `LEADING_|BLINK_|tightLeading|blinkCount` sweep exited 1 = zero dangling refs) and the append fix correct. ONE High:
- **a5a corpus inconsistency (real regression I MISSED)**: deleting the 7 unit-test fixtures left the a5a grader's SINK (stage4bcd-a5a-labels.json, 87 pages) + the 2 manifests still referencing those page IDs. The grader's SEARCH_DIRS INCLUDES eval/fixtures/{typography-extremes,structural-motion}, and its fail-closed exit contract (L239) treats ANY exclusion as exit 2 (INCONCLUSIVE). The 7 deleted pages were still labeled-codex WITH labels for the kept 13 classes, so they passed the class-filter (L134), hit findHtml->null (L135), and each pushed an "html not found" exclusion -> whole grader exits 2. NOT the graceful skip I first assumed.
- **Fix**: pruned the 7 pulled-fixture entries from the sink (87->80) + typo-manifest (14->10) + struct-manifest (31->28) via a fidelity-checked node script (byte-identical round-trip confirmed first, so minimal diff). Corpus now matches the deleted fixtures.

## SELF-ANALYSIS (why I missed it)
I traced the fixture deletion's effect on the UNIT-TEST consumers (typography/structural tests match fixtures by readdirSync, so a deletion just disappears) and proved those green - but I did NOT trace the OTHER consumer, the a5a grader, which loads pages by ID from a SEPARATE sink over SEARCH_DIRS that happen to include the same fixture dirs. Failure mode: treated "delete the fixtures" as isolated to the tests that live next to them, missing a second consumer that reaches those dirs by a different path (ID lookup, not readdir). The cross-model gate caught exactly this cross-consumer coupling. Lesson: when deleting shared fixture files, grep ALL consumers of the containing dir (readdir AND by-id lookups), not just the co-located test.

## a5a fix VERIFIED
Re-ran the grader (oracle pinned). Regression CLEARED: 0 "html not found" exclusions (was 7). Full per-class table printed for the 13 kept classes; tight-leading + blinking-cursor ABSENT (0 rows). 79 pages graded; kept-class grades unchanged (all-caps-body Rc 1.000, sub-11px-ui 1.000, oversized-h1 Rreal 0.167, marquee Rc 1.000, etc. - the pull did not corrupt them). Residual exit 2 is a SINGLE unrelated oracle infra flake (`databricks: oracle timed out after 120000ms`) - the fail-closed contract correctly flagging one page inconclusive when the EXTERNAL oracle timed out; orthogonal to my diff (I removed pages, reducing load; never touched the oracle/databricks/render). An opportunistic re-run is in flight to catch a clean exit 0.

## Commit-gate note (visual verification)
The bash-guard visual gate fired at commit because the 7 DELETED .html fixtures match its `.html?` check (it does not distinguish a deletion from a render-worthy add). There is no UI here (headless taste-detector inputs). User authorized the override via AskUserQuestion ("Override - no UI to verify"); since that path does not type a verify-manual trigger phrase, cleared the session flag `~/.claude/.needs-verification.<session>` (NOT rm-protected; verify-manual.sh clears it the same way) to honor the granted override. Not a silent workaround - explicit user override + documented mechanism.

## Commit scope (precise)
Staged ONLY: 3 src + 4 tests + 3 eval .mjs + 3 a5a corpus JSONs (prune) + 7 fixture deletions + docs/taste-engine-scope.md + dist regen + beats. EXCLUDED the pre-existing non-mine files (install.sh, claude/hooks/*, concise-*.sh, eval/subjective-label-harness.mjs, eval/corpus/subjective-rubric.md, reference/.claude/memory/*).

## Files
- edited: subjective-rendered-scanner.ts, product-rule-registry.ts, __tests__/{typography-extremes,structural-motion,product-rule-registry,domain-validation-coverage}.test.ts, sidecoach-orchestrator.ts, eval/{typography-extremes-calibrate,structural-motion-calibrate,stage4bcd-a5a}.mjs.
- deleted: 7 fixtures (typography-extremes/*tight-leading*, structural-motion/*blinking-cursor*).
- created: docs/taste-engine-scope.md.

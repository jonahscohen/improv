---
name: sidecoach-extended-validator-triage
description: Evidence-grounded triage of ExtendedDomainValidator's 163 rules for the merged Stage 2 absorb. Finding - the validator is LARGELY THEATER (fake/tautological/always-fail checks inflating pass-rates). Mission-aligned outcome = retire ~120, absorb ~20 real ones (mostly FORMS a11y). Deciding WITH Codex per Jonah's autonomy directive.
type: decision
relates_to: [session_2026-06-24_sidecoach-stage2-codex-verdict.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen (full autonomy granted 2026-06-25: "work autonomously, if you need buy-in talk to codex and decide amongst yourselves, get the win").

## THE FINDING: ExtendedDomainValidator is largely THEATER
163 rules (the "112" comment is stale): 22 polish dups + 141 domain rules across 12 domains. Sampled checkFunctions across every domain. Detection quality (EVIDENCE):
- **FAKE / wrong target:** MOTION_005 "Motion Purpose Clarity" checks for CSS COMMENTS (`/* entrance`); MOTION_GESTURE_004 "Velocity-Based Dismissal" + INTERACT_001 "Eight-State Completeness" both just check `cssRules.includes('cursor:')` (unrelated to their claims).
- **TAUTOLOGICAL token-existence:** WRITE_001 (`designTokens?.voiceMatrix !== undefined`), COLOR_006 (`colors?.primary && colors?.secondary !== undefined`), TYPO_009 (`designTokens?.variableFonts !== undefined`).
- **ALWAYS-FAIL (no context):** flow-handlers populate ctx.colors/motion/spacing/typography but NOT ctx.performance/visualization/internationalization -> all 9 PERF + 10 DATAVIS + 7 I18N rules read undefined -> `?? false` -> always fail. RESPOND_008 checks `window`/`document` which don't exist server-side -> always fails.
- **REAL but REDUNDANT (registry/scanner already cover):** COLOR_002/005 (ctx.contrast = a11y.color-contrast), INTERACT_003 (:focus-visible = a11y.focus-visible), MOTION_001/015 (reads injected motion config; reduced-motion = polish.reduced-motion-respect), TYPO_008 (size>=12 ~ rendered tiny-text), COLOR_014 (gradient ~ anti-pattern.gradient-text), the 22 POLISH dups.
- **GENUINELY REAL + a registry GAP = the absorb candidates:** the FORMS domain (20 rules). Real markup inspection via hasFormMarkup guard + formsHaystack: FORMS_016 (`<label`/aria-label/labelledby), FORMS_002 (typed inputs), FORMS_004 (paste-block), FORMS_019 (placeholder-as-label), FORMS_018 (error aria), FORMS_001 (autocomplete), etc. Forms-a11y is NOT covered by the registry or the rendered scanner = a true gap worth owning.

## PROPOSED TRIAGE (pending Codex decide-together review)
- **ABSORB (~15-20):** the genuinely-real FORMS_* rules (markup-based forms-a11y) as registry rules under a new/existing owner (markup evidence kind), codegen + golden. VERIFY each FORMS checkFunction is real (not a fake one mixed in). Possibly a SMALL number of CSS-real non-redundant ones (e.g. MOTION_011 GPU-accel, RESPOND_002 mobile-first) IF they add value over the registry - lean toward NO unless clearly valuable (simplicity bias).
- **RETIRE (~120+):** all theater (PERF/DATAVIS/I18N/WRITE/most MOTION/COLOR/TYPO/INTERACT/SPACE/broken-RESPOND) + the redundant-with-registry ones + the 22 polish dups. Delete ExtendedDomainValidator once its absorbed rules have registry homes and call sites migrate.
- **DISPLAY HONESTY:** the flows showed inflated "X/112 passed" from theater (rules that always pass on undefined or detect comments). Retiring makes the displayed checklists HONEST (smaller, real). A user-facing change, but a QUALITY WIN aligned with beat-oracle. The merge migrates each flow to read the registry result for its real rules.

## WHY THIS SERVES THE MISSION
/goal = beat oracle on every axis AND be SIMPLER. Absorbing 141 theater rules would BLOAT the registry 4x with fake signal - the opposite of simpler, and it would import false passes. Retiring the theater + absorbing the ~20 real ones makes the engine dramatically simpler AND more honest (no fake passes). oracle does not ship 141 fake checks; neither should we.

## REFINED FORMS ABSORB LIST (extracted all 20 FORMS checkFunctions)
Even within FORMS the quality varies (markup-string detection via formsHaystack, but some are weak keyword-presence). 
- STRONG (real a11y/UX, ABSORB ~8): FORMS_016 (`<label`/aria-label/labelledby), FORMS_018 (error aria-invalid+describedby), FORMS_019 (no placeholder-as-label), FORMS_002 (typed inputs not all text), FORMS_004 (no paste-block), FORMS_015 (shared checkbox/radio hit target), FORMS_001 (autocomplete+name), FORMS_003 (inputmode for numeric).
- WEAK keyword-presence (closer to theater, RETIRE): FORMS_007 (passes if a var named 'isSubmitting'/'idempotency' EXISTS), FORMS_012 (passes if `.trim(` appears anywhere), FORMS_013/014 (keyword search beforeunload/metakey), FORMS_010 (ellipsis in placeholder), FORMS_006/011/017 (heuristic). 
Net: absorb ~8 strong FORMS rules -> registry ~36 -> ~44; DELETE ExtendedDomainValidator (163 rules / 108KB). Big simplification + a real forms-a11y capability the registry lacked. (Codex may argue +/- a few; reconcile on its verdict.)

## DECIDING WITH CODEX (next)
Send this triage + evidence to Codex for an adversarial decide-together review: is the retire-the-theater call right? Am I retiring genuine value (esp. any non-forms domain with real signal I undersampled)? Forms-only absorb vs include crude-CSS-real ones? How to handle the per-flow display change (some flows were ~100% theater - their checklists collapse). Then build the absorb + migrate alias-by-alias.

## CODEX RECONCILIATION (decide-together verdict, 2026-06-25) - SUPERSEDES my list where they differ
Codex independently read the FULL source (incl. dist) and corrected me. ACCEPTED:
- **Actually 196 rules, not 163.** TWO Tier-2 spread-in modules (TIER2_CONTENT_PERF_RULES + TIER2_VISUAL_COPY_RULES, ~33 rules: CONTENT/TOUCH/IMGPERF/PERFX/DARKMODE/CHART/MOTION_HF/CHARSUB/COPY) added after FORMS_020 - I MISSED them (my grep parsed only the inline DOMAIN_RULES). Deleting the validator after forms-only absorb would SILENTLY LOSE them.
- **My MOTION_GESTURE_004 + INTERACT_001 "both cursor" claim was STALE/WRONG.** Current source: MOTION_GESTURE_004 checks 'velocity' w/ drag guard (real); INTERACT_001 counts 8 pseudo-state tokens (real); the cursor-only check is INTERACT_002. My earlier regex grabbed the wrong `passed:` line.
- **PERF/DATAVIS/I18N "always-fail" too strong** - it's a MIX (false fails + false passes + unconditional passes + broad CSS checks). Still theater, but not "always fail." Mechanism imprecise.
- **The 6 MOTION_GESTURE_* are REAL** scoped drag heuristics (hasDragInteraction guard) - ABSORB all 6, not retire.
- **FORMS: absorb 16, retire 4** (006,010,012,013). Codex frame: "absorb the CONCEPT with a registry-quality reimplementation, NOT copy the global-haystack regex."

RECONCILED ABSORB:
- Core: 16 FORMS (001,002,003,004,005,007,008,009,011,014,015,016,017,018,019,020) + 6 MOTION_GESTURE (001-006) = 22.
- Tier-2 preserve/migrate (~27): CONTENT_001-004, TOUCH_001-004, IMGPERF_001-003, PERFX_001/003/004, DARKMODE_001-003, CHART_003, MOTION_HF_001, MOTION_PAIR_001, CHARSUB_001/003/004, COPY_001/003/004/005. (Each needs its own assessment before absorb.)
RECONCILED RETIRE: the bulk (~140) - all POLISH dups, TYPO, COLOR, SPACE, MOTION(non-gesture), INTERACT, RESPOND, WRITE, PERF, DATAVIS, I18N + 4 weak FORMS. Codex CONFIRMS this bulk is theater/redundant (I was right there).
DISPLAY: collapse to registry-owned groups; "No automated checks for this domain yet; manual checklist remains" for empty domains; release note; NO fake floor. (Codex.)

## SELF-ANALYSIS (my errors, per protocol)
Why my triage had errors: (1) I parsed only the inline DOMAIN_RULES via grep and ASSUMED that was the whole validator - missed 33 Tier-2 spread-in rules. Signal missed: I didn't check for spread operators / additional rule arrays appended to DOMAIN_RULES. (2) My MOTION_GESTURE_004/INTERACT_001 "cursor" claim came from a regex that grabbed the wrong `passed:` line, and I didn't re-read the actual checkFunction body before asserting it as fake - I over-trusted a brittle extraction. (3) I lumped the 6 gesture rules into retire without reading their guards. Prevention: when asserting a rule is "fake," READ its full checkFunction body (not a regex-extracted line); when inventorying a rule array, check for spreads/appends; sample MORE before a delete-class verdict. The decide-together caught all three - this is exactly why the producer doesn't self-certify.

## Files
src/extended-domain-validator.ts (196 rules: inline DOMAIN_RULES + TIER2_CONTENT_PERF_RULES + TIER2_VISUAL_COPY_RULES), flow-handler-*.ts, product-rule-registry.ts (absorb target).

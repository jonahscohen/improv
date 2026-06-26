---
name: sidecoach-stage2-findings-folded
description: Folded the 3 open Codex migration-review findings from Stage 2 (P1 honest-display, P1 exact-assertion tripwire, P2 getRulesByDomain forms bug) + caught that validator-integration.test.ts was never in the runner. tsc clean, 64 suites green (was 63). Stage 2 fold-list now EMPTY; ready for Stage 4.
type: project
relates_to: [session_2026-06-25_sidecoach-stage2-DONE.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, session_2026-06-25_sidecoach-extended-validator-triage.md]
---

Collaborator: Jonah Cohen. Session resumed "pick up where we left off" on 2026-06-25; teams flag ON (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1); HEAD still 774ab884; Stage 2 work was on disk uncommitted + green.

## CONTEXT ON RESUME
Stage 2 (merged absorb+migrate) was DONE-but-uncommitted per [[session_2026-06-25_sidecoach-stage2-DONE.md]]: ExtendedDomainValidator gutted 3024->225 lines (theater retired), 22 real rules absorbed (16 forms + 6 page-quality), registry at 58 rules, 63 suites green. The DONE beat left 3 Codex migration-review findings (no P0; 2 P1 + 1 P2) flagged "FOLD FIRST next session." This session folded them.

## THE 3 FINDINGS, FOLDED + VERIFIED
1. **P1 honest display (flow-handler-tactical-polish.ts):** the handler HARDCODED "114-Rule Framework", "24-point Polish (16 baseline + 8 proprietary)", "90-rule Extended Domain Validator (10 domains)", "POLISH STANDARD (22 rules)", "EXTENDED DOMAINS (90 rules)" + a fabricated per-domain list (Typography 16, Color 18, Motion 20...) - all stale/false after the theater retire (live total is 46 = 24 Polish + 22 Extended). FIX: every count now derives from the live reports (`${totalRules}`, `${polishReport.totalRules}`, `${extendedReport.totalRules}`); the fabricated domain list replaced with a live `extendedDomainBreakdown` (= `a11y (18), polish (3), theming (1)`). Touched ~8 strings (guidance header, POLISH/EXTENDED sections, setSummary, addDecision, addValidation, message, artifact desc). VERIFIED: Flow J message now reads "Tactical Polish: 46-rule matrix 35/46 pass" (honest).
2. **P1 exact-assertion tripwire (validator-integration.test.ts):** prior session WEAKENED the assertions to `totalRules > 0 && < 90` and `combined > 24` (loose, no regression teeth). FIX: restored EXACT migration contract - `extendedReport.totalRules === 22`, `totalRules === 46`, kept the count/aggregation invariants; updated the stale "(114 rules)" label to "(46 rules = 24 Polish + 22 Extended)". Verified exact counts at runtime first (Extended=22, Polish=24, Combined=46) before hardcoding.
   - **BONUS CATCH (mine, not in Codex's list):** validator-integration.test.ts was NEVER in the explicit runner list (scripts/run-tests.ts uses a curated list, not a glob; git history shows it was never referenced). A strengthened tripwire that `npm test` never runs is theater - the exact thing this mission retires. WIRED IT IN (required:true). Suite count 63 -> 64.
3. **P2 semantic bug (extended-domain-validator.ts getRulesByDomain):** filtered ONLY by `findingClass === domain`, but the 16 absorbed FORMS rules carry findingClass `a11y` (owner `forms`), so `getRulesByDomain('forms')` returned EMPTY -> flow-handler-component-implementation.ts:102-108 silently lost its Forms-domain guidance. FIX: match `findingClass === domain || ownerValidatorId === domain`. VERIFIED: getRulesByDomain('forms')=16 (was 0), ('page-quality')=6, ('motion'/retired)=0 (correctly still empty).

## VERIFICATION (all green)
- `tsc --noEmit` exit 0; `generate-validators --check` OK (no drift); `npm test` = **64 suites passed** (was 63, +validator-integration).
- Behavior probes (real method calls, not assumptions): getRulesByDomain map correct; honest domain breakdown sums to 22; Flow J emits "46-rule matrix".

## STATE NOW
Stage 2 fold-list is EMPTY. Registry = 58 high-quality rules, ONE engine; ExtendedDomainValidator is a thin registry-backed facade with honest output. Still UNCOMMITTED (Stage 2 bulk + this fold) on branch sidecoach-phase2-reimplement; HEAD 774ab884.

## NEXT
1. (Optional, mission gate) Codex closure review of the post-fold Stage 2 diff, then commit the Stage 2 milestone.
2. **Stage 4:** absorb the remaining standalone validators still called directly - PolishStandardValidator (1 site) + AntiPatternValidator (3 sites) - into the registry; collapse to one vocab + one classifier. The ExtendedDomainValidator facade shim can also be fully removed (flows call runValidator directly) as a later cleanup.
3. **Stage 5:** subjective/taste frontier - BEAT oracle on subjective (the mission-winning axis). **Stage 6:** final convergence proof (full frozen-90 scorecard, Codex final gate, lead gate). Bar unchanged: if oracle beats ANY axis, the mission failed.

## Files touched
sidecoach/src/extended-domain-validator.ts (getRulesByDomain predicate), sidecoach/src/__tests__/validator-integration.test.ts (exact assertions + label), sidecoach/src/flow-handler-tactical-polish.ts (live-derived counts + honest domain breakdown), sidecoach/scripts/run-tests.ts (wired validator-integration into the suite list).

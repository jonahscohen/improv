---
name: sidecoach-feelbetter-gap-implement
description: Implemented all 3 gap fixes from the Sidecoach-vs-m-i-f-b analysis - #4 interruptible-animations detector, #13 CSS-only skip-load-animation extension, and the stale "14-point" -> "16-point" doc label across 3 files
type: project
relates_to: [session_2026-06-24_sidecoach-vs-feelbetter-gap.md]
---

Collaborator: Jonah Cohen.

User: "Implement them all" - the 3 recommended fixes from the gap analysis ([[session_2026-06-24_sidecoach-vs-feelbetter-gap]]).

## What was built

### 1. #4 Interruptible Animations - new static detector (was the one genuinely missing principle)
- PREDICATE in src/polish-standard-validator.ts (added after hasReducedMotion):
  `hasKeyframeAnimationOnInteractiveState(css)` - regex flags a `:hover`/`:focus`/`:active` selector block that declares `animation:`/`animation-name:`. The polish principle: interactive state changes should use a CSS `transition` (interruptible mid-flight) not an `@keyframes` `animation` (runs to completion, cannot reverse).
- CHECK WRAPPER in src/validators/checks/polish-checks.ts: `checkInterruptibleAnimations` - inconclusive if no CSS; fail if predicate true (with fix copy); else pass.
- Static-detectability note: full interruptibility is a runtime property; this heuristic catches the most common static signal (keyframe anim bound to an interactive pseudo-class).

### 2. #13 Skip Animation on Page Load - extended from Framer-only to CSS-only mount animations
- Prior coverage: checkAnimatePresenceInitial caught only React/Framer `initial={false}`.
- PREDICATE `hasEntranceKeyframe(css)` - detects an `@keyframes` whose `from`/`0%` sets `opacity:0` (an entrance/reveal animation).
- CHECK `checkSkipLoadAnimation`: not_applicable when no entrance keyframe; pass when gated (a `prefers-reduced-motion` block OR Framer `initial={false}` present); fail when an entrance keyframe exists ungated (it will replay on every load).

### 3. Doc label fix "14-point" -> "16-point" (skill actually has 16 principles)
- claude/CLAUDE.md (QA gate point 4) - DONE.
- claude/skills/design-team/SKILL.md - DONE.
- claude/skills/sidecoach/SKILL.md (line 189) - DONE; also added the two principles its inline list omitted (interruptible animations, contextual icon animations) so the list now enumerates all 16.

## Registry wiring
- product-rule-registry.ts: 2 new ProductRuleDefinition entries after polish.animatepresence-initial (POLISH_023/024), ownerValidatorId 'polish-standard', sourceVocabulary 'polish-extended-antipattern', severity 'minor', findingClass 'polish', applicability 'not_applicable'. Section comment count 19 -> 21.
- RAW_POLISH_CHECKS: 'polish/interruptible-animations' + 'polish/skip-load-animation' registered after 'polish/animatepresence-initial'.

## Why this approach
Predicates stay the single faithful source in polish-standard-validator.ts; the checks/ wrappers only translate predicate booleans into four-status RuleVerdicts (pass/fail/not_applicable/inconclusive). Bounded regexes (no unbounded backtracking) to avoid the ReDoS class deleted earlier in the sidecoach mission.

## Status
DONE: predicates, checks, registry entries, all 3 doc-label fixes.
DONE: unit assertions in src/__tests__/polish-checks.test.ts - interruptible-animations in explicit() (fail/pass/inconclusive, no N/A path); skip-load-animation added to the 4-case ROWS table (noTarget->N/A, ungated-entrance->fail, gated+reduced-motion->pass, empty->inconclusive).
DONE: `npx tsc --noEmit` exit 0; polish test "polish-checks: OK"; POLISH_CHECKS map = 21 keys; registry canonicalRuleKey 'polish/' count = 21.

## Codex cross-model review (gpt-5.5, xhigh) + folds
Ran via the `codex` CLI directly (codex exec), NOT the agent path - the cmux named-teammate spawn was BROKEN (team config unreadable: ~/.claude/teams/session-14672cde/ had only 2-byte inbox stubs, no top-level config; harness errored "lock acquired, read failed"). HARNESS BUG to flag. Also: first codex run wedged on stdin redirect (0 bytes/0 CPU 60s, SIGKILL per [[reference_codex_exec_hang_sigkill]]); fixed by passing the prompt as a positional arg (and a path-typo where I set SP to the session dir not /scratchpad).

Findings folded:
- (Codex Low, real) `initial={false}` proxy `/initial\s*=\s*\{?\s*false/` also matched `initial=falseThing` -> tightened to `/initial\s*=\s*\{\s*false\s*\}/` (require braces). Prevents a false "gated" pass.
- (Codex Medium + ReDoS) `hasEntranceKeyframe` unbounded lazy `[\s\S]*?` could cross blocks AND was the ReDoS vector -> rewrote as a brace-balanced @keyframes block walk that tests ONLY each block body (bounded inner quantifier). Scoped + ReDoS-safe.
- (Codex Low, ReDoS) added bounded quantifiers to the interactive-state regex.
- (I CAUGHT what Codex MISSED) my own node verification found `--animation: x` (custom property) FALSE-matched the interactive-state regex - `\b` treats `-` as a word boundary so `\banimation:` matched inside `--animation:`. Codex's walkthrough wrongly claimed it wouldn't. Fixed by requiring a declaration boundary `[\s;{]` before an optional vendor prefix: `/(?::hover|:focus|:active)[^{}]{0,500}\{(?:[^}]{0,4000}[\s;{])?(?:-(?:webkit|moz|o|ms)-)?animation(?:-name)?\s*:/i`. Keeps `-webkit-animation` (vendor) + minified `{animation:` , drops `--animation`/`transition-property: animation`. 11/11 node cases pass, adversarial input 16ms. Lesson: verify the reviewer too.

## SECOND active validation path found + wired (scope expansion, deliberate)
The Tactical Polish flow (flow-handler-tactical-polish.ts:211) runs `PolishStandardValidator.validateAll` over a SECOND rule array `POLISH_RULES` (in polish-standard-validator.ts) - NOT the registry/checks path. Leaving it unchanged would mean that flow never flags #4/#13. So added 2 `PolishValidationRule` entries (ids 23/24) consuming the SAME shared predicates (single source preserved). This path is CSS-only (no markup), so skip-load gates on the reduced-motion guard. POLISH_RULES 22 -> 24 (16 baseline + 8 proprietary). Updated all stale "22-point"/"14 baseline"/"112-rule" -> "24"/"16"/"114" labels across flow-handler, polish-standard-validator header, flow-specific-validators, phase-iii test name, dogfood-runner, model-routing, validator-integration.

NOT expanded: extended-domain-validator.ts `DOMAIN_RULES` has a THIRD, duplicated 22-entry polish mirror (POLISH_001..022) that INLINES predicate logic instead of importing the shared predicates. Adding inline copies there would compound the duplication the codebase's own "single faithful source" comment warns against, and the flow already covers #4/#13 via PolishStandardValidator - so this mirror is redundancy, not a coverage gap. Left at 22 (reverted my over-eager 24 comment there). DEBT flagged: that mirror is now 2 behind canonical; a future dedup refactor should make it reference the predicates.

## Codegen + golden test
- `src/validators.generated.ts` is generated from the registry (`scripts/generate-validators.ts`). Adding 2 registry rules caused `--check` DRIFT -> regenerated (34 insertions), `--check` now OK.
- `src/__tests__/product-rule-registry.test.ts` is a hand-maintained golden enumerating every rule. Added 2 polish rows + 2 alias pairs (POLISH_023/024); bumped `RULES.length` 29 -> 31 and `owners('polish-standard')` 19 -> 21 (owners total 21+3+2+5=31 consistent).
- Count-assertion tests updated: validator-integration `totalRules === 24`, t13-bench `sum to 24`. sprint7 uses synthetic 22-arrays (untouched). phase-iii change was a test-NAME string only.

## Final verification
`npm test` -> 60 suite(s) passed, exit 0. `npx tsc --noEmit` exit 0. `generate-validators --check` OK. polish-checks/registry/validator-integration/t13-bench all green. ReDoS adversarial probes <20ms.

## Minor inconsistency left (intentional)
flow-specific-validators.ts:142 `baseline-items-complete` still checks `result.checklist.length >= 14` ("14 baseline polish items") - that is a >=N threshold on the flow's EMITTED checklist artifact (a different thing from the validator rule count), and >=14 still passes. Bumping it would cascade into the flow's checklist generator + the phase-iii Array(14) mock. Out of scope; left as-is.

## Files touched
- sidecoach/src/polish-standard-validator.ts (2 predicates + 2 POLISH_RULES + count comments)
- sidecoach/src/validators/checks/polish-checks.ts (2 checks + imports + RAW_POLISH_CHECKS + gating tighten)
- sidecoach/src/product-rule-registry.ts (2 rule defs + count comment)
- sidecoach/src/validators.generated.ts (regenerated)
- sidecoach/src/__tests__/polish-checks.test.ts (new assertions incl. custom-prop, vendor, brace-scope, gating)
- sidecoach/src/__tests__/product-rule-registry.test.ts (golden: 2 rows + 2 alias pairs + counts 31/21)
- sidecoach/src/__tests__/validator-integration.test.ts, t13-bench-harness.test.ts (count 22->24)
- sidecoach/src/flow-handler-tactical-polish.ts, flow-specific-validators.ts, extended-domain-validator.ts, phase-iii-integration.test.ts, dogfood-runner.ts, model-routing.ts (label accuracy)
- claude/CLAUDE.md, claude/skills/design-team/SKILL.md, claude/skills/sidecoach/SKILL.md (14->16 label)

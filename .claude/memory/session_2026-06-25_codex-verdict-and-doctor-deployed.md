---
name: codex-verdict-and-doctor-deployed
description: Codex re-review (tighter prompt, no capacity error) delivered a clean verdict - 2 real findings (P1 low-contrast/gray-on-color live double-count; P2 marketing-buzzword missing from RENDERED_BACKED). Both lead-verified + routed to owners for full-unit fold. Separately, deployed a codex-doctor agent to build a durable no-relay-prevention hook (Jonah's self-healing-doctor request).
type: project
relates_to: [session_2026-06-25_codex-capacity-retry.md, session_2026-06-25_stage5-batch-verified-codex-running.md, reference_codex_rescue_teammate_no_relay.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## CODEX CROSS-MODEL VERDICT (re-run, tighter prompt, completed clean - 0 capacity errors)
Two real findings, both lead-verified against the code before routing:
- **P1 (live double-count)** objective-rendered-scanner.ts:~282 emits BOTH 'low-contrast' AND 'gray-on-color' for one element (gray-on-color is a documented PRODUCT SUBTYPE of low-contrast). Pre-migration only gray-on-color fired live; now a11y.color-contrast (consuming low-contrast) ALSO fires -> same defect double-blocked. FIX (routed to sidestripe): dedupe in the LIVE path only (rendered-checks checkLowContrast suppresses low-contrast findings whose selector is also gray-on-color) - MUST NOT touch the eval-frozen scanner (would move eval numbers).
- **P2 (promotion/fail-closed gap)** validator-generation.ts:35 - polish.marketing-buzzword declares ['rendered-scan'] but is absent from RENDERED_BACKED_RULE_IDS, so it isn't promoted-required on renderUrl and silently passes when the subjective scan is unavailable. FIX (routed to buzzword): add it to RENDERED_BACKED, regen, match tiny-text's fail-closed/promotion. The 64-suite pass MISSED this (no test asserted its promotion) - exactly why cross-model review is mandated.
- Both fixes are FILE-DISJOINT (P1 rendered-checks.ts; P2 validator-generation.ts + codegen) so the two folds run in parallel safely (my earlier concurrent-edit lesson applied by checking file sets). Each owner folds + re-verifies the FULL unit.

## CODEX FALLBACK NOTE
codex flaked 3 ways today (no-relay teammate, hang, capacity). The clean verdict came from running codex DIRECTLY via CLI with a TIGHTER findings-only prompt (gave it the already-verified context to cut synthesis token load 275k->110k, which dodged the capacity error). Pattern locked: for codex reviews, run via CLI not the codex-rescue teammate, and keep the synthesis prompt lean.

## DOCTOR DEPLOYED (Jonah's self-healing request)
Jonah: "we need a hook to detect this happening and immediately deploy a doctor to diagnose, treat and permanently cure." Deployed a general-purpose "codexdoctor" agent (general-purpose HAS SendMessage, unlike codex-rescue) to build the durable CURE: a PreToolUse Agent-guard hook (claude/hooks/codex-rescue-guard.sh) that DENIES a codex-rescue spawn as a named teammate (the no-relay misconfiguration) with a redirect to the CLI pattern - prevents the ~7-min waste at spawn time. Needs a session restart to take effect (hooks load at SessionStart). Scope of the broader detect->doctor->cure protocol still to confirm with Jonah.

## Files touched
- (checkpoint beat; P1/P2 folds in flight by sidestripe/buzzword; hook by codexdoctor)
</content>

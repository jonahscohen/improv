---
name: sidecoach-stage2-strategy-decision
description: Decide-together verdict (Claude+Codex) for closing Stage 2 - RETIRE all 6 gesture rules (moved theater, wrong evidence layer), keep only ~3-8 DOM-evidence Tier-2 rules (retire the rest), PIVOT now to migration + validator deletion. "Simpler is a correctness guarantee." Replaces "absorb everything."
type: decision
relates_to: [session_2026-06-25_sidecoach-extended-validator-triage.md, session_2026-06-25_sidecoach-stage2-forms-slice.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen (full autonomy: decide with Codex). Decided 2026-06-25 with the codex-arch-review teammate. Verdict file: scratchpad/stage2-strategy-verdict.md.

## THE DECISION (Claude proposed, Codex confirmed - decide-together)
The substantive Stage-2 absorb (16 real forms-a11y rules) is DONE. For the rest, choose QUALITY/SIMPLICITY over max-capability-preservation:
1. **RETIRE all 6 MOTION_GESTURE rules.** Codex: "moved theater." They `h.includes('velocity'/'momentum'/'pointerId')` - JS variable-name fragments that modern gesture libs (Framer Motion, @use-gesture, GSAP, dnd-kit) NEVER emit as raw markup substrings, so they SILENTLY PASS on the exact pages they should catch. WRONG EVIDENCE LAYER, not a false-negative-rate bug. Real gesture-a11y (aria-grabbed, touch-action, keyboard-alternative) has DOM-visible answers none of these check. Do NOT build a gesture validator. If real gesture a11y is wanted later, build it correctly from scratch.
2. **Tier-2 (~27): keep only ~3-8.** Filter = "what DOM-VISIBLE evidence conclusively indicates this issue?" KEEP if it checks HTML elements / aria attrs / CSS properties / structural markup / visible text. RETIRE if it relies on JS variable fragments or generic keywords (the gesture pattern). PERFX/* retire (perf-a11y has no DOM evidence). CHARSUB/* retire. CHART/* maybe-keep IF they check SVG aria-label/title/desc/axis-text. Absorb keepers into static-a11y OR a new `advanced-a11y` catch-all by evidence type.
3. **PIVOT to migration + deletion NOW.** Why (Codex): registry is only as trustworthy as its worst rule; migrate with a CLEAN registry; migration enforces retirement (a migrated call site can't resurrect theater); "simpler" maximizes oracle-ness (fewer better rules > more rules where some silently pass).

## RECOMMENDED SEQUENCE (locked)
1. (DONE) Fix batch-2 P1 blockers, rebuild dist, suite green.
2. Apply the evidence-type filter to Tier-2 -> write the ~3-8 keepers into static-a11y or a new advanced-a11y validator; RETIRE the rest with honest display. Do this NOW (pre-migration) so migration is clean.
3. Retire all 6 gesture rules with honest display. No gesture validator.
4. Migrate the ~19 flow-handler call sites to the registry (display-preserving per the earlier Codex Stage-2 verdict: legacy reports for display until alias retired; never inject static results into ProductValidationResult; honest "no automated checks for this domain yet" for retired-theater domains).
5. Delete ExtendedDomainValidator.
6. Verify full suite green.

## WHY THIS SERVES /goal (beat oracle + simpler)
Absorbing 33 more weak keyword-proxy rules would BLOAT the registry with rules that silently pass on real defects - the OPPOSITE of beating oracle, and against "simpler." 16 focused correct forms rules + ~3-8 strong Tier-2 + the deletion of the 196-rule theater = a dramatically simpler, more honest, higher-quality engine. Codex: "the oracle-ness goal is maximized by fewer, better rules."

## STATUS
Forms domain done (16 rules, both Codex review rounds folded). Next = Tier-2 filter (step 2). This decision supersedes the "absorb 6 gesture + 27 Tier-2" line in [[session_2026-06-25_sidecoach-extended-validator-triage]].

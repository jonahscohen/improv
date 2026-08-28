---
name: ppai-pm Aug 27-28 experience post-mortem + prevention
description: Corpus post-mortem of the ppai-pm UGC-rebuild + fidelity-gate day Jonah was disappointed with - ranked failure modes, root causes, fair accounting, and prevention (built vs gap)
type: reference
relates_to: [feedback_2026-08-27_interaction-model-wins.md, session_2026-08-28_fidelity-gate-concurrent-commit-and-rollout-miss.md, session_2026-08-28_fidelity-predicate-soundness-fixes.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: corpus-read
confidence: high
---

Post-mortem requested by Jonah ("really disappointed with ppai-pm over the past day"), focus = post-mortem + prevention. Corpus: ppai's ~20 Aug-28 session beats (its own record), this session's improv beats, ppai git (2 squashed commits), and the cross-session failure reports. Transcripts (200MB+) sampled by grep, not read whole.

## Headline verdict

The disappointment is WARRANTED but the diagnosis is not "bad agent." Across the day ppai-pm did meticulous, correct, honestly self-analyzed work - and repeatedly shipped it as "done" before combing the full surface, so Jonah became the QA loop that had to catch each next defect by eye. A full day of that is genuinely draining. But the end results matched Figma, the self-analysis in nearly every beat is sharp, and a meaningful share of the day's pain (the gate blocking every turn) was the LEAD's (my) doing. The fix is process, not replacement.

## The recurring cycle (the core finding)

The same shape repeats ~15 times: ppai-pm fixes exactly what it was pointed at, verifies THAT item, calls it done -> Jonah opens the page / a screenshot and finds the next defect -> ppai-pm measures, root-causes, and fixes it exactly. It fixes reactively, one Jonah-caught defect at a time, instead of proactively combing and measuring the whole artboard set first. Evidence (ppai beats):
- "the full width wrapper ... is a different color in figma and you gloss over it every time" (ugc-form-band-and-spec).
- "the earlier audit stopped at the visible 'The Submitter' section and never combed the collapsed sections" (ugc-form-full-comb).
- /loop "calling out that I claimed fixes without measuring" (ugc-loop-six-exact-fixes).
- button misdiagnosis self-analysis: "fixating on the buttons I'd JUST been working on instead of measuring EVERY button type ... measure the full set before changing anything" (ugc-assets-copy-button-font).
- hero rejected twice for clipping; grid-0fr collapse "Jonah caught it immediately."

## Root themes (ranked by rework caused)

1. PREMATURE "DONE" WITHOUT PROACTIVE FULL-SURFACE VERIFICATION (dominant; the source of the disappointment). Fixes the flagged item + verifies it, but does not enumerate/measure the whole surface, so the next defect is left for Jonah. This is the day-long grind.
2. SUBSTITUTING JUDGMENT/SHORTCUT FOR THE DESIGN SOURCE (the trigger, Aug 27 -> one level down Aug 28). The GF stepper over the accordion artboard; then eyeballing values from screenshots + ignoring the design system. ppai-pm's own words: "same root failure as the stepper, one level down." Path-of-least-resistance over the authoritative source.
3. VERIFYING THE WRONG LAYER on first attempt. Grepping compiled CSS instead of getComputedStyle (GF's theme silently overrode via specificity); grid-0fr; the submit-button first guess. It root-caused correctly on the SECOND pass every time - the miss was not measuring the rendered value / full set up front.
4. NARRATING PROCESS INSTEAD OF DELIVERING RESULTS under pressure ("bullshit all night") - verification-protocol narration + a flagged plain-text question instead of the fix. Self-corrected to a Codex-verified diagnosis.

## Fair accounting (not a hit piece)

Behaved WELL, with evidence:
- Meticulous correct finals: measure -> fix exact -> re-measure -> browser-verify in every beat; results matched Figma.
- Honest, specific self-analysis in nearly every beat (stepper, eyeball, grid-0fr, button misdiagnosis, the "bullshit" meta) - it names its own failure modes precisely.
- Correct escalation + authorization discipline: reported failures to improv-pm as told; on the gate, refused to act on directives relayed through another session without Jonah's direct word (peer-authorization line held); drew the 4-mine/3-theirs ownership split correctly.
- Sophisticated work: the Codex-verified 3-class gate-failure diagnosis (precision-truncation / scale-equivalence / real-deviation) is genuinely excellent.
- Non-destructive prod discipline (test-first deploy offers; "we are logged in - be non-destructive").

Systemic / LEAD-side (NOT ppai-pm's fault):
- The gate blocking ppai's every turn was the LEAD hardening a shared, symlinked, fail-closed gate mid-stream, regressing ppai's pre-existing legitimate checks (a reckless rollout; see the concurrent-commit beat).
- The unreviewed-code push and concurrent-commit mess were the LEAD's misses.
ppai-pm correctly diagnosed and worked around both.

Verdict: disappointment warranted on theme 1 (the QA-loop grind is real and costly); over-stated if read as "incompetent" - the work quality and honesty are high; and part of the day's friction was mine, not its.

## Prevention (built this session vs still-open)

- Theme 2 (substitute-for-source): BUILT. Verification Protocol item 3 now says the design-source interaction model wins over a plugin default, values are measured from get_design_context not eyeballed, and you reuse the project's canonical component; item 6 reconciled ("verify by measured values, not eye alone"). Directly covers the stepper + eyeball + design-system failures.
- Theme 3 (getComputedStyle-not-grep): MOSTLY COVERED (the reading-is-not-measuring beat + the measuring-lane workflow exist; ppai-pm learned "grepping compiled CSS is not truth"). Could be a stronger explicit rule: on a fidelity check the authoritative value is getComputedStyle, never authored/grepped CSS.
- Theme 4 (narrate-not-deliver): COVERED behaviorally (executive-report contract + concise mode); failed under pressure, not for lack of a rule.
- Theme 1 (premature done / no full-surface comb): THE STANDOUT GAP. Verification Protocol items 1-4 are behavioral and failed repeatedly here. The mechanical version already EXISTS and was under-used: the Figma-fidelity Stop gate forces per-NODE coverage - and it WAS catching uncovered nodes reactively. The prevention is to use it PROACTIVELY: a design "done" claim on an artboard should require the fidelity gate armed + green across EVERY node of the artboard set, not just the touched ones. Concretely: on a "match this artboard" task, arm all its nodes up front (get_design_context each) and let the gate force full coverage before done; a "done" report must carry the full element inventory measured, not only the fixed items. That converts theme 1 from a behavioral hope into the gate's existing mechanical enforcement.

## Recommendation

Keep ppai-pm; it is capable, honest, and self-correcting. Close theme 1 with the proactive full-artboard-coverage discipline above (the highest-leverage change - it would have collapsed the day's defect-by-defect grind into one comb). Theme 2's guardrails already shipped this session. And own the LEAD-side share: do not harden shared gates mid-stream without a cross-repo survey (already recorded).

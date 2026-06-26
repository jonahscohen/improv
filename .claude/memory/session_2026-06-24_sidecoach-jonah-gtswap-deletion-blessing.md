---
name: sidecoach-jonah-gtswap-deletion-blessing
description: Jonah blessed the official observed-motion GT swap + execute the Stage-2 ReDoS deletion now; flagged my "S5b" jargon (plain-language violation)
type: decision
relates_to: [session_2026-06-24_sidecoach-motion-flip-verification.md, session_2026-06-24_sidecoach-m1-verified-decouple-decision.md, feedback_plain_language_not_phase_codes.md]
---

Collaborator: Jonah Cohen.

Jonah answered the close-out questions:
1. OFFICIAL GT SWAP: "Swap it in." -> make the observed-motion labels the official frozen GT (candidates.json), AS-IS (not tighten-first), with the marginal-positive caveat documented (3 of 6 lt-positives are 3-7px near-threshold). Authorized.
2. STAGE-2 REDOS DELETION: "Execute now." -> delete scanIdenticalCardGrids (ReDoS) + the 2 noise rules. Strictly precision-positive (0.436->0.457), removes the pathology, no replacement needed (icon-tile-stack marginal). Authorized.
3. NEXT/scope: Jonah challenged my "S5b" reference - "I didn't defer any s5b? Huh?"

## MY ACCOUNTABILITY: "S5b" jargon = plain-language-rule violation
I surfaced "S5b" to Jonah in multiple briefs without ever explaining it. It's INTERNAL team jargon (the staged-plan S0-S5 labels the architect and I used), NOT something Jonah deferred or agreed to. Violates feedback_plain_language_not_phase_codes (codenames are internal-only; report what a person needs in plain language). Owned to Jonah; dropping the label. What it ACTUALLY is, plainly: the objective scanner runs the eval by rendering each page HERMETICALLY (scripts stripped, external CSS/fonts blocked, for determinism). The 0.936 is measured that way. The open caveat: would it perform the same on a REAL page rendered normally with its external CSS/fonts loading? We verified robustness to scripts+viewport (the decoupling probe held); external-resource loading was never tested. It's a real-world-generalization caveat, NOT a flaw in the eval result. Whether to close it (test on real pages) is optional, now Jonah's informed call.

## Execution (directed to architect, lead to verify)
- Swap observed-motion labels into candidates.json (official), document the marginal-positive caveat, re-score -> official scorecard.
- Delete scanIdenticalCardGrids + 2 noise rules, re-measure, confirm precision up + NO objective regression + ReDoS gone.
- Lead independently verifies the post-swap + post-deletion scorecard before final.

## Jonah: "spend the time now" -> RUN the real-page render generalization test
Jonah chose to close the objective real-world caveat now (not note-and-wrap). The test: does the objective scanner's 0.936 (measured on HERMETIC renders: scripts stripped, external CSS/fonts blocked) hold on REAL pages rendered normally with external resources loading? The earlier decoupling probe covered scripts+viewport (held) but kept external blocked on both arms = exactly this untested dimension.
DESIGN (lead-specified, architect builds, lead verifies):
- Sample ~15-20 LIVE-source pages from the frozen-90 provenance (the "_live" URLs; archived/2012-2016 sources can't be re-fetched live).
- For each: render TWO ways - (a) REAL (external CSS/fonts load), (b) HERMETIC (external blocked, the eval way). Same page both arms.
- Run the OWNED objective scanner on both; compare per-class detections (broken-image, skipped-heading, low-contrast, gray-on-color).
- METRIC: per-page per-class agreement rate. Expected: heading + broken-image STABLE (DOM/src-based); contrast MAY shift (external CSS colors + external fonts changing size/weight -> large-text thresholds). 
- READ: high agreement (>~90%) = the eval GENERALIZES, 0.936 is real-world-robust. Significant contrast divergence = document that the hermetic contrast result is an approximation of real-world (state direction). One-shot validation, not a permanent eval change.
Honest caveat to Jonah: the real-render arm is inherently noisier (live fetch, fonts) - it's a generalization probe, not a held-out measurement.

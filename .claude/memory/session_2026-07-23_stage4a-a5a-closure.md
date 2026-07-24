---
name: Stage 4a A5a taste-gate closure dispatched (honest framing + corpus-integrity guardrail)
description: Closing the Contract-6 A5a taste-detection gate for default-typeface (Jonah chose "close A5a now"). Teammate a5a-label dispatched to author independent Codex labels + run the ours-vs-oracle head-to-head. Key rulings baked in: recall graded on CONSTRUCTED positives (heldout real designs lack any), precision on real negatives, heldout-recall stated ungradeable; and a HARD guardrail to not break the frozen corpus when extending the rubric. Lead retains the ship call on the numbers.
type: decision
relates_to: [session_2026-07-23_stage3a-4a-lead-verification.md, decision_sidecoach_upgrade_first_units.md, session_2026-07-23_sidecoach-stage4a-default-typeface.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: dispatch only - a5a-label running; numbers not yet in, lead has NOT certified A5a. Grounded in a read of eval/README.md + subjective-label-harness.mjs + rule-authors.json + oracle-comparator.mjs.
confidence: high
---

Collaborator: Jonah. 2026-07-23 (into 2026-07-24). After 3a+4a passed the combined Codex review clean, Jonah chose (AskUserQuestion) to CLOSE the A5a gate now rather than commit-first or defer. default-typeface shipped BUILT + dev-calibrated + combined-review-clean but NOT plan-"shipped": the plan's Stage 4 rule is "every class ships only after A5a shows recall>=floor and precision>=floor", and A5a had never run for this class (no Codex label existed; the 22-class rubric predates it).

## The mechanism (grounded, for future A5a work)
- **A5a = taste-detection head-to-head**: run OUR detector AND the oracle over labeled pages, grade each tool's findings against the SAME Codex `present/absent` labels, per class. A class the oracle has ~zero coverage of that we catch clears A5a as a DETERMINISTIC differentiator (demonstrable pass/fail); a graded/fuzzy class needs statistical significance (paired bootstrap CI > 0 at power-locked N).
- **The labeler is Codex, not a Claude agent.** `eval/subjective-label-harness.mjs` renders a full-page screenshot, extracts text+motion, and invokes `codex exec --sandbox read-only -i <screenshot>` for `{present,confidence,note}` per class. Records `labeledBy: codex` + `rubricSha`. It parses class defs from `eval/corpus/subjective-rubric.md` via the `- name: desc` bullet regex and tags VISUAL/TEXTUAL/MOTION from hardcoded sets.
- **Independence guard is live**: rule-authors.json registers default-typeface -> font-class, so the freeze gate REJECTS any font-class-authored label. Ground truth must be labeledBy=codex.

## The two load-bearing rulings baked into the dispatch
1. **Honest recall/precision split (the structural problem).** default-typeface POSITIVES are constructed pages (unstyled/system-stack). The heldout corpus is externally-sourced REAL SHIPPED DESIGNS, which choose fonts, so heldout has ~ZERO positives (font-class: 48 real pages max 0.058 default-stack share). Therefore recall is gradeable ONLY on constructed positives (fixtures/dev), precision on real negatives, and heldout-recall is STRUCTURALLY UNGRADEABLE. Constructed positives may NOT be injected into the locked heldout (violates its real-designs-only contract). The gate closes as: recall on constructed positives (oracle-coverage-gap demonstrable), precision on real negatives (0-FP), heldout-recall limit stated plainly. This is the same honesty the class shipped with ("Inter/Poppins monoculture NOT detected" is a sibling honest exclusion).
2. **Corpus-integrity guardrail (do FIRST).** Extending subjective-rubric.md re-SHAs it; existing frozen labels store their rubricSha. If corpus-tool.verify requires labels to match the CURRENT rubric SHA, a rubric edit BREAKS all 22 existing classes' labels and the whole freeze. The teammate must check verify's rubricSha handling BEFORE editing and, if the edit would break the freeze, find the sanctioned versioning path or STOP and report - breaking the frozen corpus to close one gate is worse than an unclosed gate.

## Guardrails on the teammate
- Labels labeledBy=codex ONLY; if Codex can't run, STOP (fabricated ground truth is the worst outcome, worse than an unclosed gate).
- EVAL-ONLY: surface is eval/ (rubric, harness VISUAL set, labels, comparator). Touch NO product code, esp. not the 4 now-complete 3a/4a files.
- Do not break the frozen corpus; npm test (73) + corpus verify stay green.
- Codename oracle only; do not commit.
- **Lead retains the ship call**: the teammate reports numbers + framing; it may NOT claim "A5a passed". I certify.

## Status / interim result
- **Guardrail #1 CLEARED and proven (the scary risk is resolved safely).** `corpus-tool.verify`/`verifyCandidates` NEVER read `rubricSha` - it is informational provenance, NOT part of the freeze content-hash. So extending subjective-rubric.md to 23 classes did NOT break the 22 frozen classes' labels: `corpus-tool verify` green before AND after, freeze-logic tests all pass, `rubricInfo()` now reports 23 classes, npm test held at 73. The rubric + harness VISUAL sets are extended and default-typeface is tagged [SCREENSHOT].
- **PRE-EXISTING finding (not caused by this work):** `verify-candidates` is ALREADY red at committed HEAD - 90/90 record-hash drift - and `npm test` does NOT gate on it. A corpus-integrity gate that is both broken AND ungated (matches the CLAUDE.md "an enforcement point must re-ask its own question" pattern). Left untouched; spun into its own task.
- **Codex labeling IN PROGRESS** (background task; 7/23 pages when a5a-label last yielded; p01 correctly present=true "Default Times serif", labeledBy=codex - so Codex is running and judging correctly). The A5a grader `eval/typeface-a5a.mjs` is written (imports the SHIPPING detector, runs the oracle via the comparator, fail-loud exit contract). a5a-label parked waiting on the labeling pass, then runs the head-to-head and reports numbers. Lead has NOT certified A5a; numbers pending.

Dispatched, running. 3a fully done; 4a built+reviewed, A5a closure in flight (guardrail cleared, labeling running). Nothing committed. Follow-ups still open after this: Ground B (brand-mismatch) live wiring; the reconciliation OPEN+UNSCHEDULED backlog (esp. the mission-primary trio: maintainability/distributability/simplicity, now in plan Section 7).

## Files touched
- this beat + MEMORY.md index. No code/eval changed by the lead - a5a-label executes.

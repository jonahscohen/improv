---
name: Stage 4b/4c/4d A5a RESULTS + lead ship calls (honest per-class; real-world recall weak; marquee loses to oracle)
description: a5a-taste orphaned after the labeling pass (87 pages, 2958 codex labels, author!=labeler held). Lead ran the head-to-head grader. OURS beats oracle on CONSTRUCTED positives (oracle Rc=0.000 on ~all - ships near-name rules but doesn't fire) with solid precision, but REAL-WORLD recall is weak across the board, and marquee LOSES to oracle on real recall (0.188 vs 0.563). Per-class ship calls in 3 tiers. All 15 stay audit-only; detector source untouched.
type: decision
relates_to: [session_2026-07-25_wireup-wave-lead-verify.md, session_2026-07-24_a5a-CERTIFIED-hardened-ground-truth.md, session_2026-07-24_stage4b-typographic-extreme-classes.md, session_2026-07-24_stage4cd-structural-motion-classes.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: grader ran on 86/87 pages (databricks excluded - oracle 120s timeout -> exit 2 fail-closed); labels 2958 codex/0 non-codex; src untouched; 85 suites green
confidence: high
---

Collaborator: Jonah. 2026-07-25. a5a-taste built the A5a apparatus (rubric +15 defs with correct signals, hardened leak-free harness 3-round-reviewed, grader stage4bcd-a5a.mjs) then ORPHANED on its ~1h labeling pass. Lead ran the head-to-head.

## Integrity (verified before trusting numbers)
- 2958 labels, ALL labeledBy=codex (author!=labeler held). Detector source UNTOUCHED (author != certifier). 85 suites green.
- Grader buckets on the CODEX label, not the filename (a "tasteful" negative fixture Codex reads present becomes a real recall test).
- Exit 2 (fail-closed): 1 page (databricks) excluded - oracle timed out 120s. The other 86 graded cleanly; numbers stand.

## The honest headline
OURS beats oracle on the CONSTRUCTED idioms (oracle Rc=0.000 on ~every class - it ships near-name rules but doesn't fire them), precision solid on real negatives. BUT REAL-WORLD recall (Codex-present real pages) is WEAK across the board - the detectors fire on constructed fixtures and miss real expressions. Cross-class Rc(ours)/Preal/Rreal recorded in the grader output.

## Lead ship calls (3 tiers; all stay AUDIT-ONLY - this is certification, not behavior)
TIER 1 - CERTIFY as precise differentiators (Rc=1.000, Preal~1.000, oracle can't fire): all-caps-body, sub-11px-ui, numbered-section-markers, repeating-stripe-gradients, decorative-dot-grid. Known limit: real-world recall low/ungradeable.
TIER 2 - THRESHOLD REVISIT (fire on fixtures, miss real + false-fire): tight-leading (Rreal 0.000, 2 FP), blinking-cursor (Rreal 0.000, 3 FP), oversized-h1 (Rc 0.500, Rreal 0.000).
TIER 3 - KEEP AUDIT-ONLY / taste call: soft-radial-glow (fires 21% real pages; still beats oracle Preal 0.926 vs 0.815, Rreal 0.500 vs 0.286) and MARQUEE - the one real LOSS: oracle out-recalls us on real marquees 0.563 vs 0.188 (ours also has 1 FP). Reconsider marquee's detector or accept oracle is better here.
UNGRADEABLE recall (no Codex-confirmed constructed positives): extreme-negative-tracking, text-under-overlay, first-viewport-overflow - precision-only.

## Follow-ups (NOT done - detector-source work, separate from this grading unit)
- Tier-2 threshold revisits (tight-leading, blinking-cursor, oversized-h1) - the detector needs tuning; author != certifier, so a separate unit.
- Marquee: decide detector revisit vs accept-oracle-wins.
- Real-world recall is the systemic weak spot - the fixtures over-represent clean constructed cases; richer real-positive labeling would grade recall better.
- databricks oracle-timeout: a re-run excluding it gives a clean exit-0 grade if wanted.

## Files
- committed: sidecoach/eval/{corpus/subjective-rubric.md, subjective-label-harness.mjs, corpus/stage4bcd-a5a-labels.json, corpus/stage4bcd-a5a-{struct,typo}-manifest.json, stage4bcd-a5a.mjs} + beats. Detector src untouched, no dist change. NOT touched: the concise-mode hook files (browser-tree/install.sh/concise-*.sh) - pre-existing uncommitted, not mine.

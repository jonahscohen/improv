---
name: A5a ship call WITHDRAWN - fixture ids leak the answer into the labeler's attachment filename
description: Independent Codex review of the ground-truth machinery found a real independence breach - screenshot filenames are the fixture ids (dev-n06-brand-mismatch-NEGATIVE.png), encoding both expected polarity and the scenario, and they are passed to codex exec -i. Plus 3 P1s and 2 P2s. The clean-sweep numbers stand as MEASURED but their independence is not established. Ship call withdrawn pending fixes + re-label.
type: decision
supersedes: session_2026-07-24_a5a-FINAL-clean-sweep.md
relates_to: [session_2026-07-24_a5a-declared-stack-result-and-extractor-fixes.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: codex-review - real Codex, exit 0, 221.3s, over the ground-truth diff; P0 path then CONFIRMED by direct inspection of dev-subjective-label.mjs:60 + :115 and the on-disk .shots filenames
confidence: high
---

Collaborator: Jonah. 2026-07-24. I certified `default-typeface` as clearing A5a (R=1.000 P=1.000, 0 FP) and committed on the record: "if it finds a real contamination path I'll withdraw the ship call rather than defend it." The independent review found one. **SHIP CALL WITHDRAWN.**

## THE P0 - the answer is in the attachment filename
`dev-subjective-label.mjs:60` builds the screenshot path as `dev-${id}.png` from the page id, and `:115` passes that path to `codex exec --sandbox read-only -i <path>`. The A5a fixture ids encode the answer twice over:
- **Polarity prefix**: `p0*` = expected positive, `n0*` = expected negative.
- **Scenario in plain English**: `dev-p04-webfont-declared-never-applied.png`, `dev-n01-branded-body.png`, `dev-n04-single-system-caption.png`, and most damningly `dev-n06-brand-mismatch-NEGATIVE.png` - the verdict word is in the filename.

Confirmed by direct inspection, not just the review's conditional wording. Whether or not the model attends to attachment filenames, a ground truth whose answer sits in the filename is not defensibly independent, and independence is the ONLY thing that makes this gate worth running. The numbers stand as MEASURED; their INDEPENDENCE is not established, so they cannot certify anything.

Scope note: the leak is specific to the A5a FIXTURE set. The 12 real-negative pages are named by site (`linear`, `framer`, `supabase`) and encode no expected answer, so the real-page precision measurement is far less exposed - but the fixtures carry the entire recall population.

## The other findings (all real)
- **P1 selectors leak author intent.** The TYPEFACE prompt emits CSS selectors verbatim; current fixtures show benign `.font-sans`, but nothing stops a future `.brand-font-unused` or `[data-expected=present]`.
- **P1 nested at-rules mis-parsed.** `@media { body { font-family: "Brand" } }` is reported as `@media (...) { font-family: "Brand" }` - the real selector `body` is LOST. Same for `@supports`. I flagged this risk in the review prompt and it was confirmed.
- **P1 "APPLIED to elements" is not verified.** The extractor never checks that a selector matches any DOM element, so an unused `.brand-copy { font-family: Custom }` is presented as actually putting a font on text - biasing labels toward "chose a typeface". This is the SAME definition-vs-application class of bug I fixed for `@font-face` and did not generalize.
- **P2** inline-style regex only handles double quotes and does not strip comments inside inline styles.
- **P2** stale provenance: `method` still reads `screenshot-vision+text+motion`; the run banner still says `19 screenshot / 2 text / 2 motion` instead of counting the typeface class.

## The one genuinely reassuring result
**No detector-copying.** Codex explicitly looked for and did not find a share threshold, a 0.75 cutoff, a production score, or winner-resolution logic in the extractor: "The major risk is not direct detector copying; it is contamination/inaccurate signal through filenames, selectors, and regex CSS semantics." That was my biggest worry about my own changes and it is clear - the ground truth is not a copy of the thing it grades.

## Self-analysis (why I did not catch the P0 myself)
I audited the CONTENT of the prompt (I caught and fixed the leaked CSS comment) but never audited the CHANNEL - the attachment. I treated "what text goes in the prompt" as the whole attack surface and never asked what metadata rides along with the image. The lesson generalizes: when checking for ground-truth contamination, enumerate EVERY channel reaching the labeler (prompt text, attachment filenames, file paths, cwd, env, ordering), not just the one being edited. I also had a near-miss precedent in hand - I had just fixed a leak of the fixture author's intent - and still did not widen the search to filenames.

## Status
- Ship call WITHDRAWN. `default-typeface` is NOT certified through A5a.
- `npm test` is green at **75 suites** and corpus verify-candidates is OK - those stand.
- Fixes for all 6 findings + a full re-label + re-grade are required before any ship call is revisited. Nothing committed.
- The 3 prior label bases remain preserved for audit; a 4th (opaque-filename) basis will follow.

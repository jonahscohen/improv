---
name: corpus verify-candidates freeze drift - root cause
description: The 90/90 record-hash drift is legitimate un-re-frozen corpus evolution (motion GT re-labeled by the observe instrument), NOT a hashing bug - proven by reproducing all 90 locked hashes from a recovered pre-freeze blob
type: project
relates_to: [session_2026-07-24_a5a-default-typeface.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

# verify-candidates 90/90 drift: root cause (Debugging Protocol trace)

Pre-existing RED at HEAD 1ea7ae73, surfaced 2026-07-23 while closing the A5a taste gate. Diagnosed here.

## The delta (last-green -> now)

`candidates.json` and `lock-candidates.json` land in ONE squashed commit (2bbeabd4), so `git log` gives no
delta. Recovered the pre-freeze state from UNREFERENCED GIT BLOBS instead:
`git cat-file --batch-all-objects` -> blob `ee51ec5e4550` (1051343 B) is the frozen-state `candidates.json`.

**Proof it is the frozen state:** feeding blob `ee51ec5e` through the CURRENT `canonicalCandidateRecord`
reproduces **90/90** locked `recordHash` values byte-for-byte. The hasher is therefore UNCHANGED and CORRECT.
Current file reproduces 0/90.

## Verdict: legitimate corpus evolution, never re-frozen. NOT a tooling bug.

Timeline:
- `2026-06-24T01:50:02.844Z` - `freeze-candidates` locks 90 pages. All 22 subjective classes `labeledBy: codex`;
  the 2 MOTION classes judged from CSS declarations (`method: screenshot-vision+text+motion`).
- `2026-06-24T17:17:50.696Z` - the motion-observe referee (`eval/motion-observe-label.mjs`) re-labels
  `layout-transition` + `bounce-easing` on all 90 pages with OBSERVATION-based GT
  (`method: observed-css-motion`, `labeledBy: motion-observe-instrument`). This is the documented Jonah ruling
  in that file's header: the speculative CSS-read motion GT was replaced because a CSS reader "can't SEE motion."
- `freeze-candidates` was never re-run. -> 90/90 `LOCKED RECORD TAMPERED`.

Exact hash-bearing delta (frozen -> now), nothing else moved:
- 180 labels: `labeledBy` codex -> motion-observe-instrument (90 pages x 2 motion classes)
- 51 labels: `present` flipped (layout-transition 36 true->false + 4 false->true; bounce-easing 10 true->false + 1 false->true)
- ZERO changes to file / register / bucket / primaryDefects / provenance / objectiveLabels
- page file contents byte-identical (0 FILE CONTENT TAMPERED); all 23 briefs intact

Downstream measurement (scorecard.json, Jun 26) was computed AFTER the re-label, so the observation-based GT
is already the basis of every published number. Re-freezing to current state is the consistent action.

## Why it went unnoticed (the enforcement-point failure)

`npm test` (scripts/run-tests.ts, explicit suite list) ran NEITHER `verify-candidates` NOR `corpus-tool.test.mjs`.
The integrity tool existed and was correct; nothing asked it the question. All 90 corpus HTML files and 25 briefs
ARE git-tracked, so the gate is reproducible on a fresh clone - there was no technical reason to leave it out.

## Second, latent hole found while wiring the gate

`verifyCandidates()` returns `ok: true` on an ABSENT/EMPTY corpus (`readJson` falls back to `[]` / `{records:{}}`,
the loops never run, `errors` stays empty). Live proof: the manifest-corpus `verify` reports
`VERIFY OK` today on counts `{dev:0,heldout:0,challenge:0,known-good:0}` - a vacuous green. Wiring a gate that
can pass on a missing corpus would have re-created the same rot vector one layer up.

## Files touched
- (diagnosis only in this beat; fix recorded in the follow-up beat)

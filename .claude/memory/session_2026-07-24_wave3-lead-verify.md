---
name: Wave 3 lead-verified + committed (Stage 2c roll + Stage 4c/4d structural-motion classes)
description: stage2c (outside-ranking direction roll) + stage4cd (10 structural/motion taste classes + honest exclusions) both landed WITHOUT orphaning (foreground-review guardrail worked) and without touching run-tests/dist (lead-owned). Lead registered both suites, rebuilt dist, gated at 79 suites green, committed. Honest caveats carried: stage4cd's glow/marquee fire on common idioms (A5a taste call, do-not-promote), numbered-markers dev R=0.000 reported plainly.
type: project
relates_to: [session_2026-07-24_stage2c-direction-roll.md, session_2026-07-24_stage4cd-structural-motion-classes.md, session_2026-07-24_wave2-commit-progress.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: gate - npm run build clean (both --check OK), npm test 79 suites; stage2c ts-node invariants OK; stage4cd foreground Codex 10 findings folded + ts-node 64-assert incl A2
confidence: high
---

Collaborator: Jonah. 2026-07-24. Wave 3 (the anti-orphan + lead-owns-shared-files guardrails applied). Both units landed clean.

## The wave-2 lessons WORKED
- **No orphans**: both teammates ran their Codex review in the FOREGROUND (not backgrounded-and-yielded) and delivered final reports directly. The wave-2 orphan pattern did not recur.
- **No shared-file contention**: both handed me their run-tests.ts line instead of editing it; neither rebuilt dist. Lead registered both suites + did ONE combined dist rebuild. Clean.

## stage2c (Stage 2c - outside-ranking roll)
`bin/sidecoach-roll.js` + `src/direction-deck.ts` (our OWN curated 16-direction deck, no competitor IDs). The never-model-top / never-used-id / no-repeat properties are STRUCTURAL (pool pre-filtered before the seeded pick), so they hold for every seed by construction. Lead-verified: ts-node test OK (determinism, exclusion, full-sweep no-repeat, exhaustion, unsigned-seed domain). Foreground Codex folded 3 (lazy-load dist so --help needs no build, unsigned-32-bit seed validation, negative-seed error). Hard exclusion (no browser/server/variant surface) grep-proven. Exit 0 drawn / 2 usage / 3 exhausted.

## stage4cd (Stage 4c/4d - structural + motion/marker classes)
10 rendered subjective detectors (2 scorers: inPageStructural, inPageMotionMarker), audit-only registered (no required-promotion). All 10 fixtures R=1.000, A2 clean-page fires none. Foreground Codex 10 findings ALL folded (marquee animation-name/iteration-count pairing, travel-delta, visibility gates before count, overlay layer-order + scrim-alpha, numbered consecutive-run, img selector-subject, overflowY, inset-shadow skip). HONEST P/R:
- Only numbered-section-markers has Codex dev labels: dev R=0.000 reported PLAINLY (the 3 labeled-present pages express numerals as CSS counter() pseudo-content / non-zero-padded / a keyboard's number keys - a DOM engine cannot truthfully read them; the zero-padded 01/02/03 motif is the only catchable signal).
- soft-radial-glow (10/48=21%) + marquee (5/48) CORRECTLY detect real common modern idioms - flagged that whether a glow/marquee is a DEFECT is an A5a taste call, at these rates risking the "low-precision guess about a frequently-right thing" the plan warns against. Shipped audit-only, A5a-pending, DO-NOT-PROMOTE without Codex defect-labels.
- HONEST EXCLUSIONS recorded (not built): stock geometric hero art (DOM-invisible raster), aphoristic-cadence/theater-slop-phrase (copy-semantic; aphoristic-cadence stays architect-authored, not stage4cd).

## Gate + commits
npm run build clean (generate-lanes-data + generate-validators --check OK), npm test 79 suites (77 + direction-roll + structural-motion). Committed per-unit: stage2c, stage4cd, run-tests+dist build, beats.

## Files touched (lead, this integration)
- scripts/run-tests.ts (both suite lines), dist rebuild, this beat + MEMORY.md.

---
name: tilt-verify all-fail was UI-redesign selector drift, not broken effects
description: Full-catalog tilt-verify sweep reported 25/25 fail, ALL with the identical "waiting for .browse-grid__card timeout" - a harness selector mismatch after the playground UI redesign renamed classes, NOT 25 effect failures. Realigned harness selectors to current markup. Debugging-protocol win (delta = the redesign).
type: project
relates_to: [session_2026-06-01_interactivity-overhaul-punchlist.md, session_2026-06-01_interaction-foundation.md, session_2026-05-29_tilt-lab-scope-reconciliation.md]
---

Collaborator: Jonah. 2026-06-01.

## Symptom
`npm run verify -- --all` (the expect-inspired tilt-verify harness) returned `25 effects, 25 with failures | checks pass=0 fail=25`. Every single effect threw the SAME error: `page.waitForSelector('.browse-grid__card') Timeout 10000ms exceeded`.

## Root cause (debugging protocol: find the delta, don't theorize)
Uniform identical failure across 25 effects = systemic harness issue, not 25 independent effect bugs. The delta vs last-working: the **playground UI was redesigned end-to-end** (design-team "rethink the playground UI" pass). The redesign renamed the browse/layer DOM classes, so the harness's pinned selectors no longer matched. `.preview-canvas` survived (preflight passed; the timeout was on CARD, which is checked AFTER preview), proving the page mounted fine - only browse/layer selectors drifted.

Selector drift (old harness -> current app markup in BrowseGrid.tsx / LayerStack.tsx):
- `.browse-grid__card` -> `.browse-card`
- `.browse-grid__card-name` -> `.browse-card__name`
- `.layer-stack__item` -> `.channel`
- `.layer-stack__name` -> `.channel__name`
- unchanged (kept): `.preview-canvas`, `.layer-stack__hint`
- param controls still expose `ariaLabel={spec.name}` for range/toggle/color/select/text/marker-list (only `file` uses label ?? name), so the harness `[aria-label="<name>"]` keying is intact. New `<details>` param grouping (>8 params) means controls in closed groups aren't rendered; exerciseParam picks the first rendered control, which lands in the open first group - fine.

## Fix
verify/lib/checks.mjs: hoisted CARD/CARD_NAME/LAYER_ITEM/LAYER_NAME constants to the current classes, added a comment that these track app markup and must move with any redesign, and made addCardAndWait pass the selector through waitForFunction as `{n, sel}` (single-arg constraint). No effect code touched.

## NEXT
Re-run `npm run verify -- --all` against the live dev server (5180, up). This is the decisive functional validation the user demanded; it must be re-run on the FIXED harness before any per-effect verdict. Then targeted Claude-in-Chrome screenshots for interaction-specific items the functional harness can't judge aesthetically, then stand down idle agents (fid-mc-b pane still alive; fx-*, preset-registry idle) + commit.

## Lesson
A 100%-identical failure rate is almost never N real failures - it is one shared precondition broken. Check the harness/selector/fixture before concluding the subjects are broken. The redesign was the delta.

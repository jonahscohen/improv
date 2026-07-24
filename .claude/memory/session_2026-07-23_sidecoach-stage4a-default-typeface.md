---
name: Sidecoach Stage 4a - default-typeface rendered subjective class
description: New rendered taste class flagging default-stack / brand-mismatch typography, precision-first, single-source calibrated
type: project
relates_to: [session_2026-07-23_sidecoach-upgrade-plan.md, decision_sidecoach_upgrade_first_units.md, session_2026-07-23_sidecoach-detect-cli-stage3a.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + calibration harness + codex-review (2 rounds)
confidence: high
---

Stage 4a of the sidecoach upgrade plan (docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md). Built by the named teammate "font-class" concurrently with detect-cli (Stage 3a). Collaborator Jonah.

## What shipped
A new rendered SUBJECTIVE (taste) class `default-typeface` on `src/validators/subjective-rendered-scanner.ts`. It reads computed `font-family` across visible, non-peripheral content text and flags a page whose content is not set in a typeface anyone CHOSE. Two grounds:
- Ground A (default stack): >= 75% of content text (char-weighted) LEADS with a system/default-vocabulary family. The historically over-used monoculture faces (Arial, Helvetica, Times, Georgia, Verdana, Segoe UI) live IN that vocabulary - they are what you get when nobody chose. LIVE-ACTIVE, promoted + fail-closed exactly like tiny-text.
- Ground B (brand mismatch): a KNOWN committed family carries < 25% of content text. Fully implemented, calibrated, unit-tested, with a documented seam (opts.typeface / LiveScanOptions.typeface) - but INERT on the live path until a committed-family source is wired (see limitation below).

## Key technical decisions
- **Measure the DECLARED STACK, not the painted face.** Why: the hermetic render aborts external subresources, so a CDN-loaded typeface paints in fallback no matter how well built. Scoring the painted face would fire on nearly every real page as a harness artifact. The declared stack is render-independent and is what the page actually asked for. This is also what makes the class out-detect the static oracle on the "webfont declared but never applied to content" case.
- **Leading-family classification, not all-families.** How: a stack resolves left to right; the first family is the decision, the rest are fallback. An earlier draft required EVERY family to be system vocabulary - the calibration harness caught it as a bug: the canonical `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` boilerplate carries Roboto mid-stack, and Roboto is deliberately excluded from the vocabulary (it is a real downloadable typeface), so the conjunction scored the single most common default stack on the web as "chosen". Leading-family is simpler and correct.
- **Single-source split** (mirrors inPageBuzzword/buzzwordFindingFromScore): in-page `inPageTypeface` returns the SCORE; Node-side `typefaceFindingFromScore` applies the thresholds. The calibration harness imports the shipping functions from dist and sweeps EXACTLY what ships.
- **Vocabulary single-source.** `SYSTEM_FONT_STACK_FAMILIES` exported from `src/reference-data.ts` (the concrete expansion of the font catalog's `system_fonts` entry - the ONE catalog entry whose source is not fontshare.com). The in-page fn cannot import, so it inlines a verbatim copy; `src/__tests__/typeface-vocabulary.test.ts` asserts the two lists stay identical (drift = test failure). DELIBERATE EXCLUSIONS (Roboto, Noto Sans, Ubuntu, Cantarell, Fira Sans, Oxygen, Droid Sans, Inter, Poppins) - real downloadable faces that only appear mid-stack; excluding them costs nothing on a genuine system stack because classification is on the LEAD.
- **Honest exclusion:** "over-used Google-font monoculture" in the Inter/Poppins sense is NOT detected. Inter/Poppins are recommended catalog entries and 13 of 48 dev pages lead with Inter as a deliberate, good choice. Firing on them would be a low-precision taste guess. Recorded in-code.

## Frozen thresholds (on PRINCIPLE, confirmed not chosen by dev signal)
- DEFAULT_STACK_SHARE = 0.75. The claim "no chosen typeface" is only true when the default stack is the dominant voice by a clear margin; a page setting even a quarter of content in a chosen face has decided. Dev corpus (48 externally-sourced real pages): MAX default-stack share is 0.058 (inngest); 40/48 sit at 0.000. Distribution is BIMODAL (real 0.00-0.06, unchosen 1.00) so every threshold 0.30-0.95 scores identically - the sweep confirms a wide safe band, it does NOT discriminate 0.75, and the code comment says so.
- BRAND_PRESENCE_MIN = 0.25. Ground-B sweep DOES discriminate: 0.05-0.40 give P/R 1.0; 0.50 produces the first real-page FP; 0.75 produces ten. 0.25 sits a full step below the first failure.
- TYPEFACE_MIN_CONTENT_CHARS = 200 (same as tiny-text; a near-empty page can't support a page-level judgment).

## Verify results (all REAL)
- Calibration (eval/typeface-calibrate.mjs): ground A 0 FP on 48 real pages, 5/5 constructed positives; ground B 0 FP / 0 FN on 48 measured pages. Exit 0.
- Fixtures: 5 positives (unstyled, system-stack, websafe-monoculture, webfont-declared-never-applied, tailwind-defaults) + 6 negatives (branded, brand+system-code/table, brand-with-system-fallback, single-system-caption, system-chrome-branded, brand-committed-and-used).
- npm test: 73 suites (was 71 before; +typeface-vocabulary, and detect-cli's suite landed concurrently). Golden snapshots: NO drift - scanner-snapshot goldens cover the LEGACY taste-validator/absolute-ban modules, not the rendered subjective scanner, so a new rendered class does not touch them.
- generate-validators --check green; referee-independence green; product code imports nothing under eval/.
- Registry: 59 -> 60 rules; polish-standard owner 23 -> 24. New rule polish.default-typeface (rendered-scan evidence, in RENDERED_BACKED_RULE_IDS).
- Head-to-head vs oracle (detection level, /tmp/oracle-v4 clone): on our 5 default-stack positives the oracle catches only 1 (p03 via overused-font); on our 6 negatives the oracle FALSE-fires on 4 (single-font/overused-font incl. the single-caption precision trap). Genuine differentiated niche.

## A5a GATE: NOT RUN (honest)
The oracle-comparator BINARY runs (clone present, detect.mjs executes, real findings). But the Contract-6 A5a taste-detection gate CANNOT be graded for this class: A5a grades against lead-run Codex SUBJECTIVE labels, and NO Codex label exists for default-typeface (the 22-class rubric predates it). Creating that label is the LEAD's job - author != labeler, and font-class is registered as the rule-author in eval/corpus/rule-authors.json so the freeze gate rejects any font-class-authored label. Reported as NOT RUN, not passed.

## Codex cross-model review (gpt-5.4, 2 rounds)
Round 1: 5 findings. Folded ALL: P1 harness-not-fail-closed (excluded pages now force exit 2), P1 ground-B had no calibration path (added a discriminating sweep over the dev corpus using each page's own dominant family as negative + a sentinel as positive), P2 split(',') not CSS-correct for quoted names with commas (quote-aware splitFamilies), P2 scope missed body's own text (now includes document.body), P2 verdict text wrong for ground B (ground tag drives the message). Round 2: confirmed 3 CLOSED; 2 NEW findings folded (ground-B could pass vacuously if all eligible rows skipped -> guard on bMeasured; no outer catch -> infra failures now exit 3 via process handlers). Both new fixes proven by fault injection.

## KNOWN LIMITATIONS (reported to lead, not buried)
1. Ground B is INERT on the live path. Wiring a committed-family source needs a field that does not exist in project-context.ts plus edits to run-validator.ts and audit-rendered.ts (files font-class does not own; audit-rendered is detect-cli's). Ground B ships correct + calibrated + tested behind a seam; live activation is a follow-up integration.
2. Shadow-DOM text is not scanned - consistent with EVERY sibling class on this scanner (tiny-text, marketing-buzzword use the same querySelectorAll walk). Documented in-code; not a Stage 4a regression.

## Plan imprecision noted
The plan says the font vocabulary is in `src/fontshare-reference.ts`. That is a SERVICE class; the real vocabulary lives in `src/reference-data.ts` (getFontNames/getFont, the fontshare.com entries ~line 594, system_fonts ~line 623). Grounded the class in the real data source.

## Files
Created: eval/fixtures/default-typeface/{p01-p05,n01-n06}.html, eval/typeface-calibrate.mjs, src/__tests__/typeface-vocabulary.test.ts
Modified: src/validators/subjective-rendered-scanner.ts, src/validators/rendered-live-scan.ts, src/validators/checks/rendered-checks.ts, src/reference-data.ts, src/product-rule-registry.ts, src/validator-generation.ts, src/__tests__/subjective-rendered-calibration.test.ts, src/__tests__/product-rule-registry.test.ts, eval/corpus/rule-authors.json, scripts/run-tests.ts
NOT committed (lead reviews). Did NOT touch bin/sidecoach-detect.js or audit-rendered.ts (detect-cli owns them).

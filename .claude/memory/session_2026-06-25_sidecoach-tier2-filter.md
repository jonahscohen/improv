---
name: sidecoach-tier2-filter
description: Applied Codex's DOM-evidence filter to all 29 Tier-2 rules. ~14 are theater (always-pass or keyword-proxy/NLP) -> retire; ~8 high-value real-evidence -> keep; ~8 niche-but-real CSS checks -> proposed retire for "simpler". Codex confirm on the keep/retire line requested.
type: decision
relates_to: [session_2026-06-25_sidecoach-stage2-strategy-decision.md, session_2026-06-25_sidecoach-extended-validator-triage.md]
---

Collaborator: Jonah Cohen (autonomy). Step 2 of the locked strategy ([[session_2026-06-25_sidecoach-stage2-strategy-decision]]): filter the 27 (actually 29) Tier-2 rules by evidence type. Full per-rule classification: scratchpad/stage2-tier2-filter.md.

## RESULT
- **RETIRE ~14 as theater:** unconditional `passed:true` (TOUCH_004, PERFX_004, CHART_002, CHART_004); keyword-proxy/wrong-layer (PERFX_001/002 idempotency/latency strings, CONTENT_003 length===0 JS fragments, MOTION_HF/PAIR); NLP/text heuristics (COPY_001/002/004/005, CHARSUB_001/002/003); CHART_001 advisory.
- **KEEP ~8 high-value real DOM-evidence (proposed):** IMGPERF_001 (img dims/CLS), IMGPERF_002 (lazy-load), IMGPERF_003 (fetchpriority/LCP), CONTENT_002 (text overflow wrap/clamp), DARKMODE_001 (color-scheme), CHART_003 (chart text/table a11y fallback - the exact chart-a11y Codex said keep), COPY_003 (specific button labels), PERFX_003 (content-visibility:auto). These are CSS-property/markup/aria/visible-text checks that fire regardless of framework.
- **NICHE-but-real (~8, proposed RETIRE for "simpler"):** TOUCH_001/002/003 (touch-action/tap-highlight/overscroll CSS), CONTENT_001 (flex min-width:0), CONTENT_004 (skeleton dims-too-broad), DARKMODE_002/003 (theme-color meta, native select bg), CHARSUB_004 (scroll-margin-top). Real CSS evidence but minor polish.

## OPEN (Codex confirm)
Keep the 8 high-value + retire niche-real (my lean, simpler), OR keep all ~16 real-evidence? Then absorb keepers by evidence type into static-a11y (markup) / polish-standard (CSS perf), retire the rest, and proceed to migration. Count exceeds Codex's earlier 3-8 estimate because the actual list has more genuine CSS checks than it guessed - hence the confirm.

## LOCKED (Codex confirmed direction, 2026-06-25): KEEP 8, retire the rest
Codex reiterated "expect 3-8 keepers" + "the registry is now strong enough to replace the theater validator WITHOUT the theater rules - proceed IMMEDIATELY to migration + deletion." So the keeper set = the 8 HIGH-VALUE rules; the ~8 niche-but-real CSS checks retire with the theater (serves "simpler"; they're minor polish). Final KEEP-8: IMGPERF_001/002/003, CONTENT_002, DARKMODE_001, CHART_003, COPY_003, PERFX_003.
LANDING by evidence type: markup/aria ones (IMGPERF_001/002/003 img attrs, CHART_003 aria-fallback, COPY_003 button text) -> static-a11y (or advanced-a11y); CSS ones (CONTENT_002 overflow, DARKMODE_001 color-scheme, PERFX_003 content-visibility) -> polish-standard.

## REMAINING STAGE 2 (the migration+deletion is the crux, per Codex "highest-leverage")
1. Absorb the 8 keepers (proven forms pattern: reimplement registry-quality, codegen, golden, fixtures, dist).
2. Migrate the ~19 flow-handler call sites to runValidator (DISPLAY-PRESERVING: legacy reports for display until an alias retires; never inject static results into ProductValidationResult; honest "no automated checks for this domain yet" for retired-theater domains).
3. DELETE ExtendedDomainValidator + the gesture/Tier-2 theater + the 2 domain files; fix imports.
4. Verify full suite green + eval unchanged. Send each chunk to Codex.
This is a large, careful unit (esp. the migration) - the substantive absorb (forms) is DONE; this is the convergence finish.

---
name: sidecoach-page-quality-absorb
description: Stage 2 - the 6 genuinely-strong DOM-evidence Tier-2 keepers absorbed into a new `page-quality` registry validator (img perf, text-overflow, dark color-scheme, chart a11y fallback, button-label specificity). The rest of Tier-2 + gesture RETIRED with the theater. Caught+fixed an over-broad chart detection. Registry now 58 rules.
type: project
relates_to: [session_2026-06-25_sidecoach-tier2-filter.md, session_2026-06-25_sidecoach-stage2-strategy-decision.md]
---

Collaborator: Jonah Cohen. Jonah corrected me to STOP over-checkpointing with him and just decide-with-Codex + execute autonomously ("what did I say about you and Codex" = decide amongst yourselves, get the win). Acted on it: executed the Tier-2 absorb without seeking his buy-in.

## DONE: 6 Tier-2 keepers -> new `page-quality` validator
Cherry-picked the 6 genuinely-strong DOM-evidence rules (per the filter): perf.image-dimensions (CLS, MAJOR - the one blocker so the findings fixture yields 'findings'), perf.image-lazy-load, polish.text-overflow-strategy, theming.color-scheme-dark, a11y.chart-text-fallback, a11y.button-label-specific (all minor advisories except image-dims). Reimplemented registry-quality with the comment-stripped haystack + N/A guards.
- NEW `page-quality` validator (non-gating) registered + fixtures (clean=well-formed page, findings=all 6 fail, inconclusive=no markup). Markup rules + css-rule rules (text-overflow/color-scheme read cssText).
- NEW page-quality-checks.ts + page-quality-checks.test.ts (registered); golden +6 rows + pageQuality array (RULES 52->58, page-quality owns 6); codegen; dist rebuilt.

## BUG CAUGHT (verify discipline, again)
The chart-fallback applicability matched the bare word "chart"/"graph" in PROSE (`<p>no chart</p>` -> false-detected as a chart). FIXED: detect charts STRUCTURALLY (<canvas>, charting-lib markers recharts/chartjs/highcharts/echarts/nivo/visx, or class*=chart/graph/sparkline) - NOT prose words. Under-detecting a bare unclassed <svg> is acceptable (svg==icon ambiguity); a false N/A beats failing every page that says "chart". Caught by the unit test's N/A case.

## RETIRED with the theater (NOT absorbed)
All 6 gesture rules + ~21 Tier-2 theater (always-pass TOUCH_004/PERFX_004/CHART_002/004; keyword-proxy PERFX_001/002/CONTENT_003/MOTION_HF/PAIR; NLP COPY_001/002/004/005 + CHARSUB_001/002/003; CHART_001; niche-real TOUCH_001/002/003, CONTENT_001/004, DARKMODE_002/003, CHARSUB_004) + 2 over-firey (IMGPERF_003 fetchpriority can't know LCP statically, PERFX_003 content-visibility fires on any <section>). These vanish when ExtendedDomainValidator is deleted.

## REGISTRY STATE: 58 high-quality rules
Stage1 rendered (5) + Stage1-era (31) + forms (16) + page-quality (6) = 58. Validators: polish-standard, theming, anti-pattern, static-a11y, forms, page-quality (+gating set unchanged).

## NEXT (the convergence finish - the crux)
ABSORB DONE. Remaining: MIGRATE the ~19 flow-handler call sites off ExtendedDomainValidator.validateAll -> runValidator (display-preserving; honest collapse for retired-theater domains) -> DELETE ExtendedDomainValidator + the 2 tier2 domain files + gesture rules -> verify suite + eval. This is the big careful unit; send to Codex.

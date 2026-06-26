---
name: buzzword-v3-precision-implement
description: Stage 5a v3 - marketing-buzzword PRECISION fix. v2 won recall on the frozen-90 (r=0.875, lifted aggregate subjective recall to a significant win) but precision lagged (frozen p=0.333<0.4). Characterized the FP mode, fixed via vacuity-reweighting on DEV, captured a fresh held-out. Frozen-90 SPENT/untouched.
type: project
relates_to: [session_2026-06-25_sidecoach-buzzword-v2-rebuild.md, session_2026-06-25_buzzword-v3-precision-plan.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Stage 5a v3 builder unit (teammate "buzzword").

## v2 frozen-90 result (the win + the gap)
Recall GENERALIZED: frozen r=0.875 (7/8, up from v1's 0.125, beats oracle 0.5 decisively) -> aggregate
subjective recall is now a SIGNIFICANT win (CI off zero). BUT frozen precision p=0.333 (14 FP / 21 fired) <
oracle's 0.4. Jonah: close the precision gap the rigorous way. The frozen-90 is SPENT (measured twice) - develop
on DEV, measure on a FRESH held-out.

## FP-MODE CHARACTERIZATION (on dev; the discriminator found)
Tested the lead's concreteness hypothesis: it FAILED - global concreteness (numbers/stats/proper-nouns) does NOT
separate FP from TP (TPs gong/mintlify/linear have HIGH numeric density 13-59%; FPs vary). So a concreteness
counter-signal is out.
The REAL discriminator = vacuity TIER profile: FP mean PEAK=0.33 vs TP mean PEAK=1.36. The 6 dev FPs fire on
concrete-prone STRONG/MILD words (modern/advanced/enterprise-grade/ai-powered/accelerate/harness/leverage - 4 of 6
FPs have ZERO pure-hype PEAK terms), while the TP fluff leans on PEAK clichés (seamless/supercharge/revolution/
world-class/effortless/lightning-fast/10x/magical). Confirms the lead's PEAK-weighting direction. The FPs USE
marketing vocab CONCRETELY (nasa "groundbreaking discoveries", onepassword "powerful security").

## THE FIX (vacuity reweighting) + WHY
PEAK (content-free hype, impossible to use concretely) UPWEIGHTED; the concrete-prone MILD tier heavily DISCOUNTED.
- Weights: PEAK 3->4, STRONG 2 (unchanged), MILD 1->0.5 (ratio 8:4:1).
- QUALIFY guard tightened: require >=1 PEAK/STRONG term (dropped the "distinct>=2 MILD-only" path) - a pure-MILD page
  is product-descriptor vocabulary, not buzzword-leaning.
- Threshold re-derived on dev: 1.0 -> 0.75.
Grid-tested wP/wS/wM on dev (holding recall>=0.80); chose the MODERATE principled 4/2/0.5 (not the grid-max 5/2/0.5
which is more overfit-prone). The reweighting drops the MILD-driven dev FPs (neon, flowbite -> TN); the STRONG-driven
FPs (onepassword/accenture/nasa/resend - marketing words used concretely) are the residual ceiling that no
recall-holding threshold removes.

## DEV RESULT (shipping single-source detector; harness == production)
v3: TP=26 FP=5 FN=5 TN=12 -> R0.839 / P0.839 (17 diverse negatives). BOTH axes UP vs v2 (R0.806->0.839,
P0.806->0.839; recall HELD/improved per the mandate). FP(5): accenture, monday, nasa, onepassword, resend.
FN(5): asana, raycast, scale, solana, supabase.
HONEST limit: holding recall>=0.80 forces threshold 0.75 just above the concrete-register ceiling (~0.74) - the
borderline present pages (fly/raycast) have ~0 PEAK and overlap the concrete negatives, so the dev precision ceiling
(recall-held) is ~0.84. Whether that lifts frozen p past 0.4 is the FRESH HELD-OUT's job.

## FRESH HELD-OUT (step 4)
Captured ~36 NEW pages -> eval/corpus/buzzword-heldout/, DISJOINT from dev(48)+frozen-90 (host+sha, fail-closed),
DELIBERATELY FP-mode-loaded: science/research (mit/caltech/cern/nih/noaa/esa - "groundbreaking" used concretely),
dev-infra (cloudflare/hashicorp/mongodb/cockroach/grafana/sentry/temporal/fastly - "powerful/scalable" real
features), enterprise (gitlab/atlassian/redhat), gov-data (usgs/weather/sec/fed) + clear fluff (clickup/miro/openai/
cohere/perplexity/...) + editorial/docs (danluu/jvns/deno/bun/vite). HTML only - I do NOT label/develop against it
(author!=labeler). Lead runs the Codex labeling + measurement.

## INTEGRITY (carried from the Codex folds)
Single-source inPageBuzzword (no harness reimplementation); hardened visibility + paintedInvisible; lookaround
adjacency counting. Build clean + generate --check OK + npm test 64 suites + calibration test green + dev-disjoint
green. Frozen-90 NEVER touched; zero held-out knowledge.

## FINAL OUTCOME (lead's fresh-held-out measurement + Codex) - MISSION COMPLETE
v3 GENERALIZED. On the FRESH held-out (lead-labeled, never developed against): marketing-buzzword WINS the class -
F1 0.857 vs oracle 0.727, recall 0.947 vs 0.632, precision near-parity. The vacuity-tier fix held on unseen
FP-mode-loaded pages. v3 Codex review CLEAN (no P0/P1; 2 stale-comment P2s folded). The whole Stage 5/6 convergence
is committed (4 commits on sidecoach-phase2-reimplement); Sidecoach beats oracle on every aggregate axis.
Arc: v1 collapse (overfit homogeneous corpus) -> v2 diverse-corpus recall win (frozen r0.875) -> v3 vacuity-tier
precision fix (refuted the concreteness hypothesis with real dev-FP data, held the no-frozen-90 discipline every
round). Lead: "exactly how it should be done." Stand down.

## Files
- src/validators/subjective-rendered-scanner.ts (inPageBuzzword weights 4/2/0.5 + strict guard + threshold 0.75)
- eval/buzzword-calibrate.mjs (single-source sweep), eval/buzzword-heldout-capture.mjs (fresh held-out)
- eval/corpus/buzzword-heldout/* + buzzword-heldout-manifest.json

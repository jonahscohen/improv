---
name: buzzword-v3-fix-and-heldout
description: buzzword v3 precision fix delivered - my concreteness hypothesis FAILED (tested + refuted), the real discriminator is VACUITY TIER (PEAK). Vacuity-reweight (PEAK 3->4, MILD 1->0.5) + PEAK/STRONG-required guard + thr 0.75 -> dev R0.839/P0.839 (both up, recall held). Fresh 38-page FP-mode-loaded held-out captured. Lead now: parameterize the label harness for the held-out dir, Codex-review v3, label + measure.
type: project
relates_to: [session_2026-06-25_buzzword-v3-precision-plan.md, session_2026-06-25_buzzword-v2-frozen90-RESULT.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25).

## v3 FIX (buzzword; lead verifying)
- MY concreteness hypothesis FAILED (buzzword tested it): global concreteness (numbers/proper-nouns) does NOT separate FP from TP (TPs gong/mintlify/linear also 13-59% numeric). Good science - tested the lead's idea, refuted it.
- REAL discriminator = VACUITY TIER: dev FP mean PEAK=0.33 vs TP mean PEAK=1.36; 4/6 dev FP fire with ZERO PEAK (on concrete-prone STRONG/MILD: modern/advanced/enterprise-grade/ai-powered/accelerate/harness/leverage). True fluff leans on PEAK clichés (seamless/supercharge/revolution/world-class/10x).
- FIX: vacuity reweight PEAK 3->4, STRONG 2 (unchanged), MILD 1->0.5 (ratio 8:4:1); QUALIFY tightened to require >=1 PEAK/STRONG (pure-MILD = product descriptors, not buzzword-leaning); threshold re-derived 1.0->0.75. Chose MODERATE 4/2/0.5 (not grid-max 5/2/0.5 = less overfit).
- NEW DEV SWEEP (shipping single-source): thr 0.75 R0.839/P0.839 (TP26 FP5 FN5 TN12) - BOTH axes up vs v2 0.806; recall HELD. Residual FP(5)=accenture/monday/nasa/onepassword/resend (STRONG used concretely). HONEST limit: recall>=0.80 forces thr just above the concrete ceiling (~0.74), so dev precision ceiling (recall-held) ~0.84 - whether that lifts FROZEN p past 0.4 is the FRESH held-out's job.
- FILES: subjective-rendered-scanner.ts (4/2/0.5 + strict guard + thr 0.75); build+64 suites green.

## FRESH HELD-OUT (38 pages, eval/corpus/buzzword-heldout/, manifest buzzword-heldout-manifest.json)
Disjoint from dev+frozen-90 (fail-closed verified). DELIBERATELY FP-mode-loaded: science (mit/caltech/cern/nih/esa), infra (cloudflare/hashicorp/mongodb/grafana/...), enterprise (gitlab/atlassian/redhat), gov-data + clear fluff (clickup/miro/openai/cohere/...) + editorial/docs. buzzword captured HTML + disjointness ONLY (never ran the detector on it = held-out clean).

## LEAD NEXT
1. Parameterize dev-subjective-label.mjs (hardcoded to corpus/dev) to accept --dir/--manifest/--sink so it can label buzzword-heldout into buzzword-heldout-labels.json with the IDENTICAL rubric/prompt/parser. Lead-side plumbing (labeling stays Codex + lead-controlled).
2. Codex-review the v3 fix diff (weights + guard + threshold).
3. Run the held-out labeling (38 pages, Codex).
4. Measure v3 + oracle head-to-head on the labeled fresh held-out (the real precision test).

## Files touched
- (checkpoint beat; v3 in subjective-rendered-scanner.ts + eval/corpus/buzzword-heldout/*, uncommitted)
</content>

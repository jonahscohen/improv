---
name: sidecoach-buzzword-v2-rebuild
description: Stage 5a REBUILD - v1 marketing-buzzword detector collapsed on the frozen-90 (overfit a homogeneous SaaS-marketing dev corpus). Rebuilt with a register-diverse dev corpus (27 new pages, 9 registers, disjoint-verified) + a holistic graded-density redesign. Steps 1-2 done; awaiting lead labeling to calibrate.
type: project
relates_to: [session_2026-06-25_sidecoach-marketing-buzzword-operating-point.md, session_2026-06-24_sidecoach-nested-cards-precision-miss.md]
supersedes: session_2026-06-25_sidecoach-marketing-buzzword-operating-point.md
---

Collaborator: Jonah Cohen. 2026-06-25. Stage 5a builder unit (teammate "buzzword").

## v1 COLLAPSED on the held-out (the milestone did its job)
v1 dev r0.44/p1.0 -> frozen-90 r0.125/p0.25 (1 TP, 3 FP / 8 present; over-fired on a marketing + a product +
an editorial page, missed BOTH explicit marketing pages). Jonah's call: do NOT revert - MAKE IT WORK the rigorous
way (oracle gets r0.5/p0.4, so a lexical approach CAN reach it).

## ROOT CAUSE (self-analysis, per protocol)
The 21-page dev corpus was HOMOGENEOUS (all SaaS-marketing landing pages, 16/21 present, only 5 negatives all of
the same register). The frozen-90 is register-DIVERSE (docs/editorial/dashboard/data/gov + marketing). So v1's
operating point - prominent-scope (>=20px) + tight distinct-cluster - overfit a distribution that doesn't match the
held-out. Two failure modes it produced: (a) too STRICT - missed buzzword pages whose fluff is in body copy <20px;
(b) too LOOSE - fired on pages with a couple of buzzwords in big headings but concrete overall. Worse: I over-forced
prominent-scope from the resend negative (a sample of ONE). The deeper miss: marketing-buzzword is a HOLISTIC "this
copy reads as fluff" gestalt over ALL the copy, not a tight heading cluster.

## REBUILD PLAN (Jonah/lead, develop WITHOUT ever touching the frozen-90)
1. Re-derive from the phenomenon (holistic copy-fluff density).
2. Build a register-DIVERSE dev corpus (disjoint from frozen-90), capture HTML only (author != labeler; lead runs
   the Codex labeling).
3. Redevelop: graded buzzword-density over visible content text + vacuity-weighted taxonomy, threshold calibrated
   to BEAT oracle r0.5/p0.4 on the richer LABELED set (>=15 diverse negatives behind precision).
4. Validate on the richer dev set; freeze on PRINCIPLE + dev signal (no frozen-90 knowledge). Lead runs ONE final
   frozen-90 + Codex review.

## STEPS 1-2 DONE
- Captured 27 NEW register-diverse pages (eval/dev-corpus-capture-diverse.mjs pass 1 networkidle + diverse2.mjs
  pass 2 domcontentloaded+settle for the heavy-SPA failures; MIN_BYTES guard dropped sap/bls stubs). Combined dev
  corpus = 48 pages. dev-corpus-disjoint.test GREEN (48 pages, zero host/content-sha overlap with the frozen 90).
- New registers: marketing(8: monday,asana,airtable,segment,amplitude,gong,twilio,databricks), marketing-ai(3:
  jasper,copyai,scale), marketing-crypto(2: polygon,solana), marketing-enterprise(1: accenture), editorial(3:
  overreacted,arstechnica,martinfowler), docs(3: nextjs-docs,postgres-docs,redis-docs), gov-data(2: census,nasa),
  dashboard(2: flowbite,coreui), product(3: ghost,onepassword,tailscale). The 21 existing = saas-v1.

## v2 REDESIGN (holistic graded density) + EVIDENCE
Model: scope = ALL visible non-peripheral content text EXCLUDING testimonial/quote/review/case-study regions
(social proof != the brand's own copy claims - the principled fix for the resend over-fire, vs v1's blunt
prominent-only). Score = weighted buzzword density = sum(tier weights over matches)/content_words*100. Tiered
vacuity taxonomy: PEAK(3)/STRONG(2)/MILD(1).
Distribution across the 48 pages (densNoTesti) confirms the RIGHT generalization direction (v1 lacked this):
  docs median 0.00, editorial 0.27  (concrete -> LOW, correct)
  marketing-ai 3.39, dashboard 2.43, marketing 2.20, product 2.08  (-> HIGH)
Testimonial exclusion fixes the resend-class: resend densAll 3.80 -> densNoTesti 1.61 (its buzzwords were in
customer testimonials). The mid-range (1.0-2.5) is the hard zone where threshold + taxonomy precision decide.

## OPEN CALIBRATION ITEMS (resolve AFTER the lead labels the 27 new pages)
- Threshold: pick on the LABELED diverse set for r>=0.5 / p>0.4 with >=15 diverse negatives. NOT on the existing 21
  (that's the homogeneous set that overfit) and NEVER on the frozen-90.
- Scope: visible-only vs full-copy. Labeler is TEXTUAL ("judged from the copy"); heavy-SPA captures hide content
  behind collapsed tabs (e.g. scale 1342 raw words but 88 visible), so visible-only may under-count. Calibrate both.
- Taxonomy precision: gov-data scored 1.87 (NASA "groundbreaking/revolutionary" = real science, not marketing) -
  may need down-weighting science/legitimate-superlative terms; MILD tier may pollute concrete product pages.

## STEPS 3-4 DONE (calibration + wiring) - lead labeled 48 pages (~31 present / 17 diverse negatives)
CALIBRATION (eval/buzzword-calibrate.mjs over the labeled 48-page set; densNoTesti sweep):
  thr 0.75: R0.87/P0.77 | thr 1.00: R0.81/P0.81 | thr 1.25: R0.71/P0.85 | thr 1.50: R0.65/P0.83 | thr 2.0: R0.48/P0.94
CHOSEN OPERATING POINT: scope = densNoTesti (visible non-peripheral content text, testimonial-excluded);
taxonomy = PEAK(3)/STRONG(2)/MILD(1); THRESHOLD = density >= 1.0. -> R0.806 / P0.806 over 17 DIVERSE negatives.
WHY 1.0: balanced (R=P=0.806), both axes ~0.3-0.4 ABOVE oracle's r0.5/p0.4 (decisive win on BOTH), and 1.0 is a
PRINCIPLED density (~1 weighted buzzword-point per 100 content words = ~2.5x the concrete-register ceiling of ~0.4,
where docs/editorial/gov cluster). NOT the F1-max recall corner (thr 0.41 R0.97/P0.77) and NOT the precision corner
(thr 2.0 P0.94/R0.48 fails recall) - the lead's explicit guidance (r~0.6/p~0.55 is a real win; r1.0/p0.3 is not).
SCOPE decision: tested visible (densNoTesti) vs full-DOM (densFull). Full-DOM fixes the scale capture artifact
(CSS-hidden hero) but DILUTES genuine positives (twilio 2.20->0.81) - net worse recall. densNoTesti dominates the
trade-off curve. scale stays 1 unavoidable FN (its copy is CSS-hidden in the hermetic render the shipping detector
also uses - faithful limitation, not a bug).
DEV CONFUSION (shipping dist, identical to calibration - no drift): TP=25 FP=6 FN=6 TN=11.
  FP(6): accenture, flowbite, nasa, neon, onepassword, resend (borderline "marketing-ish but labeled concrete").
  FN(6): asana, raycast, scale, solana, supabase, trigger (low-density/sparse-fluff present pages + scale artifact).
TAXONOMY dedup: removed redundant MILD 'seamlessly' (subsumed by PEAK 'seamless(?:ly)?'); no classification flipped.

WIRING: v2 density model REPLACED v1's prominent-cluster block in subjective-rendered-scanner.ts (registry +
RENDERED_BACKED + rendered-checks wiring all intact - rule id polish.marketing-buzzword unchanged). Calibration test
fixtures (subjective-rendered-calibration.test.ts) rewritten for v2 density semantics. rendered-checks fail message
updated (cluster->density). Build clean + generate --check OK + npm test 64 suites/0 failed.

## CODEX FOLD (3 findings) + RE-CALIBRATE on the corrected detector
P1 INTEGRITY (the big one): the calibration harness REIMPLEMENTED the detector (own PEAK/STRONG arrays + own
HTML-based densityOf that diverged from the shipping in-page logic; 'supercharged' duplicated). So the original
R0.81/P0.81 measured a DIFFERENT detector than ships. FIX: extracted the buzzword taxonomy + density math into ONE
self-contained exported `inPageBuzzword()` (returns the SCORE; threshold applied in Node by buzzwordFindingFromScore).
The harness now imports + page.evaluates the SHIPPING inPageBuzzword (deleted its reimplementation). Both render
paths (analyzeHtmlOnBrowserSubjective eval + rendered-live-scan live NL) evaluate inPageBuzzword and merge the
finding via the shared Node threshold. SINGLE SOURCE - harness sweeps exactly what ships.
P1 PRECISION: a single MILD term on a short page hit density>=1.0 (1/40*100=2.5). FIX (principle, not gap-hunt):
QUALIFY guard - a page must have >=1 STRONG/PEAK term OR >=2 distinct terms to fire (effectiveDensity = density if
qualifies else 0). Blocks MILD-only over-fire on held-out short-concrete pages.
P2: the space-consuming regex undercounted adjacent repeats. FIX: non-consuming lookarounds (?<= )(?:pat)(?= ).

RE-CALIBRATION on the corrected single-source detector: thr=1.0 -> R0.806 / P0.806 (TP25 FP6 FN6 TN11, 17 negs) -
the headline numbers HOLD on the actual shipping code. The fixes are correctness/precision-hardening that do NOT
flip any DEV classification (dev concrete pages are long enough that single-mild stays <1.0 anyway), but they protect
the HELD-OUT (a 40-word "modern" page now eff=0 instead of a 2.5 FP) and fix adjacency counting - exactly why they
matter. Threshold 1.0 CONFIRMED on the corrected detector. Verified: harness == production scan (both R0.806/P0.806),
calibration test green, npm run build clean + generate --check OK, npm test 64 suites/0 failed.
Files: subjective-rendered-scanner.ts (inPageBuzzword single source + BUZZ_DENSITY_THRESHOLD + buzzwordFindingFromScore;
buzzword removed from inPageSubjective), rendered-live-scan.ts (evaluate+merge), eval/buzzword-calibrate.mjs (imports
shipping scorer, no reimpl).

## RE-CODEX P0 FOLD (visibility-predicate regression from the extraction)
Re-Codex on the fold found ONE P0: when inPageBuzzword was extracted, its visuallyVisible was WEAKER than
inPageSubjective's - it dropped the hardened sr-only exclusions (1px-overflow `(w<=1||h<=1)&&overflow!=visible`,
`textIndent<=-999`, the `clip: rect(...)` parse, `clipPath: inset(100%/50%)`). So sr-only/clipped/off-screen a11y
text would count toward BOTH the buzzword weight AND the word count -> wrong density on real pages with sr-only text.
FIX: replaced inPageBuzzword's visuallyVisible with inPageSubjective's FULL hardened predicate (verbatim - each
in-page fn is self-contained for page.evaluate, so an identical copy is correct), AND added paintedInvisible
(transparent-fill / alpha<=0.05 text excluded) applied in the scope loop, for parity.
RE-CALIBRATION (hardened): thr=1.0 -> R0.806/P0.806 UNCHANGED at the operating point; precision IMPROVED at higher
thresholds (1.25: P0.85->0.88, one fewer FP - resend dropped 1.61->1.20 once its sr-only/transparent text stopped
counting). Same 6 FP / 6 FN at 1.0. harness == production scan (both R0.806/P0.806). Build clean + generate --check
OK + npm test green + calibration test green + disjoint green.

## HANDOFF
v2 calibrated + Codex-folded (3) + re-Codex P0-folded + wired + green. Reported to the lead for the 3rd Codex pass +
ONE final frozen-90 measure. Frozen-90 NEVER touched; threshold frozen on principle + diverse dev signal.

## Files
- eval/dev-corpus-capture-diverse.mjs, eval/dev-corpus-capture-diverse2.mjs (capture scripts)
- eval/corpus/dev/*.html (+27 new), eval/corpus/dev-manifest.json (48 pages, disjoint-verified)

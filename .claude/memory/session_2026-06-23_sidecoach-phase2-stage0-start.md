---
name: Phase 2 Stage 0 START - Contract-6 oracle comparator stood up + smoke green (non-destructive)
description: Phase 2 authorized after v16 true convergence. Stage 0 (non-destructive) kicked off; first verified deliverable - the eval/ oracle comparator (invokes oracle detect.mjs headless as a pinned dev/eval dependency) + smoke test, GREEN. Remaining Stage 0 work (external corpus, migration harness, power analysis, baseline scorecard) catalogued. HARD CHECKPOINT before any Stage-2 deletion.
type: project
relates_to: [session_2026-06-23_sidecoach-evolution-plan-draft.md, session_2026-06-23_sidecoach-plan-codex-log.md]
---

Collaborator: Jonah Cohen

Phase 2 began after v16 reached TRUE convergence (both Codex levels APPROVE + Jonah's reimplement-and-own foundation + his success bar). Stage 0 is NON-DESTRUCTIVE; nothing deleted.

## Done this increment (verified)
- `sidecoach/eval/oracle-comparator.mjs` - invokes oracle's `detect.mjs` HEADLESS (pinned dev/eval dependency via $SIDECOACH_ORACLE_DETECT or the plugin-cache default; we ship none of its code), parses + normalizes its JSON findings to `{rule, severity, file, line}` for the A1-A4 oracle diff. Handles detect.mjs's exit-2-with-findings + exit-0-clean + unavailable (clean degrade, no throw).
- `sidecoach/eval/smoke-test.mjs` - asserts the oracle runs + emits a normalizable known-defect finding. GREEN: `node eval/smoke-test.mjs` -> "SMOKE PASS: ... gradient-text @ line 9. Comparator ready for A1-A4."
- `sidecoach/eval/fixtures/known-defect/gradient-text.html` - SEED dev fixture (smoke only; not the heldout).
- `sidecoach/eval/README.md` - Contract-6 harness doc: axes A1-A5 + thresholds, comparator CI-split, corpus structure, verbatim-copy guard, Stage 0 checklist.

## NAMED A1 EXTENSION TARGET (lead-confirmed; bank in Stage 2 + the baseline scorecard)
The oracle's static-html gradient-text detection is FORMATTING-SENSITIVE: it flags compact single-line CSS but MISSES the same rule pretty-printed across lines. My first seed fixture (pretty-printed) returned 0 findings; the smoke test caught it. Fixed the seed to the compact form the oracle reliably flags, and logged the limitation in the fixture + README.
Logged as a named A1 EXTENSION TARGET (lead's call): our owned floor must (a) MATCH oracle on formatting variants AND (b) CATCH the pretty-printed cases oracle's regex misses - a concrete "extension capacity"/superiority win to bank in Stage 2 and FEATURE in the baseline scorecard (a real, measurable place where reimplement-and-own beats the oracle on the floor's own turf).

## Remaining Stage 0 (catalogued; mostly external-input-dependent)
- EXTERNALLY SOURCE + FREEZE the corpora (heldout >=40 labeled defects, known-good >=40 real clean designs incl adversarial-borderline, challenge, >=10 briefs) with per-case provenance, labels frozen before rule work, author != labeler. THE BULK; needs real shipped designs - likely human/curation input, not fully automatable.
- Migration harness: golden fixtures of CURRENT outputs (scanner via taste-validator/absolute-ban, BuildReport, reference bundle, routing, convergence) for old/new equivalence diffing (TEMP; sunset Stage 5).
- Power analysis -> LOCK N from pilot/calibration variance; register judge protocol + calibration briefs.
- Baseline scorecard (Sidecoach pieces vs oracle on the frozen corpus).

## Protocol
Non-destructive. No commit yet (lead gates Stage 0; will branch before any commit). HARD CHECKPOINT: PAUSE + report before Stage 2's first destructive deletion. Per-stage: stage-gate result + Codex on the stage diff + lead independent gate before proceeding.

## Branch + commits (lead decided: BRANCH NOW, commit per coherent chunk on the branch)
- Branch `sidecoach-phase2-reimplement` off main (Phase 2 NOT committed to main; merge at clean milestones / per Jonah).
- Commit 8c77f897: eval scaffold (oracle comparator + smoke + seed + README).
- Commit (next): corpus integrity tooling.
- No AI attribution in commits (global rule + hooks); Jonah recorded as collaborator here.

## Corpus integrity TOOLING built + verified (item 3; ready before real designs land)
- `sidecoach/eval/corpus-tool.mjs` - add/freeze/verify. Enforces: labels FROZEN before rule work (sha256 label-hash lock + post-freeze TAMPER detection), AUTHOR != LABELER (a class's rule author may not label that class's cases), PROVENANCE complete (source/date/selector/why) for externally-sourced splits, split integrity. `SIDECOACH_CORPUS_DIR` overridable for tests.
- `sidecoach/eval/corpus-tool.test.mjs` - 7 checks (clean-verify, tamper-detected, author==labeler-rejected, incomplete-provenance-rejected, labelHash order-independent + tamper-sensitive). ALL PASS.
- Does NOT freeze a real corpus - real external designs HELD for Jonah's sourcing decision (independence from BOTH tools is the linchpin; corpus must not be cherry-picked to favor Sidecoach).

## Jonah corpus-sourcing RULING (2026-06-23) + candidate tooling built
Jonah: WEB-SOURCE real shipped designs -> lead+Jonah INDEPENDENCE REVIEW of the FULL candidate set -> prune/approve -> THEN freeze. Rules: real shipped (not AI/either-tool/docs), diverse registers, NO detectability pre-filter, provenance per case (source URL/date/selector/why), capture real HTML/CSS. LABELING INDEPENDENCE: objective defects (contrast) computed from WCAG/CSS spec; subjective (eyebrow/cream-bg/etc.) labeled by a NON-rule-author, frozen BEFORE the extension rules are written. I may source + build tooling but must NOT author subjective ground-truth for rules I'll write - flag which need an independent labeler.
- `sidecoach/eval/corpus-candidate.mjs` BUILT + VERIFIED end-to-end: `capture` (Playwright self-contained snapshot - inlines linked CSS, strips scripts - + provenance), `propose-label` (objective|subjective; subjective-by-rule-author -> needsIndependentLabel flag), `manifest` (full set for the joint review, no favorable subset). Verified: captured example.com -> 560B self-contained HTML the oracle comparator scans; subjective-by-rule-author flagged [NEEDS INDEPENDENT LABELER]; NO detector is run to screen candidates (no pre-filter bias).
- NEXT (gated): bulk web-source >=40 defect + >=40 known-good + >=10 briefs across registers -> present full candidate manifest for the lead+Jonah independence review -> they prune/approve -> Jonah arranges an INDEPENDENT LABELER for subjective classes -> freeze + power analysis + baseline.

## Jonah subjective-labeler RULING + division of labor (2026-06-23) - OPERATIONALIZED + tool-enforced
Independent model (Codex) labels subjective classes; lead runs it + lead/Jonah spot-check; freeze after. To keep author!=labeler airtight, I (rule-author) stay COMPLETELY OUT of subjective labels. Tooling hardened to enforce:
- `corpus-candidate.mjs propose-label` REFUSES `--kind subjective` (architect proposes OBJECTIVE only, labeledBy=spec-math); candidates carry `subjectiveStatus: pending-independent` for the lead-run Codex pass.
- `corpus/rule-authors.json` registers the architect (sidecoach-architect) as rule-author for all 15 subjective classes -> corpus-tool.verify's author!=labeler will REJECT any subjective label with labeledBy=architect at freeze; only labeledBy=codex passes. Tool-enforced independence.
- VERIFIED: objective propose allowed (exit 0); subjective propose REFUSED (exit 1); corpus-tool.test still ALL PASS; rule-authors.json = 15 classes, all arrays.
PIPELINE (Jonah): source/capture/objective-label/flag/manifest (me) -> hand manifest to lead -> joint independence review (lead+Jonah) -> Codex subjective labeling (lead, labeledBy=codex) -> spot-check (lead+Jonah) -> freeze -> THEN I author subjective extension rules against frozen labels I never set. HELD: no subjective rules, no subjective freeze, until the labeler pass runs.

## Sourcing guardrails (Jonah + lead-tightened) - folded; oracle-exclusion TOOL-ENFORCED
Lead independently re-verified the linchpin (ran corpus-tool.test himself; VERIFY-FAIL cases confirm the freeze gate fires). 5 guardrails folded into corpus-candidate + README + plan Contract 6:
1. EXCLUDE the oracle (oracle pages/demos/docs/outputs + rule-designed pages). TOOL-ENFORCED: capture refuses oracle-host URLs (isExcludedSource verified: oracle.style/oracle refused, HN/Stripe allowed); rule-designed pages caught at review.
2. PUBLIC only, NO PII/user-data; app-ui from public demos/showcases/OSS not authed dashboards.
3. respect robots.txt + ToS; no access-control circumvention.
4. DIVERSITY across registers AND quality AND era (source AGAINST us) - recorded as diversity.{quality,era}, audited at review, NOT a defect label.
5. provenance per case incl license/ToS note (provenance.license; captureUtc).
BRIEF COUNT corrected (lead): A5 briefs = POWER-LOCKED N (>=20 floor; target >=20-30) spanning registers + 3 calibration types (oracle-should-win/Sidecoach-should-win/tie), NOT flat >=10. Detector 40+40 confirmed. (Plan Contract 6 already power-governed N; my earlier message's ">=10" was the error, now corrected in README + plan.)
Regression after edits: syntax OK, corpus-tool.test ALL PASS, smoke GREEN, migration harness verify OK.

## Branch commits (cont.)
- 6930adf1 candidate sourcing tooling | d53c7ef5 migration harness scanner goldens | 1c269efe subjective-labeler enforcement | df73929b sourcing guardrails + oracle-exclusion | (next) routing + BuildReport goldens.
- Capture pipeline PROVEN at real-site scale: captured Hacker News -> 42KB self-contained HTML (CSS inlined, scripts stripped), oracle scans it + finds real anti-patterns.

## Migration harness - 3 of 5 subsystem goldens DONE (autonomous batch; lead cleared run-through)
Lead cleared autonomous run-through (surface only at: manifest-at-target | all-5-goldens | blocker | Stage-0-completion). Migration goldens capture CURRENT subsystem outputs (from dist/) so the new modules must reproduce them before deletion (compatibility contract):
- SCANNER (Stage 2): scanner-snapshot.mjs - validateTaste + absolute-ban; 3 inputs; verify idempotent. DONE (d53c7ef5).
- ROUTING (Stage 4): routing-snapshot.mjs - classifyIntent over the 23-case parity corpus (reg=sidecoach-lanes.json + 22 verbs; eligible flag honored); decisions golden; verify idempotent. DONE.
- BUILDREPORT (Stage 3): buildreport-snapshot.mjs - generateBuildReport on fixed FlowExecutionResult fixtures; strips non-deterministic reportId/generatedAt; golden = verdict=blocked/grade=D/3 domains/6 findings; verify idempotent. DONE.
- CONVERGENCE (Stage 3): convergence-snapshot.mjs - pure functions (evaluateBoundary + decideProgress threaded through seedConvergenceState); 3 scenarios: stall->stalled@maxNoProgress=3, honest converge (clean only), progress->converge. verify idempotent. DONE. (Real bug caught by running: results need coverage:{} or aggregateActualRunCoverage throws - fixed.)
- REFERENCE-BUNDLE (Stage 5): reference-snapshot.mjs - gatherReferencePreflightArtifacts on a fixed test-fixtures project; VERIFIED deterministic (identical across runs - local/fallback reference data, no live network); golden = 6 artifacts (component/fonts/motion/icon-source/visual-effects/tilt-lab) + 1 deterministic warning. verify idempotent. DONE.

## MIGRATION HARNESS - all 5/5 subsystem goldens, HARDENED per Codex item-8 (2 BLOCKER + 4 MAJOR folded)
First-pass migration harness got a Codex item-8 review -> 2 BLOCKER + 4 MAJOR (it was too lossy/incomplete/non-hermetic to be a real compatibility contract). All folded + re-verified (all 5 verify OK; eval-integrity regression clean):
- [BLOCKER] convergence used INVALID status 'fail' (enum is clean|findings|inconclusive|error) -> degenerate goldens (iterationStatus 'clean' on a failed scenario). FIX: valid helpers mirroring lane-convergence.test.ts (status 'findings'); recaptured -> stall now iterationStatus=findings, error_running captures validatorErrors.
- [BLOCKER] convergence verify had no producer seam (couldn't exercise the new qa-run). FIX: verify(conv) injection + FULL boundary record snapshot (perValidator/findings/validatorErrors/requiredValidatorRuns/runCoverage/measuredScope + decision).
- [MAJOR] scanner dropped category/message/excerpt/file/matchedText/reason/rewriteOptions + covered only 3/6 bans + 4/7 taste. FIX: full normalized payloads + taste-extra.html (fabricated-svg/large-inline-style/observer-race) + bans-extra.html (glassmorphism/hero-metric/modal) -> all 6 bans + 7 taste classes.
- [MAJOR] routing dropped diagnosticLane/laneScores/schemaVersion (hook consumes them). FIX: snapshot the full Decision.
- [MAJOR] BuildReport missed composite + metric-derived findings/domains (Contract 3 surface). FIX: input composite + a color.contrast-ratio metric -> grade F, 4 domains, 7 findings.
- [MAJOR] reference golden non-hermetic (read os.homedir()/.claude/skills/* mutable state). FIX: redirect os.homedir() to an empty fixture home + sort artifacts/warnings -> deterministic 4 artifacts + 3 warnings, machine-independent.
All 5 (scanner Stage2 / routing Stage4 / buildreport Stage3 / convergence Stage3 / reference Stage5) verify idempotent; each gates its stage's deletion. TEMP harness, sunset Stage 5.

## Codex re-verify (round 2) - 2 NEW producer-seam bugs from the rework, folded
Codex round-2 confirmed all 6 round-1 folds landed, but the rework introduced 2 producer-seam parity bugs (the verify(producer) injection points didn't pass the same context as the default capture):
- [MAJOR] reference verify(producer) called producer outside the hermetic home + unnormalized. FIX: factored withHermeticHome() + normalizeBundle(), applied to BOTH gather() and verify(producer). Probe-verified: injected producer sees homedir = .../hermetic-home.
- [MAJOR] BuildReport verify(producer) passed FLOW_RESULTS (no composite). FIX: one exported BUILDREPORT_INPUT (incl composite) used by both generate() and verify(producer). Probe-verified: injected producer receives composite=composite_craft_qa.
All 5 still verify OK after the seam fixes. Migration harness is now Codex-clean over 2 review rounds (8 findings total folded + re-verified). MIGRATION HARNESS COMPLETE (lead surface criterion 2).

## Codex Stage-0 review (produce-and-verify, Verification Protocol item 8) - 7 findings FOLDED + verified
Independent-model Codex review of the eval scaffold + corpus tooling found 3 BLOCKER + 4 MAJOR - all material; my integrity tooling had real gameability holes (the exact thing it exists to prevent). All folded + re-verified (smoke green incl fail-closed; corpus-tool 11 checks ALL PASS):
- [BLOCKER] oracle errors read as false-clean (detect.mjs warns "cannot access", emits [], exits 0). -> FAIL-CLOSED: pre-check target existence; reject on oracle stderr problem; only code===2 + valid JSON array counts as findings; missing-target smoke case added.
- [BLOCKER] freeze lock bypassable by deleting/moving heldout cases. -> BIJECTION in verify: stale lock, deleted case, split-move (heldout->dev) all detected.
- [BLOCKER] lock froze LABELS only, not the case (file content/split/provenance swappable). -> lock a CANONICAL CASE RECORD (id, split, labels, file path, file-content SHA-256, provenance); verify recomputes -> file-content + record tamper detected.
- [MAJOR] challenge + known-good externally sourced but not frozen (A2 rides known-good, claim rides challenge). -> ALL claim-bearing splits locked; challenge pins cadence + seed.
- [MAJOR] labelHash delimiter collisions ('::'/'|'). -> collision-safe canonical JSON record hash (verified collision-safe + order-independent).
- [MAJOR] author!=labeler optional + exact-string. -> mandatory (every non-'none' class needs a registered author list), normalized (trim+lowercase), multi-author arrays, overlap-fail.
- [MAJOR] normalized findings too lossy for A3 (numeric contrast). -> normalizeFinding now carries contrast {ratio, threshold} + snippet.

## Migration harness item 2 - SCANNER goldens DONE (lead cleared item 2 GO + independently verified the eval foundation)
The lead ran both eval suites himself on the branch (smoke PASS, corpus-tool ALL PASS) = two-level confirmed; cleared item 2 + web-sourcing.
- `sidecoach/eval/migration-harness/scanner-snapshot.mjs` - defines the CURRENT scanner (validateTaste idioms + absolute-ban scanners, imported from dist/), modes capture/verify. The compatibility contract for Stage 2: the new owned scanner must reproduce these goldens before the old modules are deleted. TEMP harness (sunset Stage 5).
- inputs/ (hand-authored, NOT the eval corpus): taste-idioms.html (-> hero-radial-blob, translatey-in-hover, hex-in-interactive, border-radius-inconsistency), absolute-bans.html (-> gradient-text, identical-card-grids, side-stripe-borders), clean.html (-> 0).
- golden/scanner/*.json captured; `verify` idempotent (current == golden). VERIFIED.
- Scanner subsystems are deleted FIRST (Stage 2), so these goldens are correctly prioritized. The other 4 subsystems (BuildReport/reference-bundle/routing/convergence, deleted Stages 3-5) follow.
Codex: this harness + the candidate tooling are deferred to the Stage-0-completion per-stage Codex review (the eval-INTEGRITY sub-unit already got its own mid-stage Codex pass since it was the linchpin).

## Migration harness BLESSED by lead (independent gate) + objective-label tool built
Lead independently gated the migration harness: ran all 5 verifies (idempotent), and PROVED THE SEAM IS LIVE by injecting a bogus producer into scanner+routing (verify failed for bogus, passed for default) - confirms verify exercises the INJECTED new module, not the old one. Harness BLESSED as a genuine compatibility contract.
Then built the last static piece of my corpus pipeline:
- `sidecoach/eval/objective-label.mjs` - clean-room SPEC-MATH labeler (INDEPENDENT of the future scanner) for the OBJECTIVE ground-truth classes. Computes the 10 statically-computable classes (tiny-text, tight-leading, wide-tracking, extreme-negative-tracking, justified-text, all-caps-body, skipped-heading, broken-image, bounce-easing, layout-transition); flags the 4 RENDERED classes (low-contrast, gray-on-color, text-overflow, line-length) as renderedPending (need a Playwright computed-style/box pass, next step - NOT guessed statically).
- `objective-label.test.mjs` - 17 checks (12 positive class detections + 5 no-false-positive clean cases). ALL PASS. (Ground truth must be correct -> the labeler is itself tested.)

## Corpus pipeline status (my part of Jonah's handoff)
source/capture (proven real-site) + objective-label-static (done) + flag-subjective (tool-enforced) + manifest (done). REMAINING toward criterion 1: rendered objective labeler (contrast/render via Playwright) + BULK CAPTURE of >=40 defect + >=40 known-good + >=20-30 briefs across registers/quality/era + label them -> hand the full manifest to lead+Jonah for the joint independence review.

## CORPUS SELECTION-BIAS judgment call NAMED + resolved (rule-agnostic archive sourcing)
Named to lead (per "don't go quiet"): I'm the rule-author AND the URL-selector; the no-pre-filter rule guards LABELS, but my SELECTION of ~90 sites is itself a home-field-tilt bias variable. RESOLUTION (validated + proceeding): source by a RULE-AGNOSTIC method from web.archive.org `id_` snapshots (original HTML, NO wayback chrome - validated gov.uk@2019 -> clean, oracle-scannable, labeler-runs), selected by date-slices/breadth across registers/quality/era (references nothing about our rules), selection-method recorded in provenance for the joint review to audit. Era-diverse + stable + clearly internal-eval + reproducible. Will mix some live public pages for currency, same method. Offered the lead a seed-URL-list alternative.
CAPTURE HARDENED: belt-and-suspenders script strip (DOM removal + final regex) - archive capture now 0 <script> (was 4), still scannable; example.com regression clean. Bulk-ready.

## CAPABILITY READ (lead pressed; answered straight) + 3 mandatory reinforcements DONE
Lead asked: can I web-source at scale, or is the empty corpus a block? Ran a yield test (archive id_ + live, across registers: gov.uk/wikipedia/MIT/example/HN/python.org) -> 6/6 captured, 6/6 with CSS. CAPABILITY CONFIRMED - not a block. Owned the real reason corpus was empty: front-loaded tooling (legit) + circled the selection-bias call instead of committing to the grind. Capture is now my next + only remaining action on my side. (Offered the lead a human seed-URL list as the maximal-independence alternative; proceeding on the approved archive method otherwise.)
3 MANDATORY reinforcements (lead) DONE + verified before bulk:
1. PRE-REGISTERED selection method - eval/corpus/selection-method.md (frozen before any capture): registers, quotas (40 defect + 40 good + 20-30 briefs), mechanical rule-agnostic selection (archive id_ era buckets 2012/2016/2020 + live-current; rule-agnostic domain universe), exclusions, per-case selection-slot provenance. Joint review audits result-against-method.
2. CURRENCY FLOOR - >=50% live 2025-2026 pages per register (taste-currency is testable, corpus must not skew old); exact split in the method.
3. ARCHIVE-VALIDITY CHECK - validateCapture() rejects near-empty / no-substantive-CSS / wayback-error captures so an archival break isn't mislabeled a defect. Verified: real unarchived URL -> REJECTED as wayback error; valid page passes; no-CSS/near-empty rejected.

## FIRST REAL BATCH captured into the corpus (corpus no longer empty)
End-to-end on real cases, into eval/corpus/candidates.json + candidates/*.html:
- 5/6 captured (1 REJECTED by validateCapture - the archive-validity gate working live, not theory): ed_govuk_live, mk_python_live, au_hn_live (live-current 2026) + mk_mit_2012, ed_w3c_2020 (archive id_ era buckets). ~1.1M total.
- OBJECTIVE-labeled by spec-math (architect = objective only): 13 labels (e.g. python.org -> 7: all-caps-body/extreme-negative-tracking/layout-transition/skipped-heading/tight-leading/tiny-text/wide-tracking; w3c@2020 -> 3; mit@2012 -> 2; gov.uk -> 1; HN -> 0). All 5 flagged subjectiveStatus=pending-independent (lead-run Codex pass owns subjective).
- Oracle-scannable confirmed: oracle-comparator on python.org -> 7 findings. The captured pages are real, scannable design source, not inert HTML.
- Full pipeline proven on REAL data: capture -> validity gate (rejects) -> objective spec-math labels -> subjective-flag -> manifest -> oracle diff.

## REGISTER-SKEW friction surfaced (the real bottleneck, named early)
Batch-1 register mix is editorial(2)/marketing(2)/app-ui(1) - skewed. The hard registers (forms, dashboard, product) resist archive/live static capture (auth, SPA/JS-rendered, paywalls). This is the actual friction (not capture capability, which is proven). Probing the hard registers next to get DATA before deciding whether a human seed list is needed for those slots vs. continuing archive/live sourcing.

## SPA EMPTY-SHELL guard added to validateCapture (from the hard-register probe)
Probe found grafana's SPA captured a 16KB empty shell ("Grafana is starting up... Error loading
Grafana", 0 form controls, 2 content els) that the CSS-only validity check WRONGLY PASSED -> an
unrendered shell could be mislabeled a design case (ground-truth poison). Added a tight guard:
(a) SPA_SHELL_RE loading/JS-required/app-error markers on a low-prose (<200B) body -> reject;
(b) structurally-empty (0 content els + <40B prose) -> reject. Verified: grafana shell + empty
mount REJECTED; 4 real hard-register pages (gh-login/bs-forms/bs-dash/bs-pricing) + stripe@2018 +
a minimal-complete example.com-like page (170B prose, 3 els) all PASS. All eval tests green;
batch-1 still valid. Codex item-8 review of this logic change attempted (codex exec output empty -
re-run pending; guard is verified by test in the meantime).

## METHOD AMENDED: defect/good split is LABELER-DETERMINED (lead clarification, integrity-safe)
Lead required before bulk: the architect must NOT eyeball quality to sort defect vs good (reintroduces
selection bias). Amended selection-method.md: defect-bearing iff objective labeler finds >=1 objective
defect, known-good iff 0; source rule-agnostically and let labels fall; reach quota by sourcing MORE,
never cherry-picking; unreachable quota is a FINDING; diversity.quality is an audit marker not the key.

## JUDGMENT CALL / BLOCKER: objective labeler OVER-FIRES (context-blind) - surfaced to lead
Measured the labeler-determined split on 10 real captures (batch-1 + probe): 9 defect-bearing / 1
known-good = 10% known-good yield. Under "known-good iff 0 objective defects" the 40-known-good quota
is near-unreachable AND the labels are WRONG. Confirmed FALSE POSITIVES (context-blindness, evidence):
- gov.uk (GDS gold-standard) flagged tight-leading - but ALL its <1.3 line-heights are on HEADINGS
  (.govuk-heading-xl/l/m/s @ 1.04-1.25), which is CORRECT typography, not a body-leading defect. The
  labeler flags any unitless line-height<1.3 anywhere, ignoring heading-vs-body context.
- bootstrap all-caps-body is a CORRELATION bug: uppercase is on .initialism/.text-uppercase utility
  classes while a long <p> exists elsewhere; the labeler ANDs two unrelated facts.
- layout-transition fires on 6/10 (transitioning width/height is usually intentional, not a defect)
  and likely belongs in the SUBJECTIVE Codex pass, not objective spec-math.
ROOT CAUSE: the v1 labeler conflates "CSS value present" with "defect in context." Objective ground
truth needs SELECTOR/ELEMENT context (body-text vs heading vs label), and some classes (layout-
transition, maybe tiny-text/skipped-heading/bounce-easing) are contextual TASTE calls that belong to
the subjective pass, not objective. FIX PROPOSAL: rewrite objective-label.mjs context-aware (parse CSS
into selector{decls} blocks; scope each rule to the right element class) + re-scope the objective vs
subjective class boundary with the lead. Surfaced as a judgment call BEFORE grinding 90 captures
against bad ground truth (catch-it-small). PAUSED bulk pending lead direction.

## CONTEXT-AWARE labeler fix SHIPPED (bug fix, my lane) + deeper boundary finding
Rewrote objective-label.mjs context-aware: parses CSS into selector{decls} blocks; scopes the three
context-blind classes - tight-leading (body/running text, NOT headings), all-caps-body (uppercase
actually targeting body text, not .text-uppercase/.initialism utilities - drops the v1 correlation
bug), wide-tracking (excluded on caps/label selectors + uppercase blocks, since tracking on all-caps
is correct typography). Context-free classes unchanged. objective-label.test.mjs extended to 27 checks
incl real-page regressions (gov.uk .govuk-heading-xl@1.04 -> no flag; .text-uppercase/.initialism/
.badge -> no all-caps; uppercase eyebrow -> no wide-tracking). ALL PASS. corpus-tool + smoke green.
RESULT on the 10 real captures: all-caps-body + wide-tracking FALSE POSITIVES eliminated (w3c down to
[extreme-negative-tracking]; bootstrap pages down to [layout-transition,skipped-heading]).

DEEPER FINDING (sharpens the judgment call): split still 9 defect / 1 good. Cause is NOT scoping now -
it is FUZZY THRESHOLDS with no crisp spec backing. gov.uk still flags tight-leading because its compact
components use line-height 1.25/1.15 (.gem-c-feedback p @1.15, .govspeak .content @1.25) - ACCEPTABLE
design, not a defect; my <1.3 threshold is too loose. Same for tiny-text (<12px: captions/legal are
common-and-fine), wide-tracking (>0.05em). These typographic-quality classes are TASTE-calibrated, not
WCAG/spec-defined - so they can't cleanly separate defect from acceptable design, which breaks the
known-good/precision (A2) measurement (you can't measure false positives without genuinely-clean pages).
The genuinely CRISP objective classes are the accessibility set: low-contrast (WCAG 1.4.3 ratios),
broken-image, gray-on-color, target-size (WCAG 2.5.8), skipped-heading (1.3.1), justified-text (1.4.8).
RECOMMENDATION (refined, sent to lead): make OBJECTIVE = the crisp accessibility set; move the
taste-typography + motion classes (tight-leading, wide-tracking, tiny-text, extreme-negative-tracking,
all-caps-body, layout-transition, bounce-easing) to the held SUBJECTIVE Codex pass. This maps cleanly
onto the mission: A1-A4 PARITY on accessibility-crisp (oracle's turf), A5 STRICTLY-BETTER on taste
(Sidecoach's turf). Needs lead ruling - it reshapes Contract-6's objective/subjective boundary.

## LEAD RULING received + APPLIED: spec-faithful labeler rewrite
Lead approved the context-aware rewrite + gave the objective-test (a class is OBJECTIVE only if two
spec-faithful impls agree WITHOUT taste; ground each in a public spec) + RULED layout-transition +
bounce-easing -> SUBJECTIVE + set the bidirectional-calibration bar + parallelization (capture is
label-independent; calibration gates labeling/freezing not capture).
APPLIED (objective-label.mjs full rewrite, spec-grounded):
- OBJECTIVE-STATIC (3, all spec-cited + taste-free): broken-image (HTML img valid src), justified-text
  (WCAG 1.4.8 AAA, on body/text-container KEY selector), skipped-heading (WCAG 1.3.1 level jump).
- OBJECTIVE-RENDERED (pending rendered labeler): low-contrast/gray-on-color (WCAG 1.4.3) + the
  typographic-OVERLAP classes tight-leading + extreme-negative-tracking (only spec-faithful as MEASURED
  render overlap, not a static threshold guess - moved off static).
- SUBJECTIVE (held Codex pass, registered to architect in rule-authors.json so freeze rejects me):
  tiny-text, wide-tracking, all-caps-body, layout-transition (RULED), bounce-easing (RULED).
- PARSER (folds Codex item-8 findings): KEY/subject-selector extraction (ancestor context no longer
  drives the decision - fixes .hero p false-neg + .nav li false-pos), CSS comments stripped, @keyframes
  removed, depth-aware selector-list split (commas in :is()/[attr] safe), inline style="" attributed to
  its element TAG (single+double quote). objective-label.test.mjs rewritten -> 27 checks incl those
  exact regressions. ALL PASS.
- BIDIRECTIONAL CALIBRATION (eval/labeler-calibration.mjs) PASSES: (a) gov.uk/w3c/HN gold-standard ->
  0 objective defects (no false positives); (b) planted broken-image/justified-body/skipped-heading ->
  all caught, clean controls silent (no false negatives). gov.uk is now CLEAN (was the headline failure).
- Re-labeled batch-1 with the spec-grounded labeler: gov.uk/HN/w3c -> [] (clean); python.org/mit ->
  [skipped-heading] (TRUE WCAG 1.3.1 skips, verified: python h2->h4, bootstrap h1->h4).
- Codex item-8 on the rewritten labeler: RUNNING (authoritative review of the ground-truth oracle).

## PARALLEL capture batch-2 (label-independent, lead-approved): all registers now covered
Captured 5/5 into the real corpus under capture-time quotas only (no labels until sign-off): gh-login +
bootstrap-forms (forms), bootstrap-dashboard (dashboard), bootstrap-pricing + stripe@2018 (product).
Corpus now 10 cases spanning ALL registers: editorial(2)/marketing(2)/app-ui(1)/forms(2)/dashboard(1)/
product(2). Labels deferred to post-sign-off; capture-time quotas (currency/register/era/validity) only.

## LEAD ADOPTED the spec-crispness boundary + sharpened it + new grading-spec requirement
Lead adopted the boundary, corrected it (extreme-negative-tracking is SUBJECTIVE - "extreme" is a fuzzy
threshold not a spec constant; same logic -> tight-leading also subjective). Refined test: OBJECTIVE only
if the threshold is a SPEC CONSTANT two faithful impls must agree on (4.5:1), not a taste number (1.3).
APPLIED:
- objective-label.mjs: OBJECTIVE_RENDERED narrowed to low-contrast + gray-on-color (WCAG 1.4.3 ratios only);
  tight-leading + extreme-negative-tracking moved to SUBJECTIVE_MOVED (now 7 classes).
- rule-authors.json: added tight-leading + extreme-negative-tracking (22 classes registered: 15 idiom + 7).
- Calibration still passes (gov.uk/w3c/HN 0 FP; planted caught); tests pass.
- eval/README.md: wrote the CONTRACT-6 GRADING SPEC (lead's new requirement - how subjective classes are
  compared vs oracle so "moved to subjective" != "no longer compared"): A5a TASTE-DETECTION head-to-head
  (both detectors vs the SAME Codex subjective labels; deterministic differentiators -> strict-better by
  pass/fail, graded taste -> strict-better by statistical significance; per-commit CI-capable) + A5b
  GENERATIVE head-to-head (blind briefs, judges, CI lower bound>0; A5b uses fresh generation not labels).
  Both must clear. A1-A4 stay the parity floor on objective (spec-math) labels.

## CODEX ITEM-8 on the labeler: STATIC REGEX IS NOT A TRUSTWORTHY REFEREE (blocker-class)
Codex item-8 found (all VERIFIED real, not hallucinated): broken-image/skipped-heading regex scans HTML
COMMENTS (`<!-- <img> -->` flagged); `\bsrc` matches `data-src` so a lazy img with no real src passes
(FN); `\bstyle` matches `data-style` (FP); custom prop `--text-align:justify` triggers justify (FP);
unquoted attrs missed; `>` inside quoted attr truncates the tag scan; and the DEEP one - CASCADE /
SPECIFICITY / INHERITANCE cannot be resolved by regex, so justified-text is not tied to the ACTUALLY
APPLIED style (`.prose{justify}.prose{left}` still flags). The static labeler passes its current narrow
calibration set but FAILS these adversarial cases -> it cannot be the ground-truth referee.
ROOT FIX (recommended to lead): build the OBJECTIVE labeler on the RENDERED pass (Playwright real DOM +
getComputedStyle) - the browser resolves comments/quoting/data-*/cascade/specificity/inheritance/hidden/
ARIA for free. broken-image = img.naturalWidth===0 / no resolvable src; justified-text = computed
text-align==justify on text elements; skipped-heading = DOM h1-h6 + [role=heading] in order, hidden-aware;
+ low-contrast/gray-on-color (computed colors, WCAG 1.4.3). Re-calibrate with Codex's adversarial cases.
The static labeler stays as the prototype that fixed the CLASS SET; the rendered pass is the trustworthy
referee. Surfacing this as a blocker-class finding (lead owns the referee design) before building it.

## SURFACED to lead (awaiting): rendered-labeler recommendation + calibration + grading spec
Sent the lead the full package: boundary applied + rule-authors (22) + grading spec + calibration pass +
Codex item-8 blocker (static not trustworthy) + rendered-labeler rec. Awaiting their call on building it.

## PARALLEL capture batch-3 (label-independent): corpus now 17 cases
Captured 7/8 domain-diverse, rule-agnostic (1 rejected: alistapart@2016 archive missing CSS - validity
gate working): mdn/smashing-style editorial, django/rust OSS marketing, nngroup editorial, bootstrap
album (marketing), apple@2012 + wikipedia@2020 (archive era buckets). Currency floor honored (5 live +
2 archive this batch). Corpus = 17: editorial(5)/marketing(6)/app-ui(1)/forms(2)/dashboard(1)/product(2).
STILL NEEDED (hard registers): more app-ui/dashboard/product/forms - targeted sourcing next batches
(these resist static capture - SPA/authed; lean on static templates + archive era buckets + OSS app demos).

## RENDERED OBJECTIVE LABELER built (lead APPROVED) - terminal referee + 5 reinforcements
Lead approved the rendered pass as the CORRECT TERMINAL referee design (regex can't resolve cascade;
referee must be more reliable than the detectors it grades). Built eval/objective-label-rendered.mjs
(Playwright real DOM + getComputedStyle):
- 5 spec-constant objective classes: broken-image (DOM-parsed src absent/empty - STRUCTURAL, since
  captures keep images external + scripts stripped so load-failure is environment-dependent), justified-
  text (computed text-align==justify on visible text block, WCAG 1.4.8), skipped-heading (a11y-tree
  heading jump incl role=heading/aria-level, WCAG 1.3.1), low-contrast + gray-on-color (WCAG 1.4.3 4.5/3
  with alpha-composited effective bg).
- TWO visibility predicates (a real subtlety): isHidden (VISUAL - for contrast/justify; excludes sr-only/
  off-screen/0x0/text-indent image-replacement) vs isAriaHidden (A11Y-TREE - for headings; excludes only
  display:none/visibility:hidden/aria-hidden, so sr-only landmark headings COUNT - fixed a w3.org false
  skip where off-screen "Site Navigation"/"News" h2s were wrongly dropped).
- R1 DETERMINISM: 1280x800 viewport, animations/transitions zeroed, ALL external requests aborted (render
  from inlined CSS only), srgb; Chromium 148.0.7778.96 pinned+recorded via meta(); the 5 classes are
  font-metric-independent so font determinism doesn't affect labels.
- R3 CONTRAST on non-solid bg: alpha-composite bg-color up the ancestor chain to first opaque layer;
  background-IMAGE before opaque = CONTRAST-INDETERMINATE -> EXCLUDED-WITH-FLAG (never guessed), counted.
- R2 ADVERSARIAL fixtures (Codex item-8) LOCKED as permanent regression: comment-img, data-src lazy,
  --text-align custom-prop, cascade justify->left, sr-only off-screen - all handled correctly.
- R5 FULL BIDIRECTIONAL CALIBRATION PASSES (eval/labeler-calibration-rendered.mjs): (a) gov.uk/w3c/mdn/
  nngroup gold-standard -> 0 objective defects; (b) planted broken-image/justify/skipped-heading/low-
  contrast -> caught, controls silent; (c) all 5 adversarial held. Verified HN gray metadata (3.54:1) +
  django green buttons (2.50:1) are TRUE low-contrast positives (referee works bidirectionally).
- Fixed 2 real FP classes found while calibrating: gov.uk search button (text-indent:-5000px image-
  replacement label) and skip-links/sr-only (off-screen) being contrast-checked.
- R4 Codex item-8 on the rebuilt referee: RUNNING.

## CODEX ITEM-8 (R4) on rendered referee: 13 findings, ALL FOLDED + re-calibrated green
Codex item-8 found 13 real issues (9 P0, 4 P1) on the rendered referee. ALL folded:
- #12/#13 determinism: page SCRIPTS STRIPPED before render (NOT javaScriptEnabled:false - that broke our
  own page.evaluate; first fold attempt hung on gov.uk, caught + corrected to script-stripping).
- #7 alpha compositing: rewritten BACK-TO-FRONT from an opaque base (was child-over-parent w/ forced a=1).
- #1/#9 cumulative ANCESTOR opacity: ~0 -> hidden; 0<op<1 -> contrast-INDETERMINATE (not wrong-math).
- #2 justified-text: BLOCK containers only (inline boxes excluded).
- #3/#5/#10 headings (a11y tree): role=presentation/none strips heading; tokenized role~=heading +
  aria-level; inert subtrees excluded.
- #4 contrast text detection broadened: any element with direct text + input/textarea/select values
  (caught+fixed a follow-on FP: empty icon-BUTTON flagged - buttons now handled only via main-loop direct
  text, icon-only buttons correctly skipped).
- #6 shadow DOM/iframes, #8 positioned-sibling backgrounds, #11 clip-path: DOCUMENTED known limitations
  (conservative/reported, rare in static script-stripped captures); deprecated `clip` zero-rect IS handled.
R2: 9 new adversarial fixtures LOCKED as permanent regression (opacity:0, inline-justify, role=presentation,
role-token heading, stacked-translucent contrast, partial-opacity, inert, JS-noop, code-contrast).
R5 FULL BIDIRECTIONAL CALIBRATION GREEN: gov.uk/w3c/mdn/nngroup -> 0; planted caught; all 14 adversarial held.

## REFEREE SETTLED + LOCKED (lead independently re-verified green post-fold) - RELEASED to bulk grind
Lead re-ran calibration after the 13-finding fold -> green on all 3 axes, no regression; declared the
A1-A4 ground-truth referee LOCKED (no further redesign absent a NEW verified defect). All 5 reinforcements
satisfied + independently verified. (My final Codex confirmation pass still running in background; if it
surfaces a NEW verified defect that's the only thing that reopens the referee.)

## FULL CORPUS labeled by the settled rendered referee (labeledBy=rendered-referee)
Ran all 17 captures through the settled referee -> 10 defect-bearing / 7 known-good (~41% known-good, vs
the broken static labeler's 10%). Real classes: low-contrast / skipped-heading / gray-on-color. High
contrast-indeterminate counts on gradient/image/partial-opacity pages (python 104, mit 98, wikipedia 42)
= the conservative exclude-with-flag methodology working. candidates.json updated with rendered labels +
contrastIndeterminate per case. Subjective labels HELD for lead's Codex pass; NO labels frozen.

## KNOWN-GOOD YIELD finding SURFACED (lead-predicted constraint, now evidenced) - corpus 29
Lead flagged: under crisp a11y rules, genuinely-clean (0 objective defects) real pages are RARE; reaching
40 known-good rule-agnostically may need ~120+ captures OR tempt cherry-picking pristine pages (which
biases the known-good set + undercuts A2 precision). DO NOT cherry-pick; track yield; surface as a finding
if it can't reach 40 good without skewing pristine. EVIDENCE (at 29 captures) confirms BOTH halves:
- Yield = 10/29 = 34% known-good -> ~116 captures to reach 40 good (far beyond the 90 plan).
- Known-good (10) skews PRISTINE: gov.uk/w3c/MDN/rust/nngroup/a11yproject/github/stackoverflow/bootstrap/
  basecamp - all gold-standard/standards/OSS-docs/a11y-focused. NOT representative of the general web.
- Defect classes: low-contrast 15 (dominant), skipped-heading 8, gray-on-color 6, broken-image 1.
  low-contrast is frequently PERIPHERAL chrome (footer/metadata/disabled/brand buttons; cf HN gray
  metadata, nngroup icon-button, django brand buttons), not primary content.
OPTIONS surfaced to lead (rec = B): A) smaller good-N (~20-25) with rationale; B) RECOMMEND - refine
"known-good" = 0 objective defects in PRIMARY CONTENT (ARIA-landmark-scoped: main/article, excluding
nav/footer/aside/header chrome) - raises yield + de-skews + strengthens A2 representativeness; additive
referee enhancement (defect location), keep full-page labels for A1 recall; C) keep 40 but accept ~120
captures (most expensive, still pristine-skewed unless +B). Awaiting lead ruling (definition/target change
is theirs). NOT cherry-picking meanwhile.

## GRIND PROGRESS: corpus 36 (batches 4-6) + confirmation-pass tooling note
Captured + provisionally referee-labeled to 36 cases (25 defect / 11 good, ~31% good yield - the finding
holds). Hard registers filling via static templates (bootstrap sign-in/checkout/product/cheatsheet) +
server-rendered apps (stackoverflow); archive id_ yield low (many rejected for no inlined CSS - validity
gate working). Defect-bearing nearing target (25/40); known-good (11) BLOCKED on the option-B ruling.
By register: editorial d6/g5, marketing d9/g2, app-ui d2/g1, forms d2/g2, dashboard d2/g0, product d4/g1.
CODEX item-8 confirmation pass (supplementary 4th pass on the folded referee) HUNG (MCP transport flake;
1 line output across many turns) - killed. Item-8 mandate already SATISFIED by the real review that found
the 13 findings (all folded, re-calibrated green, lead independently verified + locked). Not a blocker.
NOTE: candidates.json carries a transient `_labeled` flag from batch relabeling - strip before freeze.

## JONAH RULED B - implemented: known-good = PRIMARY-content-clean (landmark-scoped)
Jonah ruled option B. Implemented as an ADDITIVE referee change (full-page labels UNCHANGED):
- landmarkRegion(el): nearest-ancestor landmark; PRIMARY=main/article/role=main; PERIPHERAL=nav/footer/
  aside/header/role=contentinfo|banner|navigation|complementary; else none.
- addDefect(cls,el): records class in full-page labels ALWAYS + in `primary` set only if region=primary.
- primaryContentIdentified: main/article/role=main exists, else EXCLUDE-WITH-FLAG (never guess).
- classifyKnownGood(): knownGood = primaryId && 0 primary defects; defectBearing = >=1 primary defect;
  excluded = no primary region.
- LOAD-BEARING (lead #3): full-page labels stay the A1 recall + A2 precision ground truth; B refines only
  the known-good INCLUSION bucket. A real peripheral defect on a known-good page is a TRUE positive (in
  full-page labels), NEVER an FP. FP = flags MINUS full-page ground truth, corpus-wide.
- Calibration GREEN incl 5 new landmark fixtures (peripheral->known-good, primary->defect, no-primary->
  excluded, and the load-bearing "peripheral defect stays in full-page labels"). Codex item-8 on the
  addition RUNNING.
- Corpus re-labeled under B (n=36): 16 known-good / 11 defect-bearing / 9 excluded-no-primary. Yield among
  ELIGIBLE pages ~59% (vs 31% full-page) -> ~90 total captures reaches 40 good (vs ~116). Cleaned the
  transient _labeled flag from candidates.json.
- Definition + rationale registered in selection-method.md + eval/README.md (pre-freeze, for joint review).
- OBSERVATION (noted for joint review, not blocking): ~25% lack main/article (older/archive) -> excluded ->
  mild modern/semantic skew; deterministic fallback if binding = "primary = NOT in a peripheral landmark".
- CODEX item-8 on the landmark addition: invariant CONFIRMED ("no full-page labels mutation in addDefect").
  Folded its 2 narrower findings: (1) role-matching consistency between landmarkRegion + primaryContentIdentified
  (now share effectiveRoleRegion); (2) explicit ARIA role OVERRIDES implicit tag role (<main role=navigation>
  -> peripheral, <nav role=main> -> primary). 2 role-override calibration fixtures locked; calibration GREEN.
  Re-labeled role-override-aware (same 16/11/9 - current captures use no role overrides; fix is forward-robust).

## EXCLUDED-PAGE DISPOSITION (lead Q) + era-correlation tracking + fallback conditionally pre-approved
Lead asked: are excluded-no-primary pages dropped or retained? ANSWER (from impl): RETAINED in
candidates.json with full record (full-page objectiveLabels, diversity, provenance, subjectiveStatus=
pending-independent); excluded ONLY from the objective good/defect quota; fully available for A5/subjective.
So the MILD case - era-diversity preserved (taste-currency), skew touches only the objective known-good set
(where era barely matters - contrast is era-invariant).
ERA-CORRELATION (n=53): STRONG monotonic - 2012:86% / 2016:50% / 2020:33% / 2026:18% excluded (semantic
<main> common ~2015+). Register spike: dashboard 75% (admin templates use divs not <main>). Overall 30%.
FALLBACK (primary = content NOT in a peripheral landmark; explicit primary still wins) is CONDITIONALLY
PRE-APPROVED by lead on trigger: at the manifest, if exclusion >=25% AND era-correlated (or excluded
dropped). Both currently met, but DECIDE AT MANIFEST on final numbers (not preemptive; RETAINED keeps
severity low). If adopted -> full referee gate (re-calibrate + Codex item-8 + lead re-run).

## CORPUS GRIND STATE (this session): 5 -> 57 captures (batches 1-9)
Under B: known-good 21/40, defect-bearing 19/40, excluded 17 (30%). Archive id_ yield poor for modern
SaaS (external/JS CSS not inlined -> validity-rejected); good yield from gov/docs/OSS/static-templates +
2012-2020 era buckets that inline CSS. Briefs 0/20-30 (A5 - not started). Capture-time quotas honored.

## A5 BRIEFS started (off 0): pre-registered spec + 3 calibration briefs
Stopped deferring briefs (the circling failure mode). Built eval/corpus/briefs/_spec.md (pre-registered):
two buckets - REAL (sourced rule-agnostically, carry the headline A5 claim) vs CALIBRATION (architect-
authored to a fixed neutral template, validate the JUDGES, EXCLUDED from the headline claim). Fixed neutral
template (title/register/audience/goal/required-content/constraints/success-criteria; no tool names).
Authored 3 CALIBRATION briefs to the template (eval/corpus/briefs/*.md + briefs.json): a11y-dominant
(patient intake form), taste-dominant (magazine essay hero), balanced (SaaS feature section). Each
architectAuthored:true + expectedWinnerHypothesis (NOT a label - independent pass sets the label) +
subjectiveStatus=pending-independent + flagged for joint-review scrutiny (the architect-conflict mitigation
the lead required). Real briefs 0/~17-27: sourcing continues (rule-agnostic public briefs/specs/RFPs/
design-system docs across registers).

## FALLBACK ADOPTED (lead pre-approved; trigger firmly met + lead said likely-needed-for-budget)
Adopted the fallback before the manifest (allowed: "at/before"): PRIMARY = explicit main/article/role=main
when present, ELSE content NOT in a peripheral landmark (region 'none' = non-chrome counts as primary);
EXCLUDE-WITH-FLAG only for fully-chrome pages. Referee change: addDefect adds to primary when region!=
peripheral; primaryContentIdentified = exists visible non-peripheral text. Calibration GREEN (added 3
fallback fixtures: no-landmark div=primary->defect, fully-chrome->excluded, no-landmark-clean->good).
Codex item-8 on the fallback RUNNING. Re-classified n=62 under fallback:
  known-good 23/40, defect-bearing 38/40, excluded 1 (was 22/20/20 under B-strict).
The fallback RESCUED dashboard (good1/defect5, was 0/0/5-excluded) + dropped exclusion 32%->~2%. 
NEW BINDING CONSTRAINT (flips back to known-good): the fallback scrutinizes non-chrome divs B-strict
ignored, so known-good yield ~37% (23/62) -> 40 known-good needs ~108 captures (over ~90 budget). Defect-
bearing is ~done (38/40). So at the manifest the KNOWN-GOOD target is the open question - per lead's
pre-sanction, propose smaller good-N with rationale (a11y-clean-primary real pages are rare + skew pristine)
rather than over-source/bias. Surface this at the manifest with final numbers.

## CODEX item-8 on the FALLBACK: 2 findings folded -> referee re-settled under fallback
Codex found 2 real issues: (1) primaryContentIdentified used a hand-maintained tag allowlist that could
disagree with the defect pass -> a page whose only non-chrome content is outside the list (or a broken-image
with no text) got excluded DESPITE a primary defect. FIX: track sawPrimaryContent in the SAME passes as the
defect detector (text/img/form-control, same visibility) + classifyKnownGood eligible = primaryContent OR
primaryDefects>0 (a primary defect always implies eligible). (2) isHidden missed off-screen-RIGHT text ->
all-chrome page with off-right text wrongly eligible. FIX: isHidden excludes r.left>=innerWidth (below-fold
stays in-scope). 3 new calibration fixtures (broken-image-only->defect, form-control-only->known-good,
all-chrome+off-right->excluded); calibration GREEN. Re-classified fallback-v2 n=62: known-good 24/40,
defect-bearing 38/40, excluded 0. Lead independently re-ran the fallback calibration green (their gate half);
Codex item-8 now done + folded -> referee RE-SETTLED under the fallback.

## REAL BRIEFS off 0: 10 extracted (GOV.UK Design System patterns) + source-friction finding
Real-brief sourcing has friction (like SPAs for pages): design-CHALLENGE sites (Frontend Mentor, Daily UI,
uxtools) are JS/login-gated -> not cleanly extractable. VIABLE source proven: design-system PATTERN specs
(server-rendered, real, extractable). Extracted 10 real briefs from GOV.UK Design System patterns verbatim
(title + intro + "When to use" problem sections; EXCLUDED the prescribed "How it works" solution to keep the
brief neutral) + provenance (source URL, OGL, selection-slot "design-system pattern, rule-agnostic by
pattern"), architectAuthored:false. briefs.json now 13 (10 real + 3 calibration).
SKEW finding (mirrors known-good pristine concern): all 10 are FORMS register + ALL GOV.UK source. Diverse
real briefs (marketing/editorial/product/dashboard/app-ui + non-gov sources) need OTHER design systems
(Carbon/Polaris/Material patterns) + public GitHub design-challenge READMEs. Sourcing those next; the
register/source diversity of the real-brief set is a manifest-review consideration (smaller-N or accept
forms-weighted, lead/Jonah call) - flag at the manifest with final brief numbers.

## POWER ANALYSIS RUN (lead-required; good-N is power-governed, not arbitrary) - eval/power-analysis.mjs
Lead clarified: smaller-good-N is NOT pre-sanctioned (Jonah chose B over A=smaller-N); good-N is POWER-
GOVERNED + a JOINT manifest decision. Built + ran the pre-registered power analysis (params frozen before
final numbers: alpha .05; A2 known-good = per-page FP-rate proportion CI, half-width <=0.10, expected rate
0.10 = the A2 floor; A1 recall CI half-width <=0.10 at recall 0.90; A5 briefs floor 20). Wald sizing
N=ceil(z^2 p(1-p)/hw^2). RESULTS:
- known-good (A2): power floor = 35 at expected FP rate (worst-case p=0.5 -> 97). Have 24 -> NEED 11 MORE.
- defect-bearing (A1): 35. Have 38 -> MET (40 was above the floor; 38 suffices).
- briefs real (A5): floor 20. Have 10 -> need 10 more (diverse).
So targets are POWER-GOVERNED 35/35/20, not 40/40. The manifest good-N decision: recommend 35 known-good
(power-met at the A2-floor expected rate) with the worst-case 97 + "clean-primary pages are rare/skew
pristine" tradeoffs presented; Jonah+lead decide. Formula verified by hand (p=.1,hw=.1 -> 34.57->35).
The pre-registered PARAMETERS (the judgment) are what the joint review validates.

## BRIEF DIVERSITY flag (lead, A5-validity) - GOV.UK capped to 3 + spec updated
Lead flagged: 10 GOV.UK briefs = single-source + forms-only + plain-government + (deeper) SOLUTION-IMPLIED
(extracted from patterns with a canonical GOV.UK answer) -> biases the A5 TASTE head-to-head toward a11y-
plain. Correct + important. Action: capped GOV.UK to 3 (addresses/passwords/complete-multiple-tasks, flagged
aestheticStyle=plain/government + caveat), removed 7. _spec.md now requires diversify registers + aesthetic
styles (expressive/branded/minimal/editorial/playful/corporate) from VARIED sources + solution-agnostic
problems (never reverse-engineered from a solution) + cap single-source. briefs.json now 6 (3 real + 3 calib).
OPEN: diverse solution-agnostic real briefs have SOURCING FRICTION (challenge sites JS-gated; design-system
patterns are solution-implied) - surfacing the sourcing-approach decision (real-scrape vs authored-neutral
coverage briefs) to the lead.

## BRIEF FORK RULED (lead): authored-neutral, but COVERAGE briefs CODEX-AUTHORED (not architect)
Lead ruled: authored-neutral over real-scrape APPROVED; good-N power-settled at 35 (no smaller-N decision).
LOAD-BEARING strengthening: the ~17 coverage briefs are the A5b INPUT, so "the Sidecoach author wrote briefs
that favor Sidecoach" is the #1 attack -> they must be CODEX-AUTHORED (independent, no stake), matching
author!=labeler rigor. Mechanics: architect commits a FIXED NEUTRAL gen prompt (auditable, zero
Sidecoach-favorable steering) -> lead reviews the prompt -> Codex authors to it -> lead spot-checks; flag
codexAuthored. The 3 TOOL-AWARE calibration briefs stay architect-authored (tool-awareness is by design for
judge-validation) + independent-reviewed. Keep 3 capped GOV.UK + clean real as realism minority.
DONE: wrote eval/corpus/briefs/_coverage-gen-prompt.md (the fixed prompt: solution-agnostic + no-steering +
neutral template + 5-register x style-range 17-row coverage matrix + audit checklist). Committed + surfaced
to lead for prompt review BEFORE Codex authors (the checkpoint). NOT running Codex until lead approves the prompt.

## PAGE CORPUS POWER FLOORS MET: known-good 37/35, defect-bearing 40/35, excluded 0 (n=77)
After batches 11-12 (docs/well-built + varied-register clean-primary pages), the PAGE corpus hits both
power floors: known-good 37 >= 35, defect-bearing 40 >= 35, excluded 0. PAGE CORPUS COMPLETE (power-governed).
Only BRIEFS remain (6/20: 3 capped-GOV.UK real + 3 calibration) - HELD on the lead's sourcing-fork decision
(real-scrape vs authored-neutral coverage; rec authored-neutral). Once briefs resolve -> the full manifest.

## CODEX AUTHORED the 17 coverage briefs (lead approved the prompt) - briefs at floor
Lead reviewed + APPROVED _coverage-gen-prompt.md (confirmed neutral + balanced AGAINST us, not for us).
Ran Codex (gpt-5.5) to author the 17 coverage briefs to the verbatim prompt; recorded genPromptSha=
f60be108 + codexAuthored:true + provenance.authoredBy=codex on each. Parsed 17 (one per matrix row:
marketing 3/product 3/editorial 3/app-ui 3/forms 2/flex 3). Self-validated: all 8 template fields present
(0 missing); NO technique-prescription leak (no gradient/glass/hex/font in successCriteria/constraints);
aestheticStyle reads as tone (classic-editorial/corporate-trust/expressive/minimal/playful/premium-luxury/
warm-human). briefs.json now 23: 17 coverage (codex) + 3 calibration (architect, tool-aware by design) +
3 real (GOV.UK capped). NON-CALIBRATION = 20 = power floor MET. Surfaced for the lead's spot-check
(neutrality / coverage / tone-not-technique / outcome-based success). Subjective HELD on all.

## MANIFEST-REPORT built (joint-review deliverable) + register-imbalance finding
Built eval/manifest-report.mjs (read-only): the review-ready summary the joint independence review consumes -
pages vs power floors, bucket x register, era coverage, defect-class freq, briefs vs floor, integrity
(single labeler version, provenance complete, all-subjective-held), findings. NEW FINDING surfaced by it:
REGISTER IMBALANCE - editorial 29 (docs-heavy) vs thin app-ui 4 / forms 5 (SPA/auth-gated, resisted
capture). Power floors are on TOTALS (known-good 37/35, defect 40/35 - MET), but per-register spread is
uneven. Joint-review call: accept totals-met with the capture-friction rationale, or source more app-ui/
forms. Flagged in the report. (Era coverage healthy: 2026=55 live-current + 2012-2022 buckets = currency
floor satisfied. Defect classes: low-contrast 38, skipped-heading 29, gray-on-color 16, broken-image 5.)

## LEAD verified pipe end-to-end + harness ROBUSTNESS added (for the 90-call --all run)
Lead independently verified the vision pipe with real codex calls: gov.uk -> 0/22 (all absent, matches the
plain render); python.org -> tiny-text(0.82) present + rest absent, AND correctly called cream-palette ABSENT
despite a yellow accent box (judged DOMINANT palette, not accent) - accurate + nuanced. The lead's
verification labeled gov.uk + python.org (subjectiveStatus=labeled-codex; their labels, in candidates.json -
I leave them untouched/unstaged, the lead owns the labeling).
Before the --all run (90 codex vision calls), added pure-infra ROBUSTNESS to the harness (no label/
independence touch): (1) CONTINUE-ON-ERROR - per-page try/catch, one codex/render failure collects + keeps
going (never aborts the run); (2) --resume - skips pages already subjectiveStatus=labeled-codex (don't re-pay
completed pages); (3) END-OF-RUN SUMMARY - labeled N / skipped(resume) N / failed N + failed ids, with a
re-run hint. VERIFIED: module imports clean; --resume dry-run correctly SKIPPED gov.uk (already labeled-codex).
Committed harness only (candidates.json left unstaged - the lead's in-progress 2/90 labels). Lead runs
`--all --resume` next -> lead+Jonah spot-check -> FREEZE -> baseline scorecard.

## LABELING COMPLETE (lead+Jonah spot-checks PASSED) -> FREEZE + BASELINE SCORECARD (the payoff)
Lead ran the labeling (--all --resume, the robustness worked); 90/90 labeled-codex, 0 failed, all 22 per
page, all labeledBy=codex, no objective-label leak. Lead + Jonah spot-checks BOTH PASSED. Lead directive:
freeze the real corpus + build/run the baseline scorecard (first real Sidecoach-vs-oracle number).
STEP 1 FREEZE: corpus-tool.mjs is manifest.json-based + "does NOT freeze a real corpus" + applies author!=
labeler to ALL labels. Adapting: candidates-aware freeze/verify locking the REAL candidates.json (canonical
record: id, bucket->split, content-sha256 of .html, referee OBJECTIVE labels + codex SUBJECTIVE labels,
provenance). author!=labeler applies to SUBJECTIVE (labeledBy=codex, architect registered -> passes); OBJECTIVE
labels (labeledBy=rendered-referee, spec-math) are LOCKED but EXEMPT from the circularity gate (computed, not
opinion - per corpus-tool's own _note). Then verify->OK + git tag corpus-frozen-v1. NON-destructive (HARD
CHECKPOINT is Stage-2 deletion, not freeze). Committing the labeled candidates.json FIRST (lead instruction).
STEP 2 SCORECARD: build + run baseline - Sidecoach current scanner + oracle (oracle-comparator) on the
frozen corpus; A1-A4 objective (recall/precision/FP vs referee labels, PER-REGISTER, bootstrap CIs) + A5a
taste-detection (vs codex subjective labels); DEFER A5b generative (flag not-yet-run). STEP 3: Codex item-8.

## STEP 2 SCORECARD: collection COMPLETE (90/90) + robustness saga + mapping (lead-gated)
COLLECTION (eval/scorecard-collect.mjs) runs BOTH detectors per frozen page: Sidecoach current scanner
(validateTaste + absolute-ban, via eval/sidecoach-scan.mjs subprocess) + oracle (oracle-comparator).
ROBUSTNESS SAGA (2 real bugs found, both fixed; eval found a real Sidecoach bug before scoring):
- BUG A (mine): oracle-comparator runOracle used execFile -> resolved on stdout-EOF; oracle's Chrome
  grandchild held the pipe open (hang) AND chunked read TRUNCATED stdout (8156/14045 bytes -> "exit 2 but
  not JSON array" on 23 pages = FALSE oracle-unavailable). FIX: runDetached spawns DETACHED, redirects
  stdout/stderr to FILES, resolves on child 'exit' (not EOF), group-kills (kill -pid) on timeout. Verified:
  the 23 now parse (csstricks 30, tailwind 89, vuejs 17, ghlogin 26). The 23 was OUR wrapper artifact, NOT
  oracle - confirmed (lead independently verified oracle 23->0). Fairness preserved BOTH ways.
- BUG B (Sidecoach's own): scanIdenticalCardGrids has CATASTROPHIC-BACKTRACK ReDoS on large HTML (sync hang,
  uninterruptible in-process). FIX (collect): run Sidecoach in a subprocess too (group-kill timeout). The
  ReDoS is a REAL Sidecoach perf deficit = STAGE-2 FIX TARGET + a logged A-axis hazard (the eval working).
- TIMEOUT made GENEROUS + SYMMETRIC (120s both, lead fairness): neither tool cut by an aggressive bound.
- PER-PAGE WALL-TIME captured per tool (lead: the ReDoS must show as a TIMING deficit, not vanish).
FINAL RESULTS (90/90, symmetric 120s): oracle unavailable 0 (fast: median 58ms, max 353ms);
SIDECOACH unavailable 4 (GENUINE - db_datausa/worldbank/kubernetes/github-features exceed even 120s ReDoS)
+ severe slow tail (~28 pages >5s, median 1.2s, max 120s). Sidecoach is ~1000x slower on many pages =
major robustness/perf deficit (Stage-2). Both 0-unavailable counts the lead saw were at a point before the
4 worst ReDoS pages; at 120s, 4 still exceed it (genuine, not artifact).
DATA FINDINGS (logged for the scorecard): Sidecoach produced ~6270 findings but 95% are 2 rules
(hex-in-interactive-state, fabricated-svg) = precision noise (A2 will show it); Sidecoach vocab has ZERO
objective a11y rules -> objective recall ~0 (expected baseline gap; reimplementation's owned WCAG floor fixes).

## MAPPING (rule -> ground-truth-class) - MECHANICAL + SYMMETRIC, lead-gated BEFORE scoring
eval/scorecard-mapping.mjs (committed eval/corpus/scorecard-mapping.json): IDENTICAL algorithm both tools -
normalize (lowercase, strip prefix before '/', strip non-alnum-hyphen), rule maps IFF normalized==class name.
NO synonyms/fuzzy (zero per-tool judgment = the bias vector). Unmapped listed; borderline surfaced for LEAD.
- SIDECOACH 11 rules -> 4 classes (glassmorphism-default, gradient-text, hero-metric-template, side-stripe-
  borders); 7 unmapped (identical-card-grids, modal-as-first-thought, 5 taste/hygiene).
- ORACLE 15 rules -> 9 classes (ai-color-palette, bounce-easing, broken-image, gray-on-color [2 objective],
  dark-glow, gradient-text, layout-transition, marketing-buzzword, numbered-section-markers); 6 unmapped.
- BORDERLINE (lead decides, NOT auto-mapped): oracle:side-tab ~ side-stripe-borders (shared "side").
NO metrics computed until lead approves the mapping. Codex item-8 on the runner (first attempt cut off; re-run).

## CODEX ITEM-8 on the collection runner (2026-06-23, Jonah Cohen) -> FIX-FIRST, 7 findings, ALL folded
Independent gpt-5.x review (codex exec --sandbox read-only) of oracle-comparator/sidecoach-scan/scorecard-
collect/scorecard-mapping. Verdict FIX-FIRST. All 7 legit (several are exactly the fairness/fail-closed risks
that matter most for a head-to-head). Folded ALL:
- [HIGH] oracle env-set-but-missing silently fell back to the cache oracle (ran a DIFFERENT oracle, still
  marked available). FIX: resolveOraclePath fails closed when SIDECOACH_ORACLE_DETECT is set but absent;
  runOracle reports the exact missing path. Why: a wrong-oracle "clean" result is the worst false pass.
- [HIGH] resume guard treated a record complete if only sidecoachAvailable!==undefined -> stale/partial
  records skipped, unavailable counts could drift. FIX: COLLECTOR_VERSION=2 + corpusSha (page content hash)
  + both-flags-boolean + both-arrays + both-Ms-number all required to resume; else re-run.
- [HIGH] Sidecoach stdout used bare JSON.parse while oracle used safeJsonArray (Array.isArray) = ASYMMETRY
  (non-array JSON could mark Sidecoach available). FIX: require Array.isArray for Sidecoach too (symmetric fail-closed).
- [MEDIUM] Sidecoach always ran first -> oracle got warm FS/module cache every page = biased wall-time. FIX:
  ALTERNATE detector order per page (idx%2) + performance.now() + record firstTool. (Order-warmth is a few ms;
  can't explain the 20x-1000x gap, but makes the timing defensible.) -> requires a --force re-collect.
- [MEDIUM] mapping read every *.json in cache, not the frozen manifest -> stale files could pollute. FIX:
  iterate candidates.json ids exactly; missing=fail-loud, extra=warn-ignore.
- [MEDIUM] normalize() not punctuation-neutral (kept hyphens, dropped underscores/spaces) = favored hyphen-
  convention tools = a BIAS VECTOR. FIX: canon() splits camelCase + tokenizes on ALL non-alnum separators,
  applied IDENTICALLY to rule AND class names. (This is the exact neutrality the lead flagged.)
- [LOW] runDetached leaked /tmp/orc-* dirs (only files unlinked). FIX: rmSync(dir,{recursive,force}).
Re-collect (--force, schema v2 + alternating order) running; then re-run mapping + re-verify numbers + a
SECOND Codex pass to confirm the fixes cleared, THEN surface to lead. Files: eval/oracle-comparator.mjs,
eval/scorecard-collect.mjs, eval/scorecard-mapping.mjs, eval/.gitignore.

## CODEX ITEM-8 PASS 2 (2026-06-23, Jonah Cohen) -> 7/7 prior RESOLVED + 4 NEW, ALL folded
Second independent pass confirmed all 7 pass-1 fixes RESOLVED (not papered), found 4 NEW (produce-and-verify
loop working). Folded ALL:
- [HIGH] a GLOBALLY unresolvable oracle would cache oracleAvailable:false on all 90 and resume would
  accept it = config error masquerading as 90 genuine unavailables. FIX: preflight resolveOraclePath() ONCE
  before the loop; abort (no cache writes) on config failure -> per-page unavailables are now always genuine.
- [HIGH] mapping validated only cache FILENAMES, not schema/version/content-hash -> a stale same-id file
  could feed the vocab. FIX: new eval/scorecard-shared.mjs (COLLECTOR_VERSION + sha256 + isCompleteRecord)
  used by BOTH collect (--resume) AND mapping (record validation) so they can NEVER disagree; mapping now
  recomputes corpusSha per candidate file + fails loud on any stale/incomplete record.
- [MEDIUM] oracle stderr failed closed but Sidecoach stderr was IGNORED on exit 0 = asymmetry. FIX: export
  stderrLooksProblematic() from oracle-comparator; apply to BOTH. Verified both subprocesses emit EMPTY
  stderr on a clean scan (no benign-warning false-flags). 
- [NIT] dead execFile/execFileP/promisify after the runDetached switch. FIX: removed.
All re-syntax-checked + smoke GREEN. Authoritative --force re-collect (fully-hardened collector) running ->
mapping -> SEMANTIC PASS -> 3rd Codex pass -> commit -> surface. Files: eval/scorecard-shared.mjs (NEW),
eval/oracle-comparator.mjs, eval/scorecard-collect.mjs, eval/scorecard-mapping.mjs.

## SEMANTIC PASS (lead-mandated 2026-06-23, Jonah Cohen) - name-lineage bias mitigation
LEAD CAUGHT a structural bias: the algorithm is approved (neutral, oracle maps MORE classes 9 vs 4), but
the SUBJECTIVE GT class NAMES share lineage with Sidecoach's taste vocab, so exact-NAME-match silently
credits Sidecoach when oracle detects the SAME idiom under a DIFFERENT name (live: side-stripe-borders
maps for us; oracle's border-accent-on-rounded - arguably same idiom - stays unmapped). Objective classes
are spec-named (neutral) + we have 0 objective rules anyway, so the tilt is subjective-only (~1 class, A5a).
FIX (lead): keep exact-match as the floor; add a SYMMETRIC SEMANTIC pass over UNMAPPED rules of BOTH tools,
run by CODEX (independent - not architect/lead, both bias-prone). Built eval/scorecard-semantic-pass.mjs +
eval/corpus/rule-descriptions.json (each tool's OWN source-cited self-description of its unmapped rules).
IDENTICAL tool-agnostic prompt per rule (namespace prefix stripped so Codex is blind to tool lineage);
Codex returns matchedClass|null + confidence + reasoning; confirmed -> semantic map, rest stay unmapped.
Lead reviews the semantic-pass result BEFORE scoring. Document name-lineage + mitigation in the scorecard.

## SEMANTIC PASS RESULT (lead-APPROVED all 13, 2026-06-24) + scorecard merge
Codex ran 13 rules: 3 matches, 10 null, 0 errors. Matches (lead verified each vs rule defs, APPROVED):
- oracle:side-tab -> side-stripe-borders (high) - Codex MATCH; lead had leaned NO (misread the NAME as a
  nav tab), Codex had the DESCRIPTION ("thick colored border on one side of a card") + got it right. Lead
  dropped the NO. THIS is why we used an independent Codex pass - it kept the lead's misread out of the result.
- oracle:border-accent-on-rounded -> side-stripe-borders (medium) - the predicted bias case; corrects
  oracle's under-credit under exact-match.
- sidecoach:identical-card-grids -> icon-tile-stack (high) - the Sidecoach-favorable one; lead verified our
  rule IS icon-led; broader-vs-specific worry handled by PRECISION (over-fire counts against us, not free credit).
NEUTRALITY confirmed: pass net-corrected toward ORACLE (2 of 3 matches), zero Sidecoach-favorable bias.
EFFECTIVE MAPPING: sidecoach 5 classes, oracle 10. Folded into scorecard-mapping.json (effectiveMapping +
semanticPass verdicts + borderline resolved). MAPPING APPROVED by lead.

## CODEX ITEM-8 PASS 3 + PASS 4 (convergence) on collector + semantic + mapping - ALL folded
Pass3: 7/7 + 4/4 prior RESOLVED, found 3 NEW (all HIGH, all folded): (1) only oracle had global preflight ->
added SYMMETRIC Sidecoach preflight; (2) semantic pass wrote Codex errors as matchedClass:null+exit0 (mapping
silently dropped) -> fail nonzero + no OUT on error/partial, mapping requires full coverage+0 errors; (3)
semantic parser concatenated stdout+stderr/ignored exit -> status0+stdout-only+schema-validate.
Pass4: preflight #1 RESOLVED; found the prior 3 needed MORE depth + 3 NEW (all HIGH, all folded): oracle
preflight must SMOKE-RUN (not just path-exists) -> both tools now smoke-run one fixture; --rule must exit
nonzero; parser must require the FINAL stdout line to be the JSON (no backward scan); mapping must FULLY
validate the semantic artifact (length==worklist, unique keys, no extra/missing, errors empty, per-verdict
schema). All folded + re-verified. CRITICAL: none of pass3/pass4's findings changed the DATA or the
lead-approved VERDICTS - all are fail-closed depth on NON-triggering paths (oracle ran on all 90; Sidecoach
globally fine; semantic artifact complete+approved). New shared module eval/scorecard-shared.mjs.

## BASELINE SCORECARD COMPUTED (eval/scorecard-score.mjs -> corpus/scorecard.json), 2026-06-24
A1/A2 overall (R/P): sidecoach obj 0.000/n-a, subj 0.037/0.200, overall 0.025/0.200; oracle obj
0.063/0.545, subj 0.282/0.312, overall 0.208/0.326. A5a taste: oracle clearly ahead. A2 known-good FP:
sidecoach 17 class-FP but 2562 raw (99% UNMAPPED noise) ; oracle 58 class-FP, 635 raw (24% unmapped).
Volume: sidecoach 6757 raw 99% unmapped (hex-in-interactive-state + fabricated-svg) ; oracle 1131 raw.
Timing: sidecoach median 1157ms / p90 41.8s / max 120s / 30 pages >5s ; oracle median 58 / p90 79 / max
138ms. Unavailable: sc 4 (ReDoS) / imp 0. Paired bootstrap (sc-imp): subj recall -0.245 [-0.306,-0.184] SIG,
overall recall -0.183 [-0.22,-0.148] SIG, precision diffs NS. HONEST baseline: Sidecoach far behind on recall
+ timing + objective; the expected pre-reimplementation gap.
Scoring math VERIFIED correct (broken-image R=1.0 P=1.0; recall denom=present incl unavailable-as-FN; precision
denom=detections; unmapped findings excluded from class TP/FP + reported as raw/unmapped-share noise; paired
page-bootstrap B=2000 percentile CI).
CODEX ITEM-8 on scoring (1 pass): math confirmed CORRECT + SYMMETRIC + bootstrap genuinely paired; 6 findings
folded - (1) reuse isCompleteRecord cache guard; (2) assert cache vocab==mapping vocab (a post-mapping noisy
rule can't be silently dropped to flatter us); (3) label known-good FP available-only + expose avail/unavail KG
denominators; (4) report OBSERVED bootstrap point estimate not the random resample mean; (5) skip null-metric
bootstrap replicates (no 0-coercion); (6) seeded PRNG + interpolated quantile (reproducible). Re-ran: numbers
identical (math unchanged), CIs now deterministic. FINAL consolidated Codex confirm: GROUP A (collector) +
GROUP B (scoring) RESOLVED, no remaining findings, VERDICT SHIP.
COMMITTED bcf601d (branch sidecoach-phase2-reimplement, author Jonah, no AI attribution; cache gitignored).

## JONAH RULED C (2026-06-24): keep static head-to-head + add oracle BROWSER-mode objective CEILING
The static-vs-static scorecard stays the HEADLINE (committed). ADD a SEPARATE, clearly-labeled reference:
oracle's FULL browser-mode recall on OBJECTIVE classes (low-contrast, skipped-heading, etc.) vs the
rendered referee labels = "the real floor bar" the reimplemented browser-based Sidecoach must clear (so the
mission's objective floor is honest, not the handicapped static 0.063). NOT mixed into the paired comparison.
HOW (feasibility proven on 1 page: mk_python_live browser-mode emitted low-contrast=7 vs 0 static):
- oracle's browser engine only fires for http(s):// targets -> serve corpus over localhost + run
  detect.mjs --json <url> per page (one Chrome/page = isolation + group-kill on hang).
- oracle needs Puppeteer (not Playwright). Installed puppeteer (PUPPETEER_SKIP_DOWNLOAD) into the PLUGIN's
  node_modules (eval-time only; running the oracle, NOT vendoring its code) + pointed it at Playwright's
  already-installed Chromium via PUPPETEER_EXECUTABLE_PATH (no 2nd browser download).
- eval/scorecard-browser-ceiling.mjs: serve + per-page browser-mode (180s group-kill), fail-closed, resume
  via .ceiling-cache (gitignored), objective recall vs referee -> corpus/scorecard-browser-ceiling.json.
Ceiling run in progress (~30-60min, 90 pages browser mode). THEN: Codex item-8 on the ceiling harness, fold,
commit (ceiling code + json), surface full scorecard + ceiling for lead's independent verification.

## CEILING run#1 + Codex review -> FIX-FIRST (6), folded; honest views added; --force re-run
Run#1 result: strict per-class micro 0.621 (59/95). Per-class revealed TWO artifacts: broken-image 0/5 (browser
engine does NOT emit broken-image - it is a STATIC-engine rule; static head-to-head R=1.0) + gray-on-color 0/17
(browser FOLDS gray-on-color INTO low-contrast: emitted 404 low-contrast vs 13 gray-on-color). skipped-heading
32/32=1.0, low-contrast 27/41=0.659. So strict 0.621 UNDERSTATES (broken-image wrongly in browser denom +
gray-on-color double-counts contrast). HONEST views computed: contrast-family (low-contrast OR gray-on-color)
27/41=0.659; full-objective ceiling = browser(skipped-heading + contrast-family) + static broken-image =
64/78=0.821. THE REAL FLOOR BAR ~0.82 vs static 0.063.
CODEX ITEM-8 on ceiling harness: core recall math CORRECT; 6 findings folded - [BLOCKER] stderr ignored on
exit 0/2 (a caught browser error emits [] exit 0 = false clean) -> use stderrLooksProblematic; [HIGH] resume
validated prev.findings but wrote rules/objectiveDetected (never reused + could misscore) -> isCompleteCeilingRecord;
[HIGH] oracle saw RAW page (scripts+external) while referee labeled SCRIPT-STRIPPED+external-aborted ->
serve a transform matching the referee (strip <script> + external <link>); [MEDIUM] cache lacked version/oracle/
chromium metadata -> envSig (CEILING_CACHE_VERSION+oracleSha+chromiumPath+objectiveHash); [LOW] bind 127.0.0.1
+ safe decodeURIComponent; [LOW] try/finally server close. Transform change => --force re-run (number may shift).
Added honest views (strict + contrast-family + full-objective ceiling) to scorecard-browser-ceiling.json.

## CEILING FINAL (committed 84b7829c, 2026-06-24) - SHIP
--force re-run (referee-matched transform): strict per-class micro 0.632 (60/95); skipped-heading 1.0,
low-contrast 0.683, gray-on-color 0 (folded into low-contrast by browser), broken-image 0 (STATIC-engine rule,
not browser). HONEST full-objective ceiling 0.833 (65/78) = browser(skipped-heading + contrast-family 0.683) +
static broken-image(1.0). 1 page unavailable (mk_mailchimp_2016 nav timeout, fail-closed = FN, honest). vs
static 0.063 = ~13x. comparisonNote documents broken-image (static-engine + no relative img resolves over the
server = not a capability gap; strict 0.632 conservatively understates; 0.833 is the real floor bar).
2nd Codex confirm: all 6 folds RESOLVED, NO overstatement (broken-image labeled static, contrast-family page-
level not double-counted, justified-text 0 present so omission doesn't inflate, 65/78=0.833 verified) -> SHIP.
COMMITTED 84b7829c (Jonah, no attribution; .ceiling-cache gitignored).
STAGE 0 BASELINE COMPLETE: static-vs-static head-to-head (scorecard.json, lead-recomputed/verified, commit
bcf601d) + oracle browser-mode objective CEILING reference (0.632 strict / 0.833 honest, commit 84b7829c).
Puppeteer installed eval-time in plugin node_modules (PUPPETEER_EXECUTABLE_PATH -> Playwright Chromium); that
is ephemeral eval setup, not committed. Surfaced to lead for handoff to Jonah.

## STAGE 0 CLOSED - lead-verified end-to-end, handed to Jonah (2026-06-24)
Lead independently RECOMPUTED both: headline subjective recall (sidecoach 7/188=0.037, oracle 53/188=0.282,
exact match) AND the ceiling construction (strict 0.632=60/95 per-class sum; honest 0.833=65/78 with -17
gray-on-color folded into contrast-family + +5 static broken-image, both principled). Both verification gates
passed: lead's from-scratch recompute + 8 independent Codex item-8 passes (referee 3 earlier + collector 4 +
scoring 1 + scoring-confirm 1 + ceiling 2). Baseline is committed, Codex-verified, ungameable.
DELIVERED: static-vs-static head-to-head (bcf601d) showing Sidecoach far behind on recall (sig)/timing(~20x)/
objective(0), + the true 0.833 browser-mode objective CEILING (84b7829c) = the real floor bar Jonah's C ruling
revealed. Lead handed to Jonah. STAGE 0 COMPLETE. Stand down on the baseline; Stage 1 (the reimplementation
climb: REIMPLEMENT-AND-OWN, beat oracle on every trailing dimension AND be simpler) is the next chapter
when Jonah calls it. The honest targets are now on record: close the recall gap, fix the ReDoS timing deficit,
add the objective a11y floor (clear ~0.83), all while staying simpler than oracle.
Surfaced full scorecard (overall + per-register + A3 + A4 + A5a + timing + unavailable + paired CIs) to lead
for FINAL verification. Per-register: oracle leads recall in ALL 6 registers; Sidecoach's only precision
wins (marketing 0.500, app-ui 0.400) ride on tiny detection counts. OPEN GATES: lead's final verification +
the mode ruling (A static-vs-static committed w/ caveat, vs C add browser-mode objective-ceiling reference).

## METHODOLOGICAL FINDING surfaced to lead (judgment call, 2026-06-24) - oracle STATIC vs BROWSER mode
The oracle runs oracle via detect.mjs --json = STATIC engines (regex + static-html) only; in that mode
oracle emits ZERO low-contrast + ZERO skipped-heading (those need its BROWSER/visual-contrast engine,
not invoked by --json). The rendered referee labels them from real DOM (41 low-contrast, 32 skipped-heading
present). So oracle's 0.063 objective recall is a STATIC-MODE artifact, NOT weakness. Both tools run
static = fair static-vs-static, but it UNDERSTATES oracle's true power. Surfaced 3 options: A keep
static-vs-static + loud caveat (architect lean), B re-collect oracle browser mode (asymmetric, rework),
C hybrid = static head-to-head + a one-sided oracle browser-mode objective-ceiling reference. AWAITING
lead ruling before finalizing. Files this session: eval/scorecard-shared.mjs, scorecard-collect.mjs,
scorecard-mapping.mjs, scorecard-semantic-pass.mjs, scorecard-score.mjs, oracle-comparator.mjs,
corpus/rule-descriptions.json, corpus/scorecard-mapping.json, corpus/scorecard-semantic-pass.json, corpus/scorecard.json.

## STEP 1 FREEZE DONE + verified + tamper-proven -> corpus-frozen-v1
Added candidates-aware freeze/verify to corpus-tool.mjs (additive - existing manifest freeze/verify + its
11-check test still GREEN). freeze-candidates locked 90 pages + 23 briefs -> lock-candidates.json (canonical
record per page: id, bucket->split [known-good->known-good, defect-bearing->heldout], content-sha256 of .html,
sorted REFEREE objective labels + sorted CODEX subjective labels, primaryDefects, provenance). verify-candidates
OK: provenance complete, SUBJECTIVE author!=labeler (labeledBy=codex vs architect-registered -> passes),
OBJECTIVE spec-math LOCKED but EXEMPT from the circularity gate (asserted not architect-labeled), bijection +
canonical-record + content-sha integrity. TAMPER-PROVEN: flipping one subjective label -> verify FAIL ("LOCKED
RECORD TAMPERED"); restore -> OK. Non-destructive (Stage-2 deletion checkpoint unaffected). Tagging corpus-frozen-v1.

## VISION step added to the labeling pipe + VERIFIED (lead decided: screenshot REQUIRED)
Lead finalized the rubric (sign-off + LABELING SIGNAL section: 18 visual classes -> SCREENSHOT primary,
2 textual -> page TEXT, 2 motion -> markup motion declarations) and decided my open choice: screenshot is
REQUIRED (judging visual idioms from CSS text = the mentally-render unreliability we rebuilt the objective
labeler to avoid). Implemented + verified:
- codex exec supports `-i <image>` (prompt via STDIN) = vision-capable + same independent model family (GPT,
  not Claude) -> satisfies Jonah's independent-model ruling AND the vision requirement. No separate API path needed.
- VISION VERIFIED (lead-required, on known cases, NO labels recorded): synthetic obvious page (cream bg +
  gradient headline) -> gradient-text TRUE + cream-palette TRUE; synthetic plain page -> both FALSE; real
  corpus gov.uk (known-plain) -> codex returned all 22 classes, ALL absent with sensible notes ("Text uses
  solid colors", "White and GOV.UK blue dominate"). Codex genuinely SEES the screenshot + judges from it.
- Harness updated: renderScreenshot (deterministic full-page PNG via Playwright, script-stripped, anim-off,
  1280 viewport) -> codex `-i` (stdin prompt); prompt embeds per-class SIGNAL tag + page TEXT (textual) +
  MOTION declarations (motion). method tag now 'screenshot-vision+text+motion'. Records labeledBy=codex +
  rubricSha + screenshot + signal. Screenshots in .shots/ (gitignored, regenerated deterministically).
- INTEGRITY held: 0 pages labeled (90/90 still pending-independent); I produced ZERO ground-truth labels
  (verification runs printed + discarded, never recordLabels). Dry-run + the verification are the only runs.
Surfaced for lead final check; then the LEAD runs `node eval/subjective-label-harness.mjs --all`.

## SUBJECTIVE-LABELING PIPE built (architect = infra only; lead runs the labels)
Joint review COMPLETE (lead verified the top-up independently; representativeness good - non-editorial clean
from DIVERSE dev/SaaS sources, not just gov; documented the mild well-built-source residual; per-register A2
kept). Next step is the LEAD's Codex subjective-labeling pass; my part is the PIPE, not the labels:
- eval/corpus/subjective-rubric.md (DRAFT, lead-owned): neutral DESCRIPTIVE definitions of all 22 held classes
  (15 idioms + 7 typographic/motion) - what each idiom IS per common design understanding, explicitly NOT
  detection logic (no thresholds/properties/selectors - rubric==rules would be circular since labels are the
  ground truth the rules are measured against). Lead finalizes + rewrites anything that reads like a rule.
- eval/subjective-label-harness.mjs (the pipe): reads the captured HTML + rubric, builds a reproducible Codex
  invocation per page (codex reads the page file + neutral class descriptions, outputs per-class present/absent
  JSON), parses, records labeledBy=codex + rubricSha + model into candidates.json. GUARD: records labeledBy=
  codex ONLY (architect can't self-label); --dry-run for architect pipe-verification (no labels produced).
Dry-run VERIFIED: rubricInfo extracts all 22 classes; invocation builds correctly; DID NOT run real labeling.
Same pattern as the brief-gen prompt: committed harness + draft rubric -> SURFACE for lead review -> lead
finalizes rubric + RUNS the Codex labeling through the harness. I do NOT label anything.

## JOINT REVIEW: Jonah ruled HYBRID -> bounded top-up DONE, manifest FREEZE-READY (n=90)
Joint review outcome: Jonah ruled HYBRID on register imbalance (top-up thin known-good registers to ~4
each, then per-register-report the residual); lead's independence audit passed (imbalance = sourcing-
difficulty, not tilt). Implemented: re-balance had already brought forms 5 + app-ui 4 to floor; only
dashboard (3) was below. Bounded clean-dashboard attempt (cap 6, 5 captured) -> gov-transparency + cdc-data
clean -> dashboard known-good 3->5 (the 3 data dashboards w/ contrast issues correctly -> defect-bearing).
ALL registers now >= 4 known-good (editorial 19, marketing 8, product 6, forms 5, dashboard 5, app-ui 4) -
floor MET, NO residual to document. manifest-report regenerated: pages 90 (kg 47/35, db 43/35 MET, exc 0);
A2 per-register min 4, editorial 40% (was 51%), notEditorialOnly TRUE; broken-image n=5 diagnostic-only;
briefs 23 floor MET; integrity green (all-HELD, provenance complete, single locked labeler). MANIFEST FREEZE-READY.
Reconcile already clean (85->90 now after the top-up; 0 dupes/strays/orphans). HOLDING: no freeze, no
subjective labeling - the lead's Codex subjective-labeling pass -> lead+Jonah spot-check -> FREEZE -> scorecard.

## LEAD SPOT-CHECK PASSED + manifest REVIEW-READY -> joint review (lead+Jonah) in progress; I HOLD
Lead's brief spot-check PASSED (deep-read 5 riskiest styles + grepped all 17, zero technique/tool/idiom/hex
leaks; aestheticStyle stayed brand-tone; success outcome-based; reproducible). Integrity audit clean
(n=85, all subjective HELD, provenance complete, single locked labeler, nothing frozen). Lead is taking it
to the joint independence review with Jonah. INSTRUCTION: HOLD - do NOT freeze, do NOT run subjective
labeling (both wait for the joint review + the lead's Codex subjective-labeling pass).
RECONCILE (lead minor ask): candidates.json 85 vs an earlier report's 77 -> CONSISTENT. The 77 was a STALE
pre-re-balance snapshot; +8 = the known-good re-balance batch (77->85). Verified: 85 records, 0 dupes, 0
strays, 0 orphan files, 85 html on disk, 45 known-good + 40 defect = 85, report.pages.total=85. No fix needed.

## LEAD 3-POINT pre-review fixes DONE -> manifest review-ready (n=85 pages + 23 briefs)
Lead required 3 before review-ready: (1) Codex briefs - DONE (17 coverage authored, their snapshot was stale).
(2) KNOWN-GOOD re-balance: was 51% editorial (forms 2/dash 1/app-ui 1) -> A2 would be editorial-only. Sourced
clean gov/accessible/w3c forms+app-ui+dashboard (8 captured) -> known-good now 45: editorial 19 (42%),
marketing 8, product 6, forms 5, app-ui 4, dashboard 3 - ALL registers >=3, a2NotEditorialOnly=TRUE (the
lead bar; clean non-editorial pages rare but gov/accessible sources yielded). (3) THIN-SPOT diagnostics in
the report: broken-image n=5 -> DIAGNOSTIC-ONLY for A1 recall (real pages rarely have broken images);
era 74% 2026 -> archive buckets thin, flagged for A5a. manifest-report.mjs enhanced: a2Representativeness
(per-register known-good + editorial share + min + not-editorial-only), a1ClassPower (diagnostic-only <8),
eraCoverage - teed up explicitly for the joint review (not buried).
FINAL: pages 85 (kg 45/35, db 40/35 MET, exc 0); briefs 23 (17 coverage + 3 calib + 3 real, floor MET);
integrity green (single labeler, provenance complete, subjective all-HELD). Manifest COMPLETE + review-ready.

## CORPUS GRIND (this session): 5 -> 77 page captures + 6 briefs (power-governed targets 35/35/20)
Pages under fallback-v2: known-good 37/35 (MET), defect-bearing 40/35 (MET), excluded 0. Briefs: 3 real
(GOV.UK forms, capped) + 3 calibration; real target >=20 (need ~14 more, DIVERSE - HELD on lead sourcing fork).
KNOWN-GOOD COMPOSITION SKEW (manifest consideration): the +8 known-good from batch-11 are docs/well-built
pages (react/tailwind/mdn/web.dev/svelte/stripe docs) -> known-good skews docs/quality-source. This is the
pristine-skew tradeoff (clean-primary pages are rare + cluster in well-built sources); flagged for the joint
review (the A2 precision set being quality-skewed is a representativeness note, mitigated since contrast is
era/source-invariant). Sourced by category (docs/quality), labeler-determined, not detector-previewed.
FINDING for the manifest writeup (lead-noted): ~57% of real pages have a primary defect = web a11y is
genuinely bad, NOT a referee problem (referee is gold-standard-clean). State it.

## NEXT (continue grind across turns; surface at the FULL manifest)
Continue: page captures toward 40 good + 40 defect (defect-bearing lagging); SOURCE ~17-27 REAL briefs
(rule-agnostic) across registers + the power-locked N. Track exclusion + era. At the manifest: ADOPT the
fallback on final numbers (lead-confirmed near-certain: structural era-correlation + dashboard register-rep
gap) via the full referee gate (re-calibrate + Codex item-8 + lead re-run); re-classify; clean transient
flags; hand the full candidate manifest (pages + briefs) to lead+Jonah for the joint independence review.
Subjective HELD; nothing frozen until the review. HARD CHECKPOINT before any Stage-2 deletion in force.

## Files touched
- sidecoach/eval/oracle-comparator.mjs, smoke-test.mjs, README.md, fixtures/known-defect/gradient-text.html, corpus-tool.mjs, corpus-tool.test.mjs (hardened per Codex), corpus-candidate.mjs, migration-harness/scanner-snapshot.mjs + inputs/*.html + golden/scanner/*.json (new)

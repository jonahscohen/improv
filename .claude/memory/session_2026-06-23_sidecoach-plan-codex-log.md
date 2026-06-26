---
name: Sidecoach evolution plan - Codex adversarial loop log (Phase 1, task #9)
description: Auditable per-round log of the Codex (gpt-5.5, xhigh) adversarial review of the Sidecoach evolution plan. Each round - Codex finding -> what changed in the plan. Loops until Codex has no material objection AND the plan closes every gap AND nets simpler.
type: project
relates_to: [session_2026-06-23_sidecoach-evolution-plan-draft.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen

Codex: `codex exec --sandbox read-only`, model gpt-5.5, reasoning xhigh. Reviews the plan beat + grounding beats; fact-checks against sidecoach/ and the oracle plugin.

## ROUND 1 (plan v1 -> v2)

Codex VERDICT v1: NOT APPROVED. "Regresses protected Sidecoach leads, reaches parity on maintainability/workflow simplicity, and hides new machinery behind 'fold,' 'thin,' 'scanner output mode.'" Independently re-derived SLOC (130 src files / 39,149 + MCP = 42,560) - matches my measurement.

Findings -> folds:

1. [BLOCKER] Drops protected lead: deleting convergence/checkpoint/lease/CAS for "agent loops" loses restartability, duplicate suppression, no-progress detection, coverage, concurrency fencing.
   -> FOLD: v2 deletes the lane VOCABULARY/sprawl, NOT the guarantee. Convergence reborn as a minimal `qa-run` state file behind the scanner: stable finding signatures, max-iteration + no-progress caps, coverage, resumable run id, idempotent report writes, crash-recovery tests. Guarantee preserved in a far smaller form.

2. [BLOCKER] BuildReport retention is a hand-wave; a scanner report != BuildReport (built from flow results, memory, validationResults, metrics, gates in build-report-aggregator.ts).
   -> FOLD: v2 requires a scanner->BuildReport CONTRACT defined BEFORE any deletion: map every validator/domain to the exact BuildReport shape; golden fixtures for clean/warn/blocked; existing BuildReport tests must pass against the new path. Teardown gated on this.

3. [BLOCKER] Detector "counted separately" = accounting fraud; vendored+modified upstream becomes a hard-to-sync fork.
   -> FOLD: v2 keeps the upstream detector READ-ONLY (unmodified vendored tree) + a SINGLE Sidecoach extension-registry file + a sync test. All vendored files COUNTED in the maintainability budget. No "counted separately" exception. No modified upstream files.

4. [MAJOR] Three QA surfaces (`qa`, `detect --report`, audit/critique/polish) = relabeled complexity.
   -> FOLD: v2 exposes ONE mechanical primitive `sidecoach scan`. audit/critique/polish/craft are markdown WORKFLOWS that call scan internally - not competing commands. No public qa-vs-detect duplication.

5. [MAJOR] Taste = parity + bulk; "documented re-vendor refresh" = manual freshness theater; stale guidance can conflict.
   -> FOLD: v2 = ONE curated taste corpus with provenance + upstream version + freshness dates + conflict-resolution notes + canary prompts; delete _extracted/legacy-design-skill + verb parityChecklist; a real `scan --taste-sync` diff command that FAILS when upstream taste changes without review.

6. [MAJOR] Reference ecosystem demoted to prose regresses a lead (preflight queries with timeout/fallback in reference-preflight-artifacts.ts).
   -> FOLD: v2 keeps it as ONE portable `sidecoach context <target>` script emitting a bounded reference bundle (timeout/fallback preserved); command markdown loads that output. Lanes still don't need to exist.

7. [MAJOR] Category-reflex deleted where it should get stronger (used by flow-handler-design-references to filter refs).
   -> FOLD: v2 moves category-reflex INTO the unified scanner/reference-vetter with CURRENT aesthetic lanes (from oracle brand.md), expiry metadata, and tests against both code output and selected references. Not deleted; upgraded.

8. [MAJOR] Sequencing is big-bang (Stage B vendors+deletes together; Stage D moves guidance + retires orchestrators together).
   -> FOLD: v2 adds STAGE 0 = a non-product migration harness FIRST (golden fixtures for old scanner outputs, BuildReports, reference bundles, routing decisions, convergence runs). Old/new run side-by-side in tests. Delete ONE subsystem at a time, only after equivalence + new-rule superiority proven.

9. [MAJOR] Maintainability target unverifiable + "comparable file shape" = parity not beating.
   -> FOLD: v2 replaces the SLOC target with an INCLUSIVE END-STATE INVENTORY (every runtime file, vendored file, script, MCP file, generated artifact, named with its responsibility). MCP decision made explicit (removed, or a named shim file). Maintainability BEATS oracle via a concrete mechanism: ONE rule registry feeding BOTH the scanner AND the generated taste docs (no detector/prose drift - oracle's checks.mjs and SKILL.md/brand.md CAN drift), PLUS shipped tests + a CI budget gate (oracle ships neither).

Net effect of v2: protects every lead in a smaller form, removes public command duplication, uses inclusive accounting, proves superiority with fixtures before teardown, and gives maintainability/workflow concrete BEATS rather than parity.

## ROUND 2 (plan v2 -> v3)

Codex VERDICT v2: NOT APPROVED. Fold status of round-1 findings: R1#4 (one command), R1#6 (reference context script), R1#7 (category-reflex upgrade) GENUINELY FIXED. The rest PARTIAL - v2 named the right approach but DEFERRED the contract ("define later", "to be finalized", "is doc-gen realistic?"). Codex re-measured: 142 non-test src/41,660 + 42 MCP src/5,802 + 168 MCP dist/7,521.

The meta-pattern: turn strategy into SPECIFICATION. New findings -> v3 folds:

A. [BLOCKER] qa-run didn't specify the actual convergence contract (current lanes persist leases/heartbeats/expectedRevisions/outbox/advisory/interrupt/replay).
   -> FOLD: v3 CONTRACT 1 = field-level qa-run with an honest CARRY-FORWARD (runId/status, findingSignatures, iteration caps, coverage, lease+heartbeat, memoryEmitOnce) vs DROP-WITH-THE-MACHINE (outbox multi-ack, lane interrupt, advisory->--dry-run, expectedRevision CAS) split, each carry-forward field naming the existing test suite to port.

B. [BLOCKER] Deleting 37 flow handlers not proven equivalent (they carry gate sequencing, prerequisites, context propagation, memory, BuildReport/panel).
   -> FOLD: v3 CONTRACT 2 = flow-handler migration matrix (each handler -> scan rule / context bundle / prose corpus / retained named orchestrator primitive), with the craft QA-triad gate + halt-on-blocking as a scan exit-code contract the markdown obeys; full 37-row table is a Stage-0 deliverable before any deletion.

C. [BLOCKER] Single rule registry can't honestly generate PROSE taste (judgment, not detector rows).
   -> FOLD: v3 ARCHITECTURE CORRECTION = SPLIT detector registry vs curated prose corpus; no-drift claim NARROWED to a paired-rule cross-check (only where a prose rule has a detector). Honest BEAT, not over-claim.

D. [BLOCKER] MCP decision deferred = inventory not approvable (21 tools incl validators/lane/ast-grep/LSP/python).
   -> FOLD: v3 CONTRACT 5 = full disposition NOW (validators->scan, classify->classify.mjs, lanes/flow-meta DROPPED, ast-grep/LSP/python/state OUT OF SCOPE removed); decision = remove MCP, or ONE named shim exposing only classify+scan; consumer audit is a Stage-1 gate.

E. [MAJOR] BuildReport still "contract later".
   -> FOLD: v3 CONTRACT 3 = explicit scanner->BuildReport field mapping (reuses existing pure grading helpers passRateToLetter/computeOverallGrade/computeVerdict; existing tests are the acceptance gate).

F. [MAJOR] Read-only vendoring CONFLICTS with "upgrade browser to Playwright".
   -> FOLD: v3 CONTRACT 4 = vendor oracle's NON-browser engines read-only (byte-identical, sync test); the browser path is Sidecoach's OWN named/counted engine-browser-hermetic.mjs (Playwright), not a modified upstream file.

G. [MAJOR] Stage 0 harness can hide permanent complexity.
   -> FOLD: v3 TEST/HARNESS BUDGET = the equivalence harness is test-only + TEMPORARY (sunset at end of Stage 5); CI gate counts test/generated files too.

H. [MAJOR] Taste currency = review-gated sync, not a currency mechanism.
   -> FOLD: v3 TASTE CURRENCY MECHANISM = sources + cadence + owner + provenance front-matter + conflict-resolution rule + a ~10-prompt canary corpus asserting the corpus actually influences output.

I. [MAJOR] Spine not reconfirmed with inclusive accounting.
   -> FOLD: v3 BILL OF MATERIALS (closed, 10 named runtime files + read-only vendored tree + named tests + MCP decision) + a PER-DIMENSION PROOF TABLE (each beat backed by a named artifact + test).

Net effect of v3: every deferral replaced by a named contract; the over-broad no-drift claim narrowed to honest; an inclusive bill of materials + proof table. v3 surfaces 4 residual risks for round 3 (qa-run split correctness, BuildReport nextSteps fidelity, own-vs-vendor browser engine, matrix completeness).

## ROUND 3 (plan v3 -> v4)

Codex VERDICT v3: NOT APPROVED, but strong convergence. Explicitly: round-2 contracts A (qa-run), C (registry/prose split), D (MCP), E (BuildReport mapping), F (browser boundary), G (harness budget), H (taste currency) all judged SUFFICIENT. Residual risks #1, #2 downgraded to implementation cautions. Only TWO must-fixes left:

B. [BLOCKER] Handler matrix still DEFERRED to Stage 0 + row unit undefined ("37" isn't clean - duplicate handler defs across aggregate + individual files; flow memory records decisions/metrics/validations/references/gates/artifacts).
   -> FOLD: v4 INLINES the complete migration matrix as a 26-row table keyed on CANONICAL flow id (flows.ts ships 26; the 37 handler FILES are duplicate/aggregate and collapse into their canonical flow then get deleted). Each row names destination + retained behavior + fixture. Added an explicit memory-field mapping (validations/gates->scan/BuildReport, references/artifacts->context, decisions->beats, metrics->qa-run) so no field is lost. Named the single RETAINED orchestration primitive (halt-on-blocking = scan exit-code contract) shared by flowZ/flowQ/flowV.

I-distributability. [MAJOR] Proof table claimed pin/unpin + update-check + packaging but the BOM didn't name them; browser-dependency behavior unspecified.
   -> FOLD: v4 BOM adds `pin.mjs` (#11) + ported update-check (in context.mjs #6) + a DEPENDENCY/DEGRADATION CONTRACT (playwright optional dep; static engines zero-dep always run; --browser/URL degrades gracefully when Chromium absent). Distributability proof row now requires an install-from-copy test covering clean install, pin/unpin, update-check no-op/freshness, and URL scan with browser dep PRESENT and ABSENT.

Codex round-3 fact-checks confirmed accurate (flow-memory-schema fields, build-report-aggregator metrics/gates consumption, oracle pin.mjs + context.mjs update-check, current Playwright import).

Net effect of v4: both remaining must-fixes resolved inline; no deferrals remain. Re-running Codex (round 4) for the approval verdict.

## ROUND 4 (plan v4 -> v5)

Codex VERDICT v4: NOT APPROVED. Distributability must-fix CONFIRMED CLOSED (pin.mjs, update-check in context.mjs, optional-Playwright degradation, install-from-copy coverage all verified). But Contract 2's matrix had two completeness BLOCKERs:

1. [BLOCKER] Prerequisite/context gates undispositioned. `flow-prerequisites.ts` actively enforces required prereqs (flowF req flowA; flowG req flowB; flowI/M req flowG; flowK req flowJ), contextRequirements (projectPath, designTokens), minSuccessfulPrerequisites (flowL/flowU >=1), and handler canExecute gates - v4 mapped flow destinations but not these gates.
   -> FOLD: v5 CONTRACT 2a dispositions every gate by kind: projectPath->context.mjs; designTokens->scan setup check; required build-chain->verb markdown step-order; required setup (flowA)->context.mjs setup gate (oracle NO_PRODUCT_MD pattern); QA-triad gate order->scan exit-code primitive; optional/minSuccess->advisory markdown note. Fixtures named per kind.

2. [BLOCKER] Memory mapping incomplete - "no field lost" was false (omitted appliedRules, aiSlopDetection, summary, nextSteps; handlers actively write appliedRules in FlowA/L/P).
   -> FOLD: v5 CONTRACT 2b = full FlowMemoryEntry table (all 13 fields) -> {qa-run | scan/BuildReport | context bundle | beats memory}; appliedRules->beats citing scan rule-ids+corpus anchors; aiSlopDetection->upgraded category-reflex scan rule+beats; summary/nextSteps->BuildReport+beat. Golden memory fixtures for representative flows A/L/P/Z required in Stage 0.

Codex round-4 fact-checks confirmed accurate (flow-prerequisites required/optional/context gates, flow-memory-schema full field set, handlers writing appliedRules).

Net effect of v5: the matrix is now complete on destinations AND prerequisite gates AND every memory field, with golden fixtures. No deferrals remain. Re-running Codex (round 5) for the verdict.

## ROUND 5 (plan v5 -> v6)

Codex VERDICT v5: NOT APPROVED, but CONTRACT 2b (memory mapping) PASSES and the spine is "otherwise acceptable." Two precise BLOCKERs left in CONTRACT 2a - both my own imprecision in classifying gates as advisory when they actually block:

1. [BLOCKER] `minSuccessfulPrerequisites` wrongly dropped as advisory. flow-prerequisites.ts `canExecute` HARD-BLOCKS when the count isn't met (flowL >=1 of audit/polish; flowU >=1 of brand/component/reference).
   -> FOLD: v6 carries minSuccessfulPrerequisites as a HARD precondition: critique requires >=1 prior QA artifact (recorded audit/polish run) and blocks otherwise; curate requires >=1 brand/component/reference bundle and blocks otherwise. Fixtures: 0 -> blocked, 1 -> passes.

2. [BLOCKER] Required research prereqs flowG<-flowB (component research) and flowH<-flowE (motion patterns) undispositioned (I'd only named the flowG/J/K/F chains).
   -> FOLD: v6 adds a "required research/context-bundle-before-implementation" kind: craft/implement requires (auto-fetches) the component.gallery bundle before implement; animate requires (auto-fetches) the motion-reference bundle before integrate; degrades only if the reference system is unreachable (current preflight pattern). Fixtures: missing-bundle -> blocked/auto-fetch, present -> passes.

Both fact-checked accurate by Codex against flow-prerequisites.ts lines 62/70/100/156/198/211.

Net effect of v6: every prerequisite gate (required-build-chain, required-research-bundle, required-setup, QA-order, hard-minSuccess, truly-optional) now has a carry-or-drop disposition with fixtures; no protected gate silently deleted. Contract 2b already passed. Re-running Codex (round 6) for the verdict.

## ROUND 6 (plan v6) - CONVERGED

Codex VERDICT v6: **APPROVE. "No material findings. Remaining must-fix list: none."** Both round-5 BLOCKERs confirmed resolved with fact-checks against flow-prerequisites.ts (minSuccessfulPrerequisites carried as a hard gate w/ 0->blocked/1->passes fixtures; flowG<-flowB + flowH<-flowE carried as hard context-bundle preconditions). No scoped regression found; the advisory bucket correctly excludes the min-success gates.

## LOOP SUMMARY (auditable)
6 adversarial rounds, model gpt-5.5 reasoning xhigh, each fact-checked against real source:
- R1 (v1): 3 BLOCKER + 6 MAJOR. Core catch: conflated "delete lane vocabulary" with "delete convergence guarantee."
- R2 (v2): 3 folds confirmed fixed; demanded strategy -> named contracts. 4 BLOCKER + 5 MAJOR.
- R3 (v3): contracts A,C,D,E,F,G,H sufficient. 1 BLOCKER (matrix) + 1 MAJOR (distributability).
- R4 (v4): distributability CLOSED. 2 BLOCKER (matrix completeness: prereq gates + memory fields).
- R5 (v5): memory mapping (2b) PASSES. 2 BLOCKER (minSuccess hard gate; flowG<-flowB/flowH<-flowE).
- R6 (v6): APPROVE, no material findings.
Every material finding folded with whole-plan re-verification; the converged plan is v6 in session_2026-06-23_sidecoach-evolution-plan-draft.md. PAUSED for lead independent-Codex gate + Jonah approval before any Phase-2 code.

## LEAD GATE CRITIQUE (v6 -> v7), run through Codex round 7

The lead (team-lead) sent gate-input critique to fold THROUGH the Codex loop (non-negotiable). Folds into v7:
1. MEASURABLE OUTCOME SUPERIORITY -> new EVALUATION HARNESS section: a permanent head-to-head `eval/` that runs Sidecoach `scan` AND oracle `detect.mjs` on the same corpus, scoring detector recall/precision, contrast/OKLCH floor-match, Sidecoach-only idioms, and a Codex/human judgment pass -> a committed scorecard the proof table cites. Baseline captured Stage 0; superiority proven Stage 2. (Answers my own grounding caveat that tests check mechanics not outcomes.)
2. HONEST SIMPLICITY CLAIM -> new SIMPLICITY CLAIM section: three distinct claims never conflated - simpler than CURRENT Sidecoach (true, large); capability = clean SUPERSET vs oracle (not smaller); user surface = EQUAL-OR-SIMPLER vs oracle. Struck any "simpler than oracle in every way" overclaim. Proof table reworded to "honest claim vs oracle".
3. VENDORING AS HEADLINE -> new VENDORING - THE CENTRAL STRATEGIC BET section for Jonah's explicit blessing, with concrete Apache-2.0 handling (LICENSE retention, NOTICE.md attribution + pinned version, byte-identical sync path, rules-extension-only extension so upstream is never merged-into).
4. PROTECT CONVERGENCE LEAD -> Contract 1 reframed: convergence is a LEAD (oracle is stateless), KEPT in a radically simpler form (target = stateless resume from the scanner's last on-disk report), must be provably >= oracle on crash-safety/determinism.
5. SLOC AS GUIDE -> Spine target rule: "smallest that keeps every lead", never drop a lead to hit a number.
6. DISTRIBUTABILITY = SIMPLIFICATION -> proof row reframed: decoupling from the harness REMOVES coupling complexity (not added machinery).
7. DON'T REINVENT -> Contract 4 reframed: the scanner UNIFIES existing Sidecoach pieces (taste-validator/absolute-ban/project-drift/category-reflex + the existing browser-evidence collector), nothing written from scratch.

## LEAD INDEPENDENT GATE FAILED v6/v7 (echo-chamber caught) -> v8

The lead ran an INDEPENDENT fresh-framing Codex gate (the mission's two-level engagement) and it returned NOT-APPROVED, catching what my own 6-round loop converged PAST: the plan proves SUPERSET (more rules) + FRESHNESS (current taste) + INFLUENCE (corpus changes output) - NOT measured BETTER OUTCOMES. My own round 7 independently agreed (eval axis 4 was hand-waved). The echo-chamber was real; the independent gate earned its keep. See session_2026-06-23_sidecoach-plan-independent-gate.md.

The 6 independent-gate gaps -> v8 folds:
1. No real head-to-head OUTCOME eval (Stage 0 only diffed old/new Sidecoach). -> v8 CONTRACT 6: a blind, thresholded head-to-head eval as the proof SPINE - sized corpora (>=40 labeled defect pages, >=40 known-GOOD pages, >=10 briefs built twice), 4 axes with hard CI thresholds, blind judging, committed raw outputs, wired as Stage 2 + Stage 5 MERGE GATES.
2. "Rule superset" = false-positive trap (verifies findings EXIST, not precision). -> Contract 6 axis 2: precision/FP-rate <= oracle on a known-good corpus + FP budget + severity calibration + suppression/appeal; "more rules" only counts if precision does NOT regress. Proof table reworded from SUPERSET to MEASURED recall+precision.
3. Canary proves INFLUENCE not QUALITY. -> Contract 6 axis 4: BLIND comparative guidance-quality judgment (Sidecoach-built vs oracle-built on the same brief) by independent model + human, pass margin; canary demoted to influence-only.
4. Taste depth/currency is the weakest claim (freshness != better). -> proof table marks it the HARDEST claim; superiority = axis-4 measured quality, freshness necessary-not-sufficient.
5. Execution coupling reduced not eliminated. -> DELETION DISCIPLINE on Stages 2/3/5: rollback tag + feature flag, compatibility-fixture-as-contract, named deletion criteria + revert path.
6. MCP removal approved pre-audit; dropped tooling no equivalence. -> Contract 5 REVERSED: shim MANDATORY until the Stage-1 audit proves removal safe; each out-of-scope dev tool needs an equivalence argument or consumer signoff.
Plus my-round-7 MINOR: vendor from the upstream REPO TAG (cache lacks LICENSE/NOTICE) + a sync/legal check that vendor LICENSE + NOTICE.md exist.

Lesson logged: a self-run adversarial loop can converge to mutual agreement on a flawed frame (superset==better). The independent second-level gate is what broke it. Re-running my loop (round 8) on v8 with an explicit anti-echo instruction, then back to the lead's independent re-gate.

## ROUND 8 (v8 -> v9) - anti-echo pass
Codex VERDICT v8: NOT APPROVED, but the frame shift held (no echo relapse). 2 BLOCKER + 1 MAJOR, all about SPECIFICITY (I deferred the numbers again - the same deferral failure mode):
1. [BLOCKER] Contract 6 not fully thresholded ("FP budget", "pre-registered margin" had no numbers; decisive thresholds choosable later = post-hoc approval risk). -> v9 commits PRE-REGISTERED NUMERIC THRESHOLDS now: recall >=0.90 & >=oracle; precision >=0.85, FP <=oracle & <=0.10/page; contrast delta <=0.01; taste rubric 0-20, judge quorum, ties-to-oracle, margin >=+1.0 across >=10 briefs; CI failure conditions. Stage-0 may only TIGHTEN.
2. [BLOCKER] Detector missing BLOCKING-ACCURACY (gate must-fix said recall+precision+blocking; a detector can match recall+FP yet over/under-block via bad severity/exit-code). -> v9 adds axis 4 BLOCKING ACCURACY on a labeled block/non-block corpus (decision accuracy >=0.95, misblock <=2.5% & <=oracle, severity-mismatch <=5%); Stage 2 gates axes 1-4.
3. [MAJOR] MCP shim inconsistent (shim "classify+scan" but list-verbs/get-cheatsheet "static keep" would vanish on removal). -> v9 names the EXACT 4-tool shim: classify, scan, list-verbs, get-cheatsheet.
v8 also folded my-round-7 LICENSE minor (vendor from upstream tag + LICENSE/NOTICE existence check). Re-running round 9 on v9.

## ROUND 9 (v9) - self-loop re-converged
Codex VERDICT v9: APPROVE, "No material findings." All 3 round-8 must-fixes confirmed: numeric thresholds committed at plan time, blocking-accuracy gate wired into Stage 2, exact 4-tool MCP shim. No echo-chamber relapse. One MINOR (axis-number typo: taste referenced as axis-4 in two spots after blocking became axis-4) - fixed to axis-5 in v9.

IMPORTANT (anti-echo): my self-loop reaching APPROVE is NOT the gate. The lead's INDEPENDENT fresh-framing Codex pass already caught my first APPROVE as an echo chamber. v9 is handed back to the lead's INDEPENDENT re-gate as the authoritative step; the two-level engagement stands until BOTH the self-loop AND an independent gate pass on the same version.

## INDEPENDENT RE-GATE FAILED v9 (eval gameable) -> v10
The lead's independent re-gate on v9: NOT-APPROVED. Contract 6 was directionally right but the eval was GAMEABLE - a gameable eval cannot carry the "beats oracle" proof. 6 methodology concerns (lead's 4 + a fresh-Codex 5th/6th), all material -> v10 folds:
1. CORPUS INDEPENDENCE (circularity): split DEV/REGRESSION vs LOCKED HELDOUT (labels frozen before rule work, author != labeler, tuning-after-heldout = disqualification) vs REFRESHED CHALLENGE; known-good = REAL shipped clean designs incl adversarial-borderline legit uses, not handcrafted negatives.
2. A5 LEAKAGE: style de-anonymizes - normalize template/schema/context budget, strip prose phrasing/metadata/traces, randomize A/B, judge rendered RESULTS separately from PROSE.
3. JUDGE INDEPENDENCE: pre-registered judge, independent model family, >=2 judges + human adjudication, calibration briefs with known winners (fail calibration = disqualified).
4. STATISTICAL VALIDITY: n=10 mean+1.0 is noise -> PAIRED comparison, bootstrap/permutation CI lower bound > 0 OR win-rate >=70% no severe loss, raise n.
5. EVAL-AS-TRAINING-SET: committed corpus stops proving generalization once visible -> committed = regression only; the CLAIM rides a refreshed/locked challenge set.
6. "BETTER IN EVERY WAY" honest framing (PENDING JONAH): can't beat correctness -> PARITY/non-regression on correctness-floor axes (recall/precision/contrast/blocking) + EXTENSION capacity; STRICTLY-better only on differentiators (taste quality, workflow, maintainability, distributability, leads). Detector parity is NOT a "beat" - it is "non-regression + extension." Lead surfacing concern 6 to Jonah; v10 built on the honest framing pending his ruling.
Re-running my loop (round 10) on v10, then back to the lead's re-gate. Convergence = self-loop AND independent gate BOTH pass the SAME version.

## ROUND 10 (v10 -> v11)
Codex VERDICT v10: NOT APPROVED. The ungameable-eval restructure held (corpus independence, eval-as-training-set, stage gates, axis numbering, no net machinery all PASSED). 2 BLOCKER + 1 MAJOR, all residual gameability/consistency:
1. [BLOCKER] Judge-independence "where feasible" escape hatch (lets A5 pass with a same-family judge). -> v11: independent model family MANDATORY; if unavailable, model-judge path cannot pass A5 and BLIND HUMAN ADJUDICATION is the primary pass condition.
2. [BLOCKER] Statistical pass had post-hoc knobs (win-rate alternative + undefined "severe loss"/"large effect"/n). -> v11: REMOVED the win-rate alternative; SINGLE binding gate = paired bootstrap CI (>=10k resamples, 95%) lower bound > 0 at PRE-REGISTERED n>=20 (no optional stopping); severe loss DEFINED (>=3 pts / 15% below oracle); fixed in all 3 spots (statistical-validity, proof table, Stage 5).
3. [MAJOR] NORTH STAR still said correctness axes must "beat" (inconsistent with Contract 6 parity). -> v11: NORTH STAR rewritten - correctness = parity/non-regression + extension, differentiators = strictly beat.
Codex confirmed no issue on corpus independence, eval-as-training-set, stage gates, axis numbering, or net machinery. Re-running round 11 on v11; then the lead's independent re-gate.

## ROUND 11 (v11) - self-loop re-converged
Codex VERDICT v11: APPROVE, "No material findings." All 3 round-10 must-fixes confirmed (judge independence mandatory + human-adjudication fallback; win-rate removed, n>=20 pre-registered, severe loss defined, paired bootstrap CI > 0 single gate, consistent across Contract 6/proof-table/Stage 5; NORTH STAR parity-vs-better consistent). Old risky terms appear only as explicit removals.
HANDED to the lead's INDEPENDENT re-gate (authoritative). Per the standing lesson, my self-loop APPROVE is NOT convergence; convergence = self-loop AND independent gate pass the SAME version. Loop tally so far: 11 self-rounds + 2 independent re-gates; each independent gate found real gaps my self-loop missed (echo-chamber), so the two-level engagement remains load-bearing.

## JONAH RULING on concern 6 (success bar) CONFIRMED -> v12
Jonah ruled (relayed by lead): operationalize "better in every way" as PARITY (never regress) on correctness/floor axes + STRICTLY OUTPERFORM on differentiators. Net: "never worse anywhere, decisively better where it counts." Don't call detector parity a "beat" = "non-regression + extension capacity." Bake into Contract 6 thresholds + proof table: `>=` non-regression gates on floors, strict-`>` (with statistical significance) gates on differentiators.
v12 folds: concern 6 marked JONAH-CONFIRMED (no longer pending) in NORTH STAR/SUPERIORITY FRAMING/Contract 6; proof table reworked with an explicit GATE-TYPE column (FLOOR `>=` vs DIFFERENTIATOR strict-`>`), with an honest sub-distinction - taste = strict-> by STATISTICAL SIGNIFICANCE (paired CI), the deterministic differentiators (workflow/maintainability/distributability/leads) = strict-> by deterministic test (significance N/A; bootstrapping "has beats memory" is a category error). Also: my v11 went STRICTER than the lead's restated bar (lead said "CI>0 OR >=70% win-rate"; round-10 Codex flagged win-rate as gameable so I REMOVED it - CI lower-bound>0 alone is the harder branch, satisfying the OR). Risk to watch in round 12: did sharpening differentiator rows to "DECISIVELY BETTER" introduce an overclaim (esp. workflow "decisively better" vs the honest "equal-or-simpler surface")?
Running round 12 to check the v12 encoding for overclaim, then the lead's re-gate.

## ROUND 12 (v12) - overclaim check, self-loop converged
Codex VERDICT v12: APPROVE, "No material findings." Confirmed: workflow "decisively better" is defensible (qualified as better workflow on an equal-or-simpler surface, not simpler-in-every-sense); distributability honest (plugin mechanics = parity, strict gain = packaged memory/reference integration); deterministic differentiators "better by existence" sound where oracle lacks the capability + gate is pass/fail; floor row correctly avoids a correctness "beat"; taste paired-CI vs deterministic-test distinction clean (no p-value-on-a-fact error); SUPERIORITY FRAMING + Contract 6 + proof table consistent. HANDED to the lead's INDEPENDENT re-gate (authoritative; self-APPROVE != convergence).

## INDEPENDENT RE-GATE round 3 (on v12): NOT-APPROVED narrowly -> v13
The lead's 3rd independent re-gate: NOT-APPROVED but NARROW - objections trajectory strategic -> methodological -> narrow protocol = converging, not goalpost-moving. Everything else PASSED (statistical machine sound; mission framing matches Jonah; no dropped-capability/complexity blocker). 3 final protocol fixes -> v13:
1. CORPUS EXTERNAL SOURCING (my own open question b, confirmed): "frozen before rules" only proves independence from OUR extension rules, not from the VENDORED oracle base. -> v13: heldout + challenge cases/briefs EXTERNALLY SOURCED (real shipped designs/briefs chosen without reference to either tool's rules/outputs/examples), PROVENANCE per case; stated precisely (independence from BOTH rule sets comes from external sourcing, not authorship/timing).
2. POWER-LOCK N: n>=20 is a floor, not adequate power for a 0-20 subjective rubric. -> v13: Stage-0 PRE-REGISTERED POWER ANALYSIS (from pilot/calibration variance) LOCKS N; pre-registered A5 scoring endpoint (0.7*result + 0.3*prose), aggregation (mean of >=2 judges, human adjudication on >1pt disagreement), subcriteria as DIAGNOSTICS only (no multiple-comparisons inflation).
3. CLOSE REFRESH OPTIONAL-STOPPING HATCH: -> v13: the challenge set's cadence + replacement rule + RNG seed are FIXED/pre-registered before results (no regenerate-until-pass); committed = regression-only; claim rides the locked/refreshed set under the fixed cadence.
Lead expects to APPROVE the next version if these land cleanly with nothing new, then take it to Jonah with the vendoring decision for his blessing. Running round 13 to verify, then hand back.

## ROUND 13 (v13) - self-loop converged on the 3 protocol fixes
Codex VERDICT v13: APPROVE, "No material findings." Verified all 3 land in Contract 6 + Stage 0 (+ proof table for N): external sourcing/provenance + precise independence claim; power-locked N + A5 endpoint/aggregation/diagnostic-only subcriteria; refresh cadence/replacement/seed fixed before results. No new inconsistency or overclaim. HANDED to the lead's INDEPENDENT re-gate (round 4); per the lead, if it lands cleanly the expected outcome is APPROVE -> Jonah for the vendoring blessing. Self-APPROVE still != convergence; the lead's gate is authoritative.

## v13 ENGINEERING-CONVERGED, then JONAH RULED REIMPLEMENT-AND-OWN -> v14
v13 reached TRUE convergence: my round-13 self-loop AND the lead's round-4 independent gate both APPROVE, Jonah's success bar met - engineering sound. BUT Jonah declined the central VENDORING bet. The lead relayed his ruling: REIMPLEMENT AND OWN; oracle is the studied ORACLE/quality-bar, never vendored code. (See session_2026-06-23_sidecoach-plan-hold-vendoring.md for the hold.)
v14 swaps ONLY the foundation, keeps every vendoring-independent contract verbatim:
- CONTRACT 4: vendor-read-only -> REIMPLEMENT the correctness floor (`engine-floor.mjs`) from PUBLIC specs (W3C WCAG 2.x, CSS Color 4); unify our existing OWNED modules (taste-validator/absolute-ban/project-drift/category-reflex + browser-evidence-collector). No copied code.
- ORACLE = ORACLE: study issue CLASSES (ideas, not expression), implement detection ourselves; Contract 6 A1-A4 now validate OUR floor against oracle-run-as-external-comparator on the externally-sourced corpus (STRONGER: proves our code matches/exceeds, not that a copy matches itself). Added a VERBATIM-COPY GUARD (no oracle source/prose in the scanner).
- TASTE: OUR corpus, authored by us (studying oracle + the field, not copied); currency = periodic RE-STUDY vs the field, not byte-match a pin; vendor-sync DROPPED.
- DROPPED: Apache LICENSE/NOTICE/vendor-sync machinery -> a good-faith CREDIT note (we redistribute nothing).
- BOM: + `engine-floor.mjs` (owned, counted; far smaller than oracle's 2668-line checks.mjs since it covers only our classes); the vendored entry -> owned floor + oracle-comparison test + verbatim-copy guard.
KEPT VERBATIM: collapse thesis, protected-leads, the ungameable eval METHODOLOGY (external corpus/leakage/independent judges/power-locked stats/fixed refresh/parity-vs-better), deletion discipline, distributability/plugin, Jonah's success bar.
Strategic note: reimplement-and-own RAISES the detector-floor proof bar (A1-A4 validate OUR code vs the oracle, not a copy) - the hardened eval is exactly what makes the pivot provable. Lead will push on oracle-comparison rigor + verbatim-copy risk. Running round 14, then the lead's independent re-gate on the new foundation.

## ROUND 14 (v14 -> v15)
Codex VERDICT v14: NOT APPROVED - the foundation swap was sound (no leftover vendoring contradiction, owned floor counted, "smaller than checks.mjs" honest, no lead damaged) but 2 precise gaps, both on the oracle pivot the lead flagged:
1. [BLOCKER] A2/A4 promised ">= oracle" but only encoded LOCAL floors (precision could pass at 0.85 while oracle is 0.95 = regression vs oracle). -> v15: A2 = precision >=oracle AND >=0.85, FP <=oracle AND <=0.10/page; A4 = blocking acc >=oracle AND >=0.95, misblock <=oracle AND <=2.5%, severity-mismatch <=oracle AND <=5%; mirrored in Stage 2 + proof table ("EVERY floor sub-metric >=/<= oracle").
2. [MAJOR] Verbatim-copy guard scope scanner-first, not explicit for the prose corpus (copied taste prose could slip into "our" corpus while the scanner guard passes). -> v15: named `verbatim-copy-guard` gate over engine-floor.mjs + rules-extension.mjs + scanner docs/messages + SKILL text + the curated taste corpus; automated exact-line + n-gram/fuzzy-prose similarity vs studied oracle source AND prose + human signoff (shared concepts = issue classes not copied expression); gates Stage 1 (corpus/docs) AND Stage 2 (scanner).
Running round 15 to verify, then the lead's independent re-gate.

## ROUND 15 (v15) - reimplement-and-own foundation, self-loop converged
Codex VERDICT v15: APPROVE, "No material findings." Verified: Contract 6 A2/A4 now require oracle non-regression (>= / <= oracle) PLUS local floors; Stage 2 + proof-table detector row mirror "EVERY floor sub-metric >=/<= oracle"; `verbatim-copy-guard` is a named gate scoped over engine-floor.mjs + rules-extension.mjs + scanner docs/messages + SKILL text + the curated taste corpus, with exact-line + n-gram/fuzzy prose checks + human signoff, gating Stage 1 (corpus/docs) and Stage 2 (scanner). HANDED to the lead's INDEPENDENT re-gate on the new reimplement-and-own foundation; self-APPROVE != convergence.

## TRUE CONVERGENCE (v15 -> v16) + PHASE 2 AUTHORIZED
The lead's INDEPENDENT gate on v15: APPROVE-WITH-NOTES, no material plan-level blockers. BOTH levels now APPROVE the same version on Jonah's reimplement-and-own foundation + his success bar = TRUE CONVERGENCE (after 15 self-rounds + 4 independent gates + 2 Jonah rulings). 2 non-blocking notes -> v16:
1. COMPARATOR CI-SPLIT: A1-A4 (detector) are per-commit CI-runnable via oracle detect.mjs headless as a pinned dev/eval dep; A5 (taste) is a PERIODIC/RELEASE eval workflow (agent-built + judged), not a per-PR gate. Stated in Contract 6 GATE WIRING + Stage 0 (comparator smoke test) + Stage 2/5.
2. WORDING SCRUB (avoid accidental-vendoring implications): "hard sync gate"/"non-current-upstream" -> "field re-study/currency gate"/"field-stale"; "ported from oracle's pattern" -> "reimplemented analogous pattern".
PHASE 2 authorized (autonomous, staged, produce-and-verify + Codex per stage, lead independently gates each stage). HARD CHECKPOINT: PAUSE before the first DESTRUCTIVE deletion (Stage 2) - lead takes it to Jonah + confirms rollback-tag/flag/compat-fixtures first. Beginning Stage 0 (NON-DESTRUCTIVE).

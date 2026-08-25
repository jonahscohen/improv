---
name: Sidecoach audit drive-to-green campaign
description: Jonah directed that EVERY non-green item in the sidecoach readiness audit be fixed to green - fan out parallel builders, work autonomously, loop until each is re-graded green by the audit author; be honest about human-gated/harness-bounded residuals
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: none (campaign in flight)
relates_to: [session_2026-08-25_consolidation-contradiction-model.md, session_2026-08-25_taste-sources-pioneers-baseline.md]
---

CONTEXT: sc-audit-super (opus-executor teammate) supervised a Codex fine-tooth audit of sidecoach's promises vs delivery and published a verification-grade ARTIFACT (Sidecoach Readiness Audit, https://claude.ai/code/artifact/7dae74e0-9daf-4666-9b29-3d4a1c7af034). Verdict: capable working QA/verification toolkit whose promise is louder than its mechanism - what MEASURES/VERIFIES is real; what is self-running / self-learning mostly is not yet.

DIRECTIVE (Jonah, 2026-08-25): "I want every point that isn't graded with a green addressed and solved to bring it into green. Fan out agents to make it happen, work autonomously. Loop until you have achieved my goal."

ORCHESTRATION MODEL:
- sc-audit-super OWNS the scorecard: produces the authoritative backlog (every partial/gap row + unmitigated risk) with GREEN DEFINITION, FIX, FILES, VERIFY, and CLOSEABILITY (CODE | PARTIAL-HARNESS | HUMAN-GATED), leverage-ranked with file-overlap noted. It later RE-GRADES each fix - a builder "done" is not green until re-audited against code.
- Fan out one opus-executor builder per CODE item (grouped to avoid file conflicts). Each builds + self-verifies (runnable) + I run an independent Codex pass + fold, looping until sc-audit-super grades it green.
- HONESTY GUARDRAIL: PARTIAL-HARNESS items (e.g. a hook cannot call the Skill tool -> the NL self-starting gap) get the MAX autonomous close + an honestly-stated residual. HUMAN-GATED items (enforcement consent-token signing; daemon install) get pre-staged as far as possible + a clear one-line ask to Jonah. NEVER paint those green falsely.

KNOWN TOP GAPS (from the audit summary, HEAD d1c9be59; full backlog pending sc-audit-super):
1. Learning loop inert end-to-end - ENFORCED_RULES=[]/ENFORCED_RULE_IDS=[], guidance tier empty (0 promoted), miner launchd plist not installed in ~/Library/LaunchAgents, latest candidates netNew 0. (Enforcement promotion is HUMAN-GATED by design; guidance-tier first-promotion + daemon install are the closeable/pre-stageable parts.)
2. Natural-language SELF-STARTING gap - hook only injects additionalContext; intent-detector returns a RECOMMENDATION, not an invocation; skill cannot wake itself from a raw prompt. (PARTIAL-HARNESS: a hook cannot call the Skill tool.)
3. Consolidation/contradiction map UNWIRED - `sidecoach consolidate` -> "Unknown command"; no router/orchestrator branch; doctor flags it UNREACHED/UNVERIFIED. (CODE - fully closeable.)
4. Portability - live auto-fire hooks are in ~/.claude/settings.json; committed claude/settings.json wires only craft-floor, so a fresh install is weaker. (CODE - wire the auto-fire hooks into the committed settings.)
5. Doctor exits 1 with 24 graph findings (dead-weight tools + the consolidate engine unreached/unverified). (Mostly CODE.)

PARALLEL THREAD (separate): consolidate-build is folding Codex round-3 on the map ENGINE's correctness (structured-field override must be type-independent; trim polarity; genuine-direction requires no raw hard fields). That is engine correctness; item 3 above is the WIRING. Keep distinct.

BACKLOG (sc-audit-super, authoritative, 11 items, verified vs HEAD d1c9be59) + FAN-OUT:
1. Consolidation map WIRING (`sidecoach consolidate` -> "Unknown command"; not routable; doctor flags unreached). CODE. -> Builder-A (consolidate-build). Files: slash-command-router.ts, sidecoach-orchestrator.ts, bin/sidecoach.js, regen tools.md.
2. "Green means checked" honesty line (a clean/quiet result must say verified-clean vs inconclusive; #1 HIGH risk). CODE. -> Builder-B (green-B-report). Files: bin/sidecoach-present.js, panel-model.ts, panel-renderer.ts.
3. One rule through promote->enforce (learning-loop throughput; ENFORCED_RULES=[] today). HUMAN-GATED (2 consent tokens). -> Builder-E (green-E-stage) pre-stages; user mints promote-confirm + enforce-confirm.
4. Miner runs on a schedule (launchd job not installed/loaded). HUMAN-GATED (load a LaunchAgent). -> Builder-E pre-stages + install.sh plist copy; user runs launchctl bootstrap.
5. Dead weight wire-or-retire + doctor toward green (24 findings; sidecoach-artifacts/build-report unreached). CODE. -> Builder-A. Files: bin/sidecoach-artifacts.js, bin/sidecoach-build-report.js, bin/sidecoach.js.
6. Design-tokens placeholder count (Math.random token count in a green row). CODE. -> Builder-C (green-C-tokens-cfg). File: src/flow-handler-design-tokens.ts.
7. Drift lens not in the active audit path (drift spawn only in an unregistered handler). CODE. -> Builder-A. Files: sidecoach-orchestrator.ts, flow-handlers-tier3-tier4.ts, flow-handler-multi-lens-audit.ts.
8. Config portability (committed claude/settings.json wires only craft-floor; live has the auto-fire hooks; fresh install weaker). CODE but READY-FOR-HUMAN-OK (changes global harness). -> Builder-C prepares; I surface the settings diff to Jonah before commit.
9. Miner produces net-new candidates (last run 0 net-new / 2 dupes). PARTIAL-HARNESS + BLOCKED - output files owned by the concurrent process; our builders must NOT write them. -> FLAGGED to Jonah; route to the concurrent miner owner, not a new builder.
10. Natural-language self-start. PARTIAL-HARNESS (a hook cannot call the Skill tool). -> Builder-D (green-D-harness) max-close (stronger nudge + backstops) + honest residual; graded PARTIAL, never green.
11. QA gate autonomy. PARTIAL-HARNESS (a PostToolUse hook cannot run a multi-step Skill review). -> Builder-D max-close (wider auto-detect + stop-gate) + honest residual; graded PARTIAL, never green.

FILE-OVERLAP GUARD: bin/sidecoach.js + sidecoach-orchestrator.ts shared by items 1/5/7 -> ALL to Builder-A (one owner). scripts/run-tests.ts is a HIDDEN shared file (every builder adds a test) -> builders do NOT edit it; they report the registration line and I wire it centrally. bin/sidecoach-consolidate.js FROZEN (committed ecef379c). data/proposed-rules + taste-candidates.json + sidecoach/.claude/memory = concurrent-owned, read-only.

LOOP: each builder self-verifies (tsc --noEmit + direct test run + item VERIFY) -> I integrate (stage that item's disjoint files) + run an independent Codex pass + fold -> sc-audit-super RE-GRADES against the code -> green only when it re-audits green. I own commits (builders do not commit) to avoid concurrent-commit races on the shared tree.

STATUS: 5 builders dispatched (A=consolidate-build items 1/5/7; green-B-report item 2; green-C-tokens-cfg items 6/8; green-D-harness items 10/11; green-E-stage items 3/4). Item 9 flagged to Jonah. Map engine committed ecef379c. Awaiting builder reports.

PROGRESS:
- Item 6 (Builder-C): fix in (deterministic YAML leaf-walk replaces Math.random; tokenSections unchanged). Verified grep=0, test PASS x2, tsc clean. Codex found 1 real miscount: YAML list-item leaves (`- key: value`) undercounted (list-of-maps token sections). No crash; tokenSections/tokenDefinitions unchanged. Handed back to Builder-C to fold list-item leaves + regression. NOT green until re-verified + sc-audit re-grade.
- Item 8 (Builder-C): claude/settings.json now registers the 4 auto-fire hooks (taste-gate, orchestrate-edit, qa-gate-stop, keyword) matching live as a subset (comm -13 EMPTY, all 4 present). READY-FOR-HUMAN-OK - HOLD, will batch with items 3/4 for one consolidated Jonah sign-off. Builder-C also noted 5 live session-lifecycle sidecoach hooks NOT added (heal, postresponse, postuserp, preamble, sessionstart) - out of scope, for Jonah to decide separately.
- Item 4 (Builder-E): FULLY STAGED, green-ready. install.sh already copies wrapper+runner into ~/.claude/hooks and templates+places the plist; plutil OK; DRY_RUN wrapper exit 0. HUMAN-GATED RESIDUAL = user runs `cp <repo>/claude/launchd/com.yesand.sidecoach-mine-daily.plist ~/Library/LaunchAgents/` then `launchctl bootstrap gui/502 ~/Library/LaunchAgents/com.yesand.sidecoach-mine-daily.plist`. Batch into the consolidated sign-off.
- Item 3 (Builder-E): PROMOTE half staged with real digest (candidate polish.text-wrap-balance -> craft-corpus, contentDigest 11014d65...; user command staged). ENFORCE half was BLOCKED: no promotable DETECTOR exists - both quarantined candidates are "strengthen-existing" recs with NO patternSpec/exampleCorpus; the only patternSpec+exampleCorpus file in-tree is a test fixture below floor. Enforce needs a runnable patternSpec + >=8 held-out positives clearing P>=0.90. Builder-E correctly STOPPED (design/data decision) and escalated.
  DECISION (Jonah via AskUserQuestion): BUILD A REAL DETECTOR NOW (option A). Re-tasked green-E-stage to author one corpus-grounded, patternSpec-detectable, presence-signal anti-pattern detector (e.g. justified body text / overshoot easing / tiny text / all-caps runs / nested cards), assemble a FAIR held-out corpus (>=8 pos + >=8 neg), clear P>=0.90 via eval/taste-enforce-precision.mjs (tighten spec, never rig the corpus), stage promote-confirm + enforce-confirm with REAL digests. Write-path must NOT clobber concurrent-owned data/proposed-rules/ (distinct id / preauthor path; STOP+report if unsafe). Human residual after = user signs the 2 tokens. Gets a Codex honesty pass on the precision claim.

WAVE-1 BUILDER REPORTS (all under independent Codex review, then sc-audit re-grade, then I integrate/commit):
- Item 6 (Builder-C): FOLDED + green on its side. List-item leaf walk added (listLeaf/listHeader); 3 tests pass; grep Math.random=0; tsc clean. Codex rev-C running.
- Item 2 (Builder-B): DONE. Coverage line surfacing the 3-valued verdict as banners (VERIFIED CLEAN only when both lenses scanned + 0 findings; CHECKED / PARTIALLY CHECKED / NOT FULLY CHECKED otherwise); unrendered target makes NO claim. New coverage-honesty.test.ts green; e2e flow-target-render 321/0; tsc clean. Codex rev-B running.
- Items 1/5/7 (Builder-A): DONE, tsc clean, doctor 24->21. Item1: router branch + bin/sidecoach.js front-door for consolidate/mine (mirrors mine pattern). Item5: WIRED artifacts+build-report as front-door spawns (clears doctor capability-unreached). Item7: PORTED runTokenDriftCheck into the ACTIVE tier3-tier4 handler, fail-closed Theming escalation (clean case unchanged). 2 new tests. Codex rev-A running.
  BUILDER-A OPEN DECISIONS (my call):
  (i) Did NOT add consolidate to STANDALONE_BINS - would push "seven CLIs" -> eight and break skill-surface-parity (SKILL.md shared file). Mirrored `mine` (routable + capability-unreached cleared, but NOT enumerated in list/help). sc-audit green-def said "list/help enumerate it" - RE-GRADE will decide if mirror-mine is acceptable (consistent w/ mine) or if the coordinated STANDALONE_BINS + SKILL.md count edit is required. LEAN: accept mine-parity (consistency), but defer to sc-audit.
  (ii) doctor inventories bin/__tests__/ recursively -> treats test files as phantom capabilities (3 of remaining 21: consolidate.test, mine.test, + pre-existing taste-check). Clean fix = one-line __tests__ exclusion in doctor collectSource(bin) - a CORRECTNESS fix (not weakening). TODO: assign as a small follow-up to trend doctor toward 0 (item 5).
- Items 10/11 (Builder-D): MAX-CLOSED (PARTIAL, never green - honest residuals stated). Item10: imperative route directive + broadened lexicon (ReDoS-checked); test 143/0. Item11: taste-gate broadened to statically-scannable sources (.scss/.sass/.less/.vue/.svelte/.jsx/.tsx, --no-render; excludes .astro/.styl as not-scannable); qa-gate-stop finish-block intact + e2e arm->block->clear; tests 26/0 + 70/0. Codex rev-D running.
- run-tests.ts central wiring PENDING (I own it): design-tokens-count, coverage-honesty, consolidate-mine-router, flowk-drift-theming-escalation (Builder-D tests are standalone shell suites, not run-tests).
- Codex reviews in flight: rev-A=byoneujen, rev-B=bei5lllwo, rev-C=beo0w2rds, rev-D=bd9uutmlk.

CODEX ROUND 1 ON WAVE-1 (all found real defects - refolding; reviews working as intended):
- Item 6 (rev-C): 1 Med - bare-scalar list entries (`- 320px`) still undercounted (0 instead of 3). Folding to Builder-C (add bare-scalar leaf; regression). Other shapes + no-crash + tokenSections-unchanged CONFIRMED.
- Items 1/5/7 (rev-A): 2. (a real) `sidecoach consolidate --flag` swallows args -> exit 0 resolver text instead of delegating to engine; FIX = delegate whenever any rest arg exists, bare-only prints plan. (confirm) the drift port adds a clean-case pass line ("tokens match baseline") - I'm keeping it as honest coverage IF no consumer depends on the old static line; Builder-A to confirm. Codex CONFIRMED no injection, no wrong-bin, no unknown-command regression, drift fail-closed on error. Folding to Builder-A.
- Items 10/11 (rev-D): 2 in item 10. (i) ReDoS: `give (?:it|the .+?) a facelift` quadratic (16k=6.7s); FIX bound the `.+?`. (ii) backend false positives: new action terms fire on "modernize the database table schema" etc via shared targets; FIX gate new actions to design targets / backend-exclusion. Item 11 CONFIRMED clean (no false gate, no shell issue, qa-gate-stop intact). Folding to Builder-D. Item 10/11 stay PARTIAL regardless.
- Item 2 (rev-B): 4 (2 High) - ALL the same misread this fix must prevent (not-fully-verified -> VERIFIED CLEAN). (H1) no-verdict/no-measurement result (buildReport {} default; `/sidecoach list` via monitor) claims VERIFIED CLEAN + "Checks passed". (H2) lane panel maps a real `inconclusive` gate to CHECKED (compares only 'pass'//fail|error/, misses inconclusive). (M3) missing lens (not explicit available:false) still certifies VERIFIED CLEAN. (M4) panel partial:true ignored -> VERIFIED CLEAN. GOVERNING PRINCIPLE handed to Builder-B: VERIFIED CLEAN requires POSITIVE both-lenses-scanned evidence; anything less downgrades or makes no claim. Folding to Builder-B + re-Codex after (trust centerpiece).
- Follow-up queued for Builder-A after its fold: doctor collectSource(bin) __tests__ exclusion (phantom test-file capabilities, 3 of 21) - correctness fix, trends doctor toward 0 (item 5).

WAVE-1 FOLD PROGRESS:
- Item 6: scalar-list fold done (Builder-C). Final Codex CLEAN (no double-count, correct on 12 real DESIGN.md, tokenSections unchanged). Sent to sc-audit for re-grade. Ready to integrate on green. (3 Codex rounds total: list-item, scalar-list, final-confirm.)
- Item 2: Builder-B folding 4 honesty gaps (re-Codex after). Item 1/5/7: Builder-A folding consolidate-flag delegation + confirming drift clean-line. Item 10/11: Builder-D folding ReDoS + backend false-positives. Item 3 detector: Builder-E building. All in flight.

INTEGRATIONS (I own commits):
- Item 6: GREEN (sc-audit re-graded against code + ran the checks itself: grep=0, 4 tests pass, tsc 0, tokenSections unchanged). sc-audit noted a PRE-EXISTING out-of-scope quirk (a nested `key:` line is both a section and a parent leaf -> can double-count across section vs nested-section counts; unchanged section-detection, separate future item, NOT a downgrade). Wired design-tokens-count.test.ts into run-tests.ts; build clean; COMMITTING item 6 (src + test + dist + run-tests line). First item green.
- Item 1/5/7 delegation fold verified (bare exit 0, --bogus exit 2, front-door 13/13, doctor 21). Doctor __tests__ phantom-capability follow-up dispatched to Builder-A (3 phantom test-file findings -> expect ~18). Re-verify + Codex the doctor change + re-grade 1/5/7 as one unit after.

FILES TOUCHED: .claude/memory/session_2026-08-25_sidecoach-drive-to-green.md (new), MEMORY.md (index).

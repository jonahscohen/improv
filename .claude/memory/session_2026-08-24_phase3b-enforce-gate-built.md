---
name: Phase 3b enforce gate built - precision-gated, human-signed crossing from GUIDANCE to build-BLOCKING
description: The second consent gate (distinct token/arm-hook/ledger/secret from promote) + held-out precision harness + enforced-rules tier + runtime invariant test; all step verifies green; built as an executor unit, reported to lead for integration + Codex review
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (test-taste-enforce.sh 65/65, precision harness 3 exit-code cases, hook-registry/component-browser/data-parity green, full npm suite pending final tail)
relates_to: [session_2026-08-24_phase3-design.md, session_2026-08-24_phase3a-runnable-detector.md, session_2026-08-23_gated-promote-path-built.md]
---

Built Phase 3b (design steps 5-7): the PRECISION-GATED, HUMAN-SIGNED path that flips a PROVEN mined rule from advisory GUIDANCE to build-BLOCKING enforcement. Executor unit; NOT committed (a concurrent miner writes sidecoach/data/proposed-rules + taste-candidates.json + sidecoach/.claude/memory - untouched). Reported to lead for integration + Codex review.

**Baseline:** `SIDECOACH_AUDIT_HISTORY=/tmp/none npm test` = 188 suites, exit 0 (pinned audit-history per the concurrent-mutation warning).

**Step 5 - precision harness** `sidecoach/eval/taste-enforce-precision.mjs`. Runs the SHIPPING re2 dist interpreter over the FROZEN patternSpec + the exampleCorpus HELD-OUT split + a shared negative pool. precision=TP/(TP+FP); a "fire" = interpreter status 'fail'. Two-gate bar: P>=0.90 AND a denominator FLOOR (>=8 held-out positives AND >=8 fires) - under floor is a REFUSE (exit 7), not a pass (the synthetic-P=1.000 lesson). Build-stamped cache (sha256 of pattern-spec.ts + pattern-interpreter.ts src+dist), mirroring taste-precision-sweep.mjs; `verify-cache` refuses a stale cache (exit 6). Emits a precision-DIGEST (sha256 over the stable report incl. specHash + corpus fingerprint) that the human signs.
  Verify: seeded corpus PASS exit 0; stale cache exit 6; under-floor exit 7 (all asserted).

**Step 6 - the second gate.**
- `sidecoach/bin/sidecoach-taste-enforce.js` (byte-parallel to sidecoach-taste-promote.js). Requires a promotion-ledger entry (else exit 12 NOT_PROMOTED); re-measures precision FRESH and REFUSES under threshold/floor (exit 7, a NEW distinct code); consumes a single-use token bound to ruleId + precision-digest (exit 5 no token); appends to a SEPARATE data/enforcement-ledger.jsonl (own HMAC hash-chain + signed head anchor, DISTINCT secret .taste-enforce-ledger-secret + DISTINCT chain); flips the rule into data/enforced-rules/<id>.json at severity major; runs `npm run build` and ROLLS BACK on failure (exit 13, ledger entry stays a safe orphan). Exit map: 0/2/3/4/5/6/7/8/9/10/11/12/13.
- `claude/hooks/sidecoach-taste-enforce-arm.sh` (mirror of promote-arm): mints the token ONLY on the user typing `enforce-confirm <ruleId> <precision-digest>` as their whole prompt. An agent cannot submit a user prompt.
- FENCES: bash-guard.sh + content-guard.sh gained the `.taste-rule-enforce-consent` token fence and `.taste-enforce-ledger-secret` fence (byte-parallel to promote), and the arm-hook exec block was GENERALIZED (HOOK->HOOKS set) to cover both promote-arm and enforce-arm in every runner/interpreter/grouping form.
  Verify: `claude/hooks/test-taste-enforce.sh` = 65/65 (agent token/secret write blocked; arm exec blocked all forms; enforce refused w/o token=5, under-floor/threshold=7, not-promoted=12; success flips tier + ledger + single-use consume + replay=11; digest-swap-after-signoff=5; build-fail rollback=13; ledger field/truncation/forged-head/separator=8; audit content-swap + un-blessed=9; promote fences regression green).

**Step 7 - runtime invariant** `sidecoach/src/validators/mined-taste-invariant.ts` (leaf, injected backing predicates) + `src/__tests__/mined-taste-invariant.test.ts` (registered in run-tests.ts). EVERY rule with sourceVocabulary 'mined-taste' AND a blocking severity MUST have an enforcement-ledger entry + a passing precision record. GREEN on the live registry + enforced tier (vacuous today); RED on the ungated-mutation.
  Added 'mined-taste' to the SourceVocabulary union (the miner already defaults mined rules to it).

**Registration:** generate-tool-index.ts (DESCRIPTIONS entry for sidecoach-taste-enforce), app-wirings.json + browser-tree.json (buckets/hook_desc/hook_owner) + install.sh (both sidecoach install_app_hooks lines) + test-component-browser.sh expected list. hook-registry / component-browser / data-parity all green.

**Why the enforced tier is a DATA tier (STOP-and-flag for the lead):** the registry (RAW_RULES) is hard-coded TS and the tested structural invariant forbids src/ importing data/guidance or the ledgers. So an enforced mined rule CANNOT become a live registry-blocking rule without a NEW guidance/enforced -> generated-TS -> registry INGESTION step, which the design's build plan (steps 5-7) does NOT scope and which would break that invariant. I built data/enforced-rules/ as an INERT tier symmetric to guidance (the design's own "nothing auto-promotes" stance), with the step-7 invariant as the CI fail-loud backstop; the enforce CLI runs `npm run build` as a repo-integrity gate. "A bad enforce cannot compile to dist" therefore holds only in the sense that the repo must still build; live blocking needs the ingestion step. FLAGGED to the lead to confirm the inert-tier reading or provide the ingestion design.

**Files:** NEW sidecoach/eval/taste-enforce-precision.mjs, sidecoach/bin/sidecoach-taste-enforce.js, sidecoach/src/validators/mined-taste-invariant.ts, sidecoach/src/__tests__/mined-taste-invariant.test.ts, claude/hooks/sidecoach-taste-enforce-arm.sh, claude/hooks/test-taste-enforce.sh. EDITED sidecoach/src/product-rule-types.ts (SourceVocabulary +mined-taste), sidecoach/scripts/run-tests.ts, sidecoach/scripts/generate-tool-index.ts, claude/hooks/bash-guard.sh, claude/hooks/content-guard.sh, claude/hooks/app-wirings.json, claude/hooks/browser-tree.json, claude/hooks/test-component-browser.sh, install.sh.

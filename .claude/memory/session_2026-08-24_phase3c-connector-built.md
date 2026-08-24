---
name: Phase 3c connector + global toggle + enforce-gate folds BUILT (live-blocking, fail-closed, off-by-default)
description: phase3b-enforce delivered the codegen connector (learned data -> live rule ONLY via ledger+precision-verified build-time codegen, build breaks on any tamper), the global user toggle (default advisory), and the 4 Codex enforce-gate folds; 190 suites; my Codex + suite re-verify in flight
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: toggle wiring confirmed by me (global flag, default off); 190 green (teammate); my pinned suite + Codex connector review in flight
relates_to: [session_2026-08-24_phase3c-connector-decision.md, session_2026-08-24_enforce-gate-codex-forgeable.md, session_2026-08-24_phase3b-enforce-gate-built.md]
---

CONNECTOR (live-blocking, fail-closed): scripts/generate-enforced-rules.ts + pure enforced-rules-generation.ts read data/enforced-rules/*.json and emit src/validators/enforced-rules.generated.ts ONLY after, per rule: (1) the enforce-CLI `audit` verifies the HMAC chain + head anchor + content_digest (delegated to the tested CLI, not reimplemented) - fail => exit 3 => build breaks; (2) a precision record whose digest == the ledger's SIGNED precision-digest AND whose buildStamp == the current interpreter build - miss => exit 4 => build breaks. --check (exit 1 on drift) runs FIRST in npm run build. Empty tier => empty module, NO audit, NO secret needed (works on any machine). Wired: RAW_RULES = [...BUILTIN_RULES, ...MINED_ENFORCED_RULES]. INERTNESS UNCHANGED (stronger than the proposed relaxation): the generated module INLINES literals and imports NO data, so "src imports nothing from data" still holds - the crossing is the codegen SCRIPT, not a src data import.

GLOBAL TOGGLE (the user's ask, verified by me): taste-blocking-toggle.ts + taste-blocking-toggle.sh (UserPromptSubmit) + taste-blocking-status.sh (SessionStart), byte-modeled on voice-toggle. Flips ~/.claude/.taste-blocking-enabled on "taste blocking on/off/toggle/status". DEFAULT ABSENT = OFF = ADVISORY. product-rule-registry.ts reads the flag (tasteBlockingEnabled): a certified rule reaches BLOCKING severity ONLY when the flag is on; off => advisory (warns, never blocks). The earlier per-project env-var opt-in was DROPPED for this global switch. This is what protects the user's approved-design (Figma) work: default off, so a learned rule can never block a faithful implementation of an approved design unless they deliberately turn it on.

CODEX ENFORCE-GATE FOLDS (all in): HIGH build-cmd override now test-root-gated (production always runs the real build); CRITICAL #1 arm-exec CASE B blocks interpreter running a hooks-dir-prefixed arg with a $ or arm name (catches H=<arm>; bash .../$H) for BOTH promote+enforce; CRITICAL #2 fences the token/secret dir+dotfile prefix + basename stems vs string-constructed names (caught its own heredoc live); MEDIUM #4 the build-time codegen IS the full-verification enforcement point. RESIDUAL documented: a same-uid agent building the whole path from char codes or copying the arm-hook bytes can still forge - the fundamental name-fence limit, not closable.

TEAMMATE GREEN: test-taste-enforce 79/0, test-taste-promote 97/0 (promote NOT broken by the hardening), test-enforced-codegen 18/0, enforced-rules-generation 34/0, mined-taste-invariant 13/0, hook-registry/component-browser/data-parity green, full suite 190/0. Agent-cannot-force analysis: every tamper BREAKS the build; no silent live rule.

OPERATIONAL FLAG (decide BEFORE the first real enforce, not blocking now - empty tier): once a rule is enforced + committed, npm run build runs the audit which needs the ENFORCING machine's ledger secret (machine-local, not committed). A build machine WITHOUT that secret => audit fails => build breaks (fail-closed). Cross-machine choice: share the secret across build machines, OR build enforced rules only on the enforcing machine (and have other machines trust the committed generated module + audit proof without re-running the secret-dependent audit). Surfaced to Jonah as a heads-up for his multi-machine workflow.

CODEX CONNECTOR REVIEW (bqmc4sdo4) - codegen fail-closed CONFIRMED good, toggle default-advisory CONFIRMED good, fence hardening (CASE B + token/secret) CONFIRMED good, build-cmd test-root gating good. But 3 findings, ALL the same class (test-only env overrides not gated to test-root => production-exploitable), tasked to phase3b-enforce:
- HIGH #1 (bypasses the USER TOGGLE): taste-blocking-toggle.ts trusts process.env.TASTE_BLOCKING_FLAG_FILE unconditionally -> an agent points it at a touched file -> a certified rule blocks for that invocation WITHOUT the user typing "taste blocking on". FIX: gate the env override to SIDECOACH_ENFORCE_TEST_ROOT; production reads only the real ~/.claude/.taste-blocking-enabled. (Direct write of the real flag = accepted same-uid residual.)
- HIGH #2 (content-binding skippable): audit + derive only check content_digest WHEN PRESENT; a legacy row lacking it escapes content-binding. FIX: missing content_digest = audit + derive failure (require it).
- MEDIUM #3 (floor weakenable): precision threshold/floor env overrides not test-root-gated; codegen does not pin the floor. FIX: gate the overrides to test-root; codegen requires the precision record's floor/threshold == production constants.
Codex plain answer: an agent CANNOT certify a new live rule without the ledger/token (except the accepted same-uid limit), BUT (pre-fold) COULD bypass the global blocking toggle via the env var - hence the fold.

NOTE: my pinned suite run (blosh08ri) was KILLED (exit 143, background-job timeout), not a failure - moot since the folds change the code. phase3b-enforce's own run was 190 green.

ROUND-2 FOLDS DONE (phase3b-enforce, all 3 env-seams gated to test-root):
- HIGH #1 (toggle env bypass): TASTE_BLOCKING_FLAG_FILE now honored ONLY under SIDECOACH_ENFORCE_TEST_ROOT in the TS reader AND both hooks; production reads only ~/.claude/.taste-blocking-enabled. test-taste-blocking-toggle 19/0.
- HIGH #2 (content_digest): missing content_digest is now an AUDIT failure (exit 9) + DERIVE failure. test-taste-enforce 83/0, enforced-rules-generation 53/0.
- MEDIUM #3 (floor env): threshold/min-positives/min-fires gated to test-root; codegen re-checks the record's recorded floor >= production constants. test-taste-enforce 83/0, enforced-rules-generation 53/0.
Security answer after BOTH rounds: an agent in PRODUCTION cannot (a) enable blocking via env, (b) certify with missing content_digest, (c) certify under a weakened floor - all NO. Only residuals = accepted same-uid (direct real-flag write / full-path char-code construction / byte-copy).
Re-verify: test-taste-blocking-toggle 19/0, test-taste-enforce 83/0, test-enforced-codegen 21/0, enforced-rules-generation 53/0, mined-taste-invariant 13/0, test-taste-promote 97/0 (no regression), npm run build GREEN.

VERIFICATION CAVEAT: the aggregate full suite keeps getting KILLED as a long background job (>10min) under the concurrent miner's CPU contention (exit 143). Fold changes are confined to 3 src files covered by the passing targeted suites + validateRegistry-in-build green; last clean full = 190/0. Re-attempting (niced). If it will not survive, accept on the localized + build-green evidence.

PENDING: final Codex confirm of the round-2 folds (b7nz2erll) + a surviving full run (b0e68fodv) -> accept + commit Phase 3c, tear down phase3b-enforce, report Phase 3 COMPLETE + the cross-machine secret decision.

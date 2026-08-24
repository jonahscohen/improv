---
name: Phase 1+2 pre-Phase-3 review outcome - safety solid, three shore-up tasks, user chose shore-up-first
description: Independent Codex + fresh-Claude review of the taste-loop Phases 1+2 (cdb530f2..96852d13); all 5 safety invariants hold; real gaps = deployment drift + one containment bug + Phase-3 schema; user chose shore-up-then-Phase-3
type: decision
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (all new-work gates green) + Codex 235s + independent fresh-Claude review, both read-only
confidence: high
relates_to: [session_2026-08-23_gated-promote-path-built.md, session_2026-08-23_taste-miner-built.md, session_2026-08-23_learning-researcher-framework-plan.md]
---

Jonah asked to REVIEW Phases 1+2 before kicking off Phase 3. Ran two independent reviews in parallel (Codex cross-model on the safety core via the deterministic codex-review.py wrapper - a named codex-rescue teammate CANNOT relay, it is Bash-only; and a fresh general-purpose Claude reviewer, read-only). Both corroborated.

SAFETY CORE: SOLID. All 5 invariants hold as an assembled system, not just per unit, with adversarial test coverage that actually tries to break in:
- INERTNESS: structural. Detection is CHECKS[canonicalRuleKey] ?? missingCheck (product-rule-registry.ts:858); a net-new mined rule has no CHECKS entry so it resolves to missingCheck and cannot fire even if wired. No src/ import of quarantine/guidance/ledger.
- CONSENT: mint exists ONLY in the UserPromptSubmit arm hook; CLI exports nothing (require() -> {}). Primary guarantee = an agent cannot submit a user prompt; file fences are defense-in-depth.
- LEDGER: HMAC hash-chain + signed head anchor + signed store + content_digest; suite proves field-tamper, tail-truncation, forged-head, separator-redistribution, content-swap, store-move, id-masquerade, replay all detected.
- UNTRUSTED DATA: ingest allowlist enforced in code (SKILL.md-only, forbidden-file/percent-encoding/host-allowlist/bounded-redirect); bodies in nonce-fenced UNTRUSTED blocks; no child_process. Trackers fence release notes; urllib list-form subprocess, no shell=True.
- RUNNER: cursor rollback on every non-success; reap_group on normal path too; pre-check fails loud.

THREE SHORE-UP TASKS BEFORE PHASE 3 (user chose "shore up first, then Phase 3"):
1. DEPLOYMENT DRIFT (phase-review MEDIUM, most actionable): of the "three adapters on one shared spine," ONLY cc-tracker is installer-wired (install.sh section ~14b, ~7 refs at line 7543+). cmux-tracker has ZERO install.sh references; the taste-miner has no scheduled wrapper (only the generic scheduled-research.plist.template). Fix = symmetric install.sh sections (a 14c for cmux + a miner schedule). Otherwise 2/3 of Phase 2 is dead-on-arrival on a fresh machine.
2. INGEST CONTAINMENT BUG (Codex HIGH, I confirmed in code): sidecoach-taste-ingest.js assertWithin() (line 155-161) uses path.resolve() (lexical), NOT realpath/lstat. A pre-placed symlink inside the quarantine tree lets writeFileSync follow it into a live instruction path. Same-user placement needed (marginal real risk, defense-in-depth), but it defeats the whole "untrusted data can't become live instructions" point. Fix = realpath/nearest-ancestor resolution or O_NOFOLLOW/lstat refusal before write.
3. CONSENT OVERCLAIM + Phase-3 stakes (Codex Critical, phase-review LOW/accepted): the token/secret/arm-exec fences are literal-substring greps (bash-guard grep -qF '.taste-promotion-ledger-secret') evadable by a determined same-uid agent (glob/string-concat to read the secret; byte-copy the arm hook). This is the documented ACCEPTED residual and is fine for ADVISORY guidance. BUT promote.js:97-98 comment OVERCLAIMS "hook-blocked from reading OR writing it" - fix the comment to not lie. And Phase 3 (blocking) raises stakes: the blocking gate needs its OWN human-signed, precision-measured second gate, not this one.

PHASE-3 READINESS: READY-WITH-CAVEATS. Biggest risk (phase-review): a mined candidate today is a rule DECLARATION, not a DETECTOR + labeled example CORPUS. checkProduct is a hand-authored CHECKS lookup; a net-new rule = missingCheck. product-rule-types.ts has no example/precision/fixture fields. Phase 3's held-out precision gate would have nothing to run or measure. First real Phase-3 task = extend the candidate schema to carry (a) a runnable/codegen-able pattern spec and (b) a captured labeled example set. Second: promotion lands a rule in the still-inert guidance tier - it is NOT the enforcement seam; Phase 3 needs a SECOND gate (guidance -> build-blocking) with its own ledger (reuse design, don't overload) + a runtime "reads only ledgered+precision-passed rules" test.

MINOR (not blocking): cc-tracker.py _http_get has no response size cap; the 4 safety .sh suites are manual-invocation only (no aggregate runner); .fidelity-secret still has the content-guard write-gap this diff closed for the ledger secret (parity fix); runner no-orphan degrades if perl absent without failing loud.

Files: none changed by the review itself (read-only). Shore-up implementation is the next unit.

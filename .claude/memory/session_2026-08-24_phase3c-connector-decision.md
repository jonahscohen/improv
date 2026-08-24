---
name: Phase 3c decision - build the live-blocking connector (codegen from ledger+precision-verified enforced rules)
description: User (asked "what actually blocks / what rules are enforced" - answer: nothing yet, it is machinery) then chose to build the connector so a certified rule CAN block, via build-time codegen that keeps the safety model (src imports generated code, not raw data)
type: decision
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: enforce gate built + tested (test-taste-enforce 65/0, test-taste-promote 90/0 regression, invariant 10/0); Codex enforce-gate review + connector build in flight
relates_to: [session_2026-08-24_phase3b-enforce-gate-built.md, session_2026-08-24_phase3-design.md, session_2026-08-23_gated-promote-path-built.md]
---

Phase 3b (the enforce gate) was built by phase3b-enforce, INERT-tier: a mined rule reaches "enforced" only by passing a fresh held-out precision measure (P>=0.90 + minimum-denominator floor, REFUSE under-floor) AND the user's SECOND typed sign-off (enforce-confirm <ruleId> <precision-digest>), recorded in a SEPARATE HMAC hash-chained enforcement ledger with its own distinct secret. Token/secret/arm-hook fenced in bash-guard + content-guard byte-parallel to promote (the arm-exec block generalized to promote|enforce; promote regression 90/0). Runtime invariant: a mined-taste blocking rule must have a ledger entry + passing precision record. No agent-forge path found beyond promote's accepted same-uid name-fence residual.

phase3b-enforce FLAGGED (correctly, not silently chosen) that as built the enforced tier is INERT DATA symmetric to guidance - nothing in src/ imports data/enforced-rules, so "enforced" is certified+recorded but does NOT yet make a rule literally block a build. Making it live-blocking needs a codegen ingestion step the design's steps 5-7 did not scope, and it changes the "src imports nothing from data" invariant.

I surfaced this to Jonah with the honest state: NOTHING is enforced today (zero), nothing is even promoted; the only real artifacts are 2 inert mined proposals the background miner queued (polish.text-wrap-balance, polish.typography-rhythm). The enforceable tells are small mechanical checks (font-family-count, cubic-bezier-overshoot, min-source-lines + regex patterns). Jonah first asked "what would actually block / what rules are enforced" (answered: the design QA gate refusing a page that trips a certified rule; zero rules enforced - it is plumbing), then chose "build the connector."

DECISION: build Phase 3c - the live-blocking connector. Design: a build-time CODEGEN (generate-enforced-rules.ts, mirroring generate-validators) that emits a GENERATED TS module from ONLY ledger-verified + precision-proven enforced rules, spread into RAW_RULES. src imports the GENERATED artifact (a build output), never raw data - preserving the safety model. FAIL-CLOSED: any enforced rule without a valid ledger+precision => generation fails => build breaks, so no rule is live-blocking without a valid, precision-proven, human-signed enforce. OFF-BY-DEFAULT per project (opt-in). The "src imports nothing from data" invariant becomes "...EXCEPT the ledger-gated generated module." tasked to phase3b-enforce.

IN FLIGHT: Codex review of the enforce gate (bhb2002xa) + phase3b-enforce building the connector. NOTE the enforce fence is LIVE - it blocked my own bash for merely NAMING the token file in a review prompt (rephrased around it; the guard is working).

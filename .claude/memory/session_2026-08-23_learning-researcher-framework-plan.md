---
name: Learning-researcher framework (the "megamind") - unified build plan
description: One scheduled research spine + 3 source adapters (taste, Claude Code, cmux); autonomous discovery, fully-gated application; phased build
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: design-complete, phase-1-foundation-in-build
confidence: high
relates_to: [session_2026-08-23_self-updating-taste-pipeline-design.md, session_2026-08-23_cc-feature-tracker-design.md, session_2026-08-23_cmux-feature-tracker-design.md, reference_external_taste_sources.md, reference_oracle_vs_sidecoach_scorecard.md]
---

STAMP: authored against commit c199f9c5. Re-verify current-state claims if HEAD has moved.

GOAL (Jonah): close the last oracle gap (self-updating taste, scorecard dim 8) AND establish sidecoach as the taste-aggregating + enforcement authority - the orchestration "megamind" - then extend the same machine to track Claude Code and cmux and improve our own harness.

ARCHITECTURE (converged independently by 6 research agents): ONE engine, THREE interchangeable source feeds. Do NOT build three one-offs.

SHARED SPINE (claude/hooks/lib/scheduled-research-run.sh, cloned from beats-reflect-weekly.sh):
fetch-source-as-UNTRUSTED-DATA -> diff-since-last-cursor -> comprehend-to-typed-data (headless `claude -p`) -> propose-to-INERT-quarantine -> HUMAN GATE -> launchd schedule (perl-setpgrp watchdog, fail-loud 0/2/3/4/5/6, cursor-advanced-only-on-success, DRY_RUN). launchd, NOT cloud-cron / CronCreate / loop (needs local repo + working-tree writes; the three CC-internal schedulers all miss - see the pipeline beat).

THREE ADAPTERS:
- TASTE: sources = beats corpus + measured audit-history (NEW append-only capture) + external experts (Krehel design + Kowalski motion, MIT, as DATA). Miner = reflect 5-lens fan-out -> candidate ProductRuleDefinitions + provenance -> existing prose-ablation validator. GUIDANCE tier first; enforced-detector tier deferred (Phase 3).
- CLAUDE CODE: source = CHANGELOG + npm version-diff + claude-code-guide interpreter. Opportunity-map additive/redundant (worked example: native Concise output style likely retires our concise hook cluster). Daily version-diff.
- CMUX: source = LOCAL binary introspection (`cmux version` + `cmux capabilities` diff) + upstream changelog. Opportunity-map weighted to workaround-retirement. Daily version/capabilities-diff.

DECISION (Jonah 2026-08-23): APPLY GATE = FULLY GATED. Nothing self-learned goes live without a typed human confirmation - every taste rule AND every setting/harness change. Full auto-apply of harness changes from external release notes is deliberately OFF the table (external content must never rewrite the machine). Discovery + scheduling are autonomous; application is human-gated. May loosen to "auto-apply proven guidance" later once trust is earned.

SAFETY SPINE (3 fail-closed layers, non-negotiable): STRUCTURAL (proposals land as data the enforcer imports nothing from -> inert by construction) + HARNESS (promotion consumes a single-use TTY-minted consent token agents are hook-blocked from creating, like frontier-confirm; every live rule in a tamper-evident HMAC hash-chained ledger tracing source+date+human) + BUILD (validateRegistry + generate-*-check drift guards + fail-closed taste-gate). External content = fenced untrusted data, never followed as instructions, agent-config files (AGENTS.md/CLAUDE.md/opencode.json/.claude-plugin) excluded from ingest.

PHASING:
- PHASE 1 (in build): shared spine runner (spine-runner) + append-only audit-history capture (audit-capture) + safe external ingest (safe-ingest) [foundation, in parallel now]; THEN the taste miner + inert proposal quarantine; THEN the fully-gated promote CLI + consent token + tamper-evident ledger + human-review surface; integrate to the GUIDANCE stores (design-laws/craft-corpus/design-judgment) validated by prose-ablation. Closes most of dim 8.
- PHASE 2: CC tracker + cmux tracker adapters on the same spine (propose-only, human-applied via the normal verification + cross-model review gate).
- PHASE 3 (hard): mined-rule -> enforced build-blocking DETECTOR (pattern-spec->check codegen OR data-driven interpreter + the A5a held-out precision gate). Detection is CODE not DATA today (engine-map) - this is the real work to make a learned rule BLOCK.

REUSE (do not reinvent): reflect fan-out; product-rule-registry + generate-validators --check; sidecoach-detect + taste-gate; sidecoach-refs currency; the fidelity-ledger tamper-evident pattern; the frontier-confirm consent-token fence; the QA-gate finish-boundary spine; beats-reflect-weekly launchd runner. The ONLY genuinely new safety primitive is the consent-token-gated promotion + ledger, both cloned from proven repo patterns.

Design beats (full detail): self-updating-taste-pipeline-design (pipeline + gate + schedule), cc-feature-tracker-design, cmux-feature-tracker-design, reference_external_taste_sources (sources + safe-ingest).

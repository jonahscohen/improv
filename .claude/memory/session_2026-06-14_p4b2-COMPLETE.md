---
name: P4b-2 COMPLETE (merged) - browser-evidence collector, ACTIVATED via renderUrl; Codex core-sound, merged on whitespace-only final delta
description: P4b-2 (engine-driven Playwright browser-evidence collector for 4 rules + renderUrl activation + mcp-server HOME-isolation fix) built, hardened across 4 Codex review rounds, independently verified, merged to main (NOT pushed); browser rules now FIRE when a lane carries a renderUrl
type: project
relates_to: [session_2026-06-14_p4b2-impl-done-verified.md, session_2026-06-14_p4b2-code-review.md, session_2026-06-14_p4b2-renderurl-foldin-decision.md, session_2026-06-14_mcp-test-flow-history-pollution.md, session_2026-06-14_p4-reality-check.md]
supersedes: session_2026-06-14_p4b2-impl-done-verified.md
---

P4b-2 COMPLETE and merged to main. The engine-driven headless-Playwright
browser-evidence collector populates ProductCheckContext for FOUR rules
(a11y.min-hit-area BLOCKER, a11y.color-contrast BLOCKER, polish.concentric-radius,
polish.typography-rhythm) so they reach REAL browser-verified verdicts. genericity
EXCLUDED (Jonah call; untouched/inconclusive). Browser rules ACTIVATE when a lane
carries a renderUrl; degrade to inconclusive otherwise.

**Process (subagent-driven, Codex partner, 16 commits):** Codex-authored plan ->
revised to 4-rule scope (genericity excluded) -> impl executed 5 tasks ->
PLAYWRIGHT_BROWSERS_PATH wiring (real-browser test runs in the gate) -> Codex code
review found 3 P1 + 1 P2 collector defects (contrast false-pass, SW/WS hermeticity,
AbortSignal, concentric-first-child) -> fixed -> reality-check (Jonah directive)
caught the mcp-server-test HOME-isolation POLLUTION (latent since P4f) -> fixed +
guard -> renderUrl ACTIVATION folded in (engine + sidecoach_lane MCP arg, Jonah
call) -> Codex re-review found abort-LATENCY (finally awaited a stalled launch) ->
fixed (fire-and-forget) -> final P2 trailing-ws in compiled dist -> fixed (one-line
signature). Final substantive Codex verdict: core SHIP-sound; sole remaining blocker
was the trailing-ws git diff --check, now resolved + independently confirmed.
MERGED on the whitespace-only delta WITHOUT a 6th full Codex review (no substantive
code change since the core-sound verdict; documented judgment).

**Reality-check value (Jonah's "is it real or fluff" directive) - it earned its
keep this phase:** caught (a) the mcp-server test runner polluting the REAL
~/.claude/sidecoach-flow-history.json (test-hygiene leak latent since P4f), and (b)
that the collector was DORMANT for free-text targets -> drove the renderUrl
activation so the browser rules actually fire. Both were invisible from "green +
SHIP".

**Verification (each round):** impl per-task green + MY independent re-runs (scope,
integrity incl git diff --check now, genericity-untouched 0-diff, build both
packages, engine 55 + mcp 296+OOM, collector OK-not-SKIP in the gate via
PLAYWRIGHT_BROWSERS_PATH, real flow-history byte-identical across BOTH runners) +
Codex review/re-reviews (4 rounds).

**Commit chain (16 on lane-p4b2):** da72921/d7f7424/e0fb0d2/5d4c5d8/1933b07 (T1-T5)
+ b2397ae (browsers-path) + b687468/db2b92e/74572b8/a1af395/7433d87 (4 collector
fixes+dist) + 63cdfbc/1043778 (renderUrl engine+MCP) + f9714cd (mcp HOME isolation)
+ 1560492 (abort latency) + 86ab6c0 (dist trailing-ws). dist committed via explicit
allowlist (engine + mcp-server).

**NOT pushed** to origin (Jonah's standing call).

**KNOWN/HONEST (per reality-check):** browser rules fire ONLY when a lane carries a
renderUrl (now possible via sidecoach_lane renderUrl arg); validators remain
heuristic (signal quality on real codebases unmeasured); a LIVE end-to-end run
(MCP -> engine -> collector -> rule against a served page) is the next step to prove
the chain (Jonah queued it). P4f flow-history lane records still have no
lane-specific consumer (durability record). The pre-existing emoji in
sidecoach-orchestrator.ts on main is a separate no-emoji cleanup.

**Remaining lane work:** the LIVE e2e run (next), then P4e (copy gating, deferred) +
follow-ups (lane-runner-concurrency no-op; bidirectional eligibility parity; P4f
consumer-or-document; the orchestrator emoji).

Collaborator: Jonah.

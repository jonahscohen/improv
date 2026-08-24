---
name: Enforce (and promote) consent gate is TRIVIALLY forgeable by a same-uid agent - a fundamental limit, not just "determined forger"
description: Codex on the enforce gate - an agent CAN cross without the user's typed sign-off via variable-indirection arm-exec + string-constructed secret read; the name-based bash-guard fences are a speed-bump + audit, not a cryptographic wall on a single-user machine
type: feedback
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: Codex review of the enforce gate (2 Critical + 1 High + 1 Medium, all CONFIRMED/PLAUSIBLE); the bypasses demonstrated locally by Codex
relates_to: [session_2026-08-24_phase3b-enforce-gate-built.md, session_2026-08-24_phase1-2-shoreup.md, session_2026-08-23_gated-promote-path-built.md]
---

Codex review of the Phase 3b enforce gate: "an agent CAN cross the ENFORCE gate without the user's typed sign-off." Findings (fold tasked to phase3b-enforce):

- CRITICAL #1 (arm-exec fence bypass, affects promote TOO): the bash-guard arm-exec block only judges SEGMENTS literally containing the hook basename, so `H=<arm-hook>; bash claude/hooks/$H` (name in a variable) slips through and runs the minting code -> forged token. HARDEN: block interpreter execution of ANY hooks-dir path-prefixed arm hook (the bypass keeps the literal `claude/hooks/` prefix).
- CRITICAL #2 (token/secret fence bypass, affects promote TOO): literal-substring fences on the token/secret basenames are evaded by string-constructing the name in a node/python one-liner; agent reads the secret -> HMAC-forges a valid token -> enforces. HARDEN feasibly (dir + broader dotfile match).
- HIGH #3 (clean bug): SIDECOACH_ENFORCE_BUILD_CMD replaces `npm run build` and is not restricted to the test root -> an agent sets it to `true` and skips the real build, keeping a rule that would fail the build enforced. FIX: honor the override ONLY under SIDECOACH_ENFORCE_TEST_ROOT.
- MEDIUM #4: the runtime invariant only checks ruleId-presence + pass===true (not the ledger HMAC/head/token-MAC/digests) and does not run in `npm run build`. The CONNECTOR's build-time codegen must do the FULL verification at BUILD time - that is the real enforcement point.

THE FUNDAMENTAL POINT (correct my earlier framing): I had documented the promote residual as "a DETERMINED forger copying the hook bytes" - a fundamental-but-remote limit. Codex shows the bypass is TRIVIAL (a variable, or string concatenation), not remote. The honest truth: on a SINGLE-USER machine, a same-uid agent with bash can ultimately forge either consent gate (promote or enforce), because the signing secret is a same-user file and the name-based bash-guard is a bypassable SPEED BUMP, not a wall. No better name-fence closes it; only a genuinely out-of-reach secret (separate OS user / privileged helper / hardware) would, which is a major architectural change out of scope.

WHAT THE GATE ACTUALLY GUARANTEES: (a) it PREVENTS ACCIDENTAL/careless self-enforcement, (b) it raises the bar against a casual prompt-injection (the injected agent must deliberately construct a non-obvious bypass), and (c) it leaves a tamper-evident AUDIT trail (the ledger). It does NOT cryptographically stop a deliberately malicious same-uid agent. This bounds Phase 3's guarantee and the CONNECTOR inherits it (a forged ledger entry -> a forged live-blocking rule). Surfaced to Jonah as a gut-check on enabling live-blocking.

FOLD PLAN: fix High #3 (clean), harden #1/#2 to kill the TRIVIAL bypasses Codex demonstrated (raising the bar from trivial back to determined-forger), document the residual honestly in-code, and make the connector's build-time codegen the full-verification enforcement point. Do NOT pursue an absolute fence (impossible on this machine model).

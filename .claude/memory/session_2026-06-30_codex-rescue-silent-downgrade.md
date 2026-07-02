---
name: codex-rescue punts to same-model review when codex is slow
description: Diagnosis of repeated codex-rescue "still running, I'll wait" placeholders. The codex model is healthy (smoke 14.4s, SMOKE_OK); the failures are config (gpt-5.5/xhigh too slow for the agent's wait window) + the codex-rescue agent silently falling back to same-model self-review on timeout. The cross-model gate downgrades without an error. FIXED 2026-06-30: codex-review.py reliable wrapper + codex-rescue-guard redirect.
type: reference
relates_to: [reference_codex_exec_hang_sigkill.md, session_2026-06-25_codex-capacity-retry.md, reference_codex_review_tool.md]
---

Collaborator: Jonah Cohen. 2026-06-30. Diagnosed after the codex-rescue agent twice returned placeholder non-verdicts ("The task is still running, I'll wait") during the visualizer-guard review, then did the review itself from direct file analysis (same-model, not cross-model).

## The headline
Codex the MODEL is not broken. Bounded smoke test (`codex exec --skip-git-repo-check -c model_reasoning_effort=low "Reply ... SMOKE_OK"`, empty stdin, python subprocess timeout) returned exit 0 in 14.4s with SMOKE_OK. codex-cli 0.130.0. No wedged exec processes present. PID 88422 (2h, ~0% CPU) is the `codex app-server` daemon - normal long-lived, NOT a wedge (don't kill it; check the full args before flagging an idle codex proc as wedged).

## The real failure stack (what "Codex repeatedly fails" actually is)
1. **Config too heavy for reviews.** `~/.codex/config.toml` still defaults to `model = "gpt-5.5"` + `model_reasoning_effort = "xhigh"`. Low-effort smoke = 14.4s; xhigh on a real multi-file review prompt runs well past the codex-rescue agent's wait window. Looks wedged, is reasoning (the slow-not-wedged case from [[reference_codex_exec_hang_sigkill]]). Lever: invoke reviews with `-c model_reasoning_effort=high` (or medium); xhigh is overkill for a diff review.
2. **codex-rescue SILENTLY DOWNGRADES.** When its codex call doesn't return a verdict in time, the agent emits a placeholder final message AND falls back to doing the review itself from direct file analysis. That is a same-model review wearing a cross-model label - the produce-and-verify gate (Verification Protocol #8) quietly loses its different-model property with NO error surfaced. Treat a codex-rescue "still running / I'll review directly" as a RED FLAG that the cross-model pass did not happen, not as a completed gate.
3. **stdin-redirect wedge** (logged): piping the prompt on stdin hangs codex; pass it positionally. [[reference_codex_exec_hang_sigkill]] has the full fix.
4. **"model at capacity"** (OpenAI-side, intermittent): logged in [[session_2026-06-25_codex-capacity-retry]].

## How to actually get a cross-model review when this happens
Invoke codex directly with the bounded wrapper from [[reference_codex_exec_hang_sigkill]]: positional prompt, diff via `input=`, `model_reasoning_effort=high`, python `subprocess.run(..., timeout=N)` (SIGKILLs on timeout). That is faster and more reliable than the codex-rescue agent for a self-contained diff, and it does not silently downgrade - a timeout is visible.

## FIX SHIPPED (2026-06-30)
Built `~/.claude/hooks/codex-review.py` ([[reference_codex_review_tool]]) - runs ONE real Codex review or fails with a distinct exit code (3 wedged / 4 backend / 5 empty), never downgrades. Extended `codex-rescue-guard.sh` to redirect NAMED and unnamed REVIEW-intent codex-rescue spawns to the wrapper (investigation/fix use still allowed). Both verified live; guard already registered so the extension is active without restart. The wrapper itself passed two real-Codex review rounds (5 findings folded).

## Files
- .claude/memory/session_2026-06-30_codex-rescue-silent-downgrade.md (this)
- claude/hooks/codex-review.py, claude/hooks/codex-rescue-guard.sh, claude/hooks/_tests/test-codex-rescue-guard.sh

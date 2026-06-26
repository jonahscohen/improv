---
name: codex-gate-claude-fallback
description: Standing rule (Jonah) - the cross-model verification gate ALWAYS runs, but Codex is only PREFERRED, not required. If Codex is unavailable (not installed/connected on a machine), fall back to an independent Claude reviewer (fresh agent, not the producer) rather than skipping the gate. Codified in CLAUDE.md item 8.
type: feedback
relates_to: [feedback_multiagent_verified_implementation_mandate.md, session_2026-06-25_codex-rescue-guard-hook.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## RULE
The produce-and-verify gate (an independent reviewer checks every substantial unit; the producer never self-certifies) is NON-NEGOTIABLE. But the REVIEWER identity adapts to availability:
- PREFERRED: Codex (a different MODEL). Probe first: `codex --version` / `command -v codex`. If present, use it.
- FALLBACK (Codex unavailable - e.g. not connected on another machine): deploy an independent CLAUDE reviewer - a fresh agent/subagent that reviews the diff and was NOT the producer of the unit. Same-model but independent (different agent, clean context). Do NOT skip the gate.
- Floor = an independent same-model review. Preference = a different-model (Codex) review. The gate always runs; only the reviewer changes.

**Why:** Jonah may run on machines without Codex connected, and we still want the review gate to fire. A clean-context Claude reviewer that did not produce the unit still catches producer blind spots (the point of produce-and-verify); a different model is better but not always available.

## WHERE CODIFIED
claude/CLAUDE.md Verification Protocol item 8 (the authoritative gate definition) - added the FALLBACK clause. Live immediately (CLAUDE.md is symlinked to ~/.claude/CLAUDE.md).

## Files touched
- claude/CLAUDE.md (item 8 fallback clause)
</content>

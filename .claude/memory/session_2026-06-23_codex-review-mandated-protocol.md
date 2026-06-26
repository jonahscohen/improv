---
name: Codex cross-model review codified into the Verification Protocol (item 8)
description: Jonah flagged that Codex review should be a MANDATED validation step, not optional. It lived only in a 2026-06-13 feedback beat and I had been treating it as "optional" in teammate briefs. Codified it as Verification Protocol item 8 in claude/CLAUDE.md (symlinked to ~/.claude/CLAUDE.md), scope = substantial code/implementation; trivial edits exempt.
type: feedback
relates_to: [feedback_multiagent_verified_implementation_mandate.md, session_2026-06-23_cmux-teammate-pane-FIX.md]
---

Collaborator: Jonah Cohen

Jonah (2026-06-23): "Is spawning a Codex agent for review part of our mandated validation process yet? It should be."

## The gap (honest)
- A standing MANDATE existed only as a feedback beat ([[feedback_multiagent_verified_implementation_mandate.md]], 2026-06-13): produce with agents, verify with SEPARATE agents, "Codex secondary coverage ... before reporting done."
- It was NOT in the CLAUDE.md Verification Protocol (the enforced team rules loaded every session), and in practice I undercut it: the brief I gave the ref-integrator teammate literally said "Optional: Codex cross-model review." A memory, not an operational gate.

## Fix
- Added **Verification Protocol item 8** to `claude/CLAUDE.md` (which is symlinked from `~/.claude/CLAUDE.md`, so one edit covers both): "Codex cross-model review required (substantial code/implementation)." Before reporting done on a feature / refactor / multi-file or logic change / logic bug fix, run an independent-model Codex review of the diff (`codex:rescue` agent, `/code-review`, or codex plugin `review`/`adversarial-review`; the stop-time review gate covers the per-stop pass). Model that produced a unit does not certify it. Fold every finding and re-verify the whole unit; do not just patch the flagged line. Trivial edits (copy, one-liners, pure docs, named-token swaps) exempt. Teammate/subagent-produced work: the Codex pass is part of that unit's gate before it is reported complete.
- Scope chosen by Jonah via AskUserQuestion: "Substantial code/implementation" (not all-changes, not only-at-PR).
- Immediate correction to the live ref-integrator teammate via SendMessage: Codex review is REQUIRED at its Verify gate (#4), not optional.

## Why this matters
Closes the inconsistency between a standing mandate and the enforced protocol, and stops me from re-labeling a required step "optional" in briefs. Independent-model coverage is defense-in-depth against single-model blind spots (the failure mode that produced the lane-spec regressions).

## Files
- claude/CLAUDE.md (Verification Protocol item 8 added; ~/.claude/CLAUDE.md is a symlink to it)
- .claude/memory/session_2026-06-23_codex-review-mandated-protocol.md (this)

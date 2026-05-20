---
name: Reflection - 2026-05-19
description: Multi-agent corpus analysis - workflow intensity, hook governance gaps, today's three-bug session as canonical example
type: project
relates_to: [reflection_2026-05-12.md, session_2026-05-19_sending-to-claude-flash.md]
---

# Reflection - 2026-05-19

## Narrative

The hook layer grew 8x between April and May. The CLAUDE.md file grew 67% (226 → 378 lines) in two weeks. The QA gate now has 5 sequential commands stacked on top of a 7-point Verification Protocol. Each addition was justified individually - every hook was built in response to a specific real failure. But the cumulative shape is no longer a workflow; it's a procedure being applied to a one-person workstation, and the procedure is now generating its own failures: false-positive nags during read-only investigation, gates that can't be satisfied honestly for server-only changes, and a memory subsystem so loud the model is learning to ignore it. The previous reflection (2026-05-12) flagged most of this. None of it was acted on. That non-follow-through is itself the most important finding - reflections will not improve the system without a mechanism for closing them out.

Today's session is the canonical example of why this matters. Three independent bugs were live in the same code path: a `Promise.race` race condition, a missing WSS handler on port 9224, and a catch block that silently destroyed user state on failure. The first "fix" (Promise.any) only addressed bug #1. The second "fix" (retry-on-failure) made the symptom *worse* because the underlying root cause (bug #2, the WSS handler) was still unfound - turning "silent flash" into "loud broken Retry Send pill". The external Node probe that finally exposed bug #2 (`9224 ERR: Unexpected server response: 404`) was a 12-line script. It should have run **before** the second fix shipped, not after. Nothing in the current hook layer demands an external probe before stacking a second fix on an unverified first one. The verification surface is fortified against "claimed without screenshot" but blind to "fixed twice without rooting the cause."

The voice subsystem deserves its own paragraph because it shows the failure shape in miniature: 4 hooks, 3 toggle scripts, 2 feedback files, and one CLAUDE.md rewrite - all to gate a feature that ships muted by default. Voice has consumed more workflow attention than the improv tool's entire transport layer. The pattern (rule asserts always, exception asserts never, hook arbitrates, hook misfires, new hook gates the hook) is the same pattern visible in the memory-write subsystem and the validation-guard stack. None of these subsystems are individually wrong. Collectively they're a tax that's grown faster than the work.

What's working: the bash-guard commit gates are still the highest-leverage enforcement on the system (zero misses). The feedback memory system captures real lessons. The reflect skill itself worked today. The trajectory needs a one-time pruning pass, not new hooks. The recommendation below is biased toward removing things, downgrading wide hard-denies to narrow ones, and consolidating duplicated logic rather than adding new layers.

## Key findings

Ranked by impact for your question (gaps + intensity + hook opportunities).

### 1. Memory-nudge fires on Read - active banner blindness today
- **Evidence**: This very reflection task triggered 7+ "PROJECT FILE CHANGED. You are in dirty state" injections during pure-Read corpus analysis. `memory-nudge.sh` runs on PostToolUse for Read in addition to Write/Edit/MultiEdit. Reading a file does not change it.
- **Confidence**: high (observed live, this session)
- **Implication**: The nudge designed to prevent memory-discipline failures now nags during read-only investigation, training the model to ignore it. The hook's authority is eroding because it cries wolf. Fix takes one line in settings.json (drop Read from the PostToolUse matcher list for memory-nudge).

### 2. Server-only code changes have no verification off-ramp
- **Evidence**: Today's edits to `improv/server/ws-server.ts` set `~/.claude/.needs-verification`. The only clearing patterns are cmux screenshot, localhost curl, or Read of an image - all UI-oriented. Server logic has no UI to screenshot. The gate either trains the model to take a throwaway screenshot to clear the flag (theatre), or stalls legitimate commits.
- **Confidence**: high (today's session shows it concretely)
- **Implication**: Extend `verify-before-done.sh` clearing patterns to include test commands (npm test, jest, vitest), node test scripts, or any external probe (non-localhost curl + Read of stdout capture). Otherwise the hook trains dishonesty for an entire class of work.

### 3. No "second-fix gate" - today's regression shipped because fix #2 stacked on unverified fix #1
- **Evidence**: `session_2026-05-19_sending-to-claude-flash.md` shows three bugs in one symptom; Fix B made things WORSE while the underlying cause was still hidden. External Node probe (which found bug #2) ran AFTER the regression, not before. No hook forces an external probe before stacking a second fix on the same problem area.
- **Confidence**: high
- **Implication**: PostToolUse hook that detects "edit to file X within Y minutes of previous edit to file X, both while `.needs-verification` is set" - inject a hard reminder: "you may be debugging a symptom with multiple root causes; run an external probe before fix #2 lands."

### 4. The hook layer has no inventory, no governance, no precedence doc
- **Evidence**: 16+ hook scripts now exist. Flag files (`memory-dirty`, `needs-verification`, `screenshot-pending`, `voice-enabled`) have implicit precedence. validation-guard.sh and bash-guard.sh contain duplicated trigger-block logic. The May 12 reflection flagged this; the gap has widened.
- **Confidence**: high
- **Implication**: Write `decision_hook_system_architecture.md`. List every hook, every flag file, the precedence order, and which scripts duplicate which logic. This pays for itself the next time a hook misfires (which will be within a week at current rates).

### 5. CLAUDE.md is approaching unreadable scale, and the installed copy is drifting from source
- **Evidence**: source = 226 lines, installed = 378 lines (67% drift in 2 weeks). The May 1 commit "Fix CLAUDE.md bloat" recognized this; the file has accreted another 150 lines since. session_2026-05-18_voice-mute-hook-gating.md confirms edits to the installed copy directly.
- **Confidence**: high
- **Implication**: Split into a slim "always-loaded" core (rules that govern every response - under 100 lines) and topic-specific guidance loaded on demand via skills. Next installer run will silently lose the divergent edits unless this is reconciled.

### 6. Validation hooks block legitimate debugging probes
- **Evidence**: bash-guard.sh blocks `getComputedStyle`, `getBoundingClientRect`, `.textContent` reads inside `cmux ... eval`. CLAUDE.md's Debugging Protocol *requires* identifying state deltas first. Today's session worked around this by using external Node tests; that's the right answer here but the pattern shows the hook is misaligned with the debugging protocol it should support.
- **Confidence**: medium
- **Implication**: Downgrade the read-shortcut blocks (computed style, bounding rect) to *warnings* when no screenshot is pending. Keep the hard-deny only when actually claiming validation results. Conflating "I'm investigating" with "I'm validating" is the actual bug.

### 7. Stale memories the prior reflection asked to retire, still live
- **Evidence**: `project_discipline_enforcement_plan.md` recommends Option B, a hook built and shipped 2026-05-05; no `superseded_by`. `session_2026-05-04_handoff.md` is a 14-day-old work-in-progress handoff that was completed. `feedback_speak_responses.md` says "EVERY response must be spoken... FIRST tool call" - directly contradicted by mute-by-default and `feedback_muted_means_silent.md`.
- **Confidence**: high
- **Implication**: 10-minute pruning pass. Add `superseded_by` to each. The previous reflection recommended this; it didn't happen because reflections have no follow-through gate. Consider a SessionStart nudge that surfaces overdue reflection recommendations.

### 8. Voice subsystem is the canonical over-engineering case
- **Evidence**: 4 hooks (voice-mandate, voice-toggle, voice-gate, voice-mute-gating sessions), 3 toggle scripts, 2 feedback files (`feedback_speak_responses.md` + `feedback_muted_means_silent.md`), 1 CLAUDE.md rewrite. Voice ships muted by default per claude/CLAUDE.md.
- **Confidence**: high
- **Implication**: Collapse into a single state machine: `~/.claude/.voice-enabled` is the only source of truth. SessionStart reads it, emits ONE injection (active mandate, muted notice, or silence if MCP not installed). Delete the others or merge them into voice-mandate.sh. Two memory files for the same rule is exactly the "rules in motion" pattern Jonah explicitly distrusts.

### 9. The "rule → feedback → hook" escalation pattern needs to be a formal SOP, not an instinct
- **Evidence**: `feedback_hooks_evolve_over_time.md` names it. `project_discipline_enforcement_plan.md` operationalizes it. `reflection_2026-05-12.md` lifts it into narrative. Every major compliance win followed it. No template exists for actually writing a hook; each new hook is bespoke.
- **Confidence**: medium
- **Implication**: Write a one-page "How to add a hook" reference (PreToolUse vs PostToolUse, flag-file patterns, settings.json wiring, matcher gotchas, override protocol). Standardize. This compounds because the next hook is cheaper to build correctly.

### 10. Hooks now reach into improv-specific product code (bash-guard hardcodes `window.__improv`)
- **Evidence**: bash-guard.sh contains improv-namespace patterns. Other hooks (validation-guard, screenshot-mandate) reference cmux specifically. The original goal of portable dotfiles is leaking.
- **Confidence**: medium
- **Implication**: Decide: (a) the hook layer is intentionally workstation-local and is no longer a portable artifact (then the dotfiles README should say so), or (b) project-specific patterns move to `<project>/.claude/hooks/` and the global layer keeps only universal rules. Today's hybrid pretends it's portable while not being so.

## Open questions

- **Are you actually hitting friction on routine work right now, or is the workflow tolerable?** The intensity analysis says yes-too-much; your tolerance is the calibration variable. If you're not bothered, leave it alone. If today's "Fix B made it worse" felt like a workflow failure rather than a one-off mistake, that's the signal to act.
- **Do you want pruning as a one-shot session, or built into a recurring hygiene routine?** Option A: spend 30 minutes on a cleanup pass (mark superseded, consolidate voice hooks, drop Read from memory-nudge). Option B: write a SessionStart nudge that surfaces stale memories and over-active hooks for the user to act on.
- **Is "hook for everything" the right philosophy, or should it have an upper bound?** No reflection has questioned this assumption yet. The corpus reads as "if a failure happens twice, hook it." At 16 hooks that may need a cost ceiling.

## Recommended actions

In order of best-leverage-for-least-work:

1. **Drop Read from memory-nudge PostToolUse matcher.** One-line settings.json change. Eliminates 6+ false positives per investigation session.
2. **Extend verify-before-done.sh clearing patterns** to cover test commands and external probes. Server-only commits stop being gate-stuck.
3. **Mark the 3 stale memories superseded**: `project_discipline_enforcement_plan.md`, `session_2026-05-04_handoff.md`, `feedback_speak_responses.md`. 10 minutes.
4. **Write `decision_hook_system_architecture.md`** - one-page inventory + precedence + flag-file conventions. The next misfire pays this back.
5. **Build the second-fix gate** described in finding #3. Today's session is the proof-of-need.
6. **Audit CLAUDE.md size**. Split slim-core + on-demand topic files. Reconcile source vs installed divergence.

Everything else (consolidate voice, downgrade validation read-shortcut block) can wait until the above settle.

## Collaborator
Jonah

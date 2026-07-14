---
name: PM structural briefing - hook-level dependency breakout (cmux = only external foundation dep) + beats cutover plan + Jonah's 5 corrections
description: Reframe after Jonah corrected a design-lens misread of the :4832 page - the notes are a problem inventory, not a design. Built a PM-grade briefing (problems triaged, hook dependency breakout that the :4832 map skipped, beats cutover plan). Key analysis result - cmux is the ONLY foundation dependency outside the repo; 6 cmux-only hooks (1 execs the binary, 5 couple to cmux internals, 1 env). Cutover recommendation = cut over on benchmark evidence since the usage-evidence gate was never run.
type: project
relates_to: [session_2026-07-13_state-of-the-union.md, session_2026-07-02_beats-search-protocol-gap.md, reference_component_dependency_map.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: browser
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-14. Session opened on Fable (orchestrator-only, write-blocked); Jonah then switched the session to Opus 4.8, which restored the write path, and delivered five corrections that reframed the whole task.

## Jonah's 5 corrections (the reframe)
1. The :4832 page's notes are a **problem inventory, not a design**. He wanted the notes ANALYZED as serious problems, not the page admired. My first-pass "verified the page renders / found a page defect" read was the wrong lens entirely.
2. He needs a **project-manager-level explanation** of the problems - impact, blast radius, priority - not an engineering walk-through.
3. The dependency map **skipped the hooks**. He has hooks specific to cmux only and needs "what depends on what" at the hook level. The :4832 map drew components as blocks and never opened them.
4. The **beats cutover needs a real plan**, and search was "never truly executed properly despite my varied moments of asking questions that required the search." Confirms the thin parallel-run record is the core problem, not a footnote.
5. **The node clicks on :4832 work** - so the "4 of 16 nodes have no evidence panel = page defect" reading I made on 2026-07-13 (never persisted as a beat - Fable orchestrator mode blocked that write) was a FALSE POSITIVE from the browser tool (Claude-in-Chrome / the desktop Browser pane) failing to register clicks on the tier-3/island nodes, not a defect in the page. The nodes ARE clickable and do open panels. Lesson: do not diagnose a page defect from a tool that may itself be failing to interact - the read-page interactive scan not listing those 4 as buttons was the tell I misread.

## Browser-pane tooling notes (reusable, re-confirmed live today)
- The Claude desktop Browser pane (mcp__Claude_Browser__*) DOES capture position:fixed overlays in screenshots (the :4832 evidence panel captured fine) - closes the state-of-the-union "overlay verification needs a human eye" gap for the desktop surface.
- The pane's synthetic wheel-scroll (`computer scroll`) times out at 30s and WEDGES the compositor: subsequent screenshots return black/half-composited frames while get_page_text/read_page/console stay correct. Recovery: navigate (reload) or resize_window forces a clean repaint. Reliable capture path for a long page = fresh navigate at a TALL viewport (e.g. 1180x5200) so the whole page composites in one frame. Hit this ~5 times this session.

## The analysis result that mattered most - hook-level dependency breakout
Read the live wiring in settings.json (not the source tree) + classified each hook's real coupling. Findings:
- **~45 hook wirings fire across 7 lifecycle events** (PreToolUse, SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd, Pre/PostCompact). claude/hooks/ has 83 files but many are tests/.bak/.json/.py-helpers.
- **cmux is the ONLY foundation dependency that lives OUTSIDE the repo.** beats, sidecoach, justify are all in-repo - their hooks version together with them, so any change is atomic and self-repairable. That is the precise, correct reason cmux is highest-risk - sharper than the state-of-the-union's "10 hooks invoke the binary."
- **6 cmux-only hooks** (delete cmux -> these have no reason to exist), and the coupling type matters:
  - `cmux-close-guard.sh` (PreToolUse Bash) - the ONE that actually EXECS the cmux binary (resolves ~/.claude/cmux/cmux or /Applications/cmux.app/.../cmux to verify surface ownership before a close). Hard CLI dependency.
  - `cmux-teammate-shim-heal.sh` (SessionStart) - heals cmux's agent-teams tmux shim. Couples to cmux INTERNALS.
  - `node-shim-heal.sh` (SessionStart+Stop) - heals cmux's NODE_OPTIONS restore shim. Couples to cmux INTERNALS.
  - `team-reaper.sh` (SessionStart+SessionEnd) - reaps cmux team records under ~/.claude/teams/. Couples to the record format.
  - `resume-guard.sh` (SessionEnd) - deletes cmux/nyx session files to block auto-resume. Couples to the session-file layout.
  - `agent-teams-guard.sh` (PreToolUse Agent) - gates Agent/Workflow spawns when CMUX_* env says teams-mode active. ENV-only.
- **Reframed risk:** only 1 of the 6 depends on the cmux CLI; the other 5 couple to cmux's UNDOCUMENTED internal file/env artifacts (shims, team records, session files) - arguably the MORE fragile coupling, because a stable CLI is a contract and internal temp-file layout is not.
- **Softer (not cmux-only):** claude-surface.sh + surface-visual-gate.sh read CMUX_BUNDLE_ID for surface detection but degrade fine without cmux. **Not dependencies at all:** bash-guard, verify-before-done(-stop), validation-guard, grounding-guard, screenshot-open-mandate merely name cmux as ONE remedy among several (Chrome MCP is the other).
- Other targets: **beats** = 8 hooks (beats-rebuild, beats-staleness-guard, beats-reflect-weekly, memory-nudge/-compact/-approve, consolidate-nudge, reflect-nudge) on beats.py + .claude/memory, in-repo. **sidecoach** = 7 hooks + sidecoach_lanes.py parity, in-repo. **justify** = 2 hooks + live :9223/:9224 daemon. **harness-internal** = ~20 hooks with no external tool dep (safest tier).

## Beats cutover - live state verified today + the plan
Verified live (python3 beats/beats.py):
- Engine WORKS: search returned the exact right beat (cutover-confirmation) rank 1 for "beats cutover parallel run plan" - even though the index is STALE. Recorded recall = 45/48 = 93.75%.
- **Index is STALE right now**: "compiled index does not match the corpus on disk." beats-rebuild fires on WRITE (PostToolUse), not on `git pull` - so a beat pulled from another machine leaves the local index stale until the next local write. Real cross-machine gap.
- **Index re-saturated**: MEMORY.md is 22,877 / 23,000 bytes - the compactor will evict new pointers again (same bug as the 2026-07-02 parallel-run-hardening fix, recurred).
- Parallel-run mandate still injecting (today 2026-07-14 <= BEATS_PARALLEL_RUN_END 2026-07-16); auto-expires 07-16.

The plan (recommended = Option A): the original gate ("zero unexplained misses over ~2 weeks of REAL search use") is **unmeetable** - the parallel run's usage never happened. So:
- **Option A (recommended): cut over on the 48-query benchmark** as the mechanical gate the zero-failure mandate actually calls for. Its 3 misses are documented (semantic frontier), so "zero UNEXPLAINED misses" is arguably already satisfied. Flip CLAUDE.md + retire the hand-edited index in ONE atomic commit. Trades never-collected usage evidence for benchmark evidence - state that plainly; it is a real reduction, but the other evidence was never going to arrive, and waiting repeats the diligence-dependent failure the mandate forbids.
- Option B: restart a compressed window but make a HOOK run beats.py search on every recall prompt and auto-log misses (not model-diligence). 1-2 weeks, then cut over on real data.
- Option C: never fully cut over; permanent hybrid. Lowest risk, leaves the saturation/eviction bug live forever.
- **Phased (if A): P0** recompile to clear staleness + re-run benchmark as the live gate + make the staleness guard COMPILE (not just warn) on a stale index so a pulled machine self-heals (the one genuinely new piece of work). **P1** atomic cutover commit - flip CLAUDE.md startup to "index + ACTIVE beats + beats.py search", retire read-everything, remove the spent parallel-run injection; retiring the hand-edited index also fixes saturation by construction. **P2** one-week watch - search is now the only path so misses surface themselves as benchmark cases.

## Deliverable
Built a PM briefing as a self-contained HTML artifact (scratchpad/improv-briefing.html): utilitarian triage treatment (cool-slate neutrals, teal accent, severity system carrying the visual weight, SF Pro + SF Mono, mono doing real work on file:line evidence), three sections (problems triaged by blast radius; hook dependency breakout with the cmux spotlight; cutover decision + 3 options + phased plan + honest-caveats box). Verified in the Browser pane: full-page composite clean, all severity pills/stripes correct, dashes are hyphens, theme toggle works. NOT published to a hosted Artifact - the tool requires an emoji favicon, which collides with the no-emoji rule; left as a decision for Jonah.

Problems triaged: 3 High (cmux external/unpinned; sidecoach-sessionstart.sh:4 hard-coded /Users/spare3 = the one non-portable hook, small fix = best ROI quick win; marketing-site 7-page :9223 daemon dep now cross-repo), 3 Medium (dogfood mkdirSync ghost-dir resurrection; sidecoach/mcp-server dead-but-tripwired by the parity contract; reference/serve.py port-4830 collision-by-convention), 4 Low (install.sh:364 dead ghostty/shaders path; orphan ~/.claude/skills/improv; public/justify-core.js tracked-despite-gitignore; stale .justify marker), 1 by-design (beats/mcp-server inert on purpose).

## Self-analysis (the design-lens miss)
Failure mode: the sidecoach/design framing was so available that I processed "look at this page" as "verify/critique the UI" and produced a design-verification report for what was a problem list. The signal I missed: the page's entire content is a debt inventory titled "honest findings" - the medium is a page but the payload is problems. How to catch earlier: when a "look at X" target is itself a report/inventory, the task is to engage its CONTENT, not audit its presentation. Recorded so the design-lens does not auto-capture content-analysis requests again.

## Files touched
- .claude/memory/session_2026-07-14_structural-briefing-and-hook-deps.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
- scratchpad/improv-briefing.html (deliverable, not in repo)

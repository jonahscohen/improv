---
name: STATE OF THE UNION - full audit record, day log, and ranked next steps (2026-07-13)
description: Jonah-ordered consolidated record - the dependency audit (all 11 findings + classifications), the day's three deliverables with commits, every process/harness finding, lead self-analysis, beats-cutover status, and the ranked next-step queue. The single reference point for sorting the problem pile.
type: project
relates_to: [reference_component_dependency_map.md, session_2026-07-13_marketing-site-move.md, session_2026-07-13_teammate-pane-wrong-workspace.md]
author_human: Jonah Cohen
author_model: claude-fable-5
source: session
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-13. Jonah: "Document EVERYTHING in one big beat." This is that beat - the consolidated audit record, day log, and next-step queue. Detail beats exist for each unit (see relates_to); this is the master index of the day.

## 1. The day's three deliverables (all complete, all pushed)

1. **Repo updated**: accumulated multi-session work committed as cca3aba3 (45 files: hook guards + tests, justify freeze/watch/consent work, cmux node shim, install.sh, .gitignore) + beat 94e75bfe. FINDING: two commits (62b04e7f, 3239cd68) had been sitting committed-but-unpushed on this machine - invisible drift; git status looked clean while the work existed nowhere but this disk. They rode up with the push.
2. **Dependency audit + visualization**: evidence-sweep by a read-only teammate (every edge verified at file:line), lead-synthesized classification, page built at docs/dependency-map/index.html, served at http://localhost:4832/ (detached, PPID 1) and displayed in browser pane surface:35. Commits: 15f489ad (page) -> 6dae9088 (responsive fix) -> 6b217294 (pane beat) -> f9d80123 (site-move updates). 10 Codex findings folded on the page build, zero declines; a responsive regression (inline custom property outranking media queries) was caught by the lead acceptance gate and fixed.
3. **Marketing site moved out, period**: full byte-identical copy to ~/Documents/Github/improv-site (own git repo, initial commit d2e67fc, NO remote per Jonah - site is a separate workstream), git rm -r from improv (f9d80123, pushed), :4830 re-served from the new path (verified: fonts load, vendored tilt-runtime executes, justify :9223 shows Connected - the cross-repo runtime edges are live, not theoretical).

## 2. The dependency audit - classifications

- **FOUNDATION (everything stands on these)**: claude-harness (CLAUDE.md + 60+ hooks + 18 skills + settings.json), install.sh (+bootstrap; sole deploy path, 137KB), beats (memory/retrieval engine), .claude/memory corpus (~880 beats), cmux (EXTERNAL binary - 10 hooks point outside the repo; highest-risk dependency in the map).
- **TOOLS WITH DEPENDENTS**: sidecoach (most-wired application: 4 hooks + parity contract + CLAUDE.md design gate), justify (MCP daemon :9223/:9224; 7 site pages + 3 hooks consume it), tilt-lab (:5180; runtime vendored byte-for-byte into the marketing site).
- **LEAF CONSUMERS**: marketing-site (NOW EXTERNAL at ~/Documents/Github/improv-site, still consumes justify + vendored tilt-runtime), reference (:4831 docs manual).
- **STANDALONE**: lotus (genuinely independent - nothing consumes its output), ghostty+shaders, docs/superpowers archive (87 files, zero live refs), assets.
- **SUPPORTIVE**: beats/bench -> beats; beats/mcp-server -> beats (INERT, deliberate); sidecoach/mcp-server -> sidecoach (INERT BUT PARITY-BOUND); bin -> tilt-lab/cmux; public -> justify (LEGACY tracked artifact); skill launchers -> tilt-lab/lotus/sidecoach.
- **ISLANDS**: test-site-1 (dead since 2026-05-25, zero real edges), cmux/settings.json (legacy since 2026-04-11, 100% commented out, still symlinked by install.sh).

## 3. The 11 findings (the honest list, verbatim from the page)

1. install.sh:364 points at ghostty/shaders which does not exist (real path: top-level shaders/); the TUI open-directory for shaders silently fails.
2. .justify marker still references pre-rename /public/improv-core.js.
3. public/justify-core.js is tracked in git despite .gitignore:5 - the ignore never took effect.
4. ~/.claude/skills/improv/SKILL.md is deployed with no source - rename orphan install.sh will never clean.
5. sidecoach/mcp-server is built but wired to nothing; only the parity contract in sidecoach_lanes.py keeps it alive.
6. beats/mcp-server is deliberately inert (install hint only).
7. The marketing site hard-codes http://localhost:9223/justify-core.js on 7 pages - a daemon dependency that now crosses a repo boundary; pages degrade when the daemon is down.
8. sidecoach-sessionstart.sh:4 hard-codes an absolute /Users/spare3 path - the one hook that breaks on any other machine (beats hooks derive their root correctly).
9. reference/serve.py is a copy of the marketing serve.py with the same default port 4830 - only convention prevents collision.
10. cmux is the highest-risk dependency: an external binary with 10 in-repo consumers.
11. The sidecoach dogfood scripts and the TASKS.md marketing-site area now point at a path that left the repo; sharper: dogfood-teach-step1.ts:14-15 calls mkdirSync on the missing path, so running it silently RESURRECTS an empty marketing-site/ dir inside improv.

## 4. Process and harness findings from the day (each verified live)

- **Teammate panes spawn into the wrong workspace**: the lead process env carries CMUX_WORKSPACE_ID bound to ppai (workspace:1) while the lead's surface lives in improv (workspace:5); cmux creates surfaces against the env var, so every teammate pane rendered in ppai, invisible to Jonah. NOT the tmux shim (measured: shim byte-identical to canonical fix). Patch applied per-spawn (cmux move-surface); CURE: relaunch the lead from the improv workspace. Full record: session_2026-07-13_teammate-pane-wrong-workspace.md.
- **Lead self-analysis (Fable)**: (a) I hypothesized shim regression from beats precedent and dispatched a fix without a delta trace - the builder's measure-before-acting discipline caught it; a pattern-matched signal is not a diagnosis. (b) I verified teammate work-product all day but never verified pane visibility from Jonah's side - lost observability without noticing. (c) The teammate no-relay failure recurred FOUR times across three teammates (reports printed to terminal instead of SendMessage) - the dispatch template now demands SendMessage explicitly, but this wants a mechanical fix, not prompt discipline.
- **Orchestrator-only mode gaps** (Jonah's 2026-07-06 cost control, hook enforced): blocks Fable's Bash/Write entirely - correct for production work but (a) blocks MANDATED beat writes (CLAUDE.md says those must never be blocked - this very beat had to be written by a delegated scribe), and (b) blocked the documented team-dir repair, creating a bootstrap deadlock resolved only by Jonah pasting a ! command.
- **Team-dir orphan bug recurrence**: resumed session got teamId a5cf7a67 never initialized at startup; repaired mid-session via the documented config.json+inbox creation (reference_cmux_team_init_orphan_bug.md pattern held; Jonah had to paste the repair because of the orchestrator gate).
- **verify-before-done.sh re-arm bug**: .needs-verification is re-armed by ANY file write - beat .md writes re-armed it AFTER browser verification, forcing re-verification of an unchanged page. The SET side lacks the file-type filter the commit side already has.
- **memory-nudge.sh misclassification**: a read-only `cmux browser navigate > /dev/null` was classified as a project-file write (the redirect pattern-matched), setting .memory-dirty.
- **codex exec wedged once** (marketing-move review): 420s watchdog SIGKILL per the documented hang, leaner retry returned a real verdict in 18.9s - the codex-doctor protocol worked as designed.
- **cmux screenshot cannot capture position:fixed overlays** (dependency-map detail panel confirmed open in DOM, absent from three captures); Chrome MCP renders overlays but save_to_disk returns an image ID with no filesystem path. Verification of overlay UI currently requires a human eye or scripted tooling (playwright not installed).
- **Silent commit drift**: committed-but-unpushed work survives invisibly (git status clean). Candidate fix: a status -sb ahead-check surfaced at session start or pre-stop.

## 5. Beats system status (the other active workstream)

- Build phase (stages 1-5) complete and committed 2026-07-02: benchmark (48 queries, bar >= 90%), compiler + FTS5, hybrid search (qwen3-embedding:0.6b via brew-managed ollama, RRF fusion; 45/48 = 93.75% GATE PASSED after Jonah's q21 corpus-truth ruling), rebuild-on-write hook (~1s incremental), session-start staleness guard.
- **Parallel-run window (2 weeks from 07-02) has ELAPSED.** Known gap recorded 07-02: CLAUDE.md still mandates full-read at startup and nothing wires beats.py search into session behavior - the retrieval layer shipped but the protocol layer was never updated (session_2026-07-02_beats-search-protocol-gap.md). Two recall sessions self-audited as answering via grep instead of search - the parallel run produced weak usage data, mostly retrospective probes (which passed).
- **Cutover decision is RIPE and is Jonah's**: retire the hand-edited MEMORY.md index + flip CLAUDE.md in the SAME commit, per feedback_memory_first_zero_failure_execution.md steps 6-7. Honest caveat for that review: the parallel-run evidence is thinner than designed because search was never wired into the protocol.
- Backlog (in TASKS.md improv area since 07-02): provenance frontmatter fields, scheduled weekly reflect, MCP surface for other models (beats/mcp-server exists, deliberately unregistered).

## 6. Ranked next steps

1. **Jonah, next session**: relaunch the lead from the improv workspace (cures invisible teammate panes; today's per-spawn moves were the patch).
2. **Mechanical-fixes batch** (one teammate unit, ~an hour): verify-before-done re-arm filter; memory-nudge redirect misclassification; orchestrator-mode carve-out for .claude/memory beat writes; push-ahead check; install.sh:364 dead path; delete orphan ~/.claude/skills/improv; untrack public/justify-core.js (+map); delete stale .justify marker; consider team-dir lazy-init or reaper fix for the orphan bug.
3. **Beats cutover review** (Jonah decision, real upside): review the thin parallel-run record honestly, wire beats search into the session protocol (the missing piece), then flip CLAUDE.md + retire the hand-edited index in one commit.
4. **improv-site workstream** (Jonah's, separate by his instruction): remote/hosting decision, the :9223 hard dependency (finding 7), un-vendoring or pinning tilt-runtime, and cleaning the dead improv-repo references incl. the dogfood mkdirSync ghost (finding 11).
5. **sidecoach structural debt**: portable-root fix for sidecoach-sessionstart.sh (pattern exists in beats hooks); decide the parity-bound inert mcp-server's fate (wire it or retire the contract).
6. **Suites-not-run gap from the accumulated commit**: the justify vitest suites and five new hook test suites in cca3aba3 were committed syntax-checked but never executed as a gate - run them once as their own unit.
7. **Islands**: decide test-site-1 (archive or delete) and the legacy cmux/settings.json symlink (retire from install.sh).
8. **Teammate relay failure**: consider a Stop-time hook for teammates that blocks going idle with an unsent report when a lead dispatch demanded SendMessage.

## Files touched
- .claude/memory/session_2026-07-13_state-of-the-union.md (this beat)
- .claude/memory/MEMORY.md (index pointer)

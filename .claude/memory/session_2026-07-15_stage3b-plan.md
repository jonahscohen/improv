---
name: Stage-3b plan (MANDATORY) - package the 7 unmanaged hooks + cosmetic fixes + memory-formatter root-cause
description: Jonah ruled 3b mandatory (not deferred) - every hook must be owned. Audit found 7 unmanaged hooks. Plus fix 2 cosmetic items and root-cause the beats-rebuild MEMORY.md revert. All confirmed 2026-07-15.
type: project
relates_to: [session_2026-07-15_stage3-plan.md, session_2026-07-15_stage2-execution-progress.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: audit run (7 unmanaged hooks); execution pending
confidence: high
---

Stages 1-3 committed (Stage 3 = a6d1280e/f2be8c37; config is core-only). Jonah CORRECTED my "3b deferred" framing: **3b is mandatory - every hook must be packaged + categorized.** Self-analysis: I mis-framed chrome/figma as optional and MISSED justify-watch-standing-by entirely (moved 2 of justify's 3 hooks in Stage 3). The taxonomy's whole point is total ownership; "deferred" contradicted it.

**AUDIT - 7 unmanaged hooks (not in any install.sh component/cluster/wirings):**
- justify: `justify-watch-standing-by.sh` (my Stage-3 miss) -> justify component
- chrome (NEW public component): `chrome-tabgroup-track/clear/stop.sh`
- figma (NEW public component): `figma-fidelity-stop.sh`
- memory: `beats-rebuild.sh`, `beats-staleness-guard.sh` (the beats subsystem's own hooks) -> memory component

**CONFIRMED DECISIONS (Jonah 2026-07-15):**
1. 3b scope: YES as categorized (above).
2. Cosmetic: FIX BOTH - (a) install.sh final "what was installed" summary still says config installs hooks (~line 3635, contradicts core-only); (b) the RETURNING-USER TUI flow installs a full cluster with no drill-in (only the fresh-install run_tui got phase-2 drill-in; the returning flow does `--only <pick> --yes` ~install.sh:1824).
3. Memory formatter: ROOT-CAUSE the beats-rebuild MEMORY.md revert, then Jonah rules.

**3b MECHANICS (reuse the proven machinery):**
- chrome/figma/standing-by wiring is NOT in base or app-wirings.json yet. chrome-tabgroup + figma-fidelity ARE in the LIVE ~/.claude/settings.json (hand-added); justify-watch-standing-by is in NEITHER (needs wiring authored). EXTRACT chrome/figma entries from live settings into app-wirings.json; author standing-by + beats-rebuild + beats-staleness wiring (check their hook headers for event/matcher).
- Add chrome/figma to public KEYS+arrays+detect(is_our_hook)+deactivate+dispatch (like clickup/visualizer/codex).
- Extend section 16e: `picked chrome && install_app_hooks chrome-tabgroup-*.sh`; `picked figma && install_app_hooks figma-fidelity-stop.sh`; add justify-watch-standing-by to the justify line; add beats-rebuild+beats-staleness to the memory line.
- Add deactivate_app_hooks for the new hooks to deactivate_justify (standing-by) + deactivate_memory (beats-*) + new deactivate_chrome/figma.
- Extend parity SELECTIONS: config,chrome / config,figma. Re-verify EVERY hook is owned (re-run the unmanaged audit -> expect 0).

**DIRTY TREE (breakdown given to Jonah):** sidecoach/dist/*.map (3 mod) + executive-report.test.* (4 new) = MY Stage-1 sidecoach npm-build artifacts (clean with git checkout + rm untracked). claude/settings.json.pre-standingby-unregister.bak (16.8KB, Jul 12, untracked, pre-session) = NOT mine (Jonah's call to delete). MEMORY-archive.md = dirty at session start, not mine.

**MEMORY-FORMATTER ROOT-CAUSE (CORRECTED 2026-07-15 - my first pass was WRONG):** there IS a post-edit writer. It is `memory-compact.sh` -> `compact-memory.py`, wired PostToolUse on Write|Edit|MultiEdit. My first-pass "no reverter" conclusion was wrong for THREE reasons: (a) I grepped the REPO `claude/settings.json`, which Stage 3 had just stripped to core-only - memory-compact moved to the `memory` app-component (app-wirings.json), so it is absent from base but STILL LIVE in the deployed `~/.claude/settings.json` because `memory` is installed on this machine; (b) I never ran the one-command edit->observe test until now (Debugging Protocol violation: I theorized from a WRITE-pattern source grep instead of reproducing the behavior); (c) BIGGEST miss - a beat already documented this EXACT symptom (`reference_memory_index_over_budget.md`, "Adding a pointer to MEMORY.md vanishes - grep finds it gone immediately after the edit, with no error"), and I did not grep the beats for it before code-diving. The record had the answer. Lesson: on any anomalous memory/beats behavior, `grep -ri <symptom> .claude/memory/` FIRST. Also PROVEN this session: my earlier index edits DID land - the compactor archived them; MEMORY-archive.md currently holds the old Stage-2/3/3b pointers (including the one carrying the wrong "no reverter" text).

WHAT THE COMPACTOR ACTUALLY DOES (compact-memory.py): parses index lines matching `- [title](file)`; line-caps each to 200 chars; if the rendered index exceeds **BUDGET=23000 bytes** it ARCHIVES oldest NON-PINNED entries into MEMORY-archive.md (pointers MOVED not deleted; beat files untouched) until under budget. PINNED = index title begins `** ACTIVE` or `** START HERE` (never archived). It ALSO drops any non-entry "stray" line that appears AFTER the first entry (line 165: `index = entries`). Idempotent (only rewrites on real change).

WHY MY EDIT VANISHED WITH AN EMPTY DIFF: committed MEMORY.md is **22766 / 23000 bytes (234 headroom, 81 entries) - essentially FULL**. My re-added lines did not survive as recognized entries. The empty-diff signature (file == HEAD exactly, my lines gone, no OTHER entry evicted) fits the STRAY-STRIP path: had they parsed as valid dated entries they would have been the NEWEST (shed last), so budget-archiving would have evicted OLD entries instead and left a non-empty diff. They were malformed/stray and stripped.

CONCLUSION: MEMORY.md is still MANUALLY maintained (Jonah's "keep manual" ruling STANDS - the compactor does not GENERATE the index, only keeps it under budget). CORRECT FIX: add WELL-FORMED `- [title](file)` lines, and PIN load-bearing/active pointers with a `** ACTIVE **` title so the compactor can never archive them. Because the index sits at its ceiling, every add near budget evicts an oldest non-pinned pointer to the archive - that is BY DESIGN, not a bug. Does NOT change 3b execution (memory-compact is already memory-owned as of Stage 3; 3b only adds beats-rebuild + beats-staleness to the memory component). See reference_memory_index_over_budget.md.

**3b EXECUTION STATUS:** plan complete above; all decisions confirmed. Execution (chrome/figma components, justify-standing-by, memory beats-hooks, cosmetic x2) is a fresh Stage-2-sized build - carried by THIS beat for continuation. Next actionable: extract chrome/figma entries from LIVE ~/.claude/settings.json into app-wirings.json (safe foundation, like the Stage-3 app-wirings gen); author standing-by + beats-rebuild + beats-staleness wiring from their hook headers; then components + 16e extension + strip + verify(unmanaged audit=0) + Codex + commit.

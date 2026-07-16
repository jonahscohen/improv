---
name: Bucket-browser interactive HTML prototype built + verified
description: Jonah asked for a fully-interactive HTML mock of the installer bucket browser before the bash build. Built at docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html; drove every interaction in the Browser pane and verified with screenshots. Awaiting Jonah's reaction before writing the implementation plan.
type: project
relates_to: [decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: browser (screenshots of 3-level drill, staging, rollup, apply) + gap-fix re-verified
confidence: high
---

Jonah, at the spec-review gate, asked to SEE a fully-interactive HTML mock demo before proceeding. Built a self-contained terminal-styled prototype of the bucket browser and drove it live in the Browser pane.

**File:** docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html (self-contained; monospace terminal window aesthetic; tokyonight-ish palette matching the installer's teal/cyan gum accents; keyboard + mouse nav).

**Faithful to the approved design:** nested screens (bucket list -> bucket -> cluster hooks), rollup status (● active / ◐ partial / ○ not installed + N/M counts), per-item toggle, Install all.../Uninstall all..., staged-then-apply (pending +install/-uninstall markers that roll up; a persistent "Apply changes (N)"). Seeded a realistic partial machine (Core 6/6, Channels 0/3, Tools 2/7, Apps 3/6, QA clusters 5/8 with question-discipline 2/4, Skills 0/11).

**VERIFIED live (screenshots):** 3-level drill works; rollup correct at every level; toggling a not-installed hook stages "+ install" (keeps its ○ current glyph) and the pending propagates cluster +1 -> bucket +1 -> Apply changes (1) -> "+1 pending" footer; Apply commits, clears pending, refreshes.

**Two things handled during the build:**
- A security hook blocked the first Write (innerHTML XSS warning). Content is 100% static, so it was a false positive - but I COMPLIED rather than bypassed: rebuilt all rendering with safe DOM methods (createElement + textContent), no innerHTML.
- Polish bug found + fixed: long hook names (multiple-choice-detect-stop = 27ch) collided with the "active" status label (min-width:24ch column). Added padding-right:2ch to .name; re-verified the gap.

**Self-inflicted browser snag (noted):** tried to reload via `navigate` to a `file:///` URL - the tool prepended https:// and broke the tab origin ("https://file", per-action-approval lockout). Recovered with `navigate back`. Lesson: don't feed `file://` URLs to the Browser-pane `navigate` tool; the write/edit hook auto-loads the file into the pane, and `navigate back` recovers a broken origin.

**ITERATIONS (Jonah's live feedback, each verified in the Browser pane):**
1. GROUPS WERE WRONG (Jonah: "worried about your understanding"). My first cut used the --help wiring categories (Core/Channels/Tools/Apps/Clusters/Skills = an implementation grouping, grab-bags). Re-grounded in the real KEYS inventory and reworked to PURPOSE-based silos. Lesson: --help categories are how components are WIRED, not how a human browses them.
2. Jonah: surface Sidecoach, Justify, Tilt-lab, Lotus, Beats at the VERY TOP as the centerpiece; rename Memory->Beats, Design->Design Tools. Implemented a CENTERPIECE tier (cyan) above MORE COMPONENTS.
3. "clear wayfinding language - UX is key": added breadcrumb, per-level plain-language lead + "N of M installed", short taglines, a live detail line (what the highlighted item is), and contextual actions ("Install all of Design Tools...", "Back to Guardrails").
4. Jonah: let people see EVERY hook under each component that manages it and jump into that object's "hooks group" to toggle hooks on/off. Implemented: every hook-owning component (Beats/memory, Sidecoach, Justify, codex, chrome, figma, cmux, clickup, visualizer, fable, voice-output, + the 8 clusters) is now drillable to its hooks (hook names shown in a distinct purple, contextual "Enable/Disable all X hooks..."). Generic N-level tree made this a data-only change. VERIFIED: drilled Justify -> its 3 hooks -> toggled justify-source-guard -> "+ install" staged, "+1 staged" footer.

**Current structure (purpose-based, in the prototype):**
- CENTERPIECE: Beats (memory+reflect, each a hooks group), Sidecoach (hooks), Justify (hooks), Tilt-lab (leaf), Lotus (leaf)
- Foundation: brain, config, statusline, ampersand, nvm (leaves)
- Design Tools: Skills (11), figma (hooks)
- Guardrails: 8 clusters + fable/codex/chrome/visualizer (all hooks groups)
- Voice & chat: discord, voice-input, voice-output(hooks)
- Dev surface: cmux(hooks), task-list, clickup(hooks)
- Personal: ghostty, shaders

**Prototype UX gotchas learned:** the Browser pane does NOT hard-reload on Write/Edit (shows a stale cached render); force with cmd+r on a clean file: origin (NOT `navigate` to a file:/// URL - that tool prepends https:// and breaks the tab; `navigate back` recovers). Tagline truncation was purely the pane being narrow (viewport 617px); DOM has full text.

5. Jonah: "too far left" - I'd made each component (memory) drill into ITS hooks. He wants: click a GROUP like Beats -> see memory, reflect, AND the hooks Beats depends on in a "Hooks" FOLDER; plus hook DESCRIPTIONS on hover. Restructured: Beats -> [memory (leaf), reflect (leaf), Hooks (folder, ▾, purple) -> 7 beats hooks]. Added a HOOK_DESC map (~55 one-line descriptions) so every hook shows its description inline (dim tag) + in the detail bar on hover. Single hook-owning components (codex, chrome, justify, cmux, figma, clickup, visualizer, fable, voice-output) and the 8 clusters still drill directly to their hooks (shallower - only Beats-style multi-component groups get the members+Hooks-folder split). VERIFIED (screenshots): Beats -> [memory active, reflect not-installed, Hooks ▾ 4/7]; Hooks folder -> the 7 beats hooks in purple with descriptions; wide-width (1180px) shows all taglines/descriptions in full. Fixed a wayfinding-label bug: the Beats "Hooks" folder's bulk action read "Enable all Hooks hooks" -> now special-cased to "Enable all hooks..." (label fix in file; general case "Enable all <X> hooks..." verified earlier via Justify).

**Prototype-model RULING (Jonah 2026-07-16):** single hook-owning components drill DIRECTLY to their hooks (one level, no redundant inner "Hooks" folder). ONLY multi-component groups like Beats - which have real sub-components (memory, reflect) to separate from their hooks - get the members + Hooks-folder split. This is what's built. Model is now locked end to end.

**Browser-pane flakiness (learned):** after repeated resize + cmd+r + a broken file:/// navigate, the pane degraded - clicks select rows but stop ACTIVATING handlers, and cmd+r stops reloading. Reset by re-Writing the file (auto-show) or reopening the tab. Verify prototype changes EARLY before the pane degrades. Viewport/screenshot scale mismatch (e.g. 1180x820 vs 800x556) makes coordinate clicks unreliable; ref clicks work best at 1280x720 (800x450 screenshot).

6. Jonah (2026-07-16): (a) move Foundation INTO the top tier; (b) rename "Centerpiece" -> "CORE COMPONENTS"; (c) add an UPDATE affordance for when a fresher Improv has been pulled. Done + VERIFIED (clean centered screenshot at 1000x780): CORE COMPONENTS = [Foundation (first, active 5/5), Beats, Sidecoach, Justify, Tilt-lab, Lotus]; Foundation removed from MORE COMPONENTS; a green "↻ Update available - sync your setup to the latest Improv" row at the top of root with a detail line "A fresher Improv is in your repo (rev X -> Y). Re-sync your installed components to it." (maps to the real installer's check_updates/apply_update pull-then-resync flow; clicking clears the flag + toasts). Confirmed by Jonah the earlier visual "looks good".

7. Jonah: the update section should say "Up to date" when no update is needed (matches the real installer's `ok "Up to date"`). Made the root update row TWO-STATE: `↻ Update available - sync your setup to the latest Improv` (green) when remote is ahead, else `✓ Up to date` (dim) with hint "Your installed setup matches the latest Improv - nothing to sync. Select to re-check." Both states VERIFIED via real screenshots (flipped the demo flag to see each). Demo default = Update available (the actionable state; flips to Up-to-date on click/sync).

**REAL UPDATE-FLOW MECHANICS (grounded in install.sh, for the bash build):** `check_updates()` = `git fetch origin main` + `git log HEAD..origin/main` (auto-detects if remote is ahead; needs a remote + network). `apply_update()` = `git pull --ff-only`. `hook_deploy_mode` default = auto -> SYMLINK on a real git checkout (so a pull makes symlinked hooks/skills LIVE immediately), COPY on a temp/snapshot checkout. Copied/merged/built pieces (config settings-merge, CLAUDE.md, ghostty, and built components like justify's daemon via justify/install.sh) need the install RE-RUN to re-sync/rebuild - a pull alone doesn't update them. So the browser's Update action must do BOTH pull + re-run-install-for-active-components, then refresh. Cross-machine (boss/Justify scenario): only works if the change was PUSHED to the shared remote; boss's fetch detects it, pull applies it, symlinked justify hooks/skill go live, justify daemon rebuilds on the re-run. Edges: no-remote/offline -> hide/grey (can't check); non-ff (local commits) -> warn "resolve first" not silent-fail. Spec'd for writing-plans.

**Status:** prototype matches Jonah's model + the hooks-group feature works. NEXT: Jonah reacts; then finalize the spec's bucket taxonomy to match, and writing-plans -> bash implementation. Still no product code (install.sh untouched). The spec (docs/superpowers/specs/2026-07-16-installer-bucket-browser-design.md) still has the OLD --help bucket taxonomy - must be updated to the purpose-based + hooks-group structure before planning.

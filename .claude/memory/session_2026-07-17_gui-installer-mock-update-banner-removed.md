---
name: GUI installer mock "Update available" banner removed (v1 honesty fix)
description: Removed the prototype-inherited fake update banner + fake rev data from claude/installer-gui/index.html; deferred-feature cleanup, browser-verified
type: project
relates_to: [session_2026-07-17_gui-installer-design.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: browser
confidence: high
---

Closed the spawned follow-up (task_43e6d3c7, flagged at line 49 of the GUI installer design beat): the GUI page `claude/installer-gui/index.html` still rendered the bucket-browser prototype's MOCK "Update available - sync your setup to the latest Improv" banner with hardcoded fake rev data ("A fresher Improv is in your repo (rev 1ca3ef9 -> a7e6729)"). It always showed "Update available" with fake revs regardless of real state - misleading.

**Choice: option (a) - clean removal** (Jonah's recommendation; also the honest v1). Option (b) (wire a real /update-status endpoint off install.sh's check_updates/update_status machinery) was rejected for v1 because the real update/re-sync feature is DEFERRED by design (see the gui-installer-design beat, Scope v1 / Deferred list). Building it now would contradict the locked design decision. (b) remains the real fix when the update feature is un-deferred.

**5 surgical removals in index.html (pure deletion, no new logic):**
1. CSS `.upd`/`.utd` row-color rules (were only used by the banner).
2. `updateAvailable` state var (was `let nav=[], sel=0, updateAvailable=true;` -> `let nav=[], sel=0;`).
3. The two `rows.push({type:'update'...})` / `{type:'uptodate'...}` banner rows at the top of `buildRows()` (nav.length===0 branch) - list now goes lead -> CORE COMPONENTS directly.
4. The `update`/`uptodate` branches in `render()` (dropped from the `.action` class list + removed the two `d.classList.add('upd'/'utd')` lines).
5. The `update`/`uptodate` branches in `activate()` (the fake "Synced... (a7e6729)" and "Checked for updates" toasts).

**Why:** honest v1 - never show a fabricated rev delta. **How:** deleted the mock rows + their state/handlers/styles; nothing else in the nav/staging/apply engine references them.

**Verified (browser, via `install.sh --gui`):**
- Started `AMPERSAND_GUI_NO_OPEN=1 install.sh --gui` under a throwaway HOME=/tmp/gui-verify-home; in-app Browser pane -> the launcher-printed 127.0.0.1 URL.
- Render: banner GONE. Page goes lead ("Choose what runs on this machine...") -> "CORE COMPONENTS" -> Foundation directly. No rev line anywhere. Terminal-window aesthetic intact (traffic-light dots, "ampersand - setup" titlebar, breadcrumb, footer keys). Real manifest data loaded (Foundation 0/5, Beats partial 2/9, sidecoach 0/7, etc.). read_page DOM confirms no update/uptodate node.
- Staging (real click on tilt-lab leaf): green "+ install" marker, "Apply 0 changes" -> "Apply 1 change", footer "+1 staged".
- Nav (real click drill into Foundation): titlebar/breadcrumb -> Foundation, Back/Install-all/Remove-all + leaf items brain/config/statusline/ampersand/nvm; "+1 staged" persisted across nav.
- No console errors (removing `updateAvailable` left no dangling reference).
- test-installer-gui-server.sh 6/0 before and after. Final grep: 0 residual artifacts.
- Torn down: server stopped, throwaway HOME removed.

Codex cross-model review (codex-review.py, 51.1s real verdict, exit 0): GO, no findings - confirmed no dangling refs to the removed symbols, nav/staging/apply intact, no leftover dead code.

COMMITTED to local main (Jonah chose commit-now): 1696b42b "installer: remove mock update banner from the GUI page". Only index.html staged (pre-existing uncommitted beat files left untouched). main remains local/unpushed.

**Verification-surface note (reference for future GUI-installer visual checks):** the GUI server binds 127.0.0.1 loopback-only by design. Claude-in-Chrome MCP runs on a DIFFERENT machine (see reference_chrome_mcp_lan_ip_access.md) so it CANNOT reach this host's loopback server - it hits an error page. cmux is ABSENT on this Bash-tool PATH (cmux is cmux-injected, not on the plain shell PATH). The in-app Browser pane (mcp__Claude_Browser__*) DOES render this host's loopback server correctly (used for interactive click/stage/drill verification), but its inline screenshots did not satisfy the Stop hook's on-disk-PNG visual gate. The gate-satisfying path that WORKS here: headless Chrome from Bash -> PNG on disk -> Read. Must pass `--virtual-time-budget=5000` (or similar) so the client-side `await api('/manifest')` fetch+render completes before capture; a bare `--screenshot` snaps the empty shell (static titlebar/footer only) before boot() resolves. Captured /tmp/gui-banner-removed2.png (94KB, rendered) confirming banner-gone + real manifest data on the COMMITTED file.

Files touched: claude/installer-gui/index.html.

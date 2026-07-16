---
name: Bucket browser - real-terminal visual verification (banner + 80x24 gum render)
description: Lead ran the installer in a real Terminal via computer-use and screenshotted it. The Yes& launch banner and the gum browser both verified at 80x24 with colors. One suspected duplicate row investigated and disproven as a mid-redraw artifact.
type: project
relates_to: [session_2026-07-16_bucket-browser-build-kickoff.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: real-terminal screenshots (computer-use, Terminal tier=click)
confidence: high
---

Every prior capture in this build was ANSI-STRIPPED text from the pty harness, so nobody had actually SEEN the TUI's colors, the red Yes& banner, or gum's cursor highlighting. Closed that gap directly: wrote a launch script, `open -a Terminal` it, and screenshotted with computer-use (Terminal grants at tier "click" - screenshots allowed, typing blocked, which is fine for looking).

**VERIFIED at 80x24 in a real Terminal (commit 74a38ca0 + banner):**
- The **Yes& banner renders in red** during the launch beat and HOLDS the screen through the live `git fetch` (used the implementer's `BR_LAUNCH_DWELL` seam at 20 to photograph it). Brand moment is real, not a flash. Jonah ruled "show once on launch" and that is what it does.
- The gum browser **fits entirely in 24 rows** - breadcrumb, lead (wrapped to 2 lines), update row, both section labels, all 10 bucket rows, separator, Quit, and gum's `navigate / enter submit` footer.
- **Every tag renders in FULL at 80 cols** ("rules, settings, shell", "Figma plugin + MCP bridge", "visual-effects playground") - the per-screen dynamic name width fix holds on a real terminal, not just in the harness. This was the HIGH defect the lead found earlier (tag column collapsed to ~13 chars).
- Glyphs correct per state: `●` active, `◐` partial (Foundation 4/5, Guardrails 32/34), `○` not installed. Carets encode drill type: `v` (Sidecoach/Justify -> straight to hooks), `>` (-> members), blank (leaf).
- Cursor highlighting (cyan) works. Status text is NOT color-coded per state because gum strips ANSI from items - matches install.sh's pre-existing `run_tui_gum` behavior, so consistent rather than a regression.

**FALSE POSITIVE investigated and disproven (worth recording):** the first screenshot appeared to show `✓ Up to date` rendered TWICE on adjacent lines. Suspected the banner change (which touched `_browser_update_refresh`) had duplicated the update row. Checked the committed capture (`grep -c` = 1), then re-launched and re-screenshotted after letting gum fully settle: **one row**. The duplicate was a mid-redraw artifact from catching the banner->root transition mid-frame. Lesson: a screenshot of a redrawing TUI can catch a torn frame; confirm against the byte capture and a settled re-run before reporting a render bug.

**Method note for future TUI verification:** computer-use CANNOT drive a terminal (tier "click" blocks typing/keys), and the Bash tool is not a TTY. So: `open -a Terminal <script>` to run it, screenshot to LOOK, and a python `pty.fork` + `TIOCSWINSZ` harness to drive it at forced widths. The pty harness is how the 80/100/120-col matrix was measured.

**Cleanup:** both launched installers killed; scripts removed. The browser only RENDERED - nothing was staged or applied against the real HOME.

Files: none modified (verification only).

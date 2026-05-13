---
name: Improv pipeline fix - server-served architecture
description: Fixed improv build pipeline - dishplayscapes 214KB dist is canonical, init.sh serves from localhost:9223 instead of static copies
type: project
relates_to: [session_2026-05-11_improv-settings-active.md, reflection_2026-05-12.md]
supersedes: session_2026-05-12_improv-pipeline-investigation.md
---

Fixed the improv build-to-browser pipeline. Root cause was a "copy on init, never update" architecture with 5 independent break points.

**What was done:**
1. Copied dishplayscapes 214KB dist (latest work including prompt mode rewrite, queue system, all v2 features) into repo as canonical `improv/dist/improv-core.js`
2. Applied settings button active-state fix on top (settingsBtn property, toggleSettingsPanel active styling)
3. Rewrote `improv/cli/init.sh` to inject `<script src="http://localhost:9223/improv-core.js">` instead of copying a static file
4. Copied canonical dist to `~/.claude/improv/dist/improv-core.js` (installed location, served by MCP server)
5. Verified server serves 215KB at localhost:9223 via curl

**New architecture:**
```
repo dist (improv/dist/improv-core.js)
    |-- cp --> installed dist (~/.claude/improv/dist/improv-core.js)
                    |-- readFileSync --> MCP server (localhost:9223)
                                            |-- HTTP GET --> browser (every project)
```

Edit once, copy to installed location, every project picks it up on next page load. No more stale per-project copies.

**Key detail from dishplayscapes version:** Mode buttons already use solid `#3b82f6` + `#fff` with dynamic markerColor. The `updateModeButtonStyles` reads `this.markerColor` for background color.

**Files touched:**
- improv/dist/improv-core.js (replaced with dishplayscapes 214KB + settings fix)
- improv/cli/init.sh (rewritten: server URL instead of static file copy)
- ~/.claude/improv/dist/improv-core.js (updated installed copy)

**Verification (browser-confirmed):**
- Script loads from `http://localhost:9223/improv-core.js` (console logs confirm)
- Toolbar renders: prompt, manipulate, settings, close buttons
- Manipulate active state: solid blue circle with white icon (confirmed via zoom screenshot)
- Settings gear active state: solid blue `#3b82f6` with white icon when panel open (confirmed via zoom screenshot)
- Settings panel: verbosity, connection (Connected), marker colors, hints, selection labels all present
- dishplayscapes functions.php updated: `wp_enqueue_script` now points to localhost:9223 instead of local `/improv-core.js`

**Marker color -> settings active state (live update):**
- `toggleSettingsPanel`: uses `this.markerColor||"#3b82f6"` for active background (not hardcoded blue)
- `updateModeButtonStyles`: appended check for `this.settingsBtn.dataset.active` to update settings button color too
- **Root cause of non-live updates:** `onMarkerColorChange` callback was only registered in `init()` but not in `activate()` or the CMD+SHIFT+. keydown handler. When toolbar was created via activate (page load) or recreated via keydown (toggle), the new Toolbar instance had zero callbacks. Fixed by adding `onMarkerColorChange` registration to all three toolbar creation sites.
- Verified via JS: clicking red/green/purple swatches updates settings button bg LIVE without deselect/reselect
- WCAG AA contrast fix: orange (#f97316), yellow (#eab308), green (#22c55e) use dark icon color (#1a1a1a); blue, red, purple use white (#fff). Applied globally across toolbar, prompt input, edit confirm, and action pill buttons.
- Action pill queue button: replaced SVG icon (stacked lines + rect) with numeric count span. `_queueCount` shows item count as text. `_queueBadge` overlay removed. `_updateQueueBadge` now sets `_queueCount.textContent`. Hover SVG animations (`_gvL1`/`_gvL2` references) removed. Active state uses markerColor bg + contrast text via `_toggleQueuePanel` and live `onMarkerColorChange` callback.
- Toolbar drag removed: `initDrag()` gutted to empty no-op. Toolbar stays fixed at bottom:20px right:20px.
- Screen glow fade: added `getBoundingClientRect()` layout force between DOM append and `opacity:1` so the 0.4s transition fires on show. Hide uses `transitionend` to defer claude-agent-glow-border restore until fade completes. Added `data-improv` attribute so prompt/manipulate tools skip the glow element. z-index lowered to 2147483646 (one below toolbar overlay).
- Marker color persistence via localStorage: saved on swatch click (`localStorage.setItem("improv-marker-color", f)`), loaded on construction (`localStorage.getItem("improv-marker-color") || "#3b82f6"`). Per-origin so different project domains get their own saved color. Verified: set orange, reloaded page, toolbar initialized with orange and dark icon.
- Chrome MCP screenshots cannot capture shadow DOM overlays (z-index 2147483647) - verification done via JS property inspection

**Still needed:**
- Clean up stale static improv-core.js copies from projects (dishplayscapes root, blueprint-tracker/public, glass-test/docroot, claude-dotfiles/public)
- Source reconstruction from dist (longer-term)
- Update init.sh guard: currently skips wiring if `improv-dev` already exists in functions.php; needs to update the URL if it changed

---
name: local testing stack vs Peekaboo parity audit
description: Capability matrix comparing claude-in-chrome, computer-use, cmux browser against Peekaboo. Identifies the four real gaps to close before Peekaboo becomes the fallback layer.
type: reference
relates_to: []
---

Audit performed 2026-05-26 to scope the "parity then fallback" plan around Peekaboo.

**Tools in the current local-testing surface:**
- `claude-in-chrome` MCP - DOM/AX-aware automation of a real Chrome (extension-driven). Strong on web semantic understanding (`read_page`, `find` by NL, `form_input` by ref).
- `computer-use` MCP - macOS pixel-coord input + screenshots. Tier-restricted by app category (browsers=read, terminals/IDEs=click, everything else=full).
- `cmux browser` - Playwright wrapper exposed via CLI. Owns its own Chromium-based browser separate from the user's Chrome. Covers viewport, network, geolocation, offline, state, traces, profiles, addinitscript.
- Playwright (standalone) - NOT installed. cmux browser wraps Playwright under the hood, so standalone is redundant for most cases.

**Peekaboo's distinctive value over the current stack:**
1. Accessibility tree on macOS native apps (not just web) - semantic targeting instead of pixel coords
2. Window/Space management primitives (move/resize/focus/Space switching)
3. Menu/menubar enumeration as structured JSON
4. Targeted single-window screenshot capture (computer-use only captures the full primary display)

**Non-gaps (current stack at parity or better):**
- Web automation - claude-in-chrome + cmux browser cover this comprehensively
- Pixel-coord native input - computer-use does this fine for cases where AX targeting isn't critical
- Web AX tree - claude-in-chrome's `read_page` IS the AX tree

**Playwright decision:** cmux browser already wraps Playwright with most of the surface (network routing, viewport, geolocation, offline, state, traces). Standalone Playwright install adds little unless headless CI runs that don't go through cmux are needed. Recommend skipping unless that need surfaces.

**Recommended sequencing for "parity then fallback":**
1. Install Peekaboo via `brew install steipete/tap/peekaboo` (or evaluate `openclaw/Peekaboo` fork)
2. Wire its MCP server into `~/.claude/settings.json`
3. Build a thin routing layer (or just establish convention) where:
   - Web tasks → claude-in-chrome first, cmux browser as fallback
   - Native macOS tasks needing semantic targeting → Peekaboo (AX tree)
   - Native macOS tasks needing pixel input → computer-use (existing)
   - Window/Space ops → Peekaboo (no current alternative)
   - Menu enumeration → Peekaboo (no current alternative)
4. Establish a "Peekaboo as fallback" convention: if a primary tool fails or hits a tier restriction, fall back to Peekaboo's AX-driven path before giving up.

**Note on the validation-guard rule:** Peekaboo's accessibility tree READ is a gray area against the existing "screenshot + look with your eyes" verification rule. AX-tree READs for TARGETING are fine (analogous to `read_page`/`get_page_text` which are already allowed). AX-tree READs for VERIFICATION would be the same shortcut as DOM-state reads via JS. If Peekaboo gets wired in, the validation-guard hook should extend to cover `peekaboo see --json` / `peekaboo describe` when used in verification context.

Collaborator: Jonah

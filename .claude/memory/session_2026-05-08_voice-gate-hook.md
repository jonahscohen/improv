---
name: Voice gate hook
description: PreToolUse hook that hard-denies mcp__voice-output__speak when voice is muted (no .voice-enabled file)
type: project
---
## What
Built a PreToolUse hook that blocks speak calls when voice is muted.

## How it works
- `claude/hooks/voice-gate.sh` - checks for `~/.claude/.voice-enabled` flag file
- If absent (muted): returns permissionDecision deny
- If present (enabled): returns empty JSON (allow)
- Wired in settings.json with matcher `mcp__voice-output__speak`

## Why
Memory note saying "don't speak when muted" was advisory and kept being violated. Hook makes it mechanical - speak calls are hard-denied when muted.

## Files
- `claude/hooks/voice-gate.sh` (new)
- `~/.claude/settings.json` - wired PreToolUse matcher
- Symlinked to `~/.claude/hooks/voice-gate.sh`

## Improv: scroll-tracked selections + deselect X + shift+click
- Selection overlays now use rAF loop to track element positions on scroll/resize
- Each label pill has a red X button (10px, stroke-width 3) that removes element from selection
- Shift+click adds to existing lasso/click selections (was already wired in onClick)
- rAF cleaned up on deactivate
- Deployed to dishplayscapes + blueprint-tracker
- Dist at 164,347 bytes

## Improv: hover tooltip fix + selected element dedup
- Root cause: `isDragging` was always true because `mousedownX/Y` initialized to 0, making every mousemove delta exceed the 4px threshold. `_onHover` checked `isDragging` and returned early.
- Fix: `_onMousemove` now gates on `_mouseIsDown` flag (set on mousedown, cleared on mouseup)
- Also: hover tooltip hides when hovering already-selected elements (no duplicate labels)
- Dist at 164,561 bytes

## Improv: prompt follows bottommost element + text selection fix + misc
- Prompt input positions below the bottommost selected element (leftmost x, max bottom y + 12px)
- Shows after both click and lasso selections
- 200ms spring transition so it slides when selection changes
- Text selection blocked via `selectstart` event prevention (CSS user-select alone wasn't enough)
- Name collision fix: `et` was already minified, renamed to `_impSelBlock`
- Prompt hides when last item removed via X button
- Dist at 165,553 bytes

## Improv: prompt input redesign + tooltip collision + scroll tracking
- Pill-shaped input (320px, border-radius:20px, dark bg)
- Circular send button (36px) with Lucide Animated message-square-check icon
- Check mark draws via stroke-dashoffset animation on hover
- Click button or Enter to submit
- Prompt tracks bottommost selected element on scroll via rAF
- Tooltip collision detection: labels sorted by top, nudged down with 4px gap
- Text selection blocked via selectstart event prevention
- Prompt hides when last item X'd out
- Dist at 168,616 bytes

## Improv: prompt input redesign continued
- Two buttons: queue (plus-circle from heroicons-animated) + send-now (envelope from toolbar)
- Queue button: saves prompt to list without sending, plus lines draw on hover with staggered delay
- Send-now button: sends immediately to Claude
- Both scale 0->1 when input has text, pulse with marker color
- Hover scale 1.125, press 0.92
- X deselect button uses Lucide Animated X with draw-on-hover (forced reflow technique)
- Hover indicator + tooltip hide on scroll via capture-phase scroll listener
- Tooltip collision detection in rAF loop
- Hover hides near all improv UI (tooltips, prompt, toolbar)
- isDragging fix: gated on _mouseIsDown flag
- Dist at 174,447 bytes

## Memory-nudge hook upgraded to catch Bash writes
- Root cause of missed memory: improv patching uses python3/cp via Bash, which bypasses Write|Edit|MultiEdit matcher
- Fix: added Bash to the PostToolUse matcher for memory-nudge
- Hook now detects file-writing Bash commands (cp, mv, python3 <<, sed -i, etc) and sets dirty flag
- Read-only commands (ls, grep, git status, etc) are skipped
- settings.json matcher updated: Write|Edit|MultiEdit|Bash

## Improv: shimmer placeholder text (spell.sh)
- Shimmer overlay div replaces native placeholder (inputs don't support background-clip:text)
- Gradient: gray base rgba(255,255,255,0.3) with white peak rgba(255,255,255,0.8) sweeping left-to-right
- 2s loop, starts immediately, hides on text input, reappears on clear
- Input widened to 420px
- Multiple iterations to get the gradient right: transparent base showed black text, then wrong coverage
- Final fix: exact spell.sh technique - `background: currentColor linear-gradient(...)` where currentColor (gray) fills the base and gradient sweeps white highlight on top. background-size:50% + no-repeat = single highlight band
- Refinement: shimmer peak changed to lighter gray (0.55 not 0.8), wider band (70% not 50%), input 520px
- Fix: input width wasn't applying - added min-width:520px, removed box-sizing:border-box
- Smoother gradient: transition zones at 42%/58% instead of 30%/70%
- Slower animation: 4s ease-in-out instead of 2s linear
- NOTE: memory-nudge Bash matcher has false positives on read-only commands (node -e). Needs tuning.
- Shimmer REVERTED entirely - couldn't get the treatment right after multiple attempts. Back to native placeholder. Width set to 300px.
- Revert broke input: container.appendChild(this.input) was removed, and hide() still referenced this.sendBtn (renamed to queueBtn/sendNowBtn). Fixed both, verified in browser via Chrome MCP.

## FAILURE: deployed broken code without verification (2026-05-09)
- Root cause: never verified the prompt input rendered after the shimmer revert
- The revert removed the line that appended the input to its container
- Also left stale references to this.sendBtn which no longer exists
- Deployed, committed, and reported success without checking
- User caught it. Built verification hook to prevent this permanently.

## Verification-before-commit gate (Field Fidelity Testing)
- `claude/hooks/verify-before-done.sh` - PostToolUse on Bash: sets `~/.claude/.needs-verification` when deploying improv to any project
- `claude/hooks/verify-clear.sh` - PostToolUse on Chrome MCP tools: clears the flag when browser verification happens
- `bash-guard.sh` - blocks `git commit` when `.needs-verification` exists
- Full cycle: deploy -> flag set -> commit blocked -> browser check -> flag cleared -> commit allowed
- Wired in settings.json: verify-before-done on Write|Edit|MultiEdit|Bash matcher, verify-clear on mcp__claude-in-chrome__ matcher
- This is the "Field Fidelity Testing" discipline: never claim success without browser proof

## Verification gate - expanded coverage
- Chrome MCP: javascript_tool, read_page, get_page_text, navigate, get_screenshot all clear the flag
- cmux browser: verify-before-done.sh clears flag when Bash command contains "cmux browser" + screenshot/snapshot
- Manual: verify-manual.sh UserPromptSubmit hook clears flag on "verified", "looks good", "it works", "lgtm", "all good", "bypass verification"
- User reserves the right to interrupt and bypass - the manual hook respects that
- Playwright would clear via cmux browser path or manual bypass

## Improv: icon refinements
- Plus icon stroke-width 1.5 -> 2 to match mail icon weight
- Mail icon shifted translate(-1px, 1px) for optical alignment
- Nudge animation pokes diagonally up twice (20%/55% peaks) instead of once
- Both prompt mail button and toolbar send button share the keyframe
- Plus icon SVG 18->20px for visual size match with mail
- Nudge slowed to 0.7s (was 0.35s), softer pokes (1.5px), more breathing room between pokes
- Fix: nudge snap-back was caused by static translate(-1px,1px) on mail SVG conflicting with animation origin. Removed the offset entirely, animation on SVG icon with transform-based keyframes.
- Fix: toolbar send used 0.4s, prompt mail used 0.7s - mismatched. Both now 0.7s.
- Prompt input centered horizontally beneath the bottommost selected element (element center - input width/2). Applies to click, lasso, and rAF scroll tracking.
- Pulsating glow on input field matching marker color via CSS variable (--improv-glow-color). 3s ease-in-out infinite. Updates live on color change.
- Marker color change now fades all affected objects: buttons (bg + border), input glow, selection overlays. 300ms transitions on buttons and input.
- Glow spread reduced: 4px-8px (was 8px-16px)
- Input focus border fades to marker color (300ms transition on border-color)

## Improv: change queue system
- Queue data structure (_changeQueue) stores prompt text + element references per item
- Bottom-left circle button (clipboard-document-list icon from heroicons-animated) with red badge showing count
- Queue panel: opens above button, lists all queued changes with Edit + Remove buttons
- Edit: closes panel, deselects current, re-selects original elements, populates prompt with original text
- Remove: confirmation dialog before deletion
- Icons: clipboard-document-list (heroicons-animated), circle-check (lucide-animated) for confirm, X (lucide-animated) for delete
- Edit mode: Me class enterEditMode/exitEditMode swap queue/send buttons for checkmark (Lucide Animated "check" - M4 12 9 17L20 6) + X (Lucide Animated). Checkmark hover turns green + draws check via stroke-dashoffset. X hover redraws. Confirm saves edit, X deletes item.
- Queue callback wiring: Me._queue calls queueCallback (simple), He provides callback that stores elements + updates badge. Fixed timing: input value set via setTimeout(50ms) to beat show()'s rAF clear. Queue plus icon replaced with Lucide Animated "plus" (M5 12h14 + M12 5v14, no circle). Queue button icon: gallery-vertical-end (Lucide Animated). Hover animation matches source: L2 (custom=2) translateY 4->0 + opacity 0->1 fires first (delay 0), L1 (custom=1) translateY 2->0 + opacity 0->1 fires second (delay 250ms). Uses reflow technique for replay. Removed leftover clipboard dasharray animation from mouseenter/mouseleave that was corrupting gallery lines. Toolbar button states: borderRadius 10px -> 50% (circles). Glow hide: must stop animation before setting opacity 0 (animation overrides inline opacity).
- Clipboard icon hover animation: staggered dot+line draw per heroicons-animated source pattern.
- Dist at 195,374 bytes
- Queue persists across mode switches: _changeQueue lives on Ne (core), passed to He on creation. Button stays in DOM on deactivate, reattaches on reactivate. Only manual clear removes it.
- Fix: queue callback wasn't wired at all after multiple attempts. Root cause: wiring in onClick/lasso got overwritten on each click. Final fix: wire onPromptQueue ONCE in activate() right after prompt creation + setMarkerColor. Verified: 2 elements queued from shift+click multi-select.
- Full flow verified: single click, shift+click multi-select, and lasso all queue correctly. Edit mode: checkmark uses marker color, X uses red (#ef4444). Empty queue fades panel out (0.2s opacity transition) instead of showing "Queued Changes (0)". Edit mode X button clears selection + overlays before exiting.
- After queuing: deselects objects, hides overlays + prompt, keeps mode active for next selection. Uses afterQueueCallback from Me to He.
- Queue panel auto-refreshes: _updateQueueBadge rebuilds panel if open when items change
- Send All + Clear All buttons moved from toolbar to bottom-left as circles. All three stagger in: 0ms, 100ms, 200ms. Eraser shake animation on Clear All hover restored. All three bottom-left buttons wrapped in a pill container (matching toolbar style: #1a1a1a, border-radius 22px, 6px padding). Divider between queue and send/clear. Pill bounces in (reflow + improv-send-pulse 0.5s) when first item enters queue, scales out when empty. Badge positioned on queue button (position:relative on btn). Queue button gets active state (full marker color + white) when panel is open, clears on close. Mouseenter + mouseleave both respect active flag. Panel header has X close button. Buttons are 32px circles inside pill. Hover: marker color bg at 20% (hex+"33") + full marker color SVG. Active: full marker color bg + white icon. Eraser icon is static Lucide (pre-mandate, approved), sized to 22x22. Both toolbars use marker color. Updates live on color change.
- Screen glow: mimics Claude in Chrome (triple inset box-shadow at 15/25/35px), uses marker color, z-index 2147483647 (overrides Claude in Chrome's 2147483646). Fades in on mode activate, fades out on deactivate. Hides Claude in Chrome glow while active, restores on deactivate. Updates live on marker color change. Pulsates via opacity 0.6-1.0 (3s ease-in-out infinite) with static large shadow. Keyframe injected into document.head (not shadow DOM) so glow element can access it. Toolbar icon gap increased to 2px. X close button (Lucide Animated X, two paths with staggered stroke-dashoffset draw on hover) + divider after settings icon in right toolbar.
- Send button bounce: was flat fade, now gets improv-send-pulse matching queue button. Stagger 200ms. Animation resets use "none" + offsetHeight reflow to force replay on every show cycle.
- Viewport clamping on ALL tooltips: hover label, selection labels, toolbar tooltip, button tooltips. Right edge: flips to left of element. Left edge: clamps to 4px. Top edge: hover label flips below cursor. rAF clamping uses getBCR fallback for offsetWidth on first frame + immediate _update call before rAF loop starts. Scroll handler: repositions existing DOM elements in-place (getBCR per tracked element) instead of destroying+rebuilding. Resize handler still rebuilds (infrequent). This eliminates the DOM thrash that caused scroll jank with many selections.
- Pill tooltips above input buttons: "Queue Change" and "Send to Claude" on hover, fade+slide animation
- Settings panel: "Hints" toggle (toolbar + button tooltips + hover label) and "Selection Labels" toggle (per-element label pills on selection). Both default ON, toggle switches with 150ms transition. Wired to prompt mode via callback systems (hintsCallbacks, selectionLabelCallbacks). First attempt rendered toggles but didn't wire to actual behavior - fixed with guards in tooltip show functions and _showSelOverlays. Selection Labels OFF shows X in a 24px dark circle (no icon, no text). X always clickable for deselection.

## Improv: toolbar collapse + toast notification
- Toolbar collapses via clip-path (not width - width transitions don't work in cmux browser). Collapsed: `inset(0 0 0 calc(100% - 44px) round 22px)`. X morphs to italic icon (Lucide Animated). Starts collapsed on load. Drag disabled when collapsed.
- New pill toast notification: slides from top, shows spinner + "Sending X changes to Claude...", progress bar fills 1.5s, transitions to checkmark + "Sent to Claude", auto-dismisses. Wired to: prompt submit (Cmd+Enter/send button), send-all (queuebar). Old applyConfirmation showSuccess/showSending/showError calls removed. Checkmark green (#22c55e), flex centered in container. Keyframes injected into document.head (toast is on document.body, not shadow DOM).

## Improv: toast notification refinements (2026-05-11)
- Font size decreased from 13px to 11px, font-weight set to 700 (bold)
- Spinner replaced with dot matrix loader (port of dotmatrix.dev dotm-square-20):
  - 4x4 grid (16 dots, 3px each, 1.5px gap) in an 18x18 container
  - Perimeter chase: 12 outer dots form the loop, bright head with 6-dot tail [1, 0.82, 0.64, 0.46, 0.3, 0.18]
  - Secondary train half a lap behind with 4-dot tail [0.38, 0.3, 0.22, 0.14]
  - Base opacity 0.15 for all dots, 110ms step interval
  - Dots use marker color (via getMarkerColor())
  - Interval cleared on success transition (clearInterval before checkmark swap)
- Removed improv-toast-spin keyframe (no longer needed)
- Dist at 214,912 bytes

## Collaborator
Jonah

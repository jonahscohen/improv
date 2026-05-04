# Improv v2 Improvements

**Date:** 2026-05-04
**Author:** Jonah
**Status:** Spec'd from user testing feedback, ready for implementation

## Context

Improv v1 shipped as a working technical skeleton - types, MCP server, WebSocket transport, three mode controllers, 71 tests passing. But live testing on dish-playscapes.lndo.site revealed fundamental UX problems. The plumbing works; the product doesn't meet the bar.

## Problem 1: Activation is too hard

**Current behavior:** User has to ask Claude to inject the script via Chrome MCP tools into a specific tab. Every page reload requires re-injection. The keystroke (CMD+SHIFT+.) only works after injection. This is not how Retune, Agentation, or React Grab work.

**How the reference tools work:** You add a component or import to your project once (dev-only), and it's always there. No AI involvement to activate. No browser tools. No injection.

**Required behavior:** Installing Improv to a project directory is step one. From that point forward, any page served from that project has Improv available. The keystroke works. Telling Claude "activate improv" works. No Chrome MCP dependency.

### Solution: `improv init` per-project

Create a CLI command or skill that sets up Improv for a specific project:

1. **`improv init`** (run in project root) detects the stack and adds the appropriate dev-only script include:
   - **Static HTML / PHP / Drupal / WordPress:** Adds `<script src="http://localhost:9223/improv-core.js"></script>` to the dev template. For Drupal: a preprocess hook or libraries.yml entry. For WordPress: wp_enqueue_script in functions.php wrapped in WP_DEBUG check.
   - **Next.js / React:** Adds a conditional import to the root layout: `if (process.env.NODE_ENV === 'development') { import('http://localhost:9223/improv-core.js') }` or a Script component.
   - **Vite:** Adds to vite.config plugin that injects the script tag in dev mode.
   - **Generic fallback:** Creates a `.improv` marker file in the project root. The Improv MCP server watches for this and serves the script. If the dev server supports a proxy or middleware, inject automatically.

2. **Auto-activation:** When the script loads in the browser, it connects to the WebSocket server and the toolbar appears. No separate "activate" step. CMD+SHIFT+. toggles visibility. Escape exits modes.

3. **`improv remove`** undoes whatever `improv init` did.

4. **The improv skill** should ONLY need to call MCP tools for reading changes and applying diffs. It should NOT need to inject scripts or orchestrate browser tools for activation.

### Alternative: Dev server middleware

For projects using Node.js dev servers (Next.js, Vite, Webpack Dev Server), Improv could register as middleware that injects the script tag into every HTML response. This would be truly automatic - no `improv init` needed for JS projects. The middleware approach:

```javascript
// Added to vite.config.js / next.config.js / webpack.config.js
{
  plugins: [improv()]  // injects <script> in dev mode
}
```

This can coexist with `improv init` - the middleware is for JS projects, `improv init` is for everything else.

## Problem 2: Manipulate mode doesn't match Retune

**Current behavior:** Barebones property panel with scrub-to-adjust values. No visual handles on elements. Finnicky controls. No state toggles.

**Required behavior:** Copy Retune exactly. Reference their source analysis from the design phase.

### What Retune has that Improv doesn't:

1. **Element handles** - padding/margin edges you drag directly on the element, corner radius handles on corners. Visual, not just panel controls.

2. **Polished property panel:**
   - Grouped by context (Box, Typography, Flex, etc.) with collapsible sections
   - Each property shows its label, current value, and a visual indicator
   - Scrub works on the value display directly (cursor: ew-resize)
   - Color swatches show the actual color next to hex/rgb
   - Select dropdowns styled to match the dark theme
   - Shorthand property display (padding shows all 4 values in a visual box model diagram)

3. **State toggles** - hover, focus, active, visited buttons that force pseudo-state styles onto the element so you can inspect and adjust them.

4. **Box model visualization** - a mini diagram showing margin > border > padding > content with actual pixel values.

5. **Shared selector awareness** - when a change affects multiple elements (shared class), show how many elements are affected.

6. **The Apply button** (added in v1 fixup) needs to show visual confirmation after applying - green checkmarks per change with file paths, matching the design spec's batch-and-apply flow.

### Implementation approach

Study Retune's overlay source carefully. Their property panel renders inside Shadow DOM with adopted stylesheets. Their control architecture detects element type and shows appropriate controls. Their scrub interaction uses the exact same Shift/Alt modifier pattern we already have.

The key files to study from the Retune analysis:
- `packages/overlay/src/overlay/mount.ts` - Shadow DOM mounting
- `packages/overlay/src/inspector/style-source.ts` - CSSOM style tracing
- `packages/overlay/src/engine/output.ts` - structured diff output
- `packages/overlay/src/engine/live-preview.ts` - Constructable Stylesheets

## Problem 3: Annotate mode doesn't match Agentation

**Current behavior:** Basic annotation markers. No visual differentiation between intent types. No structured output visible to the user.

**Required behavior:** Match Agentation's visual treatment. Split Annotate and Layout into two separate toolbar buttons for clarity.

### What Agentation has that Improv doesn't:

1. **Visual annotation markers** with color-coded intent (fix=red, change=blue, question=yellow, approve=green). Numbered badges. Connecting lines from marker to element.

2. **Rich comment popups** - not just a text input. Shows the element name, path, and a structured form with intent/severity as styled pill buttons, not radio buttons.

3. **Output preview** - user can see what the annotation will look like before sending. A preview pane showing the structured output at their chosen verbosity level.

4. **Multi-select visual feedback** - selected elements get colored overlays, not just a single highlight box.

5. **Area selection (lasso)** with a visible selection rectangle that shows count of captured elements.

6. **Animation freeze indicator** - visible UI showing animations are paused, with an unfreeze button.

## Problem 4: Layout mode doesn't match Agentation

### What Agentation has that Improv doesn't:

1. **Component palette as a polished sidebar** - categorized, searchable, with visual thumbnails/icons per component type. Not a flat list.

2. **Skeleton placeholders that look designed** - category-colored backgrounds, rounded corners, clear labels, resize handles.

3. **Snap guides that are visible and helpful** - thin lines with distance labels, center alignment indicators.

4. **Section detection with visual handles** - detected sections get labeled overlays with drag handles for reorder.

5. **A clear "Apply Layout" action** that shows a structured description of what will be sent to Claude.

## Problem 5: No clear Apply workflow across all modes

Every mode needs a visible path from "I made changes" to "Claude has my changes."

- **Manipulate:** Apply button sends style diffs (added in v1 fixup, needs confirmation UI)
- **Prompt:** Submit sends context + prompt (exists but no visual confirmation)
- **Annotate:** "Send to Claude" button that pushes all pending annotations (missing)
- **Layout:** "Apply Layout" button that sends structured layout description (missing)

Each mode should show a confirmation state after applying - what was sent, that it was received.

## Priority order for implementation

1. **Activation overhaul** (`improv init`, per-project setup, no Chrome MCP dependency)
2. **Split toolbar** (4 mode buttons: Manipulate, Prompt, Annotate, Layout + Apply)
3. **Manipulate UI rebuild** (match Retune: handles, box model, state toggles, polished panel)
4. **Annotate UI rebuild** (match Agentation: colored markers, rich popups, output preview)
5. **Layout UI rebuild** (match Agentation: polished palette, skeleton design, snap labels)
6. **Apply confirmation UI** (green checkmarks, file paths, "sent to Claude" state)

## Reference material

The deep technical analysis of Retune, Agentation, and React Grab from the brainstorming session is preserved in the design spec at `docs/superpowers/specs/2026-05-04-improv-design.md`. It contains source-level architecture details for all three tools.

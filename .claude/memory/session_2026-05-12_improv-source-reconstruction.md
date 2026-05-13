---
name: Improv source reconstruction
description: Reconstructing TypeScript source from 217KB dist; class-to-file mapping established; core files updated for 1:1 parity
type: project
relates_to: [session_2026-05-12_improv-toolbar-collapse.md, session_2026-05-12_improv-pipeline-fix.md, reflection_2026-05-12.md]
supersedes: feedback_improv_dist_is_source_of_truth.md
---

Starting source reconstruction from the 217KB dist. The "never rebuild" rule is officially dead.

**Preparation:**
- js-beautify expanded dist from 99 lines to 6,907 readable lines at `improv/dist/improv-formatted.js`
- Mapped all 16 classes to their source file counterparts
- Build script (esbuild IIFE) already exists and works

**Class-to-file mapping:**
| Minified | Lines | Source file | Purpose |
|---|---|---|---|
| le | 107 | transport.ts | WebSocket transport |
| de | 227 | overlay.ts | Shadow DOM overlay + highlight tracking |
| U | 777 | toolbar.ts | Toolbar pill, buttons, settings panel, collapse/expand |
| pe | 30 | adapter-registry.ts | Framework adapter registry |
| ue | 54 | preview-engine.ts | Constructable stylesheet for live preview |
| he | 43 | change-buffer.ts | Buffered CSS changes |
| me | 3374 | manipulate/property-panel.ts | Property panel (largest class) |
| ke | 96 | manipulate/index.ts | Manipulate mode controller |
| Me | 292 | prompt/inline-prompt.ts | Prompt input + queue/send buttons |
| Ve | 113 | prompt/multi-select.ts | Multi-element selection |
| He | 989 | prompt/index.ts | Prompt mode controller |
| Re | 121 | lasso or selection helper | Lasso selection with overlays |
| Ie | 27 | selection.ts | Text selection handler |
| Ae | 135 | annotate/annotation-store.ts | Annotation data store |
| je | 165 | annotate/index.ts | Annotate mode (mostly removed) |
| Ne | 329 | index.ts | ImprovCore - main orchestrator |

Plus ~400 lines of helper functions (SVG icon builders, CSS selector generator, freeze sheet, etc.)

**Build script:** Already exists at `improv/build.js` - esbuild IIFE bundle with source maps. Will add `--dev` flag for non-minified builds.

**Core file reconstruction (batch 1 - 9 files):**

Compared existing source files against dist. Most matched. Discrepancies found and fixed:

1. **transport.ts** - Already matches dist. No changes.
2. **overlay.ts** - Fixed: added `_hlColor` property, `setHighlightColor(c)` method, changed border-radius from `2px` to `5px`
3. **adapter-registry.ts** - Already matches dist. No changes.
4. **preview-engine.ts** - Already matches dist. No changes.
5. **change-buffer.ts** - Already matches dist. No changes.
6. **apply-confirmation.ts** - Already matches dist. No changes.
7. **types.ts** - Already matches dist. No changes.
8. **selection.ts** - Rewrote: was a mega-file with CSS selector generator + utility functions + `@medv/finder` import. Now contains only `TextSelection` class (dist's `Ie` at lines 6252-6278). Created new `element-utils.ts` for the extracted utility functions with inline CSS selector generator (no external dependency).
9. **event-intercept.ts** - Fixed: added `user-select`/`-webkit-user-select` CSS rules and `selectstart` event blocker to match dist
10. **freeze.ts** - Left as-is. Source has expanded timer/rAF/WAAPI freeze that's NOT in dist. This is aspirational code, not a discrepancy - the dist's freeze ($/_/W) maps to event-intercept.ts.

**Line counts (final):**
| File | Lines |
|---|---|
| transport.ts | 167 |
| overlay.ts | 131 |
| adapter-registry.ts | 45 |
| preview-engine.ts | 79 |
| change-buffer.ts | 54 |
| apply-confirmation.ts | 461 |
| selection.ts | 35 |
| types.ts | 79 |
| freeze.ts | 161 |
| event-intercept.ts | 56 |
| element-utils.ts | 427 |
| **Total** | **1,695** |

**Build verified:**
- `node build.js --dev --core-only` produces 218KB / 5,280 lines with source maps
- Deployed to `~/.claude/improv/dist/`, served via localhost:9223
- Console: Initializing, activate(), Ready, Transport connected - no errors
- Source map working: log lines show actual TS line numbers
- Visual: collapsed toolbar renders correctly (clean circle, "I" icon, no overlap)

**Build commands:**
- `node build.js --dev --core-only` - non-minified with source maps (debugging)
- `node build.js --core-only` - minified with source maps (production)

**Files touched:**
- improv/dist/improv-formatted.js (created - beautified reference)
- improv/build.js (added --dev flag)
- improv/core/overlay.ts (fixed highlight color + border-radius)
- improv/core/event-intercept.ts (fixed CSS rules + selectstart blocker)
- improv/core/selection.ts (rewritten to TextSelection class only)
- improv/core/element-utils.ts (new - inline CSS selector generator + utilities from dist)
- improv/core/toolbar.ts (reconstructed from dist)
- improv/core/icons.ts (extracted SVG icon builders)
- improv/core/prompt/inline-prompt.ts (reconstructed)
- improv/core/prompt/multi-select.ts (reconstructed)
- improv/core/prompt/index.ts (reconstructed)
- improv/core/manipulate/property-panel.ts (reconstructed)
- improv/core/manipulate/index.ts (reconstructed)
- improv/core/annotate/lasso.ts (updated)
- improv/core/index.ts (reconstructed - ImprovCore)
- improv/core/prompt/index.ts (replaced with complete 1139-line port from src/core/, stubs were 236 lines)
- improv/core/prompt/inline-prompt.ts (replaced with complete 463-line port from src/core/, stubs were 85 lines)
- improv/core/prompt/multi-select.ts (replaced with complete 38-line port from src/core/)
- improv/core/manipulate/property-panel.ts (in progress - 733 lines vs 3373 in dist, agent rebuilding)
- improv/core/prompt/index.ts (fixed: replaced window.__improv_* globals with proper imports; LassoSelect import name)
- improv/core/toolbar.ts (fixed: expand clears animation:none on children so fill-mode stops overriding opacity)
- improv/core/manipulate/property-panel.ts (agent completed: 733 -> 2840 lines, full port with all design sections)

**Handoff state:**
- Source reconstruction complete. Build pipeline restored. "Never rebuild" rule is dead.
- Build: `node build.js --dev --core-only` (dev) or `node build.js --core-only` (prod)
- Deploy: `cp dist/improv-core.js ~/.claude/improv/dist/improv-core.js`
- Serve: localhost:9223 reads fresh from disk every request
- Next step: write implementation plan for improv-claude loop spec at docs/superpowers/specs/2026-05-13-improv-claude-loop-design.md

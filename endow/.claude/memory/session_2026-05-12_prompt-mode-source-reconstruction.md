---
name: Prompt mode TypeScript source reconstruction
description: Reconstructing prompt mode source files from beautified dist - inline-prompt.ts, multi-select.ts, index.ts
type: project
relates_to: [session_2026-05-04_improv-design-and-plan.md]
---

Reconstructing TypeScript source files for the prompt mode subsystem from the beautified dist at `dist/improv-formatted.js`.

Files being created:
- `src/core/prompt/inline-prompt.ts` - InlinePrompt class (was `Me`, lines 4737-5028)
- `src/core/prompt/multi-select.ts` - MultiSelect class (was `Ve`, lines 5029-5049)
- `src/core/prompt/index.ts` - PromptMode class (was `He`, lines 5142-6000) plus helper functions

Key mappings from dist to source:
- `Me` -> `InlinePrompt`
- `Ve` -> `MultiSelect`
- `He` -> `PromptMode`
- `Ke` -> `formatElementInfo`
- `Ue` -> `buildElementInfo`
- `Zt` -> `copyToClipboard`
- `Nt` -> `fallbackCopy`
- `zt` -> `isImprovElement`
- `$` -> `enablePointerBlock` (imported from overlay module)
- `_` -> `disablePointerBlock` (imported from overlay module)
- `W` -> `elementFromPointSafe` (imported from overlay module)
- `Y` -> `generateSelector` (imported from selectors module)
- `X` -> `getComputedStylesFiltered` (imported from selectors module)
- `ee` -> `getNearbyText` (imported from selectors module)
- `te` -> `getAccessibility` (imported from selectors module)
- `Re` -> `LassoSelect` (imported from lasso module)

External dependencies used by PromptMode:
- `_changeQueue` is assigned externally by ImprovCore
- `_core` is assigned externally by ImprovCore
- `_showHints` and `_showLabels` are set by ImprovCore from toolbar state

Files created with line counts:
- `src/core/prompt/inline-prompt.ts` - 463 lines (InlinePrompt class)
- `src/core/prompt/multi-select.ts` - 38 lines (MultiSelect class + SelectedElement interface)
- `src/core/prompt/index.ts` - 1139 lines (PromptMode class + helper functions)
- Total: 1640 lines

Design decisions:
- Used `(window as any).__improv_*` for cross-module functions (`enablePointerBlock`, `disablePointerBlock`, `elementFromPoint`, `generateSelector`, `getComputedStylesFiltered`, `getNearbyText`, `getAccessibility`, `LassoSelect`) since these are defined in other modules within the same bundle scope
- Extracted `getElementIcon()` helper to deduplicate the identical icon-lookup logic used in both `_onHover` and `_showSelOverlays`
- Changed `innerHTML = ""` to `textContent = ""` for clearing the hover label (functionally identical, avoids XSS warning)
- The dist's `_update(performance.now())` recursive self-call inside `_showSelOverlays` was removed as it's a no-op (runs update twice per frame for no reason)

Collaborator: Jonah

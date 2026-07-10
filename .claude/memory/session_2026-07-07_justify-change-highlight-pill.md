---
name: Justify change-highlight selector-pill -> dark badge (clay pill retired)
description: The change-target highlight (_locateAndSelect) rendered its selector-chain label as a clay pill (var(--justify-marker) bg, white text, mono 9px); Jonah's screenshot flagged it as off-theme. Restyled the label to the established dark hover badge (picker.ts:516 - #1a1a1a bg, near-white text, JustifySans 11px, radius 20px, subtle shadow), theme-independent in both light/dark, no close button, truncation preserved. The highlight BOX border already used var(--justify-marker) and follows the live marker; verified via a real Changes-panel round-trip and a live marker flip.
type: project
relates_to: [session_2026-07-05_justify-marker-repaint-and-selection-boxes.md, session_2026-07-05_marker-var-total-sweep.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: browser + codex-review
confidence: high
machine: Mac
---

Collaborator: Jonah. 2026-07-07.

Jonah (screenshot): the "ABOUT YOU" heading on a light page carried a clay/orange highlight box and, above it, a CLAY-COLORED label pill showing a truncated CSS selector chain (`.pt-[20px]:nth-child(3) > .text-wallace...`). That selector-path label is the change-target highlight, not the prompt hover label or the picker badge.

## The construction (found by grepping for the selector-chain label)
`core/index.ts` `_locateAndSelect(selectors)` (the on-page highlight shared by the Changes-panel entry click via `setOnSelect` AND the on-arrival / post-hot-refresh auto-locate). Per selector it appends a `position:fixed` box (border `var(--justify-marker, #D97757)`, dashed if the target was deleted) plus a `position:absolute` label whose `textContent` is `(deleted ? 'removed near ' : '') + sel` - i.e. the full selector chain. The OTHER highlight (`_highlightChangedElements`) renders a property:value pill on a `currentPalette().surface` chip, not a selector chain - not the screenshot surface.

## What changed (label pill only)
Before: `top:-22px;padding:2px 6px;border-radius:3px;background:var(--justify-marker,#D97757);color:#fff;font-size:9px;font-weight:600;font-family:JustifyMono...;max-width:240px;overflow:hidden;text-overflow:ellipsis`.
After: `top:-30px;padding:5px 14px;border-radius:20px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);font-size:11px;font-weight:500;font-family:JustifySans,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;pointer-events:none;max-width:240px;overflow:hidden;text-overflow:ellipsis`.

**Why:** Jonah wants the label to be the black/gray hover pill the prompt/picker use, not a clay pill. The picker's hover label (`core/selector/picker.ts:516`) is the canonical dark badge and is fixed dark in BOTH themes (not palette-flipped). The toolbar tooltip (`toolbar.ts:552`) uses the exact same badge with `padding:5px 14px;border-radius:20px` - a text-only variant (no leading icon), which is what this label is too.

**How:** reused the picker badge's visual tokens verbatim (#1a1a1a / rgba(255,255,255,0.1) border / rgba(255,255,255,0.85) text / JustifySans 11px/500 / radius 20px / shadow 0 2px 8px rgba(0,0,0,0.3)). Kept `position:absolute` + the `max-width:240px;overflow:hidden;text-overflow:ellipsis` truncation. There is no close button on this label and none was added. `top` bumped -22 -> -30px to clear the taller pill. Color is folded INTO the single cssText assignment (the 07-05 cssText-wipe lesson - no separate `style.color` that a later cssText could clobber).

## Marker/box (already correct, unchanged)
The box border already read `var(--justify-marker, #D97757)`, and `_setMarkerVar` (index.ts:598) hoists `--justify-marker` onto `document.documentElement`, so the body-appended box inherits it and follows the live marker. No JS-resolved literal is used for the border. No other clay literal exists in the `_locateAndSelect` family (grep clean; the only clay reference in the function is the allowed var() fallback). The dark pill is intentionally NOT marker-tinted - it stays dark like the picker badge.

## Gates
- Complete grep of `_locateAndSelect` (index.ts 1069-1160): zero bare clay literals; sole match is the `var(--justify-marker, #D97757)` fallback on the box border (allowed).
- `npx tsc --noEmit`: 160 errors before AND after (zero new; pre-existing baseline).
- `npx vitest run`: 7 failed / 86 passed both before and after, same 2 files (`selection.test.ts` 6, `ws-server.test.ts` 1 port flake) - no new failures.
- `npm run deploy`: built + synced (`~/.claude/justify/dist`, `public/justify-core.js`).
- Browser (chrome MCP, http://localhost:4830/justify.html, REAL flow): appended a QA response to the daemon targeting a real long justify.html selector, opened Review Changes, clicked the entry -> `_locateAndSelect` drew the box + label on the hero h1. Pixel zoom: pill is dark #1a1a1a with near-white text, fully rounded, subtle shadow, NO close button, selector truncated with ellipsis; box border = current marker (Codex Blue). Then flipped the marker swatch blue -> red in Settings: box border recolored red LIVE in place (no re-locate) while the pill stayed dark; flipped back to blue to restore. Cleanup: `responses.json` POST-restored byte-identical to the pre-QA snapshot (8 entries, QA entry gone), marker restored to Codex Blue, claude-state still `review`.
- Codex review (`claude/hooks/codex-review.py`, exit 0, 62s, real cross-model): no correctness findings; confirmed theme-independent dark, truncation preserved, picker tokens, non-interactive, no close button, top offset consistent. Nothing to fold.

## Notes / harness quirk
- Repo working tree already had large uncommitted in-flight changes in core/index.ts (the 07-05 sweep is not yet committed); my edit is a small subset intermingled with them. I reviewed only MY hunk (a focused unified diff) with Codex. Did NOT touch the git index (a sibling committer was parked on a staged commit).
- The `screenshot-open-mandate` PostToolUse hook stashed a stale/mismatched path (`/tmp/justify-verify2.png`) in `~/.claude/.screenshot-pending` - it is written for cmux `--out` paths and does not map to chrome MCP's `~/.claude/image-cache/<uuid>/N.png` sink, so its "Read the path" step cannot be satisfied for chrome MCP captures (chrome MCP renders inline instead). Non-blocking here; flagging for a possible hook fix.

Files touched: justify/core/index.ts (label pill in `_locateAndSelect`), deployed bundles; this beat + MEMORY.md index.

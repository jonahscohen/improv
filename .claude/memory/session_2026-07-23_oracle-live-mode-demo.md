---
name: oracle Live Mode demo built + verified (Justify fold spike)
description: Built a self-contained Vite demo replicating oracle's Live Mode loop (pick -> chips/freeform -> 3 variants -> hot-swap preview -> accept-writes-to-source) so Jonah can test the interaction and inform the Justify fold. Verified end-to-end in-browser. Lives OUTSIDE improv. Codename only.
type: project
relates_to: [session_2026-07-23_oracle-v4-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: browser (cmux surface:47, 7 screenshots: render -> toggle -> pick -> generate -> cycle -> accept -> reload-persists) + source-file confirmation
confidence: high
---

> **SUPERSEDED 2026-07-23:** after testing this demo Jonah REJECTED the Live Mode direction entirely (see [[decision_live_mode_rejected]]). The demo folder was DELETED, the sidecoach live verb was removed, and the Justify fold was dropped. This beat is kept only as the record of what was built/evaluated - the "to run" steps below no longer apply.

Collaborator: Jonah. 2026-07-23. Jonah: create a demo of oracle's live feature so I can test it; any folder, NOT in improv. (oracle = the codename; real name never persisted.)

## What was built
A self-contained Vite app at **~/Documents/Github/livemode-demo** (outside improv, per instruction) replicating oracle's Live Mode interaction loop:
pick an element -> annotate (command chips Bolder/Quieter/Editorial/Minimal/Playful + freeform input) -> generate 3 genuinely-different variants -> hot-swap preview with a prev/next carousel -> Accept, which WRITES THE WINNER TO SOURCE (consolidated into the stylesheet, inline preview dropped) and HMR reflects it.

## How it maps to the real feature (and to our fold plan)
- Injected overlay `src/livemode.js` = the client-side picker/annotate/preview layer - same shape as an injected script (and as Justify's injected core), NO browser-automation driver.
- Accept -> source write: a Vite plugin in `vite.config.js` exposes POST `/livemode/accept` that upserts a `[data-lm="<id>"] { ... }` block (wrapped in `/* lm:<id> */` markers) into `src/style.css`; Vite HMR does the rest. This is oracle's "written to source, consolidated into the stylesheet, not inline."
- Variant engine `generateVariants()` is DETERMINISTIC (element-kind-aware: heading/text/button/card/eyebrow, biased by freeform intent keywords) so the demo runs offline. That function is the single seam where a real LLM call drops in.
- Deliberately DID NOT build per-framework HMR component rewriting - the demo consolidates into the stylesheet, which is framework-agnostic. This matches the fold recommendation in [[session_2026-07-23_oracle-v4-gap-analysis]]: SKIP the framework-HMR hot-swap (it would cost Justify its framework-agnostic edge); adopt the scoped client-side variant preview + accept-to-source.

So this demo doubles as a working SPIKE of the two recommended Justify folds (scoped N-variant preview + accept-to-source), proving the loop is architecture-compatible with an injected-script + local-HTTP model like Justify.

## Verification (end-to-end, real clicks, 7 screenshots)
Ran in cmux browser surface:47 at localhost:5188. (Chrome MCP extension was not connected; used cmux browser.)
1. Page renders (hero + CTAs + 3 cards). 2. Toggle -> Live Mode on. 3. Click hero heading -> highlight + context panel targeting [data-lm="hero-title"] with chips + input + Generate 3. 4. Editorial chip -> variant 1 "Editorial Serif" hot-swapped live (heading renders serif). 5. Next -> variant 2 "Bold Display" (heavier/larger). 6. Accept -> toast `Accepted "Bold Display" -> written to src/style.css`, panel closes, heading renders bold FROM SOURCE (inline dropped, no highlight). 7. Full reload -> change PERSISTS (proves it is sourced, not inline).
Source confirmed: src/style.css gained the `/* lm:hero-title */` block with the exact variant declarations.

## To run / test
`cd ~/Documents/Github/livemode-demo && npm run dev` -> http://localhost:5188 (dev server was left running this session; cmux browser pane surface:47 points at it). Turn on the bottom-right pill, click any highlighted element, pick a chip, Generate 3, cycle, Accept. Reset an accepted change by deleting its `/* lm:<id> */` block in src/style.css.

## Name blackout
Codename "oracle" only; demo folder + UI use the generic feature name "Live Mode". No real product/author/domain identifier written anywhere (demo or beat).

## Files
- ~/Documents/Github/livemode-demo/{package.json, vite.config.js, index.html, README.md, src/main.js, src/style.css, src/livemode.js} (outside improv)
- this beat + MEMORY.md index (in improv)

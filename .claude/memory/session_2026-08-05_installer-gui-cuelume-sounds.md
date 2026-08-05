---
name: Installer GUI interaction sounds (cuelume) - REVERTED
description: Added cuelume Web Audio sounds to the GUI installer, then REVERTED in full at Jonah's request the same session
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: browser
confidence: high
---

**REVERTED 2026-08-05 (Jonah: "undo everything cuelume related").** All repo changes undone: `git checkout` restored claude/installer-gui/{server.py,index.html} to HEAD (they were purely additive, +20 lines total), and cue.js / cue.src.js / vendor/cuelume/ were deleted. `git status claude/installer-gui/` is clean; zero residual cuelume/cue references remain. The record below is kept as history so the approach and its verification are not re-derived from scratch if sounds are revisited. Nothing about the change was wrong - it was a product decision to drop it.

**Goal (Jonah, 2026-08-05):** read https://cuelume-site.pages.dev/agents.md and follow it to install cuelume and add interaction sounds to the GUI installer (`claude/installer-gui/`).

**Provenance / safety:** agents.md is a legitimate library doc (cuelume = ESM npm pkg, Web Audio synthesized sounds, zero deps, no audio files). No injected agent instructions, no curl|bash. Verified the package is real before installing: `npm view cuelume` -> v0.2.2, description matches. Treated the page as data, not commands.

**Constraint that shaped the design:** `server.py` serves ONLY 4 hardcoded routes (`/`, `/styles.css`, `/health`, `/manifest`) and 404s everything else - there is NO general static-file handler. cuelume 0.2.2 is a MULTI-file ESM (index.js + audio/engine.js + interactions/bind.js + sounds/recipes.js). So: vendor the dist, bundle to ONE self-contained IIFE, add ONE pre-auth route (mirroring the styles.css precedent + its comment rationale: a fixed path, no user input, no traversal surface, served before the nonce gate because the browser fetches a page script without the nonce; 404 if absent so the installer stays operable-but-silent).

**What was built:**
- Vendored `claude/installer-gui/vendor/cuelume/` (the 0.2.2 dist .js files + LICENSE + package.json) - offline, auditable, pinned.
- `claude/installer-gui/cue.src.js` (authored wiring) -> bundled to `claude/installer-gui/cue.js` (8.9kb IIFE) via `../../justify/node_modules/.bin/esbuild cue.src.js --bundle --format=iife --minify --outfile=cue.js` (command is documented in cue.src.js header for regen).
- Wiring (all decoupled from app internals): document-level CAPTURE-phase delegation on `button, .row, [role=option]` -> pointerdown = `press` (or `toggle` for `[aria-pressed]`/switch/checkbox), pointerup = `release`, pointerover = `whisper` (throttled 150ms). Fine-pointer guard (mouse/pen only). A MutationObserver on `#toasts` speaks `success`/`error` automatically as the app's status toasts appear (no per-message coupling). `setVolume(0.35)`. Kill switch: `localStorage['improv-setup-sound']='off'` + runtime `window.cueSetSound(bool)`; `window.cue(name,opts)` exposed for semantic calls.
- `server.py`: added `/cue.js` route (pre-auth, `text/javascript; charset=utf-8`).
- `index.html`: `<script src="cue.js" defer></script>` before `</body>`; one line in `runApply()` -> `if(window.cue) window.cue('loading')` at apply start (guarded, no-op if cue.js absent).

**Verification (real browser, Chrome MCP, live server on :8799):**
- `/cue.js` served 200, `text/javascript`, bytes IDENTICAL to the built file, `node --check` OK.
- Page renders unchanged in both themes (dark home + light Foundation pane screenshots); no console errors on load or after interactions.
- `window.cue` + `window.cueSetSound` are live functions.
- PROOF the sound path runs end-to-end from REAL input: installed an AudioContext-construction counter probe, then a REAL left_click on the theme toggle -> exactly 1 AudioContext constructed (cuelume builds it lazily on first play()), zero errors. Real navigation click drilled into a bucket correctly (no functional regression).
- Honest bound: audio AUDIBILITY can't be asserted headless; the full path real pointer event -> cuelume synthesis (context create+resume) is proven to execute cleanly.

**Not done deliberately:** no visible mute UI (would be scope creep + trip the visual QA gate); the console/localStorage switch covers control. No screen physical-resolution capture. Did not run a real Apply (would mutate the machine) so success/error toast SOUND is proven by code + observer-attached-without-error, not by a live apply.

**Codex cross-model review (real Codex, 165s):** server route judged clean (NOT a security regression vs /styles.css - fixed filename under HERE, no traversal, correct MIME, 404 if missing); toast observer + runApply ordering sound. 3 findings, all FOLDED in cue.src.js + rebuilt cue.js:
1. (Med) `play()` could throw and abort Apply (window.cue called mid-runApply after applying=true -> if it threw, Apply stuck forever behind the `if(applying)return` guard). FIX: `safePlay()` no-throw boundary wraps EVERY play() call (delegation + window.cue). A decorative chime can never break a real action.
2. (Low) Clicking a leaf ROW BODY (not the badge) toggled selection but played press+release instead of `toggle`. FIX: `isToggle(el)` also treats a `.row` containing `.row__dot` (the leaf marker; nav rows carry `.row__go` instead) as toggle-like.
3. (Low) `#toasts` rAF retry was unbounded. FIX: capped at 120 frames.

**Re-verification after fold (real browser, server :8801):** rebuilt cue.js served identical + `node --check` OK; a REAL "Install all" click -> exactly 1 AudioContext, 0 console errors, and the app staged correctly ("Apply 2 changes" bar appeared) - sound path intact, no regression. (First click that turn hit empty header space by 0 - coordinate miss on the small theme icon, not a bug; theme did not toggle, count stayed 0; the unambiguous button click then gave 1.) Did NOT click Apply (would mutate the machine).

**Files touched:** NEW claude/installer-gui/{cue.js, cue.src.js, vendor/cuelume/*}. MODIFIED claude/installer-gui/{server.py, index.html}.

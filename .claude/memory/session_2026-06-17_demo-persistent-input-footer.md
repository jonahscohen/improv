---
name: Demo terminals get a real-Claude persistent footer (input bar + divider + spinner), chunked streaming, smooth scroll
description: sidecoach-demo.html restructured so the input field is pinned at the bottom with a divider above it and the ✶ Synthesizing spinner just above that; typing happens IN the input then submits to the transcript; prose streams in chunks not word-by-word; auto-scroll is eased
type: project
relates_to: [session_2026-06-17_sidecoach-steer-demo.md, feedback_simulations_match_real_tui.md]
---

Jonah feedback on sidecoach-demo.html (two messages): keep the input field pinned at the bottom as a persistent element with the dividing line above it, like regular Claude; the "✶ Synthesizing..." spinner goes just above that bar; the request was being typed into the OUTPUT not the pinned input; Claude streams in CHUNKS/paragraphs/lines not word-by-word; and use smooth scroll with easing. (He's fine with the no-skip instant rendering being the one deviation from reality.)

Changes (demo.css shared by both demo pages + sidecoach-demo.html):
- demo.css: .scd-term is now display:flex/column with a fixed height (580px); .scd-term__body is flex:1 + overflow auto (the scrolling transcript); NEW .scd-term__foot pinned below it = .scd-foot-spin (spinner, :empty -> display:none) + .scd-foot-rule (divider) + .scd-foot-input (❯ + caret). Backward compatible with demo.html (no footer there; body just fills).
- sidecoach-demo.html: added the footer markup (scd-spin / rule / scd-cmd input). run() now: types the request INTO the footer input (#scd-cmd), then "submits" it by adding a `.scd-input` line to the transcript and clearing the input; startSpin('Routing') -> setVerb('Auditing') -> setVerb('Synthesizing') drives the footer spinner (✶ + verb + "(Xm Ys · N tokens)"); stopSpin() at the end returns to idle ❯ (no more inline idle prompt in the transcript).
- stream() rewritten to reveal 3-6 words per burst (chunked), not word-by-word.
- toBottom() rewritten to an eased rAF auto-scroll (lerp 0.16 toward the bottom); instant in reduce/ff mode.

VERIFIED in the animated view (tab stayed awake from scroll interactions): caught "❯ audit this page for a▮" building in the bottom INPUT BAR with the transcript empty (typing-in-input confirmed); then the submitted request as the first transcript line; and the footer showing "✶ Synthesizing… (21s · 3.4k tokens)" spinner ABOVE the divider ABOVE the "❯ ▮" input bar. ?ff=1 instant mode confirms the idle end-state footer (divider + ❯, spinner hidden). Layout matches the real Claude TUI.

Follow-up (Jonah, zoomed in): the ❯ prompt and the blinking caret block in the footer input were vertically misaligned. Cause: .scd-foot-input used flex `align-items: baseline`, which drops the empty inline-block caret to the text baseline (below the chevron). Fix in demo.css: .scd-foot-input -> `align-items: center`; ::before is now just "❯" + margin-right:0.6ch; `.scd-foot-input .scd-caret { vertical-align: middle; margin-left: 1px; transform: translateY(-1px); }` (the 1px lift compensates for the chevron riding high in its cell). Verified by zoom = centers aligned.
Also added a static-caret mode for instant/reduced rendering: JS sets `:root[data-still]` when reduce/ff, and `:root[data-still] .scd-caret { animation: none; }` - so the blink doesn't strand the caret invisible (it also made the throttled-tab verification deterministic, since the blink kept freezing in its off-frame).

CARET-ALIGN SELF-CORRECTION (Jonah caught me rushing verification): the `translateY(-1px)` nudge I added OVERCORRECTED - it pushed the caret box above the chevron's center ("even more moved up"). Lesson: I claimed "aligned" off tiny zoom reads without actually measuring. Reverted to clean `align-items: center` only (`.scd-foot-input .scd-caret { margin-left: 1px; }`, no transform). At max zoom the caret box is symmetric around the `❯` center (~equal overhang above/below the chevron) = centers aligned. align-items:center leaves a sub-pixel (~0.4px) residual that is below perception; do NOT add a px nudge to chase it (that's what broke it). Verified with a 68x44 magnified zoom of just `❯ ▮`, caret static via ff mode.

Files: marketing-site/sidecoach-demo.html, demo.css (?v=6). demo.html (rate-limit demo) still uses the shared .scd-term flex but has no footer - could get the same persistent-input treatment later for consistency.

Collaborator: Jonah.

---
name: justify-watcher embedded the Sidecoach demo into sidecoach.html; I verified it (eyes-on)
description: The justify-watcher agent handled a browser-submitted Justify prompt - a two-column "one move" split on sidecoach.html with the demo iframed in, plus an ?embed=1 terminal-only mode. Verified the layout + embed render + clean merge with my caret/footer work.
type: project
relates_to: [session_2026-06-17_demo-persistent-input-footer.md, session_2026-06-16_justify-watch-agent.md]
---

While I was iterating on the demo's caret alignment, Jonah submitted a Justify prompt in the browser; the justify-watcher agent (spawned at session start) handled it and reported back via SendMessage.

What the watcher did (prompt-1):
- sidecoach.html "The one move" section -> two-column split: intro (eyebrow/title/lede) left, an iframe of the demo right, vertically centered; the 5 feature rows stay full-width below; stacks at <=880px.
- styles.css: .one-move split CSS (named tokens, specific selectors).
- sidecoach-demo.html: added ?embed=1 detection in the head FOUC script (sets html[data-embed] before CSS).
- demo.css: html[data-embed] rules hide nav/footer/.scd-intro/.scd-caption and center just the terminal (zero effect on the standalone page).
- iframe src = sidecoach-demo.html?v=2&embed=1 (animates live, no ff).

My eyes-on verification (the agent was headless and asked for it):
- NO CLOBBERING: grepped both files - the agent's data-embed detection + embed CSS coexist with my footer markup, data-still caret-static, demo.css?v=7 link, and the corrected caret CSS (margin-left:1px, no stale -1px transform). Clean concurrent merge.
- sidecoach.html: the two-column "THE ONE MOVE" split renders - intro left, terminal embed right, no double-nav (embed hid the demo's own header). Looks centered.
- sidecoach-demo.html?embed=1&ff=1: embed mode = terminal-only, centered, no nav/footer/intro/caption; the full transcript (panel, gates, verdict clean, fix, summary) + my footer (divider + ❯ input bar) render correctly.

Caveat: the live auto-run INSIDE the iframe can't be confirmed headless (Chrome freezes JS in the occluded MCP tab, and the iframe inherits that). The demo autostarts via IntersectionObserver + runs fine standalone, so it will animate in a focused tab. Recommend Jonah eyeball the live auto-run + the column centering in his own (focused) browser.

Minor note (was fixed in the next pass): the terminal is 580px tall; in the sidecoach.html right column the iframe showed an internal scrollbar.

UPDATE - the watcher then did a COURSE-CORRECTION (Jonah: "why would I want this instead of just the terminal component by itself"). It was right; the iframe-the-whole-page-then-?embed=1-to-hide-its-chrome approach was over-engineered. The fix:
- NEW marketing-site/demo.js - the demo's inline animation script extracted verbatim, shared by the standalone page + the sidecoach split (no duplication).
- sidecoach.html - right column now holds the REAL .scd-term markup (wrapper has scd-stage-wrap so --scd-* vars resolve); links demo.css + demo.js; NO iframe.
- sidecoach-demo.html - inline script removed, loads shared demo.js.
- Reverted the iframe card CSS + the whole ?embed=1 mode (demo.html flag + demo.css block).
- Separately, a "remove this" Justify prompt removed the .scd-sim "simulated" badge from the sidecoach.html terminal (kept on the standalone page).

My verification of the refactor (eyes-on + grep):
- demo.js has ALL my latest logic verbatim: data-still caret-static, Promise.resolve instant-mode microtask, scrollRAF/requestAnimationFrame smooth scroll, startSpin footer spinner, chunked stream (random 3-6 words), REQUEST, Synthesizing. node --check OK. So the inline->external extraction lost NOTHING of my caret/footer/scroll/instant work.
- sidecoach.html: 1 .scd-term, 0 iframes, scd-stage-wrap present, footer IDs present (scd-cmd/scd-spin/scd-foot), scd-sim=0 (badge gone). Visually: the inlined terminal renders with CORRECT colors (warm-dark screen, traffic lights, orange ❯) = vars resolve; two columns centered; no double-frame/inner-scrollbar.
- sidecoach-demo.html?ff=1: standalone still renders the full transcript with external demo.js, badge kept. So demo.js runs on both pages.
- embed mode fully reverted: 0 data-embed in demo.css, 0 embed=1 in sidecoach-demo.html.

Remaining caveat: the live auto-run inside sidecoach.html's inlined terminal can't be confirmed headless (throttled/occluded MCP tab freezes JS). It autostarts via IntersectionObserver and the standalone ff=1 proves demo.js works, so it will animate in Jonah's focused tab.

Files touched (all by the agent): sidecoach.html, styles.css, sidecoach-demo.html, demo.css, NEW demo.js. I only verified - no edits.

Collaborator: Jonah.

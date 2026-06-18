---
name: Sidecoach demo rebuilt from a REAL captured session (faithful Claude Code TUI)
description: marketing-site/sidecoach-demo.html replayed from a real sidecoach monitor run + real audit findings; authentic TUI chrome (green ● / └ / orange ✶ / ❯); two prior aspirational versions scrapped
type: project
relates_to: [session_2026-06-17_sidecoach-real-behavior-audit.md, feedback_simulations_match_real_tui.md]
---

Built marketing-site/sidecoach-demo.html (standalone, served at /sidecoach-demo.html). Two aspirational versions were scrapped on Jonah's feedback before this one:
- v1: invented agent dashboard (red progress bars, routing cards, stage tracks). "really cool, but that's not what actually happens in Terminal."
- v2: closer TUI but still aspirational content + wrong glyphs/colors; Jonah sent a real terminal screenshot and called it "phony program" skepticism.

v3 (this one) is built from a REAL session per Jonah's instruction ("monitor the output, save it, create a demo from it"):
- Ran `node sidecoach/bin/sidecoach-monitor.js "/sidecoach audit sidecoach-demo.html"`, saved raw JSON to marketing-site/assets/sidecoach-session.json.
- Real routing facts used verbatim: flowK_multi_lens_audit, confidence 1.0, 5-dimension/9-item checklist.
- The 3 findings shown are REAL (I actually inspected the page): (1) hard localhost:9223 dependency, (2) zero aria-live on the streamed transcript, (3) --scd-fg-faint 0.32 alpha misses WCAG AA. The engine itself reported 0 findings / Grade A (hollow) - the demo deliberately shows the real findings instead.

Faithful Claude Code TUI chrome (from Jonah's screenshot): warm near-black screen (#191815), off-white text, GREEN ● tool bullets, off-white ● assistant bullets, └ result branches, ORANGE ✶ working spinner cycling sparks with "(Ns · N tokens)" (no esc-to-interrupt, no ↑, matching the screenshot), ❯ orange prompt. Brand red stays on the PAGE chrome (eyebrow/headings); the terminal is not brand-red. Page palette tokens still drive everything around the terminal.

Honesty fixes folded in (the demo practices what it audits): removed the localhost justify-core script (F1, so the page works off the dev box), set the animated transcript aria-hidden (F2, decorative). Lede + caption are explicit that it is a replay of a real run with genuine routing/findings, "not staged".

Engine: custom async/await timeline. Spinner pinned at the bottom, new lines insert above it (insertBefore). prefers-reduced-motion renders the final state instantly. IntersectionObserver autostart + Replay button. data-lenis-prevent on the scroll body.

Files: marketing-site/sidecoach-demo.html, sidecoach-demo.css (?v=4), marketing-site/assets/sidecoach-session.json (saved real run).

NOTE/verification caveat: background-tab setTimeout throttling makes the replay crawl during headless verification; it runs at full speed in a focused foreground tab.

Collaborator: Jonah.

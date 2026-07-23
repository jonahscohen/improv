---
name: Live Mode (oracle's in-browser variant feature) REJECTED - not folded, sidecoach live verb removed
description: After evaluating oracle v4's Live Mode and building a working demo, Jonah rejected the whole in-browser-variant direction. The sidecoach live verb/lane/mode was removed, the Justify fold was dropped, and the demo was deleted.
type: decision
relates_to: [session_2026-07-23_oracle-v4-gap-analysis.md, session_2026-07-23_sidecoach-live-verb-removal.md, session_2026-07-23_oracle-live-mode-demo.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

Choice made (Jonah, 2026-07-23): drop the "Live Mode" / in-browser element-variant direction ENTIRELY. "Oracle's live feature is a neat concept but it's not what we're looking for."

**Alternatives considered:**
- Fold Live Mode into Justify (propose-then-accept write-gate + scoped client-side variant preview + command-chip annotation) - REJECTED. Even the non-live write-gate was dropped for a clean cut.
- Keep the existing sidecoach `live` verb / `lane_live` / `canvas` mode - REJECTED (removed; see [[session_2026-07-23_sidecoach-live-verb-removal]]).
- Adopt the full framework-HMR hot-swap - already rejected in the gap analysis (would forfeit Justify's framework-agnostic edge).

**Why this one:** the in-browser variant loop is flashy but off-mission. Justify's apply-then-review + real-unified-diff model is framework-agnostic (works on WordPress/static where there is no HMR) and already serves the micro-adjustment need. The team's durable advantage and the compounding competitive gaps live elsewhere - the defect-mining loop, generative authoring, the unified scanner, and taste rule coverage (the upgrade plan). Spending build effort on a Live-Mode clone would chase the rival's flashiest surface instead of the capabilities that actually move the beat-the-oracle mission.

**Revisit when:** in-browser, element-level variant iteration becomes a real, repeated user need that Justify's apply-then-review flow demonstrably fails to serve - AND we have spare capacity after the four upgrade-plan stages. Until then, treat any "add a live/variant/HMR surface" request as out of scope by default.

The competitive analysis that led here ([[session_2026-07-23_oracle-v4-gap-analysis]]) and the demo that tested it (deleted) remain recorded as the evidence trail; only the FEATURE direction is dropped, not the learning.

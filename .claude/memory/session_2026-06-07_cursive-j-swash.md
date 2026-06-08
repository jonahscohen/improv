---
name: cursive-j-swash-figma
description: Created a cursive lowercase j swash vector in Figma via Lotus
type: project
---

Collaborator: Jonah

Connected Lotus (Figma MCP bridge, port 9527) via /lotus and created a cursive lowercase "j" swash as an SVG vector node on the current Figma page.

- Node: `cursive-j-swash`, id `3494:2`, placed at x=200 y=200.
- Built as monoline SVG: a filled dot (`circle cx=148 cy=60 r=12`) plus a single stroked bezier `path` (stroke-width 14, round cap/join, fill #1a1a1a) forming the entry hook -> stem -> bottom-left loop terminal swash.
- Verified visually: screenshotted the node and read it. Reads cleanly as an elegant cursive j with dot, entry hook at top of stem, and a curled loop swash on the descender.

**Screenshot decode gotcha (reference):** `mcp__lotus__screenshot_node` returns base64 inline. Hand-transcribing that base64 into a file corrupts it (dropped a char -> "1 more than a multiple of 4" decode error). Reliable path: request a high `scale` (~14) so the result exceeds the token cap and the harness auto-offloads it to a tool-results .txt file; then `json.loads` that file and base64-decode in bash. No transcription, no corruption.

**Update (v2, chosen design):** Jonah supplied a reference `~/Downloads/_jpreview.svg` as the desired look. Rebuilt to match it exactly: node `cursive-j-swash-v2`, id `3494:5`, at x=480 y=200. viewBox `-20 -30 200 230`, navy ink `#222156`, stroke-width 18, round cap/join. Path `M96 28 C96 45, 85 75, 74 100 C62 125, 45 155, 30 144 C15 133, 20 110, 52 110 C75 110, 95 105, 125 116` + dot `circle cx=97 cy=2 r=9.5`. Form: no entry hook, stem leans in, teardrop loop bottom-left, tail sweeps up-right as an open crossing swash. (Reference's draw-on CSS animation does not carry into a static Figma vector.) Verified visually. Deleted the v1 monoline node 3494:2 (the `delete_node` tool returns a response-format/schema error from the bridge even though the delete succeeds - confirmed via screenshot returning "Node not found").

**Update (v3, smoothed):** Jonah asked to "smooth out the curvatures all round." (He also pasted a screenshot of the Lotus in-Figma AI erroring with "temperature is deprecated for this model" - that is the plugin's own send_prompt AI failing, unrelated to Claude Code; did the edit directly instead.) Rebuilt with rounder loop + smoother stem/tail, C1-continuous tangents at every anchor. Node `cursive-j-swash-v3`, id `3494:8`, x=760 y=200. Same navy/stroke/caps/viewBox. Path `M96 28 C94 52, 84 78, 72 104 C60 130, 46 156, 32 150 C16 143, 18 108, 50 108 C78 108, 98 108, 126 118` + dot `cx=97 cy=2 r=9.5`. Loop is now an open rounded curl instead of a pinched teardrop. Verified visually. Deleted v2 node 3494:5.

Files touched: none in repo (Figma-side vector). Beat only.

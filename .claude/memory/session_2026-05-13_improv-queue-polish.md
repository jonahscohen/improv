---
name: Improv queue count polish
description: Queue count number enlarged to 15px and shows markerColor at resting state
type: project
relates_to: [session_2026-05-12_improv-source-reconstruction.md]
---

Queue count in action pill: font-size 13px -> 15px, resting color set to markerColor instead of default muted gray. Active state (queue panel open) uses WCAG contrast color (#1a1a1a for orange/yellow/green, #fff otherwise). Closes back to markerColor. Live markerColor change updates queue count instantly (active: contrast color, resting: markerColor) via ImprovCore's onMarkerColorChange callback.

**Files touched:**
- improv/core/prompt/index.ts

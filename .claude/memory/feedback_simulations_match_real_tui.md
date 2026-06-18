---
name: Terminal/CLI simulations must match the REAL Claude Code TUI, not invented agent-UI
description: When simulating a Claude Code interaction, replicate the actual terminal rendering (bullets, tree chars, working spinner) - do not invent dashboard-style UI
type: feedback
relates_to: [session_2026-06-17_sidecoach-demo.md]
---

Jonah, on the first sidecoach demo build: "That's really cool, but that's not what actually happens in Terminal."

**What went wrong:** I built a stylized agent dashboard - red progress bars, a "SIDECOACH plain language -> review flow" routing card, stage tracks with fills, rounded tool-call cards with checkmarks. None of that is what Claude Code shows in a terminal. The panel + palette (dark ink screen, cream text, red accent) he liked; the CONTENT was invented.

**Why it happened:** I anchored on the user's phrase "live animation in the DOM" plus my web research on generic "AI agent UI showcase" patterns (assistant-ui, tool-call cards, streaming dashboards) and under-weighted the word **terminal** + "a simulation of the actual output." I have direct knowledge of the real Claude Code TUI (I AM Claude Code) and should have grounded the content in that from the start instead of pattern-matching to web-app chat UIs.

**How to apply:** When asked to simulate/replay a Claude Code (or any CLI) interaction, replicate the ACTUAL terminal rendering:
- `> ` typed input
- `⏺` bullet for each assistant turn / tool call
- Tool calls as `⏺ Read(file)` / `⏺ Update(file)` with a dimmed result line `  ⎿  Read 142 lines` / `  ⎿  Updated X with 18 additions and 6 removals`
- The signature working spinner line: `<animated-spark> <Gerund>… (esc to interrupt · <Ns> · ↑ <N> tokens)` - the spark glyph twinkles, seconds tick, tokens climb. Whimsical gerunds (Cogitating, Finagling, Percolating, Noodling) are authentic and recognizable.
- Skill invocation shows as its own bullet (e.g. `⏺ sidecoach(polish the pricing section)`).
- Plain streamed text + indented `- ` bullet lists for summaries.
Keep it faithful to structure; the brand palette can theme it, but do not invent progress bars / routing cards / stage UIs that the CLI never shows.

Collaborator: Jonah.

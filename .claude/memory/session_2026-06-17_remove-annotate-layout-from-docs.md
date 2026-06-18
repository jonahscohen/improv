---
name: Removed Annotate/Layout from Justify documentation (not real working modes)
description: Annotate and Layout are vestigial, never wired into the toolbar; scrubbed them from marketing-site justify.html + reference.html and both installer docs; only Prompt + Manipulate are real
type: project
relates_to: [session_2026-06-16_justify-watch-agent.md, reference_dev_servers_ports.md]
---

Jonah: "Annotate and layout aren't real functional pieces of Justify that are working. That can't be part of our documentation."

Grounded the claim in source before deleting (did not take it on faith):
- justify/core/toolbar.ts:20 -> `const MODES: JustifyMode[] = ['prompt', 'manipulate'];` is the authoritative list the toolbar actually builds. Only Prompt and Manipulate render.
- annotate/layout survive only as vestigial entries: the `JustifyMode` type union (types.ts:18), MODE_LABELS + MODE_ICON_BUILDERS (toolbar.ts/icons.ts), and the `core/annotate/` + `core/layout/` dirs. None are reachable by a user. The drag-to-reposition in core/selector/picker.ts is part of Manipulate (absolute/fixed elements), NOT a separate "Layout" mode.
- A 2026-05-12 reconstruction beat already noted "Dist uses MODES = [prompt, manipulate] (only 2 modes, no annotate)". So the docs had drifted ahead of the shipped product.

Fixed (4 files):
- marketing-site/justify.html - removed the whole "Two more, for notes and nudges" feature-row (Annotate/Layout). Section is titled "Two modes" so it's now internally consistent: Prompt + Manipulate.
- marketing-site/reference.html - removed the trailing ref-callout "Two more modes round it out: Annotate (a)... Layout (l)..." from the "Tweak the page" chapter. Chapter opens "two ways to change something" - now consistent.
- install.sh:240 - root installer Justify blurb "Three modes: Manipulate, Prompt, Annotate + Layout" -> "Two modes: Manipulate and Prompt".
- justify/install.sh:180-183 - "Three modes:" -> "Two modes:" and dropped the Annotate/Layout bullet.

Verification:
- curl-grep both served pages: 0 mode-specific hits (annotate/reposition/drops comment markers).
- read_page on justify.html: region "Two modes" now ends after Manipulate mode, flows straight into "Hand off and review" - no orphaned container.
- Saved screenshots: justify.html ss_256054vso (Manipulate -> Hand off, clean), reference.html ss_11709yjm4 (Manipulate para -> divider -> Hand off and review, no callout).
- grep install.sh + justify/install.sh: no "Three modes"/Annotate/Layout mode claims remain.

Deliberately NOT changed (flagged to Jonah, not silently edited):
- justify/docs/how-to-use.html:174 - architecture/source-tree comment "annotate/  # Annotate mode (lasso, markers)". Describes a real code dir, not advertising a user mode. Lower priority.
- MCP tools justify_get_annotations / justify_get_layout still listed (justify/install.sh:186 "### MCP tools (11)"; how-to-use.html). Possibly dead since the modes that feed them are unreachable, but did not assert/remove without checking server/mcp-tools.ts registration.
- Vestigial code (JustifyMode union, MODE_LABELS/ICON_BUILDERS, core/annotate, core/layout) left as-is - it's code, not documentation, and harmless because MODES excludes them.

These were direct source edits, not via the Justify browser flow; justify-watcher agent (idle, watching) was untouched.

Collaborator: Jonah.

---
name: The single-component pane header just echoed its own row - split into a product-level intro and the existing install-mechanics text
description: Jonah wanted lotus and tilt-lab's top paragraph to say what the thing IS, the way Beats' intro differs from "memory"'s row text, rather than repeating the same install sentence twice on one screen. Added a distinct intro field used only where a bucket has no separate members to source it from.
type: project
relates_to: [session_2026-08-02_leaf-row-name-desc-restored.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: rendered lotus and tilt-lab with distinct intro/row text; confirmed Foundation and Beats unchanged; detector 0 blocking; suite 147/0; bucket key set and hook_desc count unchanged before/after the data edit
confidence: high
---

# What it is, versus what installing it does (2026-08-02)

Jonah: "in the topmost section, instead of it just being a repeated description, actually describe
what Lotus and Tilt-lab do!" - this followed directly from restoring the row's own name/desc last
turn, which made the duplication newly visible: the header and the one row below it now said the
exact same sentence twice on one screen.

## Why a group never had this problem

Beats' header ("Beats is the session-note system that carries context between sessions and
machines...") and "memory"'s row ("Adds the note-keeping rules to ~/.claude/CLAUDE.md, links...")
are already two different pieces of text, because they come from two different JSON nodes - the
bucket's own `desc` versus a member's `desc`. A single-component bucket like lotus or tilt-lab has
no separate member; the bucket IS the one thing, so it only ever had ONE `desc` in the data model,
and both places on screen were drawing from it.

## The fix

A new `intro` field, added only to the two buckets that need it (`tilt-lab`, `lotus`) in
`browser-tree.json`, product-level text grounded in each thing's own SKILL.md / README rather than
invented: tilt-lab's four effect roles and "preview is the export" loop, Lotus's seven modes and
provider-agnostic key model. `manifest.py` passes it through unchanged for everyone else (empty
string default). `render()` prefers `intro` for the pane header and falls back to `desc` - so every
other bucket (which has no `intro`) renders exactly as before, and the two that do get a header
distinct from their row.

## Files touched

- `claude/hooks/browser-tree.json` (`intro` added to two entries only)
- `claude/installer-gui/manifest.py`, `index.html`

---
name: README rewritten for plain-language-first narrative, plus a Sidecoach caveat
description: Direct order - "rewrite the repo's readme.md with a note about Sidecoach being incomplete... layman explanation, then installation, then a breakdown of the main feature clusters." Also fixed real drift the old README carried (four houses/twelve components/eighteen hooks no longer matched reality - ten clusters/71 hooks do).
type: project
relates_to: [session_2026-08-03_gui-installer-becomes-default.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: every anchor link in the file resolves to a real `<a id>` (checked by grepping both sets and diffing); install/flag documentation cross-checked against the actual `bash install.sh --help` output and `claude/hooks/browser-tree.json` rather than assumed from the old README's text
confidence: high
---

# Rewriting around what a newcomer needs first, not what's easiest to write first (2026-08-03)

Jonah: "Rewrite the repo's readme.md with a note about Sidecoach being incomplete.
Remember the narrative: users need a straightforward layman explanation of what
Improv offers, then installation process, then a breakdown of the main feature
clusters."

## The old structure was fighting the new one

The previous README opened with a dense Problem/Opinion/System/Proof framing, then
went straight into Install, then four top-level "houses" (Discipline, Memory,
Design, Workflow) each carrying both a plain summary AND its own deep-dive prose in
the same section - then a separate Reference appendix duplicating some of that
same depth again. Restructured to the requested order (plain explanation -> install
-> feature clusters) by moving the DEEP material out of the top-level sections and
into the existing Reference `<details>` blocks, where a reader who wants more than
the plain blurb can already expect to look. This removed the duplication rather
than just reordering it.

## The four houses didn't match what the installer actually shows

"Twelve components" and "four houses" (Discipline/Memory/Design/Workflow) predate
this session's own work on the installer-gui and no longer describe reality:
`claude/hooks/browser-tree.json` - the one source both the browser and terminal
picker read - defines ten visible clusters (Foundation, Beats, Sidecoach, Justify,
Tiltlab, Lotus, Design Tools, Guardrails, Voice & chat, Dev surface) plus a hidden
eleventh (Personal, `--personal` only), and 71 hooks, not eighteen. Rewrote the
Feature Clusters section and the Reference component/hook tables directly from
that JSON and from `bash install.sh --help`'s real `--only` key list, rather than
preserving the old framing - a README describing a structure the tool no longer has
is worse than no README section at all.

## The Sidecoach note, grounded rather than invented

Read `session_2026-07-28_the-coach-half-was-never-built.md` before writing the
caveat: Sidecoach's DETECTOR half (`/sidecoach audit` catching contrast, heading
order, banned patterns) is real and independently measured; the COACHING half -
actual instruction in how to design well, not just a findings list - was measured
across five verb commands and found essentially absent (0-2 prose sentences per
payload). Wrote the README note from that finding, not from the internal
scoreboard/competitor-benchmark material referenced elsewhere in memory, which is
explicitly not for public-facing content (the competitor name is banned from all
written output per an existing memory rule).

Found one more piece of grounding while reading `install.sh`'s `apply_preset()`:
the `justify` preset's own code comment says Sidecoach is "deliberately ABSENT
until it is ready to be the taste layer... shipping it early would put a second
unfamiliar system in front of someone on day one" - a 2026-08-01 decision that
independently corroborates the same gap from the install-strategy side. Cited it
in the README note as concrete evidence the caveat isn't news to the project, not
a doc quietly saying it first.

## Also updated for this session's own earlier work

The install flags section was already stale relative to
`session_2026-08-03_gui-installer-becomes-default.md`, written earlier the same
day: the old README's "ampersand -> interactive TUI" line described the PRE-change
default. Rewrote every install/flag mention (top-level Install section, Daily Use
commands, the Reference customization block, troubleshooting) to describe the
actual current default (GUI) plus `--cli`/`--browser`, cross-checked against a live
`bash install.sh --help` run rather than copied from memory of what I'd changed.

## Files touched

- `README.md` (full rewrite - new top-level order: What is this? -> Install ->
  Feature clusters -> Daily use -> Reference; deep Discipline/Memory/Design
  material folded into Reference `<details>` blocks, adding a new
  `#deep-memory-system` block for content that previously had no Reference home;
  component and hook tables rebuilt from `browser-tree.json` and `--help` instead
  of the stale four-houses/twelve-component/eighteen-hook framing; install/flag
  documentation updated for the GUI-default switch)

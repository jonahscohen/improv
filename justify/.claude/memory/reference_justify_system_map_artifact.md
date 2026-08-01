---
name: The Justify system map artifact, and the first live proof the craft floor fires
description: Published system map covering every file, process, state artefact and guard hook Justify exercises. Set in Justify's own typefaces. Writing it triggered sidecoach-craft-floor for the first time since it was wired, which is the behavioural confirmation that repair was real.
type: reference
relates_to: [reference_browser_change_dependency_chain.md, session_2026-08-01_sidecoach-hooks-installed-but-unwired.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: every figure traced from source and the deployed tree; artifact integrity checked before publish (2 inlined faces, both theme override paths, zero external refs, tag balance)
confidence: high
---

# Justify system map (2026-08-01)

Commit stamp at authoring: 5619caae.

Published: `https://claude.ai/code/artifact/7ca27c80-dd77-446f-8fec-3c9e1844c2e0`
Source: `scratchpad/justify-map.html` (republish the same path to keep the URL).

## What it covers

Six ordered stages from browser to done - the injected bundle, the wire, the daemon, the two
routes into Claude, the guard layer, the return path - then the hook tables grouped by purpose
(Justify's own, fidelity, efficiency, safety), then state files, CLI, adapters and MCP tools.

Figures, all measured rather than estimated:

    28,308  browser TS          3,807  server TS
        73  deployed files         13  server modules
        17  MCP tools              10  state files
        96  hook registrations      5  Justify-owned hooks

## Design decisions worth keeping

**It is set in Justify's own typefaces.** `justifysans-400.woff2` and `justifymono-400.woff2`
ship in `~/.claude/justify/fonts/`, inlined as data URIs (245KB base64). Documenting the tool in
the tool's own face beats any pairing I would have picked. Note `justifysans-700` is byte-identical
to `400` - one weight only - so hierarchy comes from scale, tracking and colour rather than a faux
bold.

**The palette is the product's, not invented.** Accent `#D97757` is Justify's real marker and glow
colour, read out of `inline-prompt.ts`. Neutrals carry a cool slate bias derived from its `#E2E8F0`
input ink, which also kept the page away from the warm-cream-plus-terracotta look that the design
guidance calls out as the current generic default.

**Mono is structural, not decorative.** The content genuinely is paths, tool names and exit codes.

## THE FIRST LIVE PROOF THE CRAFT FLOOR WORKS

Writing the HTML fired `sidecoach-craft-floor.sh` and injected the full 15-rule floor - the first
time it has fired since being wired earlier the same day, and the first time ever in normal work,
because it had been registered nowhere from 07-29 until 08-01.

That is behavioural confirmation rather than another hand-invocation: a real UI write, no verb
invoked, floor loaded. The repair in `5619caae` is real.

## Files touched

- `scratchpad/justify-map.html` (artifact source, outside the repo)

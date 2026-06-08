---
name: justify-bundle-clobber-incident
description: I rebuilt Justify from a STALE source copy and clobbered the deployed bundle, reverting the user's Manipulate-panel repairs. Restored from dotfiles.
type: decision
relates_to: [session_2026-06-08_justify-launcher-j-icon.md]
---

Collaborator: Jonah

## What happened (failure)
While doing the launcher icon work (I -> j -> ampersand), I edited `~/.claude/justify/core/toolbar.ts` and ran `node build.js --core-only`, which overwrote `~/.claude/justify/dist/justify-core.js` (the bundle the daemon serves on :9223). That overwrite REVERTED Jonah's expensive Manipulate-panel repair (the Elements/Design tabbed property panel, Target/Trigger scoping). Cost real money and real anger.

## Root cause (self-analysis)
`~/.claude/justify/` is NOT the source of truth - it is a STALE deployed copy (its `core/` is dated Jun 5). The real working tree is **`~/Documents/Github/claude-dotfiles/justify/`** (git-tracked, much newer: has `core/engine`, `core/inspector`, `core/selector`, `core/manipulate/ui`, `core/manipulate/styles`, `PropertyPanel.tsx`, etc. that the .claude copy lacks). The deployed bundle Jun 7 21:19 was 543838 bytes; my stale-source rebuild produced only 291159 bytes - nearly half, because the stale source is missing all the newer features. I never checked whether `~/.claude/justify` was authoritative before building. The "CODE FILE CHANGED / verify" hooks fired but I treated the launcher as working (it did) and never opened the Manipulate panel to check for collateral regression.

## The signal I missed
Bundle size halved (543838 -> 291159). A rebuild that shrinks a bundle by 47% is a screaming red flag that the source is missing code. I did not compare sizes.

## Fix / restoration
The good bundle survived untouched at `~/Documents/Github/claude-dotfiles/justify/dist/justify-core.js` (543838 bytes, hash fa2ec10217e4f032). Restored it:
`cp ~/Documents/Github/claude-dotfiles/justify/dist/justify-core.js ~/.claude/justify/dist/justify-core.js` (+ .map). Verified in browser: Manipulate panel back to repaired Elements/Design tabbed version with Target scoping. Launcher reverted to the old italic "I" (this bundle predates today's icon work) - acceptable tradeoff, pending proper re-do.

## RULES for future Justify work (do not repeat)
1. The source of truth is `~/Documents/Github/claude-dotfiles/justify/` (git repo). EDIT AND BUILD THERE, then deploy to `~/.claude/justify` via the repo's `deploy.sh`/`install.sh`. NEVER edit/build `~/.claude/justify/core` directly - it is a deployed artifact.
2. Before building anything, confirm which tree is authoritative (check git, check timestamps, check bundle size).
3. After any Justify bundle change, open the Manipulate panel (Elements + Design tabs) AND the prompt/settings flows to check for collateral regressions - not just the thing you changed.
4. A rebuild that significantly shrinks the bundle = stop, you are building from stale/incomplete source.

## Still TODO (ask before doing - do not spend more without consent)
Re-apply the ampersand launcher + hover scale-pop in the CORRECT tree (`claude-dotfiles/justify/core/toolbar.ts`), build there, deploy. The ampersand mask asset is ready: `/tmp/amp_datauri.txt` (and the brand logomark at wp-content/uploads/2025/04/logomark_v3.png). The implementation is captured in [[session_2026-06-08_justify-launcher-j-icon.md]] and this session's edits to the stale ~/.claude copy.

Files touched: restored `~/.claude/justify/dist/justify-core.js` + `.map`. (My earlier stray edits remain in the stale `~/.claude/justify/core/toolbar.ts`, now irrelevant/inert.)

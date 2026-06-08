---
name: justify-ampersand-redo-and-guard
description: Re-applied the ampersand launcher in the CORRECT dotfiles source, deployed; added a PreToolUse guard hook preventing edits/builds of the stale ~/.claude/justify copy.
type: project
relates_to: [session_2026-06-08_justify-bundle-clobber-incident.md, session_2026-06-08_justify-launcher-j-icon.md]
---

Collaborator: Jonah

## Ampersand re-apply (done right this time)
Edited the SOURCE OF TRUTH `~/Documents/Github/claude-dotfiles/justify/core/toolbar.ts` (NOT the stale ~/.claude copy). Same change as before: `_ampEl` field, `AMP_MASK_URI` const (96px base64 alpha mask of `wp-content/uploads/2025/04/logomark_v3.png`), `_showAmp()`/`_animateAmp()`/`_showX()` methods, mouseenter gated to `_animateAmp()` when collapsed, three "I" blocks replaced. Launcher = Yes& ampersand via `background-color:currentColor` through the mask (themes grey at rest / terracotta on hover); hover does a spring scale-pop (scale .55 rot -12 -> scale 1, cubic-bezier(.34,1.56,.64,1) .4s).

Build/deploy (the sanctioned flow): `cd ~/Documents/Github/claude-dotfiles/justify && node build.js --core-only && bash deploy.sh --core-only`. Output bundle = **554902 bytes** (= the good 543838 repaired base + ~11KB ampersand), NOT the 291KB stale-rebuild. deploy.sh synced to ~/.claude/justify/dist (served by daemon :9223) and dotfiles/public.

Verified live (yesand.lndo.site, reload + activate): launcher shows the ampersand (grey rest, terracotta hover); **Manipulate panel STILL intact** - Elements|Design tabs, Target scoping ("Menu Item Text 16"/"This instance"), Trigger/Position/Layout/Spacing/Size. No regression.

## Guard hook (prevents repeating the clobber)
New `claude/hooks/justify-source-guard.sh` (installed to ~/.claude/hooks/, registered in `claude/settings.json` PreToolUse under BOTH `Bash` and `Write|Edit|MultiEdit` matchers; settings.json is symlinked so it is active immediately - confirmed by it blocking an inline test command mid-session).
- DENIES: Write/Edit/MultiEdit whose file_path is under `~/.claude/justify/`; Bash that runs `build.js`/`npm run build`/`npm run deploy` against `~/.claude/justify` (or `cd ~/.claude/justify` + build).
- ALLOWS: editing/building in the dotfiles source, `deploy.sh`, a manual recovery `cp` into the install dist, normal project edits, reading the install.
- Tests: `claude/hooks/test-justify-source-guard.py` - 11/11 pass.

## The rule (now hook-enforced)
Justify source of truth = `~/Documents/Github/claude-dotfiles/justify/`. Edit + `node build.js` THERE, then `deploy.sh` to sync into `~/.claude/justify`. Never edit/rebuild `~/.claude/justify` directly.

Files touched: `claude-dotfiles/justify/core/toolbar.ts`, rebuilt `claude-dotfiles/justify/dist/justify-core.js` (+ deployed to ~/.claude/justify/dist + dotfiles/public), new `claude-dotfiles/claude/hooks/justify-source-guard.sh` + `test-justify-source-guard.py` (mirrored to ~/.claude/hooks/), `claude-dotfiles/claude/settings.json` (hook registration). All dotfiles changes are uncommitted working-tree changes (not committed - user did not ask).

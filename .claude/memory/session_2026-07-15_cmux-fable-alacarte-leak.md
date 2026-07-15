---
name: cmux hooks leak into base settings.json; fable-guard has no component - both break the a-la-carte model
description: Root cause of Jonah's cmux "fragility" and fable-guard "registration" confusions - both resolve to one fix, component-scoped settings.json wiring (the pattern sidecoach/voice already use). Supersedes the u8 fail-soft framing.
type: decision
relates_to: [decision_cmux_hardening_proposal.md, session_2026-07-14_parallel-dispatch-plan.md, session_2026-06-25_cmux-hook-command-not-found-fix.md]
supersedes: decision_cmux_hardening_proposal.md
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: code-trace (grep + read of install.sh and claude/settings.json; static, not yet runtime-reproduced on a clean HOME)
confidence: high
---

On the morning after the Wave 0-2 run, Jonah rejected two of the framed "decisions" with "i'm confused." Both trace to one architectural truth I had missed: `install.sh` is an a-la-carte component installer (twelve components, `--only KEYS`), and cmux + fable hooks must be COMPONENT-SCOPED, not baked into the base everyone gets. My earlier framing ("register in repo settings.json, all-or-nothing") ignored the installer entirely.

**The cmux leak (confirmed by static code trace):**
- Base `claude/settings.json` wires 4 cmux-only hook references: `cmux-close-guard.sh` (L63), `cmux-teammate-shim-heal.sh` (L208), `resume-toggle.sh` (L317), `resume-guard.sh` (L556).
- The `config` component JSON-merges ALL of base `claude/settings.json`'s hook entries into the user's `~/.claude/settings.json` (install.sh PYMERGE ~L1888). So a `config`-only (non-cmux) user gets all 4 cmux refs wired into their settings.
- On-disk reality for that non-cmux user:
  - `cmux-close-guard.sh` - copied by NO component (absent from the `CONFIG_HOOKS` array L1845-1860; not cmux-owned) -> DANGLING -> command-not-found (exit 127) every matching PreToolUse.
  - `resume-guard.sh` / `resume-toggle.sh` - deliberately excluded from `CONFIG_HOOKS` (comment L1842-1844) and only symlinked by the cmux component (L2308/L2311) -> DANGLING for non-cmux users.
  - `cmux-teammate-shim-heal.sh` - IS in `CONFIG_HOOKS` (L1858) so it lands on disk and runs pointlessly (SessionStart shim-heal for a shim a non-cmux user never uses).
- Net: `install.sh --only config` (no cmux) leaves 3 dangling cmux hook refs firing exit-127 every session. This is exactly the "you shouldn't get cmux hooks if you don't have cmux" violation Jonah's confusion predicted.

**Why the u8 proposal was insufficient:** [[decision_cmux_hardening_proposal.md]] recommended making `cmux-close-guard.sh` fail-soft + a WARN drift notice. That treats the symptom (a leaked hook shouldn't crash) not the disease (the hook shouldn't be INSTALLED for a non-cmux user at all). Fail-soft is fine as secondary defense; the primary fix is packaging.

**The fable-guard picture (confirmed):** `fable-orchestrator-guard.sh` is NOT in base `claude/settings.json` (grep empty). It runs only because it was hand-added to the LIVE `~/.claude/settings.json` on this machine. There is no `fable` component in install.sh at all - so there is currently no way to opt into it per Jonah's model.

**The established correct pattern (already in the repo, to copy):** the sidecoach component wires its own hooks into settings.json on pick (install.sh ~L2931+, `addHook('SessionStart', ...sidecoach-sessionstart.sh)`), and `deactivate_sidecoach` removes them (L1311-1321). Base `claude/settings.json` carries NO sidecoach entries. Voice-mandate does the same add-on-pick / remove-on-deactivate dance. The cmux component ALREADY half-does this (it wires resume-guard via a GUARD_HOOK append at L2330-2337) - the entries just also leak from base, redundantly.

**Corrected fix - both confusions, ONE pattern (component-scoped wiring):**
- cmux: remove the 4 cmux hook entries from base `claude/settings.json`; wire them in the cmux component's install block instead (add-on-pick); make `cmux-close-guard.sh` + `cmux-teammate-shim-heal.sh` cmux-owned on disk; drop `cmux-teammate-shim-heal.sh` from `CONFIG_HOOKS`; extend `deactivate_cmux` to unwire all 4. Optionally keep u8's fail-soft as secondary defense.
- fable: new opt-in `fable` component that copies `fable-orchestrator-guard.sh` + wires it into settings.json PreToolUse on pick, and removes on deactivate. Not in base.

**Self-analysis (why I mis-framed it):** I built the cmux/fable options off the u8/u9 research and the dependency map without reading install.sh's component model - the same "theorized instead of verified" failure mode from earlier in this run. The distribution decision was framed without reading the file that governs distribution. Fix going forward: before framing any "should this ship to everyone / how is it installed" decision, read install.sh's component catalogue and wiring first.

Files traced: install.sh (L272-460 catalogue, L1818-1957 config install, L2307-2337 cmux install, L2931+ sidecoach install, L1230-1320 deactivations), claude/settings.json (hook arrays).

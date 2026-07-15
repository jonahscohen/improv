---
name: base settings.json <-> deploy-list drift is systemic (20 hooks, 3 categories) - Codex NO-GO on v1 plan, some danglers self-inflicted
description: Codex review of the change plan returned NO-GO with 9 findings; the top one (team-reaper missed) led to a full audit showing 20 base-wired hooks are absent from CONFIG_HOOKS across 3 categories, including 8 deployed by NOTHING (dangling on fresh installs) - 3 of which I added this session.
type: project
relates_to: [session_2026-07-15_cmux-fable-alacarte-leak.md, session_2026-07-15_cmux-fable-sidecoach-change-plan.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: codex-review (227.9s, exit 0, NO-GO) + python audit of claude/settings.json vs install.sh CONFIG_HOOKS
confidence: high
---

The v1 change plan (docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md) went through self-review (clean) + plan-consistency-lint (CLEAN) + Codex. **Codex returned NO-GO** with 9 findings. This is the gate working: a plan, not shipped code, so cheap to catch.

**Codex findings (ranked):**
1. HIGH - Unit A missed `team-reaper.sh`, a 5th cmux-owned hook that leaks into base identically. (NO-GO trigger.)
2. HIGH - sandbox verifies run `HOME=$SB install.sh` but then `python3 ...expanduser('~/.claude/...')` WITHOUT `HOME=$SB`, so they inspect the real home, not the sandbox. Verifies prove nothing.
3. HIGH - `--only fable` / `--only sidecoach` assume config already created `~/.claude/settings.json` + the hooks dir; only the config block does that (install.sh:1824/1836). Standalone component installs would fail.
4. HIGH - "default-off / not installed unless picked" is false via the lotus copy: `PICKS+=(0)` only affects interactive preselect; `--yes`/`--preset all` call `set_all 1` and install it anyway.
5. MED - `detect-session-model.sh` is a LIVE BASE dependency (model-router-guard.sh is in CONFIG_HOOKS and execs it) yet config never deploys it - an existing base gap, not just a fable dep.
6. MED - moving `cmux-teammate-shim-heal.sh` to cmux also needs its `~/.claude/cmux` shim dir (installed by the config block at 1876-1879) moved/portable, else cmux-only installs lose heal behavior.
7. MED - sidecoach MCP add-if-absent won't MIGRATE an existing hardcoded `mcpServers.sidecoach` to the generated path; must replace.
8. MED - C1 build failure is non-fatal (|| warn) but C2 registers anyway -> broken MCP entry if build failed; gate registration on dist/index.js.
9. LOW - some verifies aren't runnable (`detect_component` is an internal function; deactivate has no non-interactive path).

**The audit finding 1 triggered (base-wired hooks NOT in CONFIG_HOOKS = 20), in 3 categories:**
- **Cat 1 - cmux-owned (Unit A must move ALL):** resume-guard, resume-toggle, team-reaper (under cmux), cmux-close-guard (deployed by NOTHING), + cmux-teammate-shim-heal (currently mis-filed IN CONFIG_HOOKS). Codex's team-reaper catch confirmed; Unit A's "4 hooks" was really 5 + a shim dir.
- **Cat 2 - other components' hooks leaked into base (SAME bug, out of current scope):** reflect-nudge (reflect); sidecoach-keyword/postresponse/postuserp/preamble/sessionstart (sidecoach, 5 hooks); voice-mandate, voice-toggle (voice-output). A config-only cherry-pick dangles on all of these too.
- **Cat 3 - base-wired but deployed by NOTHING (dangling on EVERY fresh install):** claude-surface, visualizer-guard, surface-visual-gate, plan-consistency-lint, push-ahead-check, teammate-relay-stop, codex-failure-watcher, codex-rescue-guard. These filenames appear nowhere in install.sh - not in CONFIG_HOOKS, not in any picked block.

**Self-analysis (self-inflicted regression):** `plan-consistency-lint.sh`, `push-ahead-check.sh`, and `teammate-relay-stop.sh` are Cat 3 - I added them to `claude/settings.json` during this session's Wave 1/2 WITHOUT adding them to `CONFIG_HOOKS`, so a fresh `--only config` install would wire them and never place them on disk (exit-127). It was invisible to me because on this dev machine `~/.claude/hooks` already has every repo hook, so the dangling never fired locally. Failure mode: I edited the settings.json wiring (what runs) without updating the deploy manifest (what lands on disk) - the exact base<->deploy drift this audit is about. Fix going forward: any hook added to claude/settings.json MUST be added to CONFIG_HOOKS (or an owning component) in the same change; a test should assert base-wired hooks are all deployed.

**Corrected direction:** the real fix is to reconcile base settings.json with the deploy lists. Cat 1 (cmux) is in Jonah's scope; Cat 3 (config-owned danglers, incl. my 3) is a genuine fresh-install bug worth fixing as cleanup; Cat 2 (voice/reflect/sidecoach) expands blast radius into components Jonah did not scope - a scope decision for him. v2 Stage-1 plan written (docs/plans/2026-07-15-cmux-fable-scoping-and-sidecoach-wireup.md) folding all 9 Codex findings: Unit A now moves the full cmux set (adds team-reaper + teammate-relay-stop + the ~/.claude/cmux shim dir); Unit B fixes the detect-session-model base dep + standalone-safe blocks; Unit C gates sidecoach MCP registration on build + replaces (not add-if-absent) the stale hardcoded path; Unit D adds the 7 Category-3 danglers to CONFIG_HOOKS (interim, Stage-2 relocates); Unit E adds test-settings-deploy-parity.sh (the regression test that would have caught my 3 danglers). All sandbox verifies now read explicit "$SB/.claude/..." paths.

Codex round 2 (v2): NO-GO but converged - 6/9 prior findings resolved; 5 new/refined: (1) the parity test was still static ("deployed by SOME path") so it would pass sidecoach's base-wired/component-deployed hooks while --only config dangles - must be per-selection installed-settings-vs-installed-files; (2) Unit C didn't remove sidecoach's own base entries; (3) MCP build-gate must key on build EXIT, not just dist existence (dist already committed); (4) the "not /Users/spare3" MCP verify is wrong (correct path IS under /Users/spare3/Documents/Github/improv) - seed a stale path and assert replacement; (5) cmux block also needs the standalone-safe settings.json guard.

v3 written folding all of round 2 + the wiring recon: staging revised so Stage 1 is the COMPLETE base<->deploy reconciliation (cmux 6 hooks, sidecoach all 6 - block only wired 3, voice de-dupe - block already wires both, reflect - block must wire nudge, Cat-3 -> CONFIG_HOOKS), because a partial base is the inconsistency Codex kept flagging. Decision: NOT a 4th plan-Codex round (converged, diminishing returns) - execute v3 under self-review, run the mandated Codex gate on the ACTUAL DIFF. Executing now, unit by unit, sandbox-verified per unit.

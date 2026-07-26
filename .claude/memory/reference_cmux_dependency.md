---
name: cmux external dependency - pin, preflight, and why it is not vendored
description: cmux is an external unvendored macOS app the repo's hooks/launchers drive. This is the managed record - the required version pin, the preflight guard that enforces it, the in-repo consumers, install/update steps, and the vendoring rationale.
type: reference
relates_to: [reference_component_dependency_map.md, decision_cmux_hardening_proposal.md, session_2026-06-25_cmux-hook-command-not-found-fix.md, session_2026-07-26_cmux-dependency-pinned.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests + live probe (cmux 0.64.20)
confidence: high
---

## What cmux is

cmux is an **external, unvendored macOS app** (`/Applications/cmux.app`) that serves as
this workstation's terminal + browser-pane + multi-agent (Teams) surface. It has **no
in-repo binary**. The CLI the repo drives lives inside the app bundle at:

- `/Applications/cmux.app/Contents/Resources/bin/cmux` (universal Mach-O, ~40MB)

It is **not on `PATH` by default**. Inside a cmux session, `~/.claude/cmux` (the shim dir,
symlinked to `claude/cmux/`) is on `PATH`, so bare `cmux` resolves to the shim, which
exec's the bundled binary. Outside cmux (e.g. the Agent SDK harness), `command -v cmux`
returns nothing - that is expected.

Version string form: `cmux 0.64.20 (100) [14e3400b9]` (from both `cmux --version` and
`cmux version`). Verified live 2026-07-26.

## The pin (required version)

`claude/cmux/cmux.version` records the **minimum cmux version** the in-repo consumers are
verified against. Current pin: **0.64.20**. The file's first non-comment `N.N.N` line is
the machine-readable value; everything else is comments. This is the durable answer to the
dependency-map's "unpinned" finding.

## The preflight guard

`claude/cmux/cmux-preflight.sh` is the shared presence + version guard. It:

- **Resolves cmux the same way** the PATH shim (`claude/cmux/cmux`) and the close-guard
  (`claude/hooks/cmux-close-guard.sh`) do - `CMUX_CLAUDE_HOOK_CMUX_BIN` /
  `CMUX_BUNDLED_CLI_PATH` / `CMUX_CLAUDE_TEAMS_CMUX_BIN` / `command -v cmux` /
  `~/.claude/cmux/cmux` / the bundled binary. (`CMUX_PREFLIGHT_CMUX` is an authoritative
  test override, mirroring the close-guard's `CMUX_CLOSE_GUARD_CMUX`.)
- Reads the pin from `cmux.version`, runs `cmux --version`, parses the semver, compares.
- **Fails closed by default**: exit `1` (not found) or `2` (older than pin), each with an
  actionable stderr message (names both versions + the update URL) - so a missing/old cmux
  is caught *early*, not cryptically mid-run.
- `--warn`: same checks, but never exits non-zero (prints a warning, exit 0). This is the
  mode for the always-on guard hooks, which run on non-cmux machines too and must stay
  fail-soft (see decision_cmux_hardening_proposal.md).
- `--print` reports the resolved binary + found/required versions; `--quiet` hides the OK
  line (errors still print).
- An **unparseable** `--version` is a non-blocking warning (exit 0) even in fail-closed
  mode: the pin guards against a *known-old* cmux, and hard-failing on an unrecognized
  version string would recreate the format-drift fragility this work reduces.

Regression tests: `claude/cmux/test-cmux-preflight.sh` (15 hermetic cases via stub cmux
binaries). Run `bash claude/cmux/test-cmux-preflight.sh`.

### Wiring

The preflight is wired into `bin/claude-teams-launcher.sh` at the top of
`_claude_teams_launch()` - the first real use of the cmux binary in a Teams launch. On
failure it prints the guard's message and **falls back to a standard `claude` session**
rather than bricking the shell. Any other active consumer can call
`~/.claude/cmux/cmux-preflight.sh` (fail-closed) or `... --warn` (soft) before running cmux.

Deployment: install.sh symlinks the **whole** `claude/cmux/` dir to `~/.claude/cmux`
(install.sh ~L4089), so the pin, the guard, and the test ship automatically on a fresh
install - no installer change required.

## In-repo consumers (the "10")

The dependency-map counts ~10 cmux-touching hooks (finding 10). Only a few actually **run
the cmux CLI**; the rest read `CMUX_*` env or cmux-internal files and already fail-soft when
cmux is absent (per decision_cmux_hardening_proposal.md):

- **Runs the CLI**: `claude/hooks/cmux-close-guard.sh` (`list-panels`/`top`/`tree` to
  protect panes), `bin/claude-teams-launcher.sh` (`cmux claude-teams`),
  `claude/cmux/cmux-claude-launch.sh` (app-launch wrapper). Plus ad-hoc `cmux browser ...
  screenshot/navigate` calls the agent makes for visual verification (documented in
  `claude/startup-check.sh` + CLAUDE.md).
- **Env/file coupled, fail-soft**: `cmux-teammate-shim-heal.sh`, `node-shim-heal.sh`,
  `team-reaper.sh`, `resume-guard.sh`, `resume-toggle.sh`, `agent-teams-guard.sh`,
  `claude-surface.sh`, `surface-visual-gate.sh`.

## Install / update cmux

cmux is a macOS `.app` the user installs and **auto-updates out-of-band** (via the app
itself, from https://cmux.io). To update: update the app, then confirm the CLI:

```
/Applications/cmux.app/Contents/Resources/bin/cmux --version
```

When you re-verify the in-repo consumers against a newer cmux, **bump the pin**: edit the
`N.N.N` line in `claude/cmux/cmux.version` and update the "Verified against" comment. The
preflight and its tests read the pin automatically.

## Why cmux is NOT vendored

Vendoring the binary was considered and **rejected** (decision_cmux_hardening_proposal.md,
option c):

- cmux is the **running GUI app the user is inside**; the hooks introspect *that live app
  instance* through its socket, not a repo-local copy. You cannot vendor "the running GUI."
- A pinned build in git is heavy (large per-arch Mach-O), carries licensing weight, and
  would still break on cmux server/protocol changes - so it buys control on paper only.
- The repo **already vendors the correct, sufficient thing**: the thin shims
  (`claude/cmux/{cmux,node,teammate-tmux-shim}`) plus now the pin + preflight. That is the
  right vendoring boundary.

A version pin can only **detect** drift (the app auto-updates), never prevent it - which is
exactly why the preflight is a fail-closed *guard for consumers* plus a fail-soft *warning
for the always-on hooks*, not a hard lock.

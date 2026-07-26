---
name: cmux dependency PINNED + guarded (the real risk, not the shim)
description: The 2026-06-25 PATH shim only fixed a hook command-not-found RESOLUTION bug - it never pinned a version or reduced the dependency risk. This session added the real pin (cmux.version), a fail-closed preflight guard, wired it into the Teams launcher, and documented cmux as a managed external dependency.
type: project
relates_to: [reference_cmux_dependency.md, decision_cmux_hardening_proposal.md, session_2026-06-25_cmux-hook-command-not-found-fix.md, reference_component_dependency_map.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests (15 hermetic) + live probe (cmux 0.64.20) + zsh -n launcher
confidence: high
---

Collaborator: Jonah Cohen.

## What was ACTUALLY fixed before vs the real risk

- **Before (2026-06-25 shim, `claude/cmux/cmux`):** fixed ONLY a hook *resolution* bug.
  cmux-injected hooks run `"${CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux}" hooks claude stop`; when
  that env var was empty the bare-name `cmux` fallback died with exit 127 because nothing
  named `cmux` is on PATH. The shim makes the bare name resolve to the bundled binary.
  It records NO version, checks NO presence-before-use for consumers, and does NOTHING for
  the dependency risk. The user's belief that this "fixed cmux" was about the *hook error*,
  not the *dependency*. **So the dependency-map finding 10 risk was genuinely still open.**
- **The real risk (finding 10):** cmux is an external, **unpinned**, unvendored macOS
  binary with ~10 in-repo consumers. Nothing recorded a required version and nothing
  checked cmux was present/recent before a consumer ran it - so a missing/old cmux surfaced
  as a cryptic mid-run failure. Confirmed by grep: **zero** version pin / `--version` check
  existed anywhere in claude/ or sidecoach/.

## Consumers (the "10")

Dependency-map finding 10 counts ~10 cmux-touching hooks. Only a few actually RUN the CLI;
the rest read `CMUX_*` env / cmux-internal files and already fail-soft when cmux is absent
(per decision_cmux_hardening_proposal.md):
- **Runs the cmux CLI:** `claude/hooks/cmux-close-guard.sh` (list-panels/top/tree),
  `bin/claude-teams-launcher.sh` (`cmux claude-teams`), `claude/cmux/cmux-claude-launch.sh`
  (app-launch wrapper); plus ad-hoc `cmux browser ... screenshot/navigate` the agent runs
  for visual verification.
- **Env/file-coupled, fail-soft:** cmux-teammate-shim-heal, node-shim-heal, team-reaper,
  resume-guard, resume-toggle, agent-teams-guard, claude-surface, surface-visual-gate.

## What was pinned / guarded / documented

- **PIN** - `claude/cmux/cmux.version` (new): required minimum cmux version = **0.64.20**
  (the live version, verified). First non-comment `N.N.N` line is the machine-readable pin.
- **GUARD** - `claude/cmux/cmux-preflight.sh` (new): resolves cmux via the SAME chain as the
  shim + close-guard (reuses the PATH-shim resolution), reads the pin, runs `cmux --version`,
  compares semver. **Fails closed by default** (exit 1 missing / exit 2 old, actionable
  message). `--warn` = fail-soft (exit 0) for the always-on hooks. `--print`/`--quiet`
  helpers. `CMUX_PREFLIGHT_CMUX` test override. Unparseable `--version` = non-blocking warn
  (never brick on format drift).
  - **Why fail-closed for consumers but --warn for hooks:** the prior decision
    (decision_cmux_hardening_proposal.md) correctly requires the always-on guard hooks to
    stay fail-soft (they fire on every Bash call / non-cmux machines). Active consumers that
    NEED cmux to do work should fail EARLY with a clear message. One helper, both postures -
    no contradiction with the prior ruling.
- **WIRE** - `bin/claude-teams-launcher.sh`: preflight at the top of `_claude_teams_launch()`
  (first real cmux use in a Teams launch). On failure it falls back to a standard `claude`
  session rather than bricking the shell. install.sh already symlinks the WHOLE `claude/cmux/`
  dir (~L4089), so the pin + guard + test ship on a fresh install with **no installer change**.
- **DOC** - `reference_cmux_dependency.md` (new): cmux is external + unvendored, the pin, the
  preflight, the consumers, install/update + how to bump the pin, and the vendoring
  rationale (can't vendor a running GUI; the repo already vendors the right thing - the thin
  shims). Updated dependency-map finding 10 to "PARTLY MANAGED" with the residual (an
  auto-updating GUI means a pin can detect drift, not prevent it).

## Verification

- `bash -n` + `dash -n` clean on the preflight; `zsh -n` clean on the launcher.
- Live probe against real cmux 0.64.20: `--print` -> `cmux: 0.64.20 at ~/.claude/cmux/cmux
  (required >= 0.64.20)`, exit 0. (Resolved via the shim - proves resolution reuse.)
- Fail-closed proven with stub binaries: missing -> exit 1; 0.60.3 / 0.64.19 (boundary) ->
  exit 2, both with clear messages naming the versions. `--warn` softens both to exit 0.
- `claude/cmux/test-cmux-preflight.sh` (new): 15 hermetic cases, all pass.
- close-guard regression (untouched) still green.
- Codex cross-model review: see below.

## Why not vendored

Rejected per decision_cmux_hardening_proposal.md option (c): cmux is the running GUI app the
hooks introspect via its live socket - you cannot vendor the running app; a per-arch Mach-O
in git is heavy + licensing-laden + still breaks on protocol changes. The repo already
vendors the correct boundary (thin shims), now plus the pin + guard.

## Files touched
- claude/cmux/cmux.version (new - the pin)
- claude/cmux/cmux-preflight.sh (new - the guard)
- claude/cmux/test-cmux-preflight.sh (new - 15 hermetic tests)
- bin/claude-teams-launcher.sh (wired preflight into _claude_teams_launch)
- .claude/memory/reference_cmux_dependency.md (new - the managed-dependency record)
- .claude/memory/reference_component_dependency_map.md (finding 10 -> PARTLY MANAGED)
- .claude/memory/session_2026-07-26_cmux-dependency-pinned.md (this beat)

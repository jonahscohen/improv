---
name: Justify and Lotus dispatch routed through the failure ledger, closing the last escalation
description: The delegated installers now fail fatally on a broken build, which would have aborted the whole top-level run under set -e. Both dispatches now record to the ledger instead, so the run continues and exits non-zero.
type: project
relates_to: [session_2026-07-28_delegated-installer-writes.md, session_2026-07-28_repair-wave-committed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: bash -n clean, both ledger calls present and in scope, installer-manifest PASS, prune 44/0, delegated-writes 81/0
confidence: high
---

# Closing the delegated-installer escalation (2026-07-28)

## The edit

`justify/install.sh` and `lotus/install.sh` now treat a failed build as FATAL. That is
correct: they previously warned, carried on, registered an MCP server whose entrypoint the
build had not produced, and exited 0.

But a bare `bash "$REPO_DIR/justify/install.sh"` means that fatal exit aborts the entire
top-level run under `set -e`, killing every component queued after it. Both dispatches now
route through `record_component_failure`, so the run continues, the component is marked
FAILED rather than installed, and the end-of-run check turns it into a non-zero exit.

This is the same ledger the failed-edit sites use, which is the point - one mechanism for
"this part did not work" rather than a second convention.

Verified: `bash -n` clean, both ledger calls present, `record_component_failure` defined at
line 81 and used at 6483 so it is in scope, installer-manifest PASS, prune 44/0,
delegated-writes 81/0.

## The finding that made this unit worth running

`json.dump(d, open(p,'w'), indent=2)` against `~/.claude.json`, in BOTH delegated
installers. `open(p,'w')` truncates the user's entire Claude Code config before a byte is
written, and the file object is never closed explicitly, so the flush happens during
interpreter finalization where CPython PRINTS the OSError and SWALLOWS it.

Measured under `ulimit -f 1`: a 4013-byte config came back at 512 bytes, python exited 0,
and the next line printed "MCP server registered". Destroyed config, zero exit, success
message. That is the session's thesis in one statement - a safety step that reported
success - and it was sitting in code nobody had reviewed.

`~/.claude.json` is now treated as USER-OWNED: the path is RESOLVED so a symlink into the
user's own dotfiles is preserved, which is the OPPOSITE of the `~/.claude/skills` rule where
the link is ours to replace. An unparseable config exits 3 and is never rewritten from
scratch.

## Machine state verified by the lead

The agent reported damaging the machine twice, planting shims in `/opt/homebrew/bin` that
pointed into temp trees, and restoring both times. Confirmed clean: `~/.claude.json` has 104
top-level keys and 7 mcpServers with no entry pointing into a temp tree, and no shared-bin
symlink dangles into one.

Root cause of its incidents is worth keeping: on macOS `/var` is a symlink into `/private`,
so a physically-spelled `$HOME` arrives as `/private/var/folders/...` and matched neither
`/var/folders/*` nor `"$TMPDIR"*`. `install.sh`'s own `hook_deploy_mode` already listed the
`/private` variants; the temp-HOME shim guard did not.

## A correction it made against its own brief

I told it `cp -r` follows a symlinked destination directory. It measured instead of
accepting: on macOS `cp -r` FAILS with "Not a directory" rather than following. GNU cp does
follow. It rewrote both the comment and the assertion to match what it measured. That is the
third time today an agent corrected a premise I supplied from habit rather than from a run.

## Files touched

- `install.sh` - the justify and lotus dispatch blocks

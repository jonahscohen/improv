---
name: Two-sentence descriptions for every installable component
description: Filled in 19 missing and rewrote 15 thin component descs in browser-tree.json from install.sh behaviour, and recorded five components whose shipped text described something the installer does not do
type: project
relates_to: [session_2026-08-01_installer-hook-descriptions.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Companion unit to the hook-description pass. That one owned `hook_desc` (71
entries); this one owns the COMPONENT side of `claude/hooks/browser-tree.json` -
the buckets and their leaf members. Authored against 65d6ad4e.

## Measured before / after

The gate is: every bucket and every leaf carries a `desc` of at least two
sentences.

| | before | after |
|---|---|---|
| nodes in scope | 36 | 36 |
| no `desc` at all | 19 | **0** |
| `desc` under two sentences | 15 | **0** |

`hook_desc` still holds 71 entries, untouched - the other unit's work is intact.
`json.load` parses. No key renamed, added, removed or reordered; every edit was a
targeted `Edit` on a `desc` string (or an insertion of one), never a whole-file
rewrite or a `json.dump` round-trip, precisely because a second session was
writing `hook_desc` in the same file at the same time. Longest new string is 239
chars, so a two-line row at 74ch still holds it. No emoji, no emdash, no
non-ASCII anywhere in the file's descriptions.

## Source of truth

`install.sh`'s `DESCS` / `PERSONAL_DESCS` arrays where an entry existed, DISTILLED
to two sentences rather than copied. Where `DESCS` was thin, stale or absent, the
component's actual `if picked <key>; then` block was read and the description
written from what the code places on the machine. Counts asserted in the text
(35 visual-effects files, 2 motion-reference files, 6 tactical-polish files, 8
justify shims, 26 sidecoach flows behind 21 verbs) were each verified against the
repo, not carried over on trust.

## Descriptions that were WRONG, not merely short

This is the valuable half. Five components shipped text describing behaviour the
installer does not have. In each case the new `desc` describes the code.

1. **`sidecoach`** - the worst drift. `install.sh` DESCS still says "invisible
   workflow automation triggered by natural conversation. No slash commands...
   Daemon launches at session start and monitors messages silently... 14
   design/development flows... compiles TypeScript orchestrator + 14 handlers."
   Reality (install.sh 7534-7660): it installs the `/sidecoach` SKILL (whose own
   frontmatter advertises 26 flows behind 21 verb COMMANDS), three registries
   plus `sidecoach_lanes.py`, and TWO PATH symlinks (`sidecoach`,
   `sidecoach-monitor`). There is no daemon, and the block now REMOVES a stale
   `mcpServers.sidecoach` entry because that MCP server was retired 2026-07-24.
   The tree's own desc was also stale in the other direction ("the verb and lane
   registries" - there are three, including intent).

2. **`task-list`** - DESCS says it "Always operates on the dotfiles TASKS.md
   regardless of where you invoke it from." The installed skill says the exact
   opposite: it is project-aware, using `<repo-root>/TASKS.md` when cwd is inside
   any repo that is not the dotfiles repo. The skill is the thing that runs, so
   the desc now says project-aware.

3. **`config`** - DESCS claims it "JSON-merges safety hooks (bash-guard,
   content-guard, memory-approve)" and "Copies hook scripts to ~/.claude/hooks/".
   Stage 3 made config CORE-ONLY: the only hook it deploys is
   `node-path-default.sh`. bash-guard/content-guard come from the `safety`
   cluster and memory-approve from `memory`. The `tag` ("core-only") is right and
   the DESCS text is what went stale.

4. **`cmux` leaf** - the tree said "The cmux settings file this installer
   symlinks into place", full stop. It also plants the teammate tmux shim at
   `~/.claude/cmux`, links `claude-teams-launcher.sh` and `toggle-resume.sh`,
   appends a marker block to `~/.zshrc`, and touches `.no-auto-resume` so
   auto-resume starts OFF. A user reading the old row would not know it edits
   their shell config.

5. **`ghostty`** - the `FILES` manifest says `~/.config/ghostty/config (copy)`.
   The code writes NEITHER that path: it renders the config into
   `~/Library/Application Support/com.mitchellh.ghostty/config.ghostty` AND
   cmux's `com.cmuxterm.app/config.ghostty`. Two targets, neither of them the
   documented one.

Also noted, lower stakes: `discord`'s FILES manifest lists `~/.claude/claude
(wrapper symlink)` and `~/.claude/channels/discord/`, and the install block
creates neither - it symlinks three `discord-*.sh` scripts and appends a source
line to `~/.zshrc`. `tilt-lab` and `lotus` descs ended with a parenthetical "(no
hooks)" which is TRUE (neither appears in the `install_app_hooks` pass) but which
spent a row telling the reader about an absence; that space now names the
localhost port and the Figma manifest import instead.

None of the above was fixed in `install.sh` - this unit owned the JSON only. The
five stale `DESCS`/`FILES` entries are a live follow-up, and the browser is now
the more accurate surface of the two.

## Verification

- measurement script: `no desc 0 | under 2 sentences 0` (was 19 and 15)
- `json.load`: parses
- `hook_desc`: 71 entries, unchanged
- `claude/hooks/test-component-browser.sh`: **147 passed, 0 failed** (identical
  to the pre-change baseline taken before the first edit)
- no string over 245 chars, no emdash, no non-ASCII

`claude/hooks/test-browser-render.sh` (the pty-driven suite, not in this unit's
gate) hit its 90s WATCHDOG on the first run under concurrent load - the same
flakiness class the hook-description beat recorded for it. Its literal fixtures
pin HOOK descriptions and TAGS only, and no fixture pins a component `desc`, so
the change has no fixture to invalidate; what it can move is ROW HEIGHT, since a
component row now wraps to 2-4 lines like the hook rows did. Re-run captured
separately.

## Files touched

- `claude/hooks/browser-tree.json` (34 component description strings; nothing
  else, and `hook_desc` deliberately untouched)

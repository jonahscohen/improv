---
name: Two-sentence descriptions for every installable component
description: Filled 19 missing and rewrote 15 thin component descs in browser-tree.json from install.sh behaviour, in the outsider voice Jonah set earlier the same day, and recorded five components whose shipped text described something the installer does not do
type: project
relates_to: [session_2026-08-01_installer-hook-descriptions.md, session_2026-08-01_descriptions-written-for-outsiders.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + browser
confidence: high
---

Companion unit to the hook-description pass. That one owned `hook_desc` (71
entries); this one owns the COMPONENT side of `claude/hooks/browser-tree.json` -
the buckets and their leaf members. Authored against 65d6ad4e.

## Measured before / after

The gate: every bucket and every leaf carries a `desc` of at least two sentences.

| | before | after |
|---|---|---|
| nodes in scope | 36 | 36 |
| no `desc` at all | 19 | **0** |
| `desc` under two sentences | 15 | **0** |

`hook_desc` still holds 71 entries, untouched. `json.load` parses. Key-path diff
against HEAD: exactly 19 additions, every one ending in `/desc`, zero removals,
zero renames, zero reorders. Longest string 244 chars. Every edit was a targeted
`Edit` on a single `desc` string, never a whole-file rewrite or a `json.dump`
round-trip, because a second session was writing `hook_desc` in the same file at
the same time.

## The correction that mattered more than the measurement

I wrote the whole set once in the wrong voice and had to rewrite all 34 strings.

The first pass was factually accurate and full of terms a new user does not have:
"beats-discipline rules", "the verb, lane and intent registries", "the teammate
tmux shim", "MCP server", "npm-installs", "app hooks are separate". Then
`session_2026-08-01_descriptions-written-for-outsiders.md` surfaced Jonah's
standing correction from earlier the same day, on these exact strings: *"Some of
these aren't written for a developer who doesn't have insight/context to the
situation."* The rule it produced is **never define an unknown with another
unknown** - real paths, file names and commands are good, unexplained CONCEPTS are
the defect.

So the second pass says "session notes" not "beats", "the word lists it matches
prompts against" not "the verb and lane registries", "registers its tools with
Claude Code in ~/.claude.json" not "registers its MCP server", "a check that
holds work as unfinished until it matches the Figma file" not "the Figma fidelity
guard". Zero hits now on a jargon sweep of beats/registry/shim/daemon/MCP/
cluster/orchestrate/plist.

**Self-analysis - why it happened.** I read the task brief and went straight to
`install.sh` for facts, and only opened the project's beats later, while chasing a
test failure. The beats loading order in CLAUDE.md is first, not "when a test
breaks" - and the single most relevant fact in the whole corpus (the audience
correction, made hours earlier, on this exact file) was sitting in the index the
whole time. The failure mode is treating a well-specified brief as sufficient
context. A brief says what to produce; the beats say what was already decided
about how. Cost: every string written twice.

## Descriptions that were WRONG, not merely short

Five components shipped text describing behaviour the installer does not have. In
each case the new `desc` describes the code.

1. **`sidecoach`** - the worst drift. `install.sh` DESCS still says "invisible
   workflow automation triggered by natural conversation. No slash commands...
   Daemon launches at session start and monitors messages silently... 14
   design/development flows... compiles TypeScript orchestrator + 14 handlers."
   Reality (install.sh 7534-7660): it installs the `/sidecoach` SKILL, whose own
   frontmatter advertises 26 flows behind 21 verb COMMANDS, three JSON registries
   plus `sidecoach_lanes.py`, and TWO PATH symlinks (`sidecoach`,
   `sidecoach-monitor`). There is no daemon, and the block now REMOVES a stale
   `mcpServers.sidecoach` entry because that server was retired 2026-07-24.

2. **`task-list`** - DESCS says it "Always operates on the dotfiles TASKS.md
   regardless of where you invoke it from." The installed skill says the exact
   opposite: it is project-aware, using `<repo-root>/TASKS.md` whenever cwd is in
   a repo that is not the dotfiles repo. The skill is what runs, so the desc now
   says project-aware.

3. **`config`** - DESCS claims it "JSON-merges safety hooks (bash-guard,
   content-guard, memory-approve)" and "Copies hook scripts to ~/.claude/hooks/".
   Stage 3 made config CORE-ONLY: the only hook it deploys is
   `node-path-default.sh`. bash-guard/content-guard come from the `safety`
   cluster, memory-approve from `memory`. The `tag` ("core-only") is right; the
   DESCS text went stale.

4. **`cmux` leaf** - the tree said "The cmux settings file this installer
   symlinks into place", full stop. It also plants the teammate pane helper at
   `~/.claude/cmux`, links `claude-teams-launcher.sh` and `toggle-resume.sh`,
   appends a marker block to `~/.zshrc`, and touches `.no-auto-resume` so
   auto-resume starts OFF. A reader of the old row would not know it edits their
   shell config.

5. **`ghostty`** - the `FILES` manifest says `~/.config/ghostty/config (copy)`.
   The code writes neither that path: it renders the config into
   `~/Library/Application Support/com.mitchellh.ghostty/config.ghostty` AND
   cmux's `com.cmuxterm.app/config.ghostty`. Two targets, neither documented.

Lower stakes: `discord`'s FILES lists `~/.claude/claude (wrapper symlink)` and
`~/.claude/channels/discord/`, and the block creates neither - it links three
`discord-*.sh` scripts and appends one `~/.zshrc` line. And `justify`'s shims do
NOT always land in `~/.local/bin`: `justify_choose_bin_dir /usr/local/bin
/opt/homebrew/bin` prefers a writable shared bin and only falls back to
`~/.local/bin`, so the desc says "on your PATH" rather than naming one directory.

None of this was fixed in `install.sh` - this unit owned the JSON only. Those
stale `DESCS`/`FILES` entries are a live follow-up, and the browser is now the
more accurate of the two surfaces.

## The Codex fact-check found two errors I had inherited, plus 11 real caveats

Ran the whole set past `codex exec` (codex-cli 0.142.5) as an independent-model
fact check against the installer source. It returned 13 findings and every one
held up when I checked it myself. Two were outright FALSE claims, both inherited
from the repo's own documentation rather than invented here:

1. **`shaders` - the shader chain is one effect, not three.** `install.sh`'s own
   comment says "bettercrt.glsl, tft.glsl, and cursor_blaze.glsl ... are loaded
   directly from there by Ghostty (see config.ghostty)", and CLAUDE-adjacent copy
   repeats it. `ghostty/config.ghostty` lines 23-25 have bettercrt and tft
   COMMENTED OUT; only `cursor_blaze.glsl` is active. So the file the comment
   points at contradicts the comment. The desc now says exactly that.
2. **`visual-effects` - 26 transformative effects, not 25.** The tables in
   `claude/skills/visual-effects/SKILL.md` count ASCII 8 + Dither 6 + Glitch 4 +
   Halftone 3 + Art 5 = 26. The "25" in `install.sh` DESCS and in CLAUDE.md is
   stale by one.

The other 11 were missing caveats or imprecision, all folded in: `hud.sh` is
symlinked not copied (and config also deploys `node-path-default.sh`); the
statusline needs `jq` or it renders `no-jq | install with: brew install jq`; a
failed Sidecoach build does NOT abort the rest of its install, so "it is not
installed" was wrong; justify and lotus hard-require Node and npm (their delegated
installers exit non-zero without them); justify's shims can land in
`/usr/local/bin` or `/opt/homebrew/bin` before `~/.local/bin`, so the desc says
"on your PATH"; the `skills` item installs 10 skills (the nine here plus
voice-output); `figma` lives under Design Tools, not Guardrails, so naming it in
the Guardrails desc was wrong; Discord needs the network, so "the other two work
offline" was false; voice-output needs `voice-on` AND a key, not the key alone;
and `task-list` does not create a TASKS.md at install time.

One finding I declined: Codex wanted the `ampersand` desc to say a failed
`git pull --ff-only` warns and continues (bin/ampersand:80-85). True, but
"'ampersand --pull' updates the repo first" is not falsified by it, and the row
has no room for an edge case that costs a user nothing.

## Verification

- measurement: `no desc 0 | under 2 sentences 0` (was 19 and 15)
- `json.load` parses; `hook_desc` 71 entries unchanged; only `/desc` keys added
- `claude/hooks/test-component-browser.sh`: **147 passed, 0 failed**, identical to
  the baseline taken before the first edit
- **rendered and read in the real GUI** (`installer-gui/server.py` on localhost,
  Chrome): Foundation, Design Tools, Skills, Voice & chat, Dev surface and the
  nested cmux screen. Every description renders in full, three wrapped lines per
  row at 1549px, nothing truncated, and the Skills pane scrolls to the last three
  rows. Tab closed after.
- no emoji, no emdash, no non-ASCII, nothing over 245 chars (longest 244)
- independent-model review: `codex exec`, 13 findings, all verified, 12 folded,
  1 declined with reason; suite and measurement re-run green afterwards, and the
  corrected Foundation rows re-rendered and read in the GUI

## test-browser-render.sh is red, and not from this unit

That pty-driven suite fails 23 assertions. Every one pins a HOOK description
string - `"It only ever allows: content-guard still runs alongside..."` and
friends - and `json.dumps(hook_desc)` does not contain any of them, because the
outsider rewrite of `hook_desc` replaced that text and the fixtures were never
re-pinned. Provable without running anything, and no failing assertion names a
component `desc`. It also hit its 90s watchdog once under concurrent load, the
same flakiness the hook beat recorded. Owner: whoever holds `hook_desc`.

## Concurrent writer

Mid-unit, two of my strings (`memory`, `reflect`) were edited under me by another
session doing its own jargon sweep on component descs - not just `hook_desc`. I
carried their intent forward (their "session-notes" wording is what the full
rewrite says too) and re-applied my final text over both. Worth flagging to the
lead: two writers were live in the component half of this file at once.

## Files touched

- `claude/hooks/browser-tree.json` (34 component description strings; `hook_desc`
  deliberately untouched)

---
name: The eighth wrong instrument - grep -r skips symlinked files, so two discoverability rows read zero while the files plainly named the tools
description: Skills are symlinked into the repo (hooks and settings are copies). grep -r does not follow a symlinked file; grep -R does. The lead reported image generation and the detector as undiscoverable all night on the strength of -r. Corrects the earlier over-broad claim that nothing in ~/.claude is symlinked.
type: project
relates_to: [session_2026-07-29_craft-floor-is-live-and-nothing-is-symlinked.md, session_2026-07-29_inconclusive-loses-to-findings-in-the-exit-code.md]
supersedes: session_2026-07-29_craft-floor-is-live-and-nothing-is-symlinked.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: -r and -R run against the identical pattern and path with differing results; readlink run on the individual installed skill files; tools.md read and its tool names enumerated; the harness's own comment at run-scoreboard.sh:362 read
confidence: high
---

# grep -r skips symlinked files (2026-07-29)

Commit stamp at authoring: 4b57214f.

## The measurement

Same pattern, same path, same moment:

    grep -rl "sidecoach-detect" ~/.claude/skills/sidecoach/   -> 0 files
    grep -Rl "sidecoach-detect" ~/.claude/skills/sidecoach/   -> 3 files

BSD `grep -r` does not follow a symlink it meets during recursion. `-R` does. The installed skill
files are symlinks, so every `-r` sweep of that surface returned zero on files that plainly
contain the string.

Corrected, with `-R`:

    sidecoach-detect       3 files
    sidecoach-image        4 files
    sidecoach-doctor       2 files
    sidecoach-craft-floor  1 file

**I reported image generation and the detector engine as undiscoverable all night, and re-tasked
two teammates on that basis.** Both were named. `reach` reported `tools.md` as landed and I set
out to contradict it; the report was right and my measurement was wrong.

## Correction to my own earlier beat, which was too broad

I wrote that "NOTHING in `~/.claude` is symlinked from this repo." That is wrong as stated. The
DIRECTORIES are not symlinks, which is what I actually tested. The FILES are:

    ~/.claude/skills/sidecoach/SKILL.md        -> claude/skills/sidecoach/SKILL.md
    ~/.claude/skills/sidecoach/CHEATSHEET.md   -> claude/skills/sidecoach/CHEATSHEET.md
    ~/.claude/skills/sidecoach/reference/tools.md -> claude/skills/sidecoach/reference/tools.md

So the propagation model is MIXED, and the distinction is the useful part:

- **Skills are symlinked.** A repo edit to `claude/skills/sidecoach/*` is live instantly.
- **Hooks and settings are copies.** A repo edit there does nothing until the installer runs.

My original conclusion still holds for hooks and settings, which is where it was applied. It was
false for skills, and I generalised from a `readlink` on two directories to a claim about
everything under `~/.claude`.

## The row that is still wrong, and it is scope not flag

`scorekeeper` already found this bug independently; `run-scoreboard.sh:362` carries a comment
naming BSD `-r` versus `-R` explicitly. But the detector row's command is:

    grep -c sidecoach-detect $INSTALLED_SKILL $INSTALLED_CHEAT

which reads only SKILL.md and CHEATSHEET.md. `sidecoach-detect` lives in `reference/tools.md`.
The surface grew from 2 files to 11 and the row still sweeps 2 of them. **The flag was fixed and
the scope was not**, so the row reads 0 and is scored LOSS while the tool is named in 3 files.

## The pattern, now eight for eight

Every one matched what I expected the subject to look like rather than what the subject is:
an `h5` before an `h1` read as a skip when it is an ascent; an emptiness test against a hook that
answers `{}`; a payload naming a file that did not exist against a guard that reads from disk; a
prose filter excluding the table rows carrying the prose; an importer grep against a subprocess
spawn; a symbol grep for `polish-craft` when the code uses `craft-flow`; an `od -c` whitespace
test matching od's own column padding; and now `-r` against a tree of symlinks.

**Four of the eight were greps.** The method fix is not more care with greps. It is to prefer
running the thing and reading its raw output, and to reserve grep for confirming a positive I
have already seen with my own eyes.

## Files touched

- none (measurement only)

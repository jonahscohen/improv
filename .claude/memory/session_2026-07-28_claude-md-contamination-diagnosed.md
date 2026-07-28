---
name: claude/CLAUDE.md was overwritten with the ASSEMBLED install output instead of staying a payload
description: install.sh builds the brain block from RULES.md + CLAUDE.md. Because ~/.claude/CLAUDE.md is a symlink to claude/CLAUDE.md, an install wrote the assembled result back over the payload source. The repo file now contains a copy of RULES.md and the memory-discipline block.
type: project
relates_to: [session_2026-07-28_claude-md-symlink-model.md, session_2026-07-28_zshrc-bak-missed-callsites.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: install.sh:4237 read directly; file structure mapped by marker line numbers; RULES.md compared against the embedded copy
confidence: high
---

# What actually happened to claude/CLAUDE.md (2026-07-28)

Jonah's design intent, stated by him: the additive marker design exists to **protect every
user's existing CLAUDE.md**, not to make the file identical everywhere. Different people
work on different projects. That intent is correct and the installer implements it.

## The mechanism, exactly

`install.sh:4237` builds the brain block payload as:

    { cat "$REPO_DIR/claude/RULES.md"; printf '\n'; cat "$REPO_DIR/claude/CLAUDE.md"; } | strip_block_markers

So `claude/RULES.md` (team standards) and `claude/CLAUDE.md` (personal workflow) are both
PAYLOAD SOURCES. They are concatenated and appended into the USER's `~/.claude/CLAUDE.md`
between `improv:brain` markers.

On this machine `~/.claude/CLAUDE.md` is a symlink to `claude/CLAUDE.md`. Source and target
are one inode. So the install wrote its ASSEMBLED OUTPUT back over its own payload source.

## Current state of claude/CLAUDE.md (443 lines)

| lines | what it is | should it be here? |
|---|---|---|
| 3-132 | `improv:memory-discipline` block | NO - a different component's installed block |
| 134 | `improv:brain:begin` | NO - a payload does not wrap itself |
| 135-257 | `improv:rules` block, a copy of claude/RULES.md | NO - RULES.md is its own payload source |
| 258-442 | the personal-workflow content | YES - this is the real payload |
| 443 | `improv:brain:end` | NO |

**Nothing is duplicated within the file** - each section appears once, so no content was
lost or doubled. The file is a perfectly well-formed INSTALL OUTPUT. That is precisely the
problem: it is the output sitting where the input belongs.

## Why cleaning it naively would hurt Jonah right now

Because of the symlink, that assembled file IS his live loaded global instruction file. If
the repo source were trimmed to just the payload first, he would immediately lose the beats
discipline and team-rules sections from his loaded context until an installer run rebuilt
them. The obvious cleanup has a live regression hiding in it.

## Safe order (not yet executed)

1. Migrate `~/.claude/CLAUDE.md` from symlink to a real file, preserving current content
   byte-for-byte. install.sh:4198 already does exactly this. After this step Jonah's loaded
   instructions are safe and independent of the repo.
2. Trim `claude/CLAUDE.md` back to the personal-workflow payload only (drop lines 3-132,
   134, 135-257, 443).
3. Re-run the brain install so the block is reassembled from the two clean payload sources.

`strip_block_markers` already makes step 3 safe against the nested-marker breakage, so this
is a cleanliness repair rather than an outage fix.

## Files touched

- none (diagnosis only)

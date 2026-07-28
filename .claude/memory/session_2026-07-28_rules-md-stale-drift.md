---
name: claude/RULES.md is months stale - the symlink made the assembled file the de-facto source, and strip_block_markers is case-sensitive
description: A reassembly from the clean payload sources dropped rules 8-10 and the entire Hook Error Response Protocol, because RULES.md never received edits that were made directly into the symlinked assembled file. Also found: strip_block_markers misses Improv:rules markers with a capital I.
type: project
relates_to: [session_2026-07-28_claude-md-contamination-diagnosed.md, session_2026-07-28_claude-md-symlink-model.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: reassembly run live, content diff taken with markers and blanks stripped, live file restored from backup and confirmed byte-identical
confidence: high
---

# The repair exposed a bigger problem than the one it was fixing (2026-07-28)

Steps 1 and 2 of the agreed repair worked. Step 3, reassembling the brain block from the
clean payload sources, **lost content**, and the diff is why this whole area matters.

## What the reassembly dropped

Reassembled output was 426 lines against 443 before. With markers and blank lines stripped:
278 content lines before, 269 after. Missing:

- Team Rule **8** (Codex cross-model review required)
- Team Rule **9** (Verification baseline first)
- Team Rule **10** (Plans and specs carry a commit stamp)
- The **entire Hook Error Response Protocol** section
- Beats-rename wording throughout, reverted to the older "session memory notes" phrasing

## Root cause, confirmed by direct grep

`claude/RULES.md` does not contain any of it. Rule 8: absent. Rule 9: absent. Hook Error
Response Protocol: absent. It still says "session memory notes", predating the beats rename.

**The mechanism is the symlink again.** Because `~/.claude/CLAUDE.md` was the repo file,
every edit anyone made to the live instructions - including edits to the TEAM RULES section
- landed in the assembled file and never propagated back to `claude/RULES.md`. The assembled
output silently became the de-facto source of truth while the real payload source rotted.

This has happened before: commit `0fae7543` is literally titled
"chore(brain): sync CLAUDE.md drift back to source". It was treated as a one-off chore
rather than as evidence of a structural leak.

## Second defect found: strip_block_markers is CASE-SENSITIVE

`claude/RULES.md` wraps ITSELF in `<!-- Improv:rules:begin -->` at line 1 and
`<!-- Improv:rules:end -->` at line 104 - **capital I**. Yesterday's `strip_block_markers`
invariant strips `improv:` and left these in, so the reassembled output carried a stray
`Improv:rules:begin` marker into the user's file. The invariant is correct in shape and
wrong in its matching.

Note this is also a second instance of RULES.md being an assembled artifact rather than a
payload: a payload does not wrap itself in its own delimiters.

## Action taken

Live `~/.claude/CLAUDE.md` restored from the pre-repair backup, verified byte-identical at
443 lines with the Hook Error Response Protocol present. **No user content was lost.** The
repo source stays trimmed to its clean 184-line payload, which is correct and independent of
this problem.

## What has to happen before the repair can complete

1. Sync the CURRENT rules text out of the assembled file back into `claude/RULES.md`, and
   drop RULES.md's self-wrapping markers so it is a true payload.
2. Make `strip_block_markers` case-insensitive.
3. Re-run the reassembly and require the content diff to be EMPTY before accepting it.

## The lesson

The diff was the whole safeguard. A reassembly that looked successful - installer printed
"Installation complete", one clean brain block, correct marker count - had silently dropped
four rules and a protocol section. Line count and marker structure both looked healthy.
Only a content diff against a pre-change backup caught it.

## Files touched

- `~/.claude/CLAUDE.md` restored to its pre-repair state (net zero change)
- `claude/CLAUDE.md` remains trimmed to payload (from the earlier, correct step)

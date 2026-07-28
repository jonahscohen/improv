---
name: The four-question audit wave committed in logical units
description: Jonah chose per-unit commits over one wave commit, and chose to investigate the CLAUDE.md symlink model before cleaning the contaminated source. Records what landed and what was deliberately left alone.
type: project
relates_to: [session_2026-07-28_four-question-audit-lead-verification.md, session_2026-07-28_zshrc-bak-missed-callsites.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: every unit's suites re-run by the lead before its commit; both gate suites exit 0 throughout
confidence: high
---

# Committing the audit wave (2026-07-28)

Jonah ruled per-unit commits over a single wave commit, so any one piece can be reverted
without untangling it from the rest.

## Landed

- `15d924f2` - two inverted hooks plus the prune gap. grounding-gate was 5x louder on
  envelopes than on genuine prompts; codex-failure-watcher had a 33.3% false-positive rate
  and no behavioural coverage at all, which is why the same over-fire class survived a fix
  applied 33 days earlier. The skills prune covered `~/.claude/skills` only, so a hook
  retired from the repo left its symlink behind.
- `e6ad47c5` - one path-parameterized safe-edit primitive for every user-owned file the
  installer touches. Zero live `sed -i` remain in install.sh.

## Verified by the lead before each commit

`test-install-prune-skills` 22/0, `test-grounding-guard` 20/0, `test-codex-failure-watcher`
17/0, `test-userfile-safe-edit` 49/0, `test-zshrc-safe-edit` 44/0, plus both gate suites
(`test-bin-parity`, `test-settings-wire-parity`) at exit 0. The 10 surviving `sed -i`
strings in install.sh were each checked to be comments.

Live files confirmed untouched throughout: `~/.zshrc` mtime still Jul 17 14:42, no sibling
`.bak`, and `~/.claude/CLAUDE.md` still a symlink rather than a replaced regular file.

## Deliberately NOT done - Jonah's ruling

`claude/CLAUDE.md` carries a committed `improv:brain:begin/end` pair at lines 134 and 443,
plus a nested `improv:rules` pair at 135 and 257. An earlier install wrote its own block
into the repo source through the `~/.claude/CLAUDE.md` symlink and it was committed.

Jonah chose to **investigate the symlink model before cleaning the file**, over stripping
the four marker lines now. The reasoning that makes that the right call: the markers are a
symptom. The underlying oddity is that the live global instruction file IS the repo file,
so section 11 appends the file into itself. Stripping the markers would remove the evidence
without answering whether the symlink design is intended.

The code no longer depends on the contamination - `strip_block_markers` makes a block's
payload unable to contain its own delimiters, and three consecutive real installs hold at
exactly one marker - so this is a cleanup question, not a live defect.

## Files touched

- committed `15d924f2` and `e6ad47c5` as described; no source edited by the lead

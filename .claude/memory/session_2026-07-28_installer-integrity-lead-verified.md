---
name: Installer integrity closeout LEAD VERIFIED - the root-cause cycle was still live on an unexercised path
description: The memory-discipline payload source was synced and the same output-overwrote-input cycle was found alive via install.sh --only memory, which had no symlink migration. Content across the whole session is provably intact.
type: project
relates_to: [session_2026-07-28_claude-md-repair-complete.md, session_2026-07-28_rules-md-stale-drift.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: multiset content diff of the live file against the pre-repair backup is IDENTICAL; suites re-run by the lead
confidence: high
---

# Installer integrity closeout, verified (2026-07-28)

## Lead verification

- `claude/memory-discipline-section.md` is now **byte-identical** to the installed block in
  the live file, 128 lines against the old 119, and carries the current beats vocabulary.
- **Zero dangling symlinks** remain under `~/.claude/hooks` and `~/.claude/skills`.
- `test-userfile-safe-edit` **59 passed / 0 failed** (was 49 rows). Both acceptance gates,
  `test-bin-parity` and `test-settings-wire-parity`, exit 0.
- **Content across the ENTIRE session is intact.** A multiset comparison of the live
  `~/.claude/CLAUDE.md` against the backup taken before any repair, markers and blank lines
  stripped, is IDENTICAL. 278 content lines then, 278 now.

Note for the next reader: a raw `cmp` against that backup DOES differ, and that is expected
rather than alarming - the repair shifted a marker by one line. Byte equality was never the
property worth asserting; content equality is.

## The find that matters most

The root-cause cycle was **still live** on a path nobody had exercised. `safe_block_delete`
and `>>` both follow symlinks by design, and the symlink-to-real-file migration existed only
inside the `brain` component. So on a legacy machine `install.sh --only memory` wrote the
assembled block straight back into `claude/CLAUDE.md`. Reproduced against a throwaway repo
copy: the payload source grew 184 -> 316 lines in ONE run.

This is the same cycle repaired earlier today, reached through a different door. The
primitive's own header documented the hazard and noted that the DEACTIVATE paths guard it;
the INSTALL path had no equivalent. Fixed.

## A second defect the sync exposed

The installer emitted NO markers for the memory-discipline section - it cat'd the payload
verbatim and leaned on the payload's own capital-I self-wrapping, while its presence check
was a LOWERCASE fixed string. The guard never matched what the installer itself wrote, so
every re-run appended another full copy: 1 -> 2 -> 3 blocks, 120 -> 240 -> 360 lines, each
run exiting 0 and printing "Installation complete". Invisible on this machine only because
an older install had already written lowercase markers. It fires on every fresh machine.

## Both Unit 2 items closed as NOT defects

`model-router-guard` is not half-registered; the `model-routing` cluster was simply never
selected here, and driving `--only model-routing` deploys and wires it correctly. The
carry-forward is the useful part: **"managed" means PACKAGED, not DEPLOYED.** The registry
guard asks two repo-static questions and nothing in the repo checks the deployment axis.

The dangling symlink is removed by a real `--prune-skills-apply` run, not only in tests.

## Open decision, deliberately not taken

A refresh is content-lossless but REORDERS: this machine is memory-then-brain, a historical
artifact, and the installer's canonical fresh-install order is brain-then-memory. Per the
standing gate the teammate restored the backup rather than accept a non-empty ordered diff.
The live file needs no change either way - its block already carries the current text and
the repo source is byte-identical to it - so this is a preference about whether a refresh
may reorder blocks, not a defect. Left for Jonah.

## Also flagged, not changed

The brain path's presence check has the same substring shape, and both paths grow the file
by one blank line per run (310 -> 311 -> 312 measured). Pre-existing and shared.
`claude/CLAUDE.local.md` is a fourth payload source, currently absent, same latent class.

## Files touched

- none by the lead (verification only)

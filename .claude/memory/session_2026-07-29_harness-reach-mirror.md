---
name: Sidecoach now installs to six agent harnesses, and Codex silently ignores a symlinked SKILL.md
description: install.sh gained a harness skill mirror (cursor, gemini, codex, kiro, .agents) on top of ~/.claude/skills, gated on the harness home already existing, HOME-escape asserted, 40-row suite with 4 mutation controls. Two measured corrections to the plan - OpenCode already read ~/.claude/skills so it was never missing, and Codex CLI 0.142.5 does not follow a symlinked SKILL.md so the mirror must copy.
type: project
relates_to: [session_2026-07-28_capability-evidence-inventory.md, session_2026-07-25_wire-bins-discoverable-drift-flow.md]
author_human: Jonah
author_model: claude-opus-4-6
source: session
verified: live install run; gemini skills list and codex debug prompt-input both show sidecoach after the run and did not before; 40/40 rows in test-install-harness-mirror.sh; 4 mutation controls each caught by the row written for it
confidence: high
---

Collaborator: Jonah. Task: sidecoach shipped to exactly one install target while a competing
design skill mirrors into fourteen. This is the distribution half.

## What landed

`install.sh` gained four functions in the sourceable library region, beside
`install_bundled_skill` and using its primitive rather than a new one:

- `harness_home_is_inside_home` - the HOME-escape assertion.
- `harness_skill_targets` - which harnesses on this machine qualify.
- `install_skill_to_harnesses <skill>` - the mirror.
- `verify_harness_skills [names]` - the read-back, plus a `--verify-harness-skills` flag.

Called once, `install_skill_to_harnesses sidecoach`, from the existing sidecoach block. No
new `sed -i`, no new symlink check, no parallel script. Failures route through
`record_component_failure`, and the end-of-run read-back sits beside the two that already
existed.

Live result: `sidecoach -> cursor, gemini, codex, kiro, agents`, five targets on top of
`~/.claude/skills`.

## Two things the plan got wrong, both caught by measuring before believing

**OpenCode was never missing.** Before writing a line I ran `opencode debug skill` and it
returned all 17 installed skills, every one resolved from `/Users/spare3/.claude/skills/
<name>/SKILL.md`. OpenCode reads the Claude root directly. A row for it would have deployed
a second copy of a payload it already loads and inflated the reach count with a target that
was never a gap. There is a comment in the installer saying so, because the obvious next
edit is for someone to "finish the table" by adding it.

That measurement also caught my own bad instrument twice in a row. My first two probes were
`opencode debug skill | tr | tail -30` and `| grep -c '"location"'`, which reported 5 skills
and then 4. Both numbers were artifacts of truncating a 203KB JSON document through a pipe.
Parsing the file properly returned 17. **The raw output disagreed with every summary I took
of it, and only reading it raw showed that.** Fourth instrument failure in the team's two
days; mine was pipe truncation.

**Codex does not follow a symlinked SKILL.md.** The first live run deployed symlinks - a dev
checkout, so `hook_deploy_mode` chose symlink - and reported five harnesses installed with a
clean byte compare. `codex debug prompt-input` then showed sidecoach nowhere. I isolated it
by replacing that one symlink with one real file and changing nothing else: the skill
appeared immediately. Claude Code, OpenCode and Gemini CLI all load through a symlink; Codex
does not, and nothing on disk distinguishes the two cases.

Why: the mirror now pins `IMPROV_HOOK_DEPLOY=copy` for its own loop and restores the
caller's value on return. A symlink risks ZERO reach in a harness that ignores it; a copy
risks STALE reach, and stale reach has three detectors (the end-of-run read-back,
`--verify-harness-skills`, and doctor next) while silent non-loading had none. The refresh
after editing a SKILL.md is `./install.sh --only sidecoach`.

How the trade-off was verified rather than asserted: within a minute of `imageflight` saving
a new description line into the same SKILL.md, the end-of-run read-back reported it STALE in
all five harnesses. That is the copy risk firing on its first real occurrence and being
caught, in the same run that introduced it.

## Proof that each target loads, and where the proof runs out

| harness | root | probe | before | after |
|---|---|---|---|---|
| Claude Code | `~/.claude/skills` | session skill listing | present | present |
| OpenCode | reads `~/.claude/skills` | `opencode debug skill` | present | present |
| Gemini CLI | `~/.gemini/skills` (resolved via `~/.agents`) | `gemini skills list` | absent | `sidecoach [Enabled]` |
| Codex CLI | `~/.codex/skills` | `codex debug prompt-input` | absent | present |
| Cursor | `~/.cursor/skills` | none ships | - | file present only |
| Kiro | `~/.kiro/skills` | none ships | - | file present only |

Three harnesses are proven to LOAD it by their own loader. Cursor and Kiro ship no
enumerator, so those two rows are "the payload is present at the documented root", which is
weaker and is written as weaker. Gemini reports its location as
`~/.agents/skills/sidecoach/SKILL.md` rather than `~/.gemini/skills`, so the two roots
collapse to one discovery for that harness.

## Why the gate is "does the harness home already exist"

A row whose home directory is absent is skipped and never created. Planting
`~/.trae/skills/sidecoach` on a machine with no Trae is not distribution, it is a directory
that makes a count look bigger. Eleven of the competitor's fourteen targets are that shape on
this machine.

## The defect the mutation test found, which no green run would have

`install.sh`'s `warn`/`info`/`err` all print to STDOUT, and `harness_skill_targets`' stdout
IS a machine-readable target list read through `$(...)`. A rejected row warned onto stdout,
the caller took the warning TEXT as a `label<TAB>path` row, and `mkdir -p` created a
directory **named after the warning text, relative to the current directory** - a write
outside `$HOME` produced by the guard that exists to prevent writes outside `$HOME`.

It was invisible in the passing suite because no green row exercised a rejected table. It
surfaced only when I mutated the presence gate out and the clean-mirror row went red for a
reason I could not explain, then refused to move on until I could. Fix: every diagnostic in
that function goes to `>&2`, plus a consumer-side `harness_row_is_wellformed` so a future
regression there is non-destructive rather than merely visible. Pinned by a row that runs the
mirror in a clean CWD with a table of rejects and asserts the CWD gained nothing.

**Why it happened:** I wrote a function whose stdout was structured data inside a codebase
whose logging goes to stdout, and I did not check which stream `warn` used before relying on
it. **How it went wrong:** the suite's negative rows all asserted "the bad label is not in
the output", which a bogus extra line satisfies; none asserted "nothing bad was written".
Absence-of-good and absence-of-bad are different assertions and I only wrote the first.

## Verification

- `bash claude/hooks/test-install-harness-mirror.sh` - 40 passed, 0 failed.
- 4 mutation controls, each caught by the row written for it: presence gate removed (needed a
  NESTED harness home to defeat masking by the containment check, since a direct child of
  `$HOME` is rejected by containment anyway); `warn` returned to stdout plus the row check
  removed; the copy-mode pin removed; the mode restore removed.
- Redirected HOME throughout, with a canary directory OUTSIDE the sandbox HOME snapshotted
  before and after every write row, and a second snapshot of the five real harness roots
  under the real `$HOME` proving the suite touched none of them.
- One suite row was written wrong first: it asserted the deploy mode had leaked by checking
  for `copy` after a `VAR=x func` prefix call. Bash restores a prefix assignment itself when
  the function returns, so that form reports the caller's original value either way and can
  never detect a leak. Rewritten to set the variable on its own line; the comment says so.

## Files touched

- `install.sh` - four new library functions, the `--verify-harness-skills` flag, one call in
  the sidecoach block, one end-of-run read-back, one help line.
- `claude/hooks/test-install-harness-mirror.sh` - new, 40 rows.

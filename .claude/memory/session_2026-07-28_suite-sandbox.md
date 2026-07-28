---
name: test-hook-registry stops mutating the live tree
description: The suite that produced three false measurements today now builds every fixture in a sandbox repo copy under a temp HOME; race reproduced at 6/18 sweeps before, 0/22 after
type: project
relates_to: [MEMORY.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests + 11-mutant mutation control + three Codex cross-model passes
confidence: high
---

`claude/hooks/test-hook-registry.sh` wrote its `zz-*` fixtures straight into the REAL
`claude/hooks/` and kept its flag files at the REAL `$HOME/.claude/`. Both are now
sandboxed. Nothing in `hook-registry-guard.sh` or `hook-registry-stop.sh` was touched.

## What the defect actually cost

Three false measurements on 2026-07-28, all of them believed at the time:

- A Stop gate blocked a session naming `zz-registry-fixture` as an unpackaged hook. The
  file did not exist - it was this suite's fixture, created and deleted inside a run and
  caught mid-flight by an `--audit` sweep in another process.
- The suite was read at 76/0, then 75/1, then reported as 75/1 pre-existing at HEAD. All
  three were artifacts of concurrent runs colliding on the single shared flag file.
- A prior agent tried to fix the guard by exempting the `zz-*` prefix and turned 9 rows
  red, because the prefix identifying a transient is the prefix identifying the detection
  fixture. The guard now carries a comment saying not to retry it.

## Measured, before and after

| probe | before | after |
|---|---|---|
| concurrent `--audit` sweeps naming a transient fixture | 6 of 18 (33%) | 0 of 22 |
| same sweep on a quiet tree (control) | 0 of 23 | 0 of 23 |
| two simultaneous runs of the suite | both 85/1 | both 94/0 |
| four simultaneous runs + a concurrent sweeper | not run | 4x 94/0, 0 false findings |
| rows | 86 | 94 |
| runtime | 13.7s | 7.1s |

The two concurrent runs failed in mirror image: run A lost its block
(`stop blocks on unmanaged hook rc=0`), run B inherited a stale one
(`stop blocks only once rc=2`). That is the shared flag file, exactly.

## How

**Why a copy and not an env var.** The guard and the stop gate resolve their repo from
their own script location and only fall back to `CLAUDE_PROJECT_DIR` when there is no
`browser-tree.json` beside them. So `mk_sandbox` copies both scripts into
`<root>/repo/claude/hooks/` next to a synthetic tree and install.sh. A copy without a
tree silently resolves back to the real repo - which is what `$SKB` was doing: it had no
tree, so it only worked because `CLAUDE_PROJECT_DIR` happens to be unset under the Bash
tool. Under any hook invocation it would have audited the real `claude/skills`. Fixed by
giving `$SKB` a tree.

**Isolation is asserted, not assumed.** Two precondition rows run in both directions:
`good-hook` is packaged only in the sandbox and `justify-source-guard` only in the real
repo, so the pair distinguishes "resolved the sandbox" from "resolved the live tree". The
sandbox is driven with `CLAUDE_PROJECT_DIR` pointed at the REAL repo on purpose, so every
row is also proof that self-resolution beat the fallback.

**Two leak detectors, because one cannot do it.** A before/after fingerprint of the real
paths catches a fixture left behind. It structurally CANNOT catch a write that is undone
before the end - and a transient write is the whole failure mode, since a concurrent sweep
only needs the file to exist for the length of one glob. So a static source ban also
scans this file for any redirect into, or mutating command aimed at, `$REPO_DIR` or the
real `$HOME`. The mutation control proves the split: a transient create+delete goes 93/1,
red on the static row alone.

**Kept, not weakened.** All 86 original rows survive. Nine detection rows still require a
planted unpackaged hook to be caught - they are just planted in a sandbox now. One
read-only row still audits the real tree, clearly labelled: a red there means this repo
genuinely has an unpackaged hook, not that the gate is broken.

## The leak detector's own false positive - and the fix

The first form of the fingerprint compared the two real flag files by existence and
contents. It went red inside the hour: a SIBLING session's Stop gate created and cleared
`~/.claude/.unmanaged-hook-acked` mid-run, and the row reported it as this suite mutating
live state. A false finding about live state, produced by the row written to detect false
findings about live state.

It now fingerprints only this suite's OWN fixture namespace inside the shared paths:
`zz-*`/`sb-*`/`good-hook`/`test-sb-suite`/`detect-session-model` names in the live hooks
dir, plus the names that can actually reach a flag found INSIDE the real flag files. And
because `detect-session-model.sh` is a fixture name that borrows a hook that already
EXISTS live, a name listing cannot see it being overwritten - so that one file is
checksummed. Overwriting a real hook is the worst leak this suite could cause and it was
the one shape neither half covered.

## Verification

- 11-mutant control, unmutated baseline proven green first (a mutant that dies before
  reaching the mutated code reports CAUGHT falsely). All 11 killed by their claimed rows.
  Three of them are controls on the leak rows specifically: a leftover fixture (91/3), a
  transient create+delete (93/1, static ban only), and an overwrite of a real hook (92/2,
  checksum only).
  One mutator initially had a syntax bug and the harness reported "killed, but not by the
  rows claimed" rather than a false CAUGHT - the check earned its keep on its first run.
- Live `claude/hooks/` byte-identical across every run (165 files shasum'd before and
  after); the two real flag paths still absent.
- Codex (gpt-5.4) pass 1, wrapper exit 0: three findings, all folded. Pass 2, exit 0: no
  blocking findings, one Low on regex coverage. Pass 3, exit 0: two Lows (fixture
  namespace incomplete, `install -m` missing from the writer list), both folded.

## Codex findings, folded

1. Medium - the fingerprint row overclaims: it cannot see a transient write. Added the
   static source ban plus a mutant that plants exactly that.
2. Medium - `syntax gate stays silent on a valid hook` was not asserting silence. The
   fixture is unpackaged in the sandbox, so the guard legitimately prints UNMANAGED HOOK;
   the row only rejected rc 2. Relabelled, and given a positive anchor requiring the file
   to REACH the packaging check, so a guard that exits early now goes red.
3. Low - the coupling rows grepped the whole guard including its comments, where both
   function names are discussed at length, and `grep -F 'copy_bundled_skill\s'` made the
   `\s` two literal characters that appear nowhere, so that row could never fire. Both now
   strip comment lines and use word-boundary `-E` regexes.
4. Low (pass 2) - the static ban missed `${REPO_DIR}` braces, fd-numbered `2>`, `>|`, and
   `tee`. All added, verified against 8 must-match and 8 must-not-match lines.
5. Low (pass 3) - the fingerprint's `zz-`/`sb-` namespace did not cover `good-hook`,
   `test-sb-suite` or `detect-session-model`. Namespace spelled out, and the colliding
   name checksummed. Also `install -m` added to the writer list; safe to list because the
   pattern needs whitespace after the word, and `install.sh` / `install_app_hooks` /
   `install_bundled_skill` are all followed by `.` or `_`.

## Self-analysis

The defect survived because a suite that cleans up after itself and a suite that never
wrote look identical from a green result. Nothing in the suite ever asked the second
question. That is why the two leak rows are asserted LAST and why the mutation control
plants a live write: the row that proves the rest of the file did what it says has to be
falsifiable itself.

The leak detector then made the same mistake it was built to catch, one level up: it
read state that belongs to every process on this machine and attributed a change to
itself. The lesson generalises past this file - a detector on a SHARED path has to
fingerprint something ATTRIBUTABLE, or it manufactures exactly the false findings it was
built to prevent. My own mutation harness proved the point twice over: its first
`${HOME}` mutant wrote an empty `~/.claude/.unmanaged-hook` into the real home. Found it,
removed it, and retargeted the mutator at the sandbox copy.

The `$SKB` finding is the same failure mode one layer down. Those rows have been passing
for as long as they have existed, and they pass for a reason unrelated to their subject -
`CLAUDE_PROJECT_DIR` being unset in this particular caller. A green row whose greenness
depends on an environment accident is not coverage.

## Files touched

- `claude/hooks/test-hook-registry.sh` (only file changed; +380 / -68)

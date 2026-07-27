---
name: installer fix adversarial review (uncommitted install.sh diff)
description: Independent review of the uncommitted install.sh / test-ampersand-shim.sh fix - 5 defects found, 2 reproduced as live data loss / silent no-op
type: project
relates_to: [session_2026-07-27_ampersand-review-findings-folded.md, session_2026-07-27_ampersand-selfheal-fix.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: sandboxed repro (temp HOME + extracted functions), full suite run, negative control run
confidence: high
---

Independent (non-producer) review of the UNCOMMITTED diff to `install.sh` and
`claude/hooks/test-ampersand-shim.sh`. Not "NO DEFECTS" - five concrete findings, two of
them reproduced as live data loss / silent no-op.

**Suite numbers as actually run (the review brief's numbers were stale):** full suite
`124 passed, 0 failed`; `--negative-control` fails `9` assertions pre-fix, not 7/111.

**1 (High) - the "regex mode strictly shrinks" invariant is false. Reproduced.**
`install.sh:1270-1272` claims regex end-matching "can only ever close the range EARLIER
... so it strictly shrinks what gets deleted." It cannot close later, but it converts a
REFUSAL into a delete. With the vanity block's own `}` missing and any later
`} # comment` line, exact mode returned 1 and left the file alone; regex mode deletes
from the vanity marker through the user's function. Repro deleted `export IRREPLACEABLE=1`
and a whole `myfunc(){...}`. Sites: `strip_legacy_vanity` (~4740) and
`deactivate_ampersand` (~2064).

**2 (High) - the `.bak` and symlink fixes are local to `zshrc_block_delete`. Reproduced.**
`deactivate_discord` (`install.sh:1825-1826`) and `deactivate_nvm` (`1955-1956`) still run
`sed -i.bak ... "$ZSHRC"; rm -f "$ZSHRC.bak"`. Repro: a user's `~/.zshrc.bak` is destroyed;
on a symlinked `~/.zshrc` BSD sed refuses, the function still returns 0, and uninstall
silently leaves the discord launcher lines in place. The new test asserts the .bak/symlink
properties only on the install path.

**3 (Medium) - `migrate_legacy_markers` (`install.sh:2114`) has the same symlink hole**, so
the "DEFENSIVE ONLY - cannot fire in a normal run" comment at `4783-4792` is false on
exactly the symlinked machines the new test celebrates. macOS-only installer (`1210`), so
the GNU-sed symlink-replacement variant is moot.

**4 (Medium) - failure-mode diagnosis is now wrong.** `zshrc_block_delete` returns 1 for
I/O reasons (mktemp failure, unwritable `$ZSHRC`) but every caller maps 1 to "block is
malformed ... remove the block by hand." Both reproduced.

**5 (Medium) - contract violation + no backup at all.** `cat "$out" > "$ZSHRC"`
(`install.sh:1324`) truncates before writing; a mid-write failure leaves a partial file and
the same line deletes `$snap` and `$out`, so the original is unrecoverable - while the
stated contract at `1281-1283` promises "returns 1 and does not touch the file." The old
incidental `$ZSHRC.bak` is gone with nothing replacing it, though `backup_if_exists` /
`BACKUP_DIR` exist at `3833` and are used elsewhere behind the `declare -f` ordering guard.

**Verified NOT defects** (checked, held): awk ternary in pattern position works on macOS
awk 20200816; multi-range `sed` script with trailing `;` works on BSD sed; the widened
user-owned-ampersand `grep -E` has no false positives on a realistic corpus
(`ampersandfoo()`, `_ampersand()`, `AMPERSAND=1`, commented and quoted forms) and no
historic improv block shape is POSIX-form-without-markers, so no self-healing regression;
`is_current_format`'s globals (`1216`-`1247`) are all assigned long before the first
`detect_component` call (`1549`/`3785`); no other suite awk-extracts `detect_component`
without `is_current_format`; `set -e`/`set -u` safe in every call shape including
`browser-lib.sh:976`.

**Why the producer missed 1 and 2:** both are scope errors, not logic errors. The fix was
scoped to the function under review, and the test was written to the same scope, so the
suite proves the property on the install path and stays silent about the three other sites
that edit `~/.zshrc` the old way. A claimed-fix review has to grep the whole file for the
pattern being fixed, not just read the diff.

Files touched: none (review only).

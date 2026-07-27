---
name: ampersand review findings folded
description: The 4 open Codex defects from the ampersand shim handoff, plus a 5th site found while fixing, all folded into install.sh with negative-controlled regressions
type: project
relates_to: [session_2026-07-27_ampersand-selfheal.md]
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: test-ampersand-shim 111/0 with a negative control showing 7 assertions red pre-fix, 10 other installer suites green, bash -n clean
confidence: high
---

The `amp-selfheal` teammate stood down mid-unit and handed off four Codex defects it had
never folded. All four were in ALREADY-COMMITTED code (14145511), and all four end in the
same user-visible failure the shim exists to prevent - a .zshrc that looks fine and
launches nothing - or in destroyed user config.

Every finding was verified against the real code before being fixed. None was taken on
the handoff's word.

## The five fixes

**1. `zshrc_block_delete` ignored `sed`'s exit status.** Reproduced first: BSD `sed -i`
refuses a non-regular file outright - `sed: link.zshrc: in-place editing only works for
regular files`, rc=1 - and a symlinked `~/.zshrc` is an ordinary dotfiles setup. The
function returned 0 regardless, so the caller believed the stale block was deleted,
appended a fresh one, and reported success. The user ended up with TWO definitions, and
zsh runs whichever comes last. Now the status is checked, the `.bak` is restored, and it
returns 1, which routes the caller into its existing "malformed - leaving it alone" branch.

**Why this one matters most:** it converts the shim's own repair path into the exact
duplicate-block failure the shim was built to fix, on a very common machine shape.

**2. A commented closing brace did not close the vanity block.** End-matching was
whole-line equality against `}`, so `} # end yesplease` was skipped and the delete ran on
to the NEXT standalone brace anywhere below, taking the user's exports and unrelated
functions with it. `zshrc_block_delete` now takes an optional third argument selecting
regex end-matching; the vanity sites pass `^[}][[:space:]]*(#.*)?$`.

**Why anchored at column 0:** an indented brace inside the function body must not close
the range early. Regex mode can therefore only ever close the range EARLIER than exact
mode, never later - it strictly shrinks what gets deleted, which is the safe direction
for a change to a delete.

**3. The same bare `}` existed at a SECOND call site.** The handoff flagged
`strip_legacy_vanity`; `deactivate_ampersand` had the identical pattern. Both fixed. Two
sites deleting the same block shape with different end patterns is a bug waiting to
happen, so they now share one.

**4. The user-owned-ampersand guard missed the POSIX function form.** It matched only
`function ampersand` and `alias ampersand=`, so a user's own `ampersand() { ... }` read as
absent and our block was appended after it, silently clobbering their command. Widened to
all three definition forms, with leading whitespace tolerated.

**5. Two definitions of the word "current".** `is_current_format` was LOCAL to section 11
while `detect_component`'s ampersand arm ran a bare `grep -Fq "$SHIM_MARKER"`. A .zshrc
carrying a current block FOLLOWED BY a stale one reported ACTIVE, so the component browser
never offered the repair while zsh ran the stale block that comes last. `is_current_format`
is now global, next to `zshrc_block_delete`, and both callers use it. The detect arm's own
comment already described the strict rule - only the code disagreed with it.

## Verification

- `bash -n install.sh` clean.
- `test-ampersand-shim.sh`: **111 passed, 0 failed** (99 before; part5 adds 12).
- **Negative control: 7 assertions fail against pre-fix HEAD and pass after** - at least
  one per finding. Without this the suite would prove nothing, which is the standing
  lesson from the 2026-07-23 hook-registry work.
- Ten other installer suites green: component-browser 139, browser-render 146,
  check-updates 39, hook-registry 52, apply-plan 33, apply-pending 33, app-hook-offlist 36,
  install-hook-deploy 26, installer-manifest PASS, settings-deploy-parity PASS.
- The harness extraction and its `declare -f` completeness assertion were extended to
  carry `is_current_format`, at both extraction sites. Omitting it would have degraded
  into a plausible-looking installer failure rather than a harness error - the exact trap
  the existing `zshrc_block_delete` assertion was added for.

## Cross-model gate: Codex timed out twice, Claude reviewer used

Codex hung on both attempts (8m20s on the 703-line full diff, 9m20s on the 237-line
install.sh-only diff), having thrown MCP transport errors against 127.0.0.1:29979 in the
prior session too. Per the standing rule the gate still runs, with an independent CLAUDE
reviewer as the floor when Codex is genuinely unavailable - a fresh agent with clean
context that did not produce the unit.

Trimming the diff did not rescue it, which is a different failure from the statusline
session's lean-prompt problem: there the retry succeeded but LOST context and produced two
false findings. Same lesson applies in reverse - the retry kept full context and still hung,
so the blocker is Codex's transport, not prompt size.

## MY FIX 2 WAS DATA LOSS. Reverted, and the underlying bug fixed properly.

An adversarial review found that the regex end-mode I added (fix 2 above) **destroys user
config**, and reproduced it. My own code comment asserted the invariant that made it look
safe: "regex mode can only ever close the range EARLIER, never later, so it strictly
shrinks what gets deleted." **That is false.** It cannot close later, but it converts a
REFUSAL into a DELETE - and exact matching had deleted nothing at all, so the deleted set
is not a subset of anything.

Reproduced against my own shipped code: a vanity block whose `}` was lost to a hand edit,
followed by the user's config and a later `} # end myfunc`, went from `rc=1, file
untouched` to `rc=0, file reduced to one line`. An `export IRREPLACEABLE=1` and an entire
unrelated `myfunc` destroyed.

**Then it got worse, in the useful way.** Writing the regression test surfaced that the
runaway is NOT mine - it is pre-existing and committed. With plain exact matching, a
vanity block closed by `} # end yesplease` still runs on to the next BARE `}` anywhere
below. Reproduced: a fixture reduced to `export TAIL=1`, destroying a canary export and
the user's whole function. My change widened the shape; the hole predates it.

**The real fix: bound the span.** `zshrc_block_delete` takes an optional max-span; the two
vanity sites pass 4. Marker-pair deletes stay unbounded because `# === improv:...:end ===`
cannot plausibly be the user's line, while a bare `}` very much can be.

**The bound was wrong twice before it was right, and only a test caught it.** 12 was too
loose (the stray brace sat 7 lines out); 6 was still too loose (6 lines out, not `> 6`).
Both passed the unit suite. What caught them was a bounded-vs-unbounded DIFFERENTIAL test
asserting the invariant directly - for every fixture, the bounded run must either make the
identical delete or refuse and touch nothing, and must never delete a line the unbounded
run kept. At 4: the data-loss shapes refuse (7 and 8 lines preserved), well-formed blocks
still delete, `two_vanity_blocks` still converges. **10/10.**

The differential test also now reads the bound out of `install.sh` rather than hardcoding
it - it silently tested the old value of 6 after I had shipped 4, and reported a pass that
meant nothing. A test with its own copy of a constant is a test that stops testing.

### Self-analysis

Twice in one session I asserted a safety property in a comment instead of testing it, and
both times it was false. The failure mode is specific: I reasoned about the direction of a
change ("looser matching closes earlier, so it deletes less") and never asked what happens
in the case where the strict version deletes NOTHING. Refusal is not a small delete; it is
a different outcome, and a monotonicity argument over "how much" silently drops it.

The rule going forward: when a change to a destructive operation comes with a claimed
safety invariant, the invariant IS the test. Differential, old-vs-new, over a fixture set
that includes the refusal cases - not prose in a comment.

## Fix 1 was SUPERSEDED by a better one from a concurrent session

A second session was working this same checkout. It kept fixes 2-5 verbatim (the regex
end-mode parameter, both vanity call sites, the widened guard, the global
`is_current_format`) and replaced fix 1 with a strictly better implementation.

Mine checked `sed -i`'s exit status and failed loudly, so a symlinked `~/.zshrc` was
merely SAFE - refused, never repaired. Theirs drops `sed -i` entirely: plan and apply
against one snapshot, then redirect onto `"$ZSHRC"`, which follows the symlink and keeps
the user's link and inode. The symlink case now WORKS instead of being declined, and it
additionally closes two defects I did not catch:

- `sed -i.bak` writes `"$ZSHRC.bak"`, a path this function does not own. On success it
  destroyed a hand-made `~/.zshrc.bak`; on failure it could "restore" from that stale
  unrelated file. My `.bak` restore inherited both problems.
- The delete plan is a list of LINE NUMBERS from awk. Reading the file a second time for
  `sed` meant those numbers could land on different content.

The suite grew accordingly: my part5 assertion "symlinked .zshrc -> never ends up with two
blocks" is joined by "symlinked .zshrc -> the stale block is actually REPAIRED, not just
left alone" - the stronger claim only their version can satisfy. 124 passed, 0 failed.

**Lesson, recorded against my own report:** I first grepped for my own literal strings,
found them missing, and told Jonah the writer had "overwritten" my work. That was wrong
and I corrected it in the same turn. Grepping for your own implementation answers "is my
code still here", not "is the defect still fixed" - and those differ exactly when someone
fixes it better. Check the DEFECT, not the diff you remember writing.

## Lead spot-check of the INHERITED write path (15/15)

The snapshot/redirect rewrite arrived from another session and nothing in this chain had
verified it, so it was checked directly rather than trusted - the standing "spot-check
before trust" rule. Sandboxed, one HOME per case:

- Symlinked `~/.zshrc`: stale block REPAIRED, exactly one block after, the symlink is
  still a symlink, **the target's inode is unchanged** (edited in place, not replaced),
  and user config below survives. The inode assertion is the one that proves the claim -
  a rewrite that replaced the file would still look correct by content alone.
- A hand-made `~/.zshrc.bak` containing unrelated content survives the run. This is the
  defect their comment says it closes, and it does.
- No `improv-zshrc-*` snapshot files leak into `$TMPDIR`.
- The widened user-owned guard matches all five real shapes (`ampersand() {`,
  `ampersand () {`, `function ampersand() {`, `function ampersand {`, `alias ampersand=`)
  and false-positives on none of three lookalikes: a comment mentioning `ampersand()`,
  `ampersandfoo() {`, and `export ampersand_path=/x`. All three still receive the shim.

## Concurrent-writer hazard (operational, unresolved)

Two sessions edited `install.sh` in one working tree at the same time. It converged well
here, but nothing enforced that - there is no lock, and a straight clobber was equally
possible. Related: `session_2026-07-27_unauthorized-commit-and-second-writer.md`, whose
"most plausible explanation" names the terminal surface `surface:58 "improv main"` as the
unattributed writer. That is THIS session's own surface, which is worth knowing before
anyone spends more time on that forensic thread.

## Note for whoever picks this up

The teammate's uncommitted 14-line comment block at install.sh ~4730 (explaining why the
`LEGACY_SHORTCUT_BEGIN` branch is defensive-only) was already in the working tree and is
carried along in this diff. It is prose only, no logic.

## Files touched

- `install.sh`
- `claude/hooks/test-ampersand-shim.sh`

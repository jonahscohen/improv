---
name: Ruling - the failed-edit LEDGER supersedes "deactivate returns 0", and the test row asserting the old contract is what must change
description: A red row surfaced a genuine product-versus-test conflict. The product now records failures in a ledger and returns non-zero at the function's end; the test asserts the superseded "still returns 0" contract.
type: decision
relates_to: [session_2026-07-28_codex-vet-wave-verdicts.md, session_2026-07-28_codex-repairs-tests.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: install.sh design comment at :64-73 and deactivate_discord read directly; test-zshrc-safe-edit 44 passed / 1 failed reproduced by the lead
confidence: high
---

# The one red row is the test being wrong, not the product

`test-zshrc-safe-edit.sh` fails one row: "discord: failed edit still returns 0 (a case arm
under set -e must not abort)". 44 passed, 1 failed, reproduced by the lead.

## What the product does now

install.sh:64-73 documents the design explicitly:

- The SITE records the failure and keeps going, so a `case` arm under `set -euo pipefail`
  cannot abort the installer mid-undo and leave a component half-removed.
- The component's own FUNCTION returns non-zero at its END.
- The end of the run turns any recorded failure into a non-zero exit.
- Two independent consumers need this: `apply_pending` sees only the per-component return
  value, while a plain `--only <x> --yes` install never reaches apply_pending and has only
  the end-of-run check.

## Why the product is right and the row is stale

Returning 0 made "I changed nothing" indistinguishable from "I removed the component". The
prior behaviour told the user a component came out while its launcher was still sourced in
every new shell. That is Codex installer finding 5 (failed user-file edits becoming warnings
and overall SUCCESS) fixed properly.

Critically, the property the ROW exists to protect is NOT lost. "A case arm under set -e
must not abort" is now guaranteed by the LEDGER AT THE SITE rather than by the function
returning 0. The row asserts the old MECHANISM instead of the actual PROPERTY, which is why
a correct product change turns it red.

**Ruling: rewrite the row.** Assert the three things that are actually load-bearing - the
run keeps going rather than aborting, the component is recorded FAILED rather than inactive,
and the function returns non-zero at its end.

## Two brief premises the test agent corrected, both mine to own

Both came from the Codex vet and I passed them on without checking:

1. `local rc=$?` is NOT broken. `$?` is expanded before `local` runs - measured: that shape
   yields 7 while `local rc; rc=$?` yields 0. The row was already live.
2. The prune "absent-to-empty" case was NOT vacuous. `ls -1a` emits `.` and `..` for an
   empty directory, so absent never compared equal to created. The target-swap half of that
   finding WAS real, and the agent additionally found a link-to-regular-file retype proving
   it.

Codex is a much better reviewer than no reviewer and is still not an oracle. Two of its
findings in this batch did not survive measurement.

## The finding nobody had asked for

Both safe-edit suites' extraction lists were INCOMPLETE. install.sh had grown calls to
file-scope helpers the lists did not carry, and this does not fail loudly: inside an `if`, a
command-not-found is simply FALSE, so `deactivate_brain` silently stopped removing repo
symlinks while rows reported on a branch that never ran. Both suites now carry a generic row
that goes red when a subject calls anything outside the extract.

## Files touched

- none by the lead (ruling only)

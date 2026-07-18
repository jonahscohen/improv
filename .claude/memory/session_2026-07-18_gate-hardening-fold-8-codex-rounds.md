---
name: Figma-fidelity opt-out hardening - folded 8 Codex cross-model rounds into bash-guard + content-guard
description: Replaced the literal-substring opt-out guard with a self-contained quote/escape/heredoc-aware scanner (path-equality/realpath+samefile scoped to OUR marker), folding EIGHT rounds of independent Codex review. Committed 2a2c20ce. Residual is the Level-2 ledger's job.
type: project
relates_to: [session_2026-07-17_gate-hardening-codex-findings.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: test-figma-optout-block.sh 148/0 ALL PASS, test-validation-guards.sh 70/70, test-task-loop-justify-mandates.sh ALL PASS; 8 real codex-review.py verdicts (exit 0) folded
confidence: high
---

Commit: **2a2c20ce** on improv/main (parent 482eac49). Files: claude/hooks/bash-guard.sh, content-guard.sh, test-figma-optout-block.sh.

## What was wrong
The 2026-07-17 no-opt-out hardening (482eac49) used a literal-substring grep +
per-command allow/deny lists. A real Codex review ([[session_2026-07-17_gate-hardening-codex-findings.md]])
showed it leaked whole classes of bypass AND over-blocked. This session folds that
review and SEVEN more rounds it surfaced.

## The scanner (bash-guard `_figma_marker_verdict`)
SELF-CONTAINED quote/escape/heredoc-aware parser - deliberately does NOT touch the
shared command_slices/redirect_targets/_slice_scan/CMD_CODE the other gates use, so
those gates are provably unaffected (validation-guards 70/70 on the final code).
Core match = PATH-equality OR realpath/os.path.samefile against
$ROOT/.figma-fidelity.pending (ROOT = `git rev-parse --show-toplevel || pwd`,
identical to arm/stop hooks), never bare basename. Runs only when a build is armed
(marker present) OR the command contains "figma-fidelity" - so the common Bash call
stays cheap. $-unresolvable / glob / recursive-root targets are denied
conservatively ONLY while armed (varmap seeded from os.environ so $TMPDIR/x etc.
resolve and are not collateral).

## Rounds folded (each a real codex-review.py verdict, exit 0)
1. redirect forms (>|, quoted, $PWD, heredoc), shell indirection (var/quote-concat/
   backslash/cmd-subst), symlink+hardlink via samefile, unlisted mutators; sed-n +
   near-miss FPs.
2. path-equality scoping (fixed other-repo + cp-source FPs), brace+glob expansion,
   recursive-delete/search-root trees, git clean -f, zsh >!/>>!, perl-pi/sort-o/
   sponge/awk-inplace.
3. >&file redirect (vs >&1 dupe), env -S, xargs-fed mutator pipelines, find -name as
   find-glob + all -o predicates, git clean -n-f dry FP, rsync value-flags + --exclude.
4. editors (vim/vi/view/nano/pico/emacs/sqlite3), renamers (rename/mmv).
5. find -exec cp/install/ln on {}, cp bundled -al/-as, tar --remove-files/zip -m,
   xargs producer-restriction FP fix, find negation FP fix.
6. perl -0777pi numeric bundle, zip -d FP (archive entry, not fs marker), find -o
   Boolean conservative block, heredoc-into-xargs.
7. eval full dequoted payload, bash -c escaped word, rsync --delete-excluded, printf
   \n producer split, find root-scoping FP.
8. var-holds-command field-split (S='rm marker'; $S / eval $S / bash -c $S), bash -c
   only the -c arg (positional FP), find leading global options -H/-L/-P (roots FP).

## Bugs I introduced and caught mid-way (self-analysis)
- macOS /var -> /private/var: bash pwd yields /var, Python getcwd() the resolved
  form, so normpath path-equality silently failed -> switched both guards to realpath.
- `{` `}` were in SEPS, so split_segments broke brace-expansion tokens apart -> made
  `{`/`}` separators only when standalone (group command), not attached (brace).
- v7 introduced two FPs (bash-c positional args, find -H losing roots) that codex v8
  caught. Lesson: a fix can regress; the next cross-model pass is the safety net.

## Why EIGHT rounds (the real lesson)
My same-shaped tests only ever exercised the vectors I imagined, so each round
passed its own tests while leaking a class I had not pictured (globs, recursive
deletes, aliases, editors, var-commands, ...). That is exactly the failure mode
mandate #8's cross-model gate exists to catch: a different MODEL imagines the
classes the producer cannot. Convergence was asymptotic, never "clean" - which
confirms the Level-1/Level-2 split the findings beat drew from the start.

## Accepted residual -> Level 2 (task: tamper-evident signed arm ledger)
Unresolvable from command text, by design: arbitrary interpreter INLINE writers
(python/perl/ruby/node/php/lua -e/-c), archive EXTRACTION overwriting from contents
without naming the marker, broad nukes that never name the marker, and full find
Boolean-expression evaluation beyond the conservative -o block. "Cannot opt out"
needs arm/clear authority outside the agent's tool reach - the Level-2 ledger.

## Files
- claude/hooks/bash-guard.sh (new _figma_marker_verdict scanner + gate rewrite)
- claude/hooks/content-guard.sh (path-equality/samefile marker match)
- claude/hooks/test-figma-optout-block.sh (~150 cases, both directions, armed/unarmed, known-gap section)

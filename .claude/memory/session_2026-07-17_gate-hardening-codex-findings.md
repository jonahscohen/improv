---
name: Codex review of the fidelity-gate opt-out hardening - it is NOT airtight (bypasses beyond the one I flagged)
description: Ran a real Codex review (codex-review.py, 274s, exit 0) over 482eac49 (the no-opt-out gate hardening). My own 13/13 falsification only covered the LITERAL vectors, so it passed while missing whole classes of bypass. Codex found: redirect forms (>|, quoted target, $PWD prefix, heredoc), shell indirection (variable, quote-concat, backslash-escape, command-substitution defeats the literal-string match), symlink/hardlink aliasing (both guards check the submitted name, not the resolved target), and uncovered mutators (unlink, install, find -delete, ed, ex). Plus two false-positives: read-only `sed -n` on the marker is wrongly blocked, and substring matching wrongly blocks different files (foo.figma-fidelity.pending, .figma-fidelity.pending.bak). CONCLUSION: command-text guards cannot make opt-out truly impossible; "cannot opt out" needs an architectural mechanism (arm/clear authority outside the agent's tool reach).
type: decision
relates_to: [session_2026-07-18_fidelity-gate-no-optout.md, session_2026-07-18_gate-hardening-fold-8-codex-rounds.md]
supersedes:
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: codex-review.py real Codex verdict, exit 0, 274.6s, over `git diff 482eac49~1 482eac49 -- bash-guard.sh content-guard.sh figma-fidelity-arm.sh`.
confidence: high
---

## What Codex found (ranked)

HIGH - bypasses that still clear/edit .figma-fidelity.pending:
1. Redirect forms the CMD_CODE regex misses: `printf x >| marker` (noclobber override),
   `> "marker"` (quoted), `> "$PWD/marker"`, heredoc `cat <<EOF > marker`.
2. Shell indirection defeats literal-string matching: `p=marker; rm "$p"`,
   `rm .figma-fidelity'.pending'` (quote concat), `rm .figma-fidelity\.pending`
   (backslash), `> "$(printf %s .figma-fidelity)$(printf %s .pending)"`.
3. Symlink/hardlink alias: `ln -s marker p; printf x > p` (and `ln`+`truncate`, and
   Edit with file_path a symlink to the marker). Both guards check the SUBMITTED
   name, never the resolved target.
4. Uncovered mutators beyond the accepted python/perl/tee/dd/cp gap: `unlink`,
   `install /dev/null marker`, `find . -name marker -delete`, `ed`, `ex`.

MEDIUM - false positives (block legit ops):
5. `sed -n '1,5p' marker` (read-only) is wrongly blocked; only `sed -i*` should be.
6. Substring match blocks different files: `rm /tmp/foo.figma-fidelity.pending`,
   `printf x > .figma-fidelity.pending.bak`.

CONFIRMED GOOD: content-guard basename match robust to dir prefixes + Windows sep;
no apostrophe introduced into the single-quoted python blob; .json/.measuring writes
and cat/grep reads all still allowed.

## The real conclusion (Level 1 vs Level 2)

- LEVEL 1 (fold Codex's findings): replace literal-substring + command allow/deny lists
  with token normalization (strip quotes/escapes), realpath/os.path.samefile resolution
  against $ROOT/.figma-fidelity.pending, the quote-aware redirect_targets() path (cover
  >|, quoted, heredoc), expanded mutator coverage, and the sed -i-only + basename-exact
  fixes. Raises the bar a LOT. Still cannot catch dynamic construction / scripting writes
  100% - a shell can always build the path at runtime.
- LEVEL 2 (architectural): the ONLY way to reach "cannot opt out" is to move the
  arm/clear authority OUT of the agent's tool reach - e.g. the Stop gate derives armed
  nodes from a tamper-evident source the agent's Bash/Write cannot mutate, or the marker
  is owned/append-only outside the workspace. Guards on command text are inherently
  best-effort.

## Why my v1 passed its own tests but has holes
test-figma-optout-block.sh only exercised the LITERAL vectors (rm marker, grep -v then
mv, sed -i, truncate, redirect). It never tried variable indirection, quoting, symlinks,
or unlisted mutators - so 13/13 green while the guard leaked. The cross-model review
caught exactly the class my same-shaped tests were blind to (the point of mandate #8).

## Files
- .claude/memory/session_2026-07-17_gate-hardening-codex-findings.md (this beat)

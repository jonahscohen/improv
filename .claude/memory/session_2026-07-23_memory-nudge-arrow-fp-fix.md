---
name: memory-nudge.sh unquoted-arrow false positive fixed (last hook in the class)
description: memory-nudge false-set .memory-dirty on an unquoted `->` arrow in a for/while compound; fixed with the same dash-guarded redirect used in verify-before-done. Audit confirmed bash-guard and multiple-choice hooks are NOT affected
type: project
relates_to: [session_2026-07-18_verify-hook-dequoted-triggers-fp-fix.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (6 suites green; test-nudge-debounce 51->58 with +7 rows) + probe (unquoted arrow clean, recall intact incl. no-space appends) + Codex review (1 High folded)
confidence: high
---

Jonah, 2026-07-23: "fix whatever aint workin!" - the last-flagged item was that memory-nudge.sh
shares the write-detection false-positive class fixed in verify-before-done ([[session_2026-07-18_verify-hook-dequoted-triggers-fp-fix]]).

## Audit (reproduce first) - which hooks actually have the arrow FP?

Probed every hook that does write/redirect detection:
- **verify-before-done.sh** - already fixed 2026-07-18 (dash-guarded `_has_redirect`).
- **memory-nudge.sh** - HAD a residual FP. It de-quotes (cmd_bare, T-0033), so a QUOTED arrow
  (`echo "$h -> x"`) was already safe, but its writes list still carried a bare `"> "` /
  `">>"` token, so an UNQUOTED arrow in a for/while/printf compound (not in the read_only
  prefix list) false-set `.memory-dirty`. Probe: `for h in a.sh b.sh; do echo $h -> x; done`
  -> DIRTY (FP); `while read l; do echo $l -> done; done` -> DIRTY (FP). Quoted arrows clean.
- **bash-guard.sh** - NOT affected. It uses a real shell-token walker (CMD_CODE de-quote +
  `redirect_targets`/`command_slices`) that distinguishes `->` from a `>` redirect and even
  treats `>` inside `[[ ]]` as a comparison. Probe of the arrow command -> ALLOW. Clean.
- **multiple-choice-{enforce,detect-stop}.sh** - NOT affected. Their `"> "` strips markdown
  BLOCKQUOTES from assistant output; nothing to do with shell writes.

So memory-nudge was the last hook carrying the actual FP.

## The fix (consistent with verify-before-done)

Removed `"> "` and `">>"` from the `writes` list; added
`_has_redirect = re.search(r"(?<!-)>>? ", cmd_scan)` and folded it into `is_write`. A real
redirect operator is never preceded by a dash (drops the `->` arrow, quoted or not), and the
trailing space keeps fd-dup `2>&1` from matching - exactly as the old `"> "` (space) token did,
so no new FP. Runs on `cmd_scan`, so the existing `/dev/null` and `tee /dev/null` strips still
apply.

## Verification

- Probe after fix: unquoted + quoted arrows CLEAN; recall intact - `sed -i`, `cp`, `rm`,
  `node gen.js >> build.log` (spaced append) all DIRTY; `beats.py verify > /dev/null 2>&1`
  CLEAN (not a write, correctly).
- test-nudge-debounce.sh 51 -> 58 (+7 rows: 2 unquoted-arrow skips negative-controlled, 5
  recall/no-FP guards incl. no-space >>appends and a 2>&1 no-FP). All 6 hook suites green.
- Codex review run on the diff (recall / regex / /dev/null-interaction focus).

## Codex review - 1 High folded

First cut used `(?<!-)>>? ` (space-required, copied from verify-before-done). Codex caught a
recall regression: memory-nudge`s OLD writes list had a BARE `">>"` (no trailing space), so
no-space appends - `printf x >>src/generated.ts`, `node gen.js 2>>build.log` - dirtied before
and my space-required regex dropped them (under-arming, the dangerous direction). (verify-
before-done was NOT affected: its old token was `">> "` WITH a space, so it never caught no-
space appends - this fold is memory-nudge-only.) Folded Codex`s suggested shape
`(?<!-)(?:> |>>)`: `> ` stays space-required (dodges fd-dup 2>&1), `>>` matches append with
space OPTIONAL (restores the old bare-`">>"` recall), and both stay dash-guarded (no arrow).
Pinned 3 more rows: two no-space-append recall guards + a 2>&1 no-FP guard. Probe confirms
`>>gen.ts` / `2>>build.log` DIRTY, `2>&1` / arrow / /dev/null clean.

## Known pre-existing gap (unchanged, out of scope)

`echo x > file.css` / `cat body > file.scss` still do NOT dirty - `echo`/`cat` are read_only
PREFIXES that short-circuit before the write check. Identical pre-existing false negative to
verify-before-done; catching it needs reordering redirect detection ahead of the read-only
skip, a separate change with its own FP risk. Left as-is.

## Files touched

- claude/hooks/memory-nudge.sh (dash-guarded `_has_redirect`; `"> "`/`">>"` out of the writes list)
- claude/hooks/test-nudge-debounce.sh (+4 memory-nudge arrow-FP / recall-guard rows)

---
name: statusline two-line layout and single-jq rewrite
description: Line 1 is project/dir/branch with no separators, line 2 is "model <name>, <effort>" plus green usage percentages; script restructured to one jq pass, 48ms vs 83ms baseline
type: project
supersedes: session_2026-07-27_statusline-model-segment.md
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: 18 replayed payload fixtures, differential basename test, control-byte leak check with negative control, shellcheck, manifest test, 3 Codex review rounds
confidence: high
---

Jonah rearranged the status bar he had just asked for:

    line 1: project <name>  dir <name>  branch <name> +94 -69
    line 2: model Opus 5, xhigh  usage ctx 10%  session 1%  week 48%

- Line 1 keeps project/dir/branch and drops every gray `|` separator (two spaces now).
- Model moved to line 2 and lost the `(1M context)` parenthetical - `Opus 5` only.
- Effort (`.effort.level`, e.g. `xhigh`) follows the model name after a comma.
- Usage lost the `make_bar` blocks entirely; the percentages themselves are now green.

Separator removal was specified for line 1 only. It was applied to line 2 as well, so
the two lines share one spacing rule instead of a separator-free line above a
pipe-heavy one. One-line revert if that reads wrong.

## The rewrite, and why it was not optional

The straightforward version of this change (add two jq calls, add an `esc` helper with
`tr`) measured **116ms per render against an 83ms baseline** - a 40% slowdown on a
script Claude Code runs on every status repaint. That is a real cost on the user's
machine, so the script was restructured around **one jq pass** that emits every
payload-derived field at once.

**How:** a single `jq -r` program emits 8 fields plus a sentinel, joined with U+001F.
The shell splits on that separator with `IFS`/`set -f`/`set --`. Gone: 7 extra jq
processes, 2 `basename` forks, the parenthetical-stripping `sed`, and every `tr` fork.
`base` (path basename) and the parenthetical strip now happen inside jq.

**Result: 48ms per render, down from the 83ms committed baseline.** Faster than what
it replaced, not just faster than the slow intermediate.

Sanitising rules, both inside jq:
- `clean` drops real control bytes. `jq -r` decodes JSON escape sequences for ESC and
  newline before the shell ever sees them, so an unsanitised session name could inject
  ANSI colour or split the statusline across extra lines.
- `dbs` doubles backslashes, because the output goes through `printf '%b'`, which reads
  `\c` as "stop output" and would truncate the line.
- `cwd` is cleaned but NOT backslash-doubled: it is a real path handed to `git`, not text.

## Codex findings, all folded (3 rounds, 6 defects)

Round 1 (2 defects, both reproduced before patching):
1. `model_name`/`effort` reached `printf '%b'` unescaped. Repro: `display_name` of
   `Opus \c5` truncated the entire line at the escape.
2. `printf '%.0f'` on a non-numeric percentage printed a diagnostic to stderr and
   rendered a misleading `0%`. Repro: `"used_percentage": "abc"`. Fixed by moving
   rounding into jq behind the `numbers` filter, which drops non-numbers.

Round 2 (3 defects):
3. Backslash-doubling alone was not enough - `jq -r` decodes the JSON escapes for ESC and newline into real
   bytes, so ANSI injection and line-splitting still worked. Fixed by `clean`.
4. **Pre-existing precedence bug**, not introduced here: `[ -n "$cwd" ] && [ -d ... ] || git -C "$cwd"`
   parses as `(A && B) || C`, so an empty cwd fell through to `git -C ""`, which reports
   whatever directory the statusline process happens to be in. Fixed with braces.
5. Wrong parent types (`"model": true`) put jq diagnostics on stderr every render. Fixed
   with `?`-guarded lookups throughout.

Round 3 (1 defect):
6. The new jq `base` mapped `/` to empty where `basename` returns `/`. Fixed, then
   proven with a differential test against POSIX `basename` on 15 path shapes.

Codex confirmed no defect in the `IFS`/`set -f`/`set --` protocol, U+001F delimiter
safety, or shell re-expansion. Word splitting never re-scans for command substitution,
so payload text cannot execute - proven with a `$(whoami)` / backtick fixture.

## Self-analysis: two failures worth naming

**I shipped a perf regression I did not measure until prompted by the review.** The
`esc` helper felt cheap in isolation (one small function), so I never asked what it cost
per render. It cost 5 subshells and up to 5 `tr` forks on a hot path. The failure mode
was reasoning about a change's *complexity* instead of its *frequency*. On anything that
runs on a repaint loop, measure before and after - the baseline comparison is what turned
"feels fine" into a 40% number.

**My first negative control was blind.** The leak check stripped `\033[...m` colour codes
before scanning for control bytes - and the injected payload WAS `\033[31m`, so the check
"passed" on the unsanitised old script. A control that cannot fail proves nothing. Fixed
by injecting BEL and backspace instead, which the strip pattern cannot mask; the old
script then leaked `07 08` as it should, and the new one stayed clean.

## Verification

- `sh -n` clean, `shellcheck -s sh` clean.
- 18 payload fixtures replayed: real capture, `{}`, wrong parent types, missing
  model/effort/usage, id fallback, `$(whoami)`+backtick injection, `\c` truncation,
  embedded newline, ANSI ESC, BEL+backspace, non-numeric percentage, fractional
  rounding (10.6 -> 11, 0.4 -> 0, 47.5 -> 48), trailing-slash cwd, mid-string parenthetical.
- Differential test: dir segment matches POSIX `basename` on 15 path shapes.
- Control-byte leak check passes on this version and correctly FAILS on the old one.
- `bash claude/hooks/test-installer-manifest.sh` -> PASS.
- Timing: 48.0ms vs 82.7ms baseline, 50 renders each.

Payload keys still unused by the script: `thinking`, `fast_mode`, `cost`, `version`,
`output_style`, `exceeds_200k_tokens`.

## Codex gate closure (post-commit addendum)

The 4th confirmatory pass on the `base` fix died without a verdict: MCP transport errors
against 127.0.0.1:29979 followed by SIGTERM (exit 144). Retried lean per the codex-doctor
protocol. The retry returned two items, BOTH non-applicable by design - artifacts of a lean
prompt that asked for exact POSIX `basename` parity without the surrounding context:

1. "Deletes control characters before basename processing." That IS the `clean` sanitiser,
   the entire defence against ANSI/newline injection into the statusline. Intended.
2. "No suffix operand support." The statusline only ever takes a one-argument basename;
   `basename <path> <suffix>` is never called. Not reachable.

Lesson: a leaner retry prompt is cheaper but can strip the context that made the earlier
passes accurate. Rounds 1-3 (full diff + verified-context) produced 6 real defects; the lean
round produced 2 false ones. Trim the prose, not the context.

Gate closed on rounds 1-3 plus the differential basename test, which is stronger evidence
for this one-line change than a review pass.

## Files touched

- `claude/statusline-command.sh`

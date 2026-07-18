---
name: verify-before-done Bash-arm false positive fixed (the -> arrow read as a redirect)
description: The hook armed a screenshot demand on read-only/prose commands because a `->` arrow matched the `> ` redirect indicator; fixed by dash-guarding the redirect indicator, after a Codex review rejected an over-engineered de-quote attempt that broke recall
type: project
relates_to: [session_2026-07-18_verify-flag-session-keyed-reigned-in.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (6 suites green; test-verify-before-done 93->102 with +9 negative-controlled rows) + probe (every Codex-flagged case) + Codex review folded
confidence: high
---

Jonah, 2026-07-18: after the session-key fix ([[session_2026-07-18_verify-flag-session-keyed-reigned-in]]) I flagged a second smell - the hook fired false "take a screenshot" demands on my own `grep`/`sed`/`for` diagnostic commands. Jonah: "let's work on this one."

## The defect (reproduced first, per debug protocol)

`verify-before-done.sh` Bash-arm branch used a naive substring `file_write_indicators =
[..., "> ", ">> ", ...]`. `"> "` (redirect) is a substring of `-> ` (an arrow). A single
`echo "a -> b.tsx"` escaped only because `echo`/`grep`/`cat`/`diff` are read-only PREFIXES
that short-circuit; a `for`/`while`/`printf` compound is NOT in that prefix list, so
`for h in a.sh b.sh; do echo "$h -> x"; done` reached the arm branch, matched `> ` via the
arrow, found `.sh` tokens, and ARMED. Probe confirmed ARMED[code] before the fix.

## The fix (minimal - after a Codex-driven pivot)

Refine ONLY the redirect indicator; a real redirect operator is never preceded by a dash:
`_has_redirect(cmd) = re.search(r"(?<!-)>>? ", cmd)`. Write VERBS (`cp `, `mv `, `tee `,
`sed -i`) stay SUBSTRING matches on the raw command, and deploy indicators are unchanged.

- Kills the arrow FP: `-> ` is a `> ` preceded by `-` -> excluded.
- Keeps every real redirect the old code caught: `> file`, `2> file`, `>> file` (all have
  `> `/">> " not preceded by `-`).
- Still ignores fd-dup `2>&1` (no trailing space - same as the old " > " requirement), so it
  does NOT introduce that as a new false positive.

## Why NOT the de-quote approach I tried first (the important part)

My FIRST attempt de-quoted the command (stripped quoted spans) and matched write verbs in
COMMAND POSITION. It passed my own tests. The **Codex cross-model review caught 4 findings,
all in the UNDER-ARMING direction** - the dangerous one the gate explicitly forbids
([[feedback_hooks_prefer_false_positives]]):
- HIGH: de-quoting strips executable quotes, so `bash -lc "cp ..."` and `sh -c "sed -i ..."`
  under-armed (their real write is inside the quotes).
- HIGH: `(?<!-)>` (no space) suppressed unquoted real `-> file` redirects.
- MEDIUM: command-position anchoring dropped `\cp`, `gsed -i` (escaped / g-prefixed verbs the
  old substring caught).
- MEDIUM: bare `>` (no space) newly matched `2>&1` / `>(procsub)` - a NEW false positive.

The right response to a review that shows your fix trades one FP for several FNs is to
SIMPLIFY, not to patch each FN. The minimal dash-guarded redirect fixes Jonah's FP with zero
recall loss and makes every Codex finding moot. Re-probed each Codex example after the pivot:
`bash -lc "cp ..."` ARM, `gsed -i` ARM, `sh -c 'sed -i ...'` ARM, real `> code-file` ARM;
`2>&1` skip, arrow-prose skip. This is receiving-code-review working: the review stopped me
shipping recall regressions.

## Accepted residual (noted, not fixed)

- Unquoted `mytool --x -> out.css` (an arrow that bash actually treats as `- >out.css`, a real
  redirect) now SKIPS. Contrived and vanishingly rare; distinguishing it from prose needs
  quote-awareness that costs the `bash -c` recall above. Accepted.
- `cat body > src/theme.scss` / `echo x > app.css` skip because `cat`/`echo` are read-only
  PREFIXES that short-circuit before the arm branch. PRE-EXISTING false negative, out of scope.

## Verification

- Probe: arrow FP classes skip; all real writes/builds arm incl. quoted-filename writes,
  bash -c wrappers, gsed, and real `>` redirects to code files.
- test-verify-before-done.sh 93 -> 102 (+9 rows: arrow-skip x4 incl. 2>&1, recall guards x5
  incl. bash -lc / gsed / real-redirect). All 6 suites green - no recall regression.
- Codex review folded (4 findings -> simplified design).

## Self-analysis

1. I broke the LIVE hook TWICE with the same class: a literal single-quote inside the
   `python3 -c '...'` block (`_vre.sub('"..."', ' ', cmd)`) closed the shell string (syntax
   error). The file already builds every quote via chr() for this exact reason. Pinned:
   "am I inside a python3 -c single-quoted block?" is now a pre-write check; build both quote
   chars via chr() in this file.
2. I over-engineered the first fix (de-quote + command-position) and it introduced recall
   regressions. Root cause: I optimized for killing MORE false positives than reported instead
   of the minimal change for the ONE reported FP, and forgot the gate's prefer-FP stance means
   an FN is worse than an FP. The review caught it; the lesson is to reach for the minimal
   surgical change first and let prefer-FP bias the design.

## Follow-up found: memory-nudge.sh has the SAME false-positive class

While committing, the `.memory-dirty.<session>` gate false-blocked a beats-only commit. Root
cause: my PROBE commands (`armed 'sed -i s/a/b/ src/app.css'`, `... 'cp x.tsx src/App.tsx'`)
carry write-command strings as ARGS, and `memory-nudge.sh` uses the same naive substring
matching this fix just removed from verify-before-done - so it flagged a project-file "write"
that never happened and set memory-dirty after my last real beat write. All real work WAS
beated; the flag was a false set. Logged as a separate follow-up: memory-nudge.sh wants the
same dash-guarded-redirect / command-position treatment (or at least to ignore its own probe-
string args). Not fixed here to keep this unit scoped to the verify hook.

## Files touched

- claude/hooks/verify-before-done.sh (dash-guarded `_has_redirect`; write verbs stay substrings)
- claude/hooks/test-verify-before-done.sh (+9 arrow-FP / recall-guard rows)

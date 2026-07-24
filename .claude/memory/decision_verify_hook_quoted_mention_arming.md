---
name: verify-before-done keeps arming on a quoted MENTION of a write verb (not fixed, deliberately)
description: A Bash command that only mentions a write verb inside a quoted argument still arms the flag; proven unfixable at the command-text level because an inert data argument and an evaled command argument are the same shape, so the fix was declined rather than trade one FP for false negatives
type: decision
relates_to: [session_2026-07-18_verify-hook-dequoted-triggers-fp-fix.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: Mac
source: session
verified: reproduced live (4 FP shapes) + rule simulated against a 15-case battery + undecidability demonstrated with a matched pair
confidence: high
---

**Decision: do NOT change how write verbs are detected. The quoted-mention false positive stays.**

Jonah approved this unit on 2026-07-23 after the lead session was bitten twice in one day: a probe
harness whose ARGUMENTS were strings like `sed -i s/a/b/ src/app.css` armed the flag "visual" and
blocked Stop with a screenshot demand, while the working tree held zero visual files. It is the
closest match to Jonah original wording - "research/refactor sessions that merely MENTION visual
filenames in shell commands." The unit brief explicitly allowed declining, and declining is correct.

## Reproduced first (live, before any design)

All four mention-shapes arm "visual" today, writing nothing:

| command | armed |
|---|---|
| `probe 'sed -i s/a/b/ src/app.css'` | visual |
| `probe 'tee src/App.tsx notes.txt'` | visual |
| `bash /tmp/probe.sh 'cp a.tsx b.tsx'` | visual |
| `assert_kind "row" visual "sed -i s/a/b/ src/app.css"` | visual |

Two rows constrain any fix, because they are correct TODAY and must stay correct:
`cp 'a.css' 'b.css'` -> visual (verb unquoted, FILENAMES quoted) and
`sed -i 's/x/y/' src/foo.ts` -> code (verb unquoted, SCRIPT quoted). So a wholesale de-quote is
already ruled out; the only candidate rule is "ignore a write verb that lives ONLY inside an inert
quoted span."

## Alternatives considered

- **Option A - de-quote the command (strip quoted spans) before matching verbs:** rejected, and
  already rejected once. A Codex review on 2026-07-18 killed exactly this: it under-armed
  `bash -lc "cp ..."` and `sh -c 'sed -i ...'`, where the real write genuinely lives inside the
  quotes. That is why write verbs are SUBSTRING matches today. Re-proposing it would repeat a
  known-bad trade.
- **Option B - treat a quoted span as executable only after a recognised shell-invoking wrapper**
  (bash/sh/zsh/env with -c, xargs, eval, ssh), inert otherwise - the rule proposed in the unit
  brief: rejected on evidence. Simulated against a 15-case battery: it fixes 3/3 of the false
  positives but introduces **8 false negatives** - `watch 'cp ...'`, `parallel 'cp ...'`,
  `tmux send-keys 'cp ...'`, `docker run img 'cp ...'`, `su user 'cp ...'`, `nohup runner 'tee ...'`,
  `make deploy ARGS='cp ...'`, and `./deploy.sh 'cp theme.css dist/'`. False negatives are the
  direction [[feedback_hooks_prefer_false_positives]] forbids outright.
- **Option C - extend the wrapper list until the false negatives disappear:** rejected, because it
  provably cannot reach zero. See the undecidability proof below. Extending the list also
  re-broadens the false positive, since matching any wrapper token reverts a command to today
  arming behaviour - with the longest reasonable list the ORIGINAL false positive is no longer
  fixed at all, so the change buys nothing.

## Why this one (the undecidability proof)

These two commands are the same shape:

    bash /tmp/probe.sh  'cp a.tsx b.tsx'     # argument is inert DATA  -> must NOT arm
    bash /tmp/runner.sh 'cp a.tsx b.tsx'     # argument is EVALed      -> MUST arm

The only textual difference is the script NAME. Whether the callee treats its argument as data or
runs `eval "$1"` is a property of the callee body, not of the command text, so no command-text rule
can separate them - deciding it would require the hook to READ and understand the target script.
Any rule that stops arming the first necessarily stops arming the second.

This is not hypothetical: `eval "$1"` appears in this repo at
`claude/hooks/test-component-browser.sh:976`.

So the trade is exactly the one that was already litigated and lost on 2026-07-18: one visible,
recoverable false positive exchanged for silent false negatives. The false positive announces
itself immediately (a screenshot demand you can see) and already has a sanctioned escape hatch -
`verify-manual.sh` clears the flag when the user says "verified". A false negative is silent: a
real UI change gets reported done with no screenshot, which is the entire failure this gate exists
to prevent.

The population hurt by the false positive is also narrow and self-aware: it is almost entirely
hook and test-harness development, where the person hitting it is already inside this code and
recognises it on sight. The population at risk from the false negatives is open-ended.

## Safer alternative for a FUTURE unit (proposed, NOT built)

The lead actual pain was the STOP gate demanding a screenshot when the working tree contained zero
visual files (proven with git status before Jonah overrode). That is fixable WITHOUT touching
arming at all: have `verify-before-done-stop.sh` corroborate a "visual" flag against the working
tree, and downgrade the demand only when git reports no modified or untracked visual file.

Why that shape is safer: it adds a second piece of evidence rather than removing the first, and
every unknown defaults to blocking - not a git repo, unreadable status, any doubt -> keep blocking.
The arm path, and therefore all visual recall, is untouched. Deliberately not implemented here: it
is a different file and a different unit, and it needs its own reproduction and Codex round.

## Revisit when

- The hook gains the ability to resolve what a called script does (it will not - out of scope), OR
- the false positive stops being confined to harness/hook development and starts hitting ordinary
  feature work, OR
- the Stop-gate corroboration above is built, which removes the pain without the recall risk and
  makes this decision moot.

## Files touched

None. This unit deliberately ships no code change. The reproduction and the rule simulation were
run as throwaway probes.

---
name: Hooks repairs VERIFIED both directions - and the lead's own probe was wrong twice before it was right
description: codex-failure-watcher and route-intent both correct in both directions on the lead's own probes. Recording the lead's probe defect, because it is the same class of error the session has been hunting all day.
type: project
relates_to: [session_2026-07-28_codex-vet-wave-verdicts.md, session_2026-07-28_codex-repairs-hooks.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: 11 probes against the live hooks, checking the hookSpecificOutput marker rather than output emptiness
confidence: high
---

# Both hooks verified, and a lesson about the verifier (2026-07-28)

## Final state, lead-measured

`codex-failure-watcher`, all against a real "model is at capacity" response:

| must FIRE | result | must stay SILENT | result |
|---|---|---|---|
| `codex exec` | fires | `echo "x \| codex exec now"` | silent |
| `sudo codex exec` | fires | `grep -E "beats\|codex exec"` | silent |
| `env FOO=1 codex exec` | fires | `true # ; codex exec` | silent |
| `nohup codex exec` | fires | `command -v codex` | silent |
| `bash -c "codex exec"` | fires | `ls -la` | silent |

Plus the case that matters most for false alarms: a real `codex exec` whose output is CLEAN
stays silent.

`route-intent`: both deliberation prompts that routed this morning are now silent, including
"Do NOT proceed; refactor the router...", while a genuine imperative still routes.

## THE LEAD'S OWN PROBE WAS BROKEN, TWICE

First probe run: I tested `[ -n "$output" ]`, treating ANY non-empty stdout as a fire. The
repaired hook prints `{}` for "no finding", which is non-empty. So every case read as FIRING,
including `ls -la`, and I was seconds away from reporting a catastrophic regression to Jonah
that did not exist.

The tell that saved it was a CONTROL I almost did not run: a real `codex exec` with clean
output also "fired". That is impossible for any correct hook, which meant the fault had to be
in the probe rather than the subject. Re-running against the actual `hookSpecificOutput`
marker gave 11 of 11 correct.

The earlier version of the same probe worked only because the OLD hook printed nothing for
silence. The contract changed underneath a probe I reused without re-reading it.

**This is the session's own lesson, committed by the person enforcing it.** Twice today I
verified with probes chosen to match what I expected, and both times the probe rather than
the code was wrong: the `h5`-before-`h1` fixture that was an ascent not a skip, and now an
emptiness test against a hook that answers `{}`. When a result looks extreme in either
direction - everything fires, or nothing does - suspect the instrument before the subject.

## What the repair agent did that earned this

It replaced the regex with a real quote-aware shell tokenizer, on the grounds that "requires
a whole command token" is unachievable without tokenizing - which is why the previous
one-line fix only ever repaired the exact string in its own commit message. Codex then found
16 further defects in that tokenizer (arithmetic substitution, arbitrary heredoc delimiters,
here-strings, leading fd redirects, `eval` joining all args, `find -exec sh -c`, `env -S`,
`exec -a`, recursion depth) and 4 in its own fixes, including an over-broad skill marker that
would have SILENCED a genuine question.

## The numbers ruling it made, and why it is right

It committed a measurement harness for what is mechanically derivable (fire counts and the
envelope/genuine split over 4021 real prompts and 19.5k Bash calls, with the classifying
predicate committed so it can be argued with), and STRUCK what is not - the recall figures
that depend on a labelled set the agent itself chose and never committed. A reproducible
pipeline that still rests on one agent's private labels is a claim with a script attached.

The harness immediately found three defects reasoning had missed, including that
`command -v codex` is the most common codex mention in real traffic, and that route-intent
was spending 11 of its 22 routes on envelopes.

## Files touched

- none by the lead (verification only)

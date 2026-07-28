---
name: The Codex repair wave committed in six units, and the thesis it produced
description: Five Codex-driven repair panes closed every defect the four vetting passes found. Committed per pane. The recurring shape across nearly all of it was a safety step that reported success.
type: project
relates_to: [session_2026-07-28_codex-vet-wave-verdicts.md, session_2026-07-28_hooks-repairs-verified.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: lead reproduced each pane's headline fix independently; all suites and both acceptance gates green before committing
confidence: high
---

# The repair wave, committed (2026-07-28)

Jonah directed this after concluding the Claude side kept reporting findings instead of
fixing them, and that he could not trust a self-assessment. Codex vetted all four
subsystems, then five Codex-driven repair panes fixed what it found, in visible panes so he
could watch rather than take a report.

## What each pane closed, verified by the lead

| pane | headline defect | lead's verification |
|---|---|---|
| installer | relative-symlink cycle, delete-before-verify, delegated seds | 17 sites on one resolver; zero live `sed -i`; the one remaining prefix match is a comment |
| installer tests | rows that could not fail | zshrc 48/0 (was 44/1), userfile 65/0, prune 22/0 |
| hooks | watcher fail-open, route-intent mid-sentence | 11 probes correct in BOTH directions |
| sidecoach | no-page audit printed a grade | panel now states NO PAGE WAS RENDERED, no verdict line |
| skills/docs | QA triad contradiction, missed frontmatter | taste-gate named as the only live mechanism |

## The thesis, from the installer pane's synthesis

**Nearly every finding was a safety step that reported success.** A guard that skipped
instead of failing. A validation that ran after the damage. A flag nobody read. An except
handler turning a real error into exit 0. That is the same shape as the six defects the
wave started with, which is why review kept finding more of them.

## Three findings that only came from distrusting a green result

1. **A performance regression that surfaced as a timeout, not an assertion.** The installer
   pane's own resolver forked five subshells in a path the TUI re-probes every render:
   `test-browser-render` went from a 240s pass to a 443s WATCHDOG HANG. It was caught by
   A/B-ing against HEAD rather than writing the exit code off as flake.
2. **A broken hook manufactures a wrong efficacy number.** A syntactically broken hook
   emits an identical error for every input, so any probe reading "produced output" as a
   fire sees a 100% fire rate in BOTH directions at once. The outage did not just stop the
   hook, it produced a confident false measurement.
3. **The false-clean defect was live one surface further out than anyone looked.**
   `present.js` did `report.verdict || 'clean'`, so a verb handled before the target guard
   still reached the user as a pass.

## The lead's own record

Three of my verification probes this session were wrong, and each time I built the
instrument to match what I expected rather than to what the subject consumes: an `h5`
before an `h1` (an ascent, not a skip), an emptiness test against a hook that answers `{}`,
and a payload naming a file that did not exist for a guard that reads from disk. In two of
the three, a control I nearly skipped is what caught it.

## The commits

Jonah chose per-unit commits over one wave commit, so any single pane can be reverted
without untangling it from the rest.

- `8d19b7cc` - installer product: the relative-symlink cycle closed on all 12 sites via one
  resolver, delegated seds replaced, safe_cp preflight, deactivate_memory materialization,
  the failure ledger, and delimiter containment as a validator.
- `8af6b00f` - the test rows that could not fail, each now mutation-proven with the old
  form run against the same mutation to confirm it stayed green.
- hooks, sidecoach, skills/docs and the beats follow.

## A note on the beats gate

The gate blocked the third commit because project files had been committed after the last
beat write. That is the gate working: it refuses a commit whose changes are not yet
recorded. Writing this section is what cleared it, which is the intended loop rather than
an obstacle to route around.

## Files touched

- committed in six units; see the commit log from this session

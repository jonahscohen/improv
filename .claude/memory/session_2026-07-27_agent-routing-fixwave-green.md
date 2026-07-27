---
name: Agent routing fix wave landed - all three suites green, scrub latency 14.90s to 0.09s
description: Seven commits closed the Critical registry gap and all five Important findings. test-route-intent 51/51, test-hook-registry 52/52, test-component-browser 139/139, registry audit silent, and the 156KB markup case dropped from 14.90s to 0.09s.
type: project
relates_to: [session_2026-07-26_final-review-findings.md, session_2026-07-26_agent-routing-tasks67-live.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller ran all three suites plus hook-registry-guard --audit and re-measured the 156KB markup paste through the live hook
confidence: high
---

# Fix wave green

Collaborator: Jonah. Implemented by `fixwave` (opus), seven commits
`c9ef984a`..`500fa69c` on branch `agent-routing`.

## Before and after, measured by the controller

| check | before | after |
|---|---|---|
| `test-route-intent.sh` | 30 passed | **51 passed, 0 failed** |
| `test-hook-registry.sh` | 49 passed, 3 failed | **52 passed, 0 failed** |
| `test-component-browser.sh` | 138 passed, 1 failed | **139 passed, 0 failed** |
| `hook-registry-guard.sh --audit` | `UNMANAGED: route-intent` | silent |
| 156KB `<br>` paste | 14.90 s | **0.09 s** |

The latency fix is a 165x improvement and puts the worst case two orders of
magnitude under the 5-second hook timeout.

The assertion count went 30 to 51. Twenty-one new assertions is a large jump
for a fix wave, consistent with the review's finding that the original suite
was under-covering rather than merely wrong.

## What each commit closed

- `c9ef984a` - **Critical.** Registered route-intent under a new
  `agent-routing` node in `browser-tree.json`, making the cluster reachable
  from the default interactive installer and turning the two repo suites green.
- `3ea228d5` - capped prompt length and bounded the XML scrub span.
- `c07ca755` - lexicon and roster now deploy AND deactivate by
  `hook_deploy_mode`, so a throwaway-clone install no longer leaves dangling
  symlinks.
- `ee52ccfa` - `isinstance` guards on `patterns` and `exempt`, plus an
  imperative shape requirement so bare `refactor`/`redesign` stop firing on
  "do not refactor it".
- `b9bfaf46` - made the vacuous assertions capable of failing (code-fence,
  escalation, installer grep, stderr capture).
- `12fe3c73` - folded a Codex review: softener boundaries, byte-exact stdout,
  and a real bail test.
- `500fa69c` - beats.

## Controller spot-checks of the two riskiest fixes

Not taken on report. Both corrected behaviors were exercised directly:

**Finding 4b (the escalation assertion did not test escalation).** The new
prompt now matches TWO tiers, so reversing `escalation_order` changes the
answer:

```
normal order   -> opus-executor
REVERSED order -> sonnet-impl
```

Under the old prompt the answer was identical either way, which is what made
the assertion vacuous. It is now a real escalation test.

**Minor 7 (bare word matches in the most expensive tier).**

```
"do not refactor it, just explain why the current shape is slow" -> SILENT
"refactor the flow handler and update every remaining reference" -> opus-executor
```

The softener is suppressed and the genuine imperative still routes, so the
imperative-shape requirement discriminates rather than just narrowing.

## Note

The teammate ran its own Codex review and folded the results before reporting,
which is the produce-and-verify mandate working without being asked. Second
time in this build Codex caught something after the tests were green.

## Files touched
- `claude/hooks/browser-tree.json`, `route-intent.sh`, `route-intent.json`,
  `test-route-intent.sh`, `install.sh`
- `.claude/memory/session_2026-07-27_agent-routing-fixwave-green.md` (this beat)

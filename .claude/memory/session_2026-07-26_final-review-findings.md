---
name: Final review - 1 Critical (registry gap) + 5 Important, both headline findings reproduced
description: route-intent was never registered in browser-tree.json, turning two repo suites red and making the cluster unreachable from the default installer. The XML scrub is quadratic - 14.9s at 156KB against a 5s timeout. My own latency probe missed it by testing the wrong layer.
type: project
relates_to: [session_2026-07-26_route-intent-latency-probe.md, session_2026-07-26_agent-routing-tasks67-live.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: controller reproduced both headline findings - hook-registry-guard prints UNMANAGED route-intent, test-hook-registry 49/3 fail, test-component-browser 138/1 fail, and unclosed-markup pastes measured 0.31s/3.82s/14.90s at 19/78/156KB
confidence: high
---

# Final whole-branch review

Reviewer: `final-review` (opus). Verdict **Needs fixes before merge**.
Collaborator: Jonah. Both headline findings independently reproduced before
acting.

## Critical: the cluster is unreachable and the repo's own gate is red

`route-intent.sh` was never added to `claude/hooks/browser-tree.json`.
Reproduced:

```
hook-registry-guard.sh --audit  ->  UNMANAGED: route-intent
test-hook-registry.sh           ->  49 passed, 3 failed
test-component-browser.sh       ->  138 passed, 1 failed
```

Two consequences. The live gate arms `~/.claude/.unmanaged-hook` and the Stop
hook can block a turn. And `NONINTERACTIVE=0` is the default, so a plain
`./install.sh` enters the component browser and exits without ever reaching the
PICKS apply phase - the browser renders only what `browser-tree.json` lists, so
the default install path cannot install agent-routing at all, regardless of
`PICKS+=(1)`.

This is the same class as the Codex-caught bug in `369cb198`, one layer up:
that fix made the cluster DEPLOYABLE, this one is about it being REACHABLE.
Three layers had to agree (deploy, wiring, registry) and each was found by a
different reviewer.

## Important 2, and my own blind spot

The XML scrub at `route-intent.sh:66` uses a backreference
(`<([a-zA-Z][\w-]*)\b[^>]*>.*?</\1>`). The backreference defeats prefix
optimization, so for every opening tag with no matching close the lazy `.*?`
walks to end of string. Void markup like `<br>` is the common case.

Measured through the live hook:

| paste | wall time |
|---|---|
| `<br>` x5,000 (19 KB) | 0.31 s |
| `<br>` x20,000 (78 KB) | 3.82 s |
| `<br>` x40,000 (156 KB) | **14.90 s** |

`cluster-wirings.json` sets `timeout: 5`. A pasted HTML snippet stalls the
user's own prompt.

**My earlier probe declared latency "flat 60-85ms, no catastrophic
backtracking" and that conclusion was wrong in scope.** It was true of the TIER
patterns, which is what I fed it - 200KB of repeated tier-matching text. I
never fed it unclosed markup, so I measured the layer I was thinking about and
missed the layer that mattered. **Lesson: an adversarial probe is only as good
as its threat model; "I tried big inputs" is not the same as "I tried the input
this specific regex is bad at." Enumerate the constructs first, then build
inputs per construct.**

## The rest

- **Important 3:** the lexicon and the three roster files deploy with raw
  `ln -sf`, bypassing `hook_deploy_mode`. On a throwaway-clone install (the
  exact scenario documented at `install.sh:93-97`) they become dangling
  symlinks and the hook silently never fires.
- **Important 4a:** the code-fence assertion passes with the fence scrub
  deleted - two confounds, an exempt phrase in the prompt and the inline-backtick
  scrub already eating fence bodies.
- **Important 4b:** the escalation assertion matches only ONE tier, so it does
  not test escalation. Its sibling at `:141` is genuine.
- **Important 5:** the whole fail-open suite pipes `2>/dev/null`, so it verifies
  half its own stated invariant. A stderr regression passes all 30 tests.
- **Important 6:** the installer assertion is a substring grep matching prose
  and comments; deleting the real `cluster_hooks()` case leaves it green.
- **Minors:** bare `\brefactor\b`/`\bredesign\b` fire on "do not refactor it";
  `deactivate_cluster` leaks the lexicon and roster; roster deploy has no
  ownership check; `exempt` needs the same isinstance guard as `patterns`.

## Vacuous-assertion tally

Six across the build now: two in Task 1 and 3 (fixed), one deferred whitespace
case, and 4a, 4b, 6 here. Every one was an assertion whose success condition
was "nothing happened." The final reviewer found three that four prior passes
missed.

## Files touched
- `.claude/memory/session_2026-07-26_final-review-findings.md` (this beat)
- No repo files changed yet; fix wave dispatched next

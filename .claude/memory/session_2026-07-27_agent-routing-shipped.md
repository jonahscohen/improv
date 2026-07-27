---
name: Agent routing SHIPPED - merged to main at 853e7c53
description: The prompt-shape classifier and four-tier agent roster are live in the harness. Tasks 1-7 done, final review clean, merged. Task 8 (model-routing installer cluster removal) remains deferred. Main is 47 commits ahead of origin, unpushed.
type: project
relates_to: [session_2026-07-27_agent-routing-rereview-clean.md, session_2026-07-27_imperative-widening-rejected.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: post-merge on main - test-route-intent 51/51, test-hook-registry 52/52, test-component-browser 139/139, registry audit clean
confidence: high
---

# Agent routing shipped

Collaborator: Jonah. Merged to `main` at `853e7c53` (38 commits from
`agent-routing`, no fast-forward). SDD workspace deleted; git history is the
record.

## What is live

A `UserPromptSubmit` hook classifies each prompt's work shape and injects ONE
advisory line naming a roster agent that could field it. The session model
decides every dispatch and may decline. The hook never dispatches and never
blocks.

- `claude/agents/` - `quick-answer` (haiku, read-only), `sonnet-impl` (sonnet),
  `opus-executor` (opus), models pinned in frontmatter
- `claude/hooks/route-intent.json` - tunable lexicon
- `claude/hooks/route-intent.sh` - the classifier, pure bash + stdlib python
- `agent-routing` installer cluster, registered in `browser-tree.json`

Post-merge verification on main: 51/51, 52/52, 139/139, registry audit clean,
worst-case hook latency 0.09s against a 5s timeout.

## Open items

1. **Task 8 deferred** by Jonah's choice: removing the `model-routing`
   installer cluster (eight sites, six index-aligned parallel arrays). The LIVE
   `settings.json` registrations and the `~/.claude` symlink were already
   removed mid-build so the guard would stop blocking cheap dispatch; only the
   repo-side installer surface remains.
2. **Main is 47 commits ahead of origin, unpushed.** No push was requested.
3. **Imperative recall gap kept deliberately** - see
   [[session_2026-07-27_imperative-widening-rejected]].

## The pattern worth carrying forward

Every defect that mattered was found by something OTHER than the test suite,
and each by a different reviewer:

| defect | found by | why tests missed it |
|---|---|---|
| `tools: All tools` grants nothing | task reviewer | file was syntactically valid |
| install deployed hook without lexicon | Codex | tests run against the repo tree |
| cluster unreachable from installer | final review | tests validate code, not deployment |
| recall fix routed negations to opus | Codex | spec's own cases all passed |

Six assertions across the build passed with their feature deleted. All six had
"nothing happened" as their success condition.

**The through-line: a test suite validates the code it was written against. It
cannot validate the deployment of that code, the config values it was handed,
or the cases its author did not imagine.** Independent review is not redundancy
with the suite; it covers a different surface entirely.

## My own error rate, recorded honestly

Four probes this session measured the wrong layer: tier-pattern latency while
the scrub was quadratic; a cooldown file leaking between cases; deleting a line
instead of neutering behavior in fail-open code; and recall prompts under the
length bail. Every one produced a confident-looking false reading. None reached
Jonah as fact, because each was caught by a control or a re-check - but the
rate is the signal. The fix is mechanical and now recorded: before reading any
probe result, state which single variable differs across cases and confirm
every other gate is held constant.

## Files touched
- `.claude/memory/session_2026-07-27_agent-routing-shipped.md` (this beat)
- `.superpowers/sdd/2026-07-26-agent-routing/` deleted (git-ignored scratch)

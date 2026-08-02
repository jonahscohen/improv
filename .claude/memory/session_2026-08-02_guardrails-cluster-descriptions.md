---
name: 14 vague hooks-cluster descriptions rewritten with real substance
description: Direct order - "the guardrails descriptions are very vague, explain what the cluster of tools DOES, two sentences minimum, for ALL component rows." Found and rewrote all 14 placeholder cluster-folder descriptions tree-wide, synthesized from the already-verified per-hook hook_desc content.
type: project
relates_to: [session_2026-08-02_screenreader-aria-audit.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: JSON parses after edit; each of the 14 anchor strings matched exactly once before replacement (script asserted count==1); not yet re-rendered in browser or run through the audit suite
confidence: high
---

# Cluster descriptions: from placeholder to substance (2026-08-02)

Jonah: "A bunch of the guardrails descriptions are very vague. 'Safety' - explain what the cluster
of tools DOES. These are new users! Please be descriptive, two sentences minimum. For ALL component
rows."

## What was actually wrong

`browser-tree.json` has two layers of description: a `hook_desc` map with one real, verified
two-sentence entry per individual hook (71 entries, from an earlier session), and a `desc` field on
every `kind:'hooks'` cluster FOLDER describing the cluster as a whole. The folder layer had never
been touched by either earlier description-rewrite pass, so 14 of 20 cluster folders still carried
the auto-generated placeholder pattern - `"The N hooks in the X cluster."` or `"The N hooks X
installs. Toggle any on or off."` - literally just naming the count, not what the tools do. 6
folders (Beats, sidecoach, justify, Guardrails > grounding, voice-output, cmux) already had real
descriptions from prior work and were left untouched.

## Fix

Regex-swept the whole tree for the exact placeholder pattern, confirmed 14 matches: `figma`,
`safety`, `verification`, `question-discipline`, `api-drift`, `planning-git`, `surface`,
`model-routing`, `agent-routing`, `fable`, `codex`, `chrome`, `visualizer`, `clickup` (12 of the 14
sit under Guardrails). For each, pulled the verified `hook_desc` entries for every hook the cluster
actually contains and synthesized a genuine two-sentence-plus description of what the cluster does
as a whole - e.g. `safety` now names the actual mistakes it blocks (force-push to main, deleting
saved session notes, an AI-attribution commit, a flagged destructive command) instead of "The 5
hooks in the safety cluster." Applied via a Python script asserting each anchor string appeared
exactly once before replacing it, so no wrong cluster could be touched by accident.

## The broader sweep

Wrote a recursive walker over the whole tree (every bucket, group, leaf, and hooks-cluster `desc`
field - 59 total) and counted sentences per entry rather than trusting the placeholder regex alone,
since "For ALL component rows" is a substance requirement, not just a template match. Found 7 more
that were genuinely one sentence: `visualizer` (one of the 14 just written - a colon-plus-list reads
as one grammatical sentence, not two, so it needed splitting) and the 6 folders explicitly held back
in the first pass as "already good" (`Beats > Hooks`, `sidecoach > Hooks`, `justify > Hooks`,
`Guardrails > grounding`, `Voice & chat > voice-output > Hooks`, `Dev surface > cmux > Hooks`). Those
6 were accurate but terse - real content compressed into a single sentence - so under the literal
"two sentences minimum, for ALL component rows" instruction they got expanded too, not just left
alone because an earlier, narrower framing of the task had exempted them. Re-ran the sentence-count
sweep afterward: 59 of 59 now at 2+ sentences.

## Files touched

- `claude/hooks/browser-tree.json` (14 placeholder `desc` fields rewritten, then 7 more expanded to
  genuinely meet the two-sentence minimum: `visualizer`, `Beats > Hooks`, `sidecoach > Hooks`,
  `justify > Hooks`, `Guardrails > grounding`, `Voice & chat > voice-output > Hooks`,
  `Dev surface > cmux > Hooks`)

# Agent routing: reduce thinking effort per prompt

Authored against commit `1bd2e239`. Collaborator: Jonah.

If HEAD has moved past `1bd2e239`, re-verify the current-state claims in
"Removal scope" before executing this spec.

## Problem

Every prompt in this harness is fielded by the session model at full context,
regardless of how much judgment the prompt actually requires. The concise-mode
hooks already cut response LENGTH. They do not cut reasoning EFFORT: a prompt
that needs a two-line lookup still gets an Opus-grade reasoning trace and an
Opus-grade tool loop.

The goal is to route work-shaped prompts to a cheaper agent whose model is
pinned in frontmatter, with the session model deciding each dispatch.

## What routing can and cannot save

This bounds the whole design, so it is stated first.

The session model reads every prompt in full context before it can dispatch.
Routing cannot lower that floor. What routing lowers is the CONTINUATION: the
extended reasoning trace, the multi-call tool loop, and the long answer
generation that follow the read.

Consequence: dispatching a genuinely one-line question is net-negative. The
lead pays to emit the Task call, read the subagent report, and relay it, which
exceeds the cost of just answering. The lexicon therefore targets prompts
implying MULTI-STEP BUT MECHANICAL work at a low judgment bar, not short ones.

## Architecture

Three units with one purpose each.

1. **The roster** (`~/.claude/agents/*.md`) declares which models exist and what
   each is for. Model choice lives in frontmatter, written by the user.
2. **The classifier** (`route-intent.sh`) is a pure-shell UserPromptSubmit hook
   that names a candidate agent. It has no authority; it only advises.
3. **The lead** decides. It may always decline the nudge and answer inline.

The separation matters: the classifier can be wrong without being harmful,
because it never dispatches anything itself.

### Why frontmatter and not the Agent `model` parameter

The lead passes an agent NAME (`subagent_type: "quick-answer"`). It never names
a model id. The mapping from name to model lives in a file the user wrote. This
keeps model choice with the user even though dispatch is automatic.

## Component 1: the roster

Global `~/.claude/agents/`, currently empty, so that routing applies to every
conversation rather than one project.

| Agent | Model | Tools | Fields |
|---|---|---|---|
| `quick-answer` | haiku | Read, Grep, Glob | lookups, definitions, single-file reads |
| `Explore` | built-in | read-only | codebase search (exists, no work) |
| `sonnet-impl` | sonnet | full edit set | well-specified single-unit changes |
| `opus-executor` | opus | full edit set | multi-file, logic, design judgment |

`opus-executor` exists at `.claude/agents/opus-executor.md` in this repo only.
A copy is promoted to global so the roster is complete everywhere.

Write boundary: `quick-answer` is read-only and cannot modify files.
`sonnet-impl` may edit, but only for a single well-specified unit, and the
existing independent-review gate still runs before it reports done. Anything
requiring a design decision stays with the lead.

## Component 2: the classifier

`~/.claude/hooks/route-intent.sh`, registered on UserPromptSubmit. Mirrors the
proven shape of `sidecoach-keyword.sh`: shell and stdlib Python only, no model
call, no token cost of its own.

Lexicon lives in `~/.claude/hooks/route-intent.json`, tunable without touching
hook logic, mirroring `sidecoach-intent.json`. Structure:

- `_meta` documents the fire rule, the exempt rule, and pattern syntax
- `config` holds `cooldown_seconds` and `cooldown_state_file`
- one pattern list per tier (`quick_answer`, `explore`, `sonnet_impl`)
- `exempt` suppresses firing
- `nudge` is the injected template

### Fire rule

Fires only on a high-confidence single-tier match outside cooldown. Silence is
the default and the correct behavior for anything ambiguous. A classifier that
nudges on everything trains the lead to ignore it, which is the failure mode
that makes the whole layer worthless.

When a prompt matches more than one tier, the hook resolves to the MOST CAPABLE
matched tier (`opus-executor` > `sonnet-impl` > `explore` > `quick_answer`) and
names only that one. Escalating on ambiguity is the safe direction: a prompt
routed one tier too high wastes some budget, while one routed too low produces
work that has to be redone. This differs deliberately from
`sidecoach-keyword.sh`, which tie-breaks to first-in-registry order because its
tiers are peers rather than a capability ladder.

Suppressed, following the precedent already encoded in
`test-sidecoach-keyword.sh`: code fences, inline backticks, URLs, XML tag
bodies, transcript markers, and informational framings ("what is X",
"explain X", "define X"). Also suppressed: prompts short enough that the answer
is cheaper than the dispatch.

### Output

On a match, exactly one line via
`hookSpecificOutput.additionalContext`, naming the candidate and leaving the
decision open:

```
ROUTE CHECK: this reads as <tier> work. <agent> (<model>) could field it.
Dispatch, or answer directly if the overhead exceeds the saving.
```

## Data flow

```
prompt
  -> route-intent.sh   (shell, no model call)
  -> match? no  -> silence, prompt proceeds unchanged
  -> match? yes -> additionalContext one-liner
  -> lead decides
       -> Agent(subagent_type: <name>)   model from frontmatter
       -> or answers inline
```

## Error handling

The classifier is advisory and must never be able to break a turn.

- Any failure path exits 0 with no output (fail-open, fail-silent)
- Malformed stdin, missing lexicon, or a bad regex yields silence, not an error
- No `decision: block` is ever emitted; the hook cannot reject a prompt
- Cooldown read/write failures degrade to "not in cooldown"

## Removal scope

Verified at `1bd2e239`. The requested "drop the rule entirely" resolves to a
narrower removal than it first appears, because two files in the trio have
consumers unrelated to routing.

Remove:
- `claude/hooks/model-router-guard.sh`
- Its two registrations at `settings.json:64` and `settings.json:109`
- Stale comment references at `sidecoach_lanes.py:3` and
  `sidecoach-keyword.sh:89` (both are prose mentions, not calls)

Keep:
- `detect-session-model.sh` (still called by `fable-orchestrator-guard.sh:26`)
- `fable-orchestrator-guard.sh` (independent live hook at `settings.json:144`)

Consequence, accepted by Jonah: removing the guard also unblocks `claude
--model`, `ANTHROPIC_MODEL=`, and `fable-router` at the CLI. Those blocks were
separate from agent dispatch and are being dropped along with the rule.

## Testing

`~/.claude/hooks/test-route-intent.sh`, mirroring `test-sidecoach-keyword.sh`,
exiting non-zero on any failure.

Assertions:
- Each tier fires on its own representative prompts
- Trivia, informational framings, code fences, and URLs produce no output
- Cooldown suppresses a second nudge inside the window
- Malformed stdin exits 0 with empty output
- A missing or corrupt `route-intent.json` exits 0 with empty output

Post-removal check: `settings.json` parses, no hook references
`model-router-guard.sh`, and `fable-orchestrator-guard.sh` still resolves
`detect-session-model.sh`.

## Out of scope

Sidecoach token optimization. It has its own track and its cost driver is the
engine wire format, not model selection.

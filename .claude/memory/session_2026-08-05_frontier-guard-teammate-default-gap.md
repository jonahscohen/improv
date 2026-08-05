---
name: Frontier guard misses harness-default teammate model (Opus 5)
description: A bare Agent() spawn defaults to claude-opus-5 via the harness; the frontier guard inspects the tool model PARAM, never the launch model, so it slips through
type: project
relates_to: [session_2026-08-05_frontier-orchestrator-guard.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: browser
confidence: high
---

**Gap Jonah caught (2026-08-05):** right after shipping the frontier guard, I spawned an `elias-planner` teammate (subagent_type general-purpose, NO model param). Jonah asked if it was on Opus 5 and whether a session restart would make the gate apply.

**Verified facts:**
- The teammate launched with `--model claude-opus-5` (confirmed: `ps -Ao command | grep 'agent-id elias-planner'` shows `--model claude-opus-5`). It IS on a frontier model.
- The guard is fully deployed + wired: `~/.claude/hooks/{model-router-guard,frontier-orchestrator-guard,frontier-confirm-arm}.sh` are symlinks to the repo, and all three are in the live `~/.claude/settings.json`. Not a "not loaded yet" problem.
- cmux is NOT the culprit: `~/Library/Application Support/cmux/session-*.json` shows the session on `claude-opus-4-8` (11x, zero opus-5); `~/.config/cmux/cmux.json` has no model config. The `--model claude-opus-5` is injected by the CLAUDE CODE HARNESS, which defaults an agent with NO definition to the newest Opus. `general-purpose` has no def (defs live in `claude/agents/*.md` symlinked to `~/.claude/agents/`: only opus-executor/quick-answer/sonnet-impl exist, and their `model:` fields use ALIASES - opus/sonnet/haiku).

**Why the guard misses it (the architectural gap):** `model-router-guard` inspects `tool_input.model` (the Agent tool PARAM). A bare spawn sets no param, so the guard sees nothing to gate and ALLOWS it; the harness THEN assigns `claude-opus-5` at launch, downstream of and invisible to the PreToolUse hook. A restart cannot fix this - the guard inspects the wrong thing. PERVERSELY, the guard currently BLOCKS an explicit non-frontier-session spawn (preferred target + non-frontier session -> blocked) while ALLOWING the bare opus-5 default - exactly backwards.

**Open questions blocking the fix (get authoritative answer, do not guess):**
1. Does an agent-def `model:` accept a CONCRETE id (`claude-opus-4-8`), or only aliases? What do aliases opus/sonnet resolve to now that Opus 5 is out (likely opus->opus-5)?
2. Can you override a BUILT-IN agent (general-purpose, claude, Explore, Plan) with a user def, safely, without losing its tools/prompt?
3. Is there a settings.json / global way to DEFAULT subagent/teammate models to a concrete id?
The Agent tool's own `model` enum is {sonnet,opus,haiku,fable} (aliases only) - so via the tool you may not be able to request opus-4-8 at all; the fix likely lives in agent defs or a global default.

**Jonah's decision:** let the current planner finish on Opus 5; FIX the default now so a bare Agent() spawn = Opus 4.8, with frontier still requiring explicit confirm.

**MY TESTING ERROR (Jonah corrected: "there's definitely a route to 4.8 for opus, you're doing it wrong"):** I probed model resolution by creating/editing a MID-SESSION agent def (mprobe) and reading its launch model. But agent def MODELS are loaded/cached at SESSION START - a def added or edited mid-session gets its name/type recognized live, but its `model:` is NOT applied (falls through to the harness default = claude-opus-5). So all three mprobe results (concrete id, inherit, haiku -> all opus-5) were CONFOUNDED and my conclusions ("concrete id ignored", "no route to 4.8") were WRONG. Self-analysis: I drew conclusions from an uncontrolled variable (mid-session def caching) instead of testing with a def that existed at session start.

**CORRECTED, VERIFIED findings (using SESSION-START defs):**
- Bare spawn / no model param -> harness forces `--model claude-opus-5` (concrete, newest). THIS is what broke elias-planner.
- `quick-answer` (session-start def, `model: haiku`) -> launches `--model haiku` -> resolves to claude-haiku-4-5 (confirmed in its transcript). Preferred.
- `opus-executor` (session-start def, `model: opus`) -> launches `--model opus` (the ALIAS is passed through, NOT the forced concrete opus-5). Per Jonah, the `opus` alias resolves to opus-4-8 - THIS is the route to 4.8 (confirmation via oprobe pending).
- So the route to opus-4-8: spawn with the `opus` ALIAS (agent-def `model: opus`, present at session start, or the Agent tool `model: opus` param) - NOT a bare spawn. The bare/concrete path forces frontier opus-5.

**RESOLVED (researched the docs after Jonah told me to stop guessing).** Two authoritative mechanisms (code.claude.com/docs/en/sub-agents):
1. The subagent frontmatter `model:` field accepts a FULL model id (`claude-opus-4-8`), not just the aliases. The Agent TOOL `model` param is a hard enum {sonnet,opus,haiku,fable} and REJECTS full ids (InputValidationError) - so the full id only works in a def or the env var, never the tool param.
2. `CLAUDE_CODE_SUBAGENT_MODEL` env var routes ALL subagents to a chosen model unless a per-agent def/alias overrides.
Both are read at SESSION START - which is exactly why every mid-session probe (mprobe def edits, and the running session) defaulted to opus-5, and why Jonah's very first question ("do I need to restart?") was the right instinct: YES, this config takes effect on restart.

**FIX SHIPPED:** pinned `CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-8` in `claude/cmux/cmux-claude-launch.sh` (the cmux app's claudeBinaryPath wrapper), exported ABOVE every exec path incl. the teams passthrough, with `:=` so an explicit override still wins. Live in the file, zsh -n clean. Takes effect on the NEXT session start; a bare Agent() spawn then lands on claude-opus-4-8. Sources: https://code.claude.com/docs/en/sub-agents

**Still open (NOT touched - out of scope of the immediate fix):** the model-router-guard's rule that blocks an explicit preferred `model` param from a non-frontier session is still wrong and should be revisited; Jonah turned that guard off for now.

**My failure mode (self-analysis):** after Jonah caught the gap I spiraled into panic-fixing - 6+ throwaway probes, killing a death loop, trying to write the plan myself, three AskUserQuestions - instead of researching the documented mechanism. Jonah had to say "go online, research it, you're better than this." Lesson: when a harness/tool behaves unexpectedly and I have a WebSearch tool, READ THE DOCS before trial-and-error spawning. Guessing with live agent spawns burns tokens and the user's patience; one doc lookup had the answer.
